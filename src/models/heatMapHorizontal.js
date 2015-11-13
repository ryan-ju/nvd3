nv.models.heatMapHorizontal = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    // General Settings
    var margin = {top: 30, right: 20, bottom: 20, left: 20}
        , width = null
        , height = null
        , noData = null
        , duration = 250
        , dispatch = d3.dispatch('cellEnter', 'cellLeave', 'cellClick', 'chartRemove', 'renderEnd')
        ;

    // Chart Specific Settings
    var
    // Int.
        cellSize = 12
    // Int.  The number of cells per column.
        , numCellsPerColumn = 12
    // Array.  The size should be equal to numCellsPerColumn.
        , rowNames = d3.range(0, 12).map(function(i) { return 'row' + i; })
    // Array.  Should be equal to the range of groupDivider.
        , groupNames = d3.range(0, 10).map(function(i) { return 'group' + i; })
    // Array.  Should be equal to the range of chartDivider.
        , chartNames = d3.range(0, 2).map(function(i) { return 'chart' + i; })
    // function(dataItem): Int.  E.g., for a heat map with each cell being a day, cellHorizontalIndex can return the week of the year.
        , cellHorizontalIndex = function(d) { return Math.floor(d / 12) - Math.floor(Math.floor(d / 500) * 500 / 12); }
    // function(dataItem): Int.  E.g., for a heat map with each cell being a day, cellVerticalIndex with range [0..6] makes each column a week.
        , cellVerticalIndex = function(d) { return d % 12; }
    // Array.  Used to get values from data.
        , dataDomain = d3.range(0, 1000)
    // function(domainValue): String.  E.g., a date formatter.
        , dataDomainFormat = function(d) { return d; }
    // Used as default value for domain values not in data.
        , defaultValue = 0
    // The type of scale.
        , colorScaleType = d3.scale.linear()
    // Array.  Color range for the heat map.
        , colorRange = [d3.rgb(255,255,255), d3.rgb(165,0,38)]
    // function(dataItem): chartName.  Used to divide data into different heat map charts.
        , chartDivider = function(d) { return Math.floor(d / 500) }
    // function(dataItem): groupName.  Used to show group boundaries.  If null, then no group boundary will be shown.
        , groupDivider = function(d) { return Math.floor(d / 100)}
    // Tooltip when mouse moves over a cell.
        , tooltip = nv.models.tooltip()
    // function(data, index): Unit.  Function to call when cell is clicked.
        , cellClick = function(d, i) {}
        ;

    //============================================================
    // Private Variables and Setup
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    tooltip
        .duration(0)
        .headerEnabled(false)
        .snapDistance(cellSize)
        .valueFormatter(function(d, i) {
            return d3.format(',.0f')(d, i);
        });

    function chart(selection) {
        renderWatch.reset();

        chart.selection = selection;

        selection.each(function(data) {
            // Create color scale for cells.
            var colorScale = colorScaleType
                .domain(d3.extent(collectPropertyValues(data)))
                .range(colorRange)
                .interpolate(d3.interpolateLab);

            // Initialize container.
            var container = d3.select(this);
            nv.utils.initSVG(container);
            container = container
                .append('g')
                .attr('class', 'nvd3 nv-wrap nv-heatMapHorizontal');

            // Update function.
            chart.update = function() { container.transition().call(chart); };

            //var availableWidth = nv.utils.availableWidth(width, container, margin),
            //    availableHeight = nv.utils.availableHeight(height, container, margin);

            // Display No Data message if there's nothing to show.
            if (!data) {
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Divide dataDomain into charts with chartDivider.  Returns [{key: "chart1", values: [key1, key2, ...]}, ...].
            var wrap = container
                // Leave the correct margin.
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                .selectAll('g.nv-heatMapChart')
                .data(d3.nest().key(chartDivider).entries(dataDomain));

            // Each g is a chart.
            var chartG = wrap
                .enter()
                .append('g')
                .attr('class', 'nv-heatMapChart')
                // Each chart needs to be below the previous chart.
                .attr('transform', function(d, i) { return 'translate(0,' + (i * (numCellsPerColumn + 2) * cellSize) + ')'; });

            // Draw chart label.
            var chartGLabel = chartG
                .append('text')
                .attr('class', 'nv-heatMapChartLabel')
                // The chart label is rotated 90 degrees anti-clockwise and placed at (0, chart height / 2).
                .attr('transform', 'translate(0,' + numCellsPerColumn * cellSize / 2 + ')rotate(-90)')
                .text(function(d, i) { return chartNames[i]; });

            // Get bounding box for chartGLabel.
            var chartGLabelBB = chartGLabel.node().getBBox();
            // Use height because the element is rotated -90 degrees.
            var chartGLabelRB = chartGLabelBB.x + chartGLabelBB.height;

            // Draw row labels.
            var chartGRowLabel = chartG.selectAll('text.nv-heatMapRowLabel')
                .data(rowNames)
                .enter()
                .append('text')
                .attr('class', 'nv-heatMapRowLabel')
                // The row label is placed at (chartGLabel.width, 3/4 of row it corresponds to)
                .attr('transform', function(d, i) { return 'translate(' + chartGLabelRB + ',' + (cellSize * (i + 3 / 4)) + ')'; })
                .text(function(d) { return d; });

            // Container for chart body.
            var chartGBody = chartG
                .append('g')
                .attr('class', 'nv-heatMapChartBody')
                // The chart body is shift by chartGLabel.width + max(chartGRowLabel.width) to the right.
                .attr('transform', 'translate(' + (chartGLabelRB + getMaxWidth(chartGRowLabel) + cellSize / 2) + ',0)');

            // Draw each cell.
            var chartGBodyCell = chartGBody
                .selectAll('.nv-heatMapCell')
                .data(function(d) { return d.values; })
                .enter()
                .append('rect')
                .attr('class', 'nv-heatMapCell')
                .attr('width', cellSize)
                .attr('height', cellSize)
                .attr('x', function(d) { return cellHorizontalIndex(d) * cellSize; })
                .attr('y', function(d) { return cellVerticalIndex(d) * cellSize; })
                .style('fill', function(d) { return colorScale(data[d] || defaultValue); });

            if (groupDivider !== undefined) {
                // Create group.
                var chartGGroup = chartGBody.selectAll(".nv-heatMapGroup")
                    .data(function (d) {
                        return d3.nest().key(groupDivider).entries(d.values).map(extractValues);
                    })
                    .enter()
                    .append('g')
                    .attr('class', 'nv-heatMapGroup');

                // Draw each group boundary.
                chartGGroup
                    .append('path')
                    .attr('class', 'nv-heatMapGroupBoundary')
                    .attr("d", groupPath);

                // The y translation for group labels.
                var chartGGroupLabelY = ((numCellsPerColumn + 1) * cellSize);

                // Draw group label.
                chartGGroup
                    .append('text')
                    .attr('class', 'nv-heatMapGroupLabel')
                    .attr('transform', function () {
                        // Get the bounding box for the boundary.
                        var bbox = d3.select(this.parentNode).select('.nv-heatMapGroupBoundary').node().getBBox();
                        // The group label is placed below the bottom-left corner of the boundary.
                        return 'translate(' + bbox.x + ',' + chartGGroupLabelY + ')';
                    })
                    .text(function (d, i) {
                        return groupNames[i];
                    })
            }

            // Event firing
            chartGBodyCell.on('mouseenter', function(d, i) {
                dispatch.cellEnter(d, i);
            });

            chartGBodyCell.on('mouseleave', function(d, i) {
                dispatch.cellLeave(d, i);
            });

            chartGBodyCell.on('click', function(d, i) {
                dispatch.cellClick(d, i);
            });

            // Event handlers
            dispatch.on('cellEnter.highlight', function(d, i) {
                var sel = d3.select(this);
                sel.style('fill', d3.rgb(sel.style('fill')).darker());
            });

            dispatch.on('cellEnter.tooltip', function(d, i) {
                var v = data[d] || defaultValue;
                var c = colorScale(data[d] || defaultValue);
                tooltip.data({
                    series: {
                        key: dataDomainFormat(d),
                        value: v,
                        color: c
                    }
                }).hidden(false);
            });

            dispatch.on('cellLeave.highlight', function(d, i) {
                d3.select(this).style('fill', function(d) { return colorScale(data[d] || defaultValue); });
            });

            dispatch.on('cellLeave.tooltip', function(d, i) {
                tooltip.hidden(true);
            });

            dispatch.on('cellClick', function(d, i) {
                cellClick();
            });
        });

        renderWatch.renderEnd('heatMapHorizontal immediate');
        return chart;
    }

    /**
     * Collects the values of data and returns them in an array.
     *
     * @param data          An object of the form {key0:value0, key1:value1, ...}.
     * @param defaultValue
     * @returns {*[]}       An array of [value0, value1, ...].
     */
    function collectPropertyValues(data, defaultValue) {
        var arr = [defaultValue];
        for (var prop in data) {
            if (data.hasOwnProperty(prop)) {
                arr.push(data[prop]);
            }
        }
        return arr;
    }

    /**
     * Returns the maximum width of elements in d3.selectAll().
     *
     * Note this implementation isn't thread safe, but since JS is single threaded, it's ok.
     *
     * @param selection     A d3.selectAll() value
     * @returns {*|number}
     */
    function getMaxWidth(selection) {
        var arr = [];
        selection.each(function(d) { return arr.push(d3.select(this).node().getBBox().width); });
        return d3.max(arr);
    }

    /**
     * Extract values from {values: ..., ...}.
     *
     * @param data
     * @returns {*}
     */
    function extractValues(data) {
        return data.values;
    }

    /**
     * Returns the boundary path for the group.
     *
     * @param data          An array of domain values belong to a group.
     * @returns {string}    The 'd' attribute of a path element.
     */
    function groupPath(data) {
        var ext = d3.extent(data);
        var min = ext[0];
        var max = ext[1];
        var x0 = cellHorizontalIndex(min), y0 = cellVerticalIndex(min),
            x1 = cellHorizontalIndex(max), y1 = cellVerticalIndex(max);
        return 'M' + (x0 + 1) * cellSize + ',' + y0 * cellSize
            + 'H' + x0 * cellSize + 'V' + numCellsPerColumn * cellSize
            + 'H' + x1 * cellSize + 'V' + (y1 + 1) * cellSize
            + 'H' + (x1 + 1) * cellSize + 'V' + 0
            + 'H' + (x0 + 1) * cellSize + 'Z';
    }

    chart._calls = {
        // Remove the chart with a fading out transition.  This also removes the tooltip if any.
        remove: function () {
            chart.selection
                .selectAll('.nv-heatMapHorizontal')
                .transition()
                .duration(500)
                .style('opacity', 0)
                .remove();
            d3.select(tooltip.chartContainer() ? tooltip.chartContainer() : document.body)
                .select('#' + tooltip.id())
                .transition()
                .duration(500)
                .style('opacity', 0)
                .remove();
            dispatch.chartRemove(chart);
        }
    };

    chart.options = nv.utils.optionsFunc.bind(chart);

    // use Object get/set functionality to map between vars and chart functions
    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        noData:         {get: function(){return noData;},         set: function(_){noData=_;}},

        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
        }},
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        cellSize: {get: function() { return cellSize; }, set: function(_) { cellSize = _; }},
        numCellsPerColumn: {get: function() { return numCellsPerColumn; }, set: function(_) { numCellsPerColumn = _; }},
        rowNames: {get: function() { return rowNames; }, set: function(_) { rowNames = _; }},
        groupNames: {get: function() { return groupNames; }, set: function(_) { groupNames = _; }},
        chartNames: {get: function() { return chartNames; }, set: function(_) { chartNames = _; }},
        cellHorizontalIndex: {get: function() { return cellHorizontalIndex; }, set: function(_) { cellHorizontalIndex = _; }},
        cellVerticalIndex: {get: function() { return cellVerticalIndex; }, set: function(_) { cellVerticalIndex = _; }},
        dataDomain: {get: function() { return dataDomain; }, set: function(_) { dataDomain = _; }},
        defaultValue: {get: function() { return defaultValue; }, set: function(_) { defaultValue = _; }},
        colorScaleType: {get: function() { return colorScaleType; }, set: function(_) { colorScaleType = _; }},
        colorRange: {get: function() { return colorRange; }, set: function(_) { colorRange = _; }},
        chartDivider: {get: function() { return chartDivider; }, set: function(_) { chartDivider = _; }},
        groupDivider: {get: function() { return groupDivider; }, set: function(_) { groupDivider = _; }},
    });

    nv.utils.initOptions(chart);
    return chart;
};