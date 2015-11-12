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
        , dispatch = d3.dispatch('renderEnd')
        ;

    // Chart Specific Settings
    var
    // Int.
        cellSize = 17
        , numCellsPerColumn = 12
        , rowNames = d3.range(0, 12).map(function(i) { return 'row' + i; })
    // function(dataItem): Int.  E.g., for a heat map with each cell being a day, cellHorizontalIndex can return the week of the year.
        , cellHorizontalIndex = function(d) { return Math.floor(d / 12) % Math.floor(500 / 12); }
    // function(dataItem): Int.  E.g., for a heat map with each cell being a day, cellVerticalIndex with range [0..6] makes each column a week.
        , cellVerticalIndex = function(d) { return d % 12; }
    // Array.  Used to get values from data.
        , dataDomain = d3.range(0, 1000)
    // Used as default value for domain values not in data.
        , defaultValue = 0
    // The type of scale.
        , colorScaleType = d3.scale.linear()
    // Array.  Color range for the heat map.
        , colorRange = [d3.rgb(255,255,255), d3.rgb(165,0,38)]
    // function(dataItem): chartName.  Used to divide data into different heat map charts
        , chartDivider = function(d) { return Math.floor(d / 500) }
    // function(dataItem): groupName.  Used to show group boundaries.  If null, then no group boundary will be shown.
        , groupDivider = function(d) { return Math.floor(d / 100)}
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    function chart(selection) {
        renderWatch.reset();

        selection.each(function(data) {
            // Create color scale for cells.
            var colorScale = colorScaleType
                .domain(d3.extent(collectPropertyValues(data)))
                .range(colorRange)
                .interpolate(d3.interpolateLab);

            var container = d3.select(this);
            nv.utils.initSVG(container);

            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            // Display No Data message if there's nothing to show.
            if (!data) {
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Divide dataDomain into charts with chartDivider.  Returns [{key: "chart1", values: [key1, key2, ...]}, ...].
            var wrap = container
                .append('g')
                .attr('class', 'nvd3 nv-wrap nv-heatMapHorizontal')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                .selectAll('g.nv-heatMapChart')
                .data(d3.nest().key(chartDivider).entries(dataDomain));

            // Each g is a chart.
            var chartG = wrap
                .enter()
                .append('g')
                .attr('class', 'nv-heatMapChart')
                .attr('transform', function(d, i) { return 'translate(0,' + (i * (numCellsPerColumn * cellSize + margin.bottom)) + ')'; });

            // Draw row labels.
            var chartGLabel = chartG.selectAll('text.nv-heatMapRowLabel')
                .data(rowNames)
                .enter()
                .append('text')
                .attr('class', 'nv-heatMapRowLabel')
                .attr('transform', function(d, i) { return 'translate(0,' + (cellSize * i + cellSize / 2) + ')'; })
                .text(function(d) { return d; });

            // Container for chart body.
            var chartGBody = chartG
                .append('g')
                .attr('class', 'nv-heatMapChartBody')
                .attr('transform', 'translate(' + (getMaxWidth(chartGLabel) * 1.2) + ',0)');

            // Draw each cell.
            chartGBody
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

            // Draw each group boundary.
            chartGBody.selectAll(".nv-heatMapGroup")
                .data(function(d) { return d3.nest().key(groupDivider).entries(d.values).map(extractValues); })
                .enter()
                .append('path')
                .attr('class', 'nv-heatMapGroup')
                .attr("d", groupPath);
        });

        renderWatch.renderEnd('timeHeatMap immediate');
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

    chart.options = nv.utils.optionsFunc.bind(chart);

    // use Object get/set functionality to map between vars and chart functions
    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        noData:         {get: function(){return noData;},         set: function(_){noData=_;}},

        // options that require extra logic in the setter
        //color: {get: function(){return color;}, set: function(_){
        //    color = _;
        //    legend.color(color);
        //    pie.color(color);
        //}},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
        }},
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }}
    });

    nv.utils.initOptions(chart);

    return chart;
};