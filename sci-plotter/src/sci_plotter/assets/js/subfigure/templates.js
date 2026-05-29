/**
 * 子图模板定义
 * 每个模板是一个函数，接收数据对象和配置，返回 ECharts option
 */

const ChartTemplates = {

    _resolveColName(data, mappedName, fallbackCols, index) {
        if (mappedName && data.headers.includes(mappedName)) return mappedName;
        return fallbackCols[index]?.name ?? null;
    },

    _colInfo(data, colName) {
        if (!colName) return null;
        const index = data.headers.indexOf(colName);
        return index >= 0 ? { name: colName, index } : null;
    },

    /**
     * 散点图（支持分组着色）
     */
    scatter(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        if (numericCols.length < 2) {
            return this._errorOption('散点图需要至少两列数值数据');
        }

        const m = config.columnMapping || {};
        const xName = this._resolveColName(data, m.x, numericCols, 0);
        const yName = this._resolveColName(data, m.y, numericCols, 1);
        const xCol = this._colInfo(data, xName);
        const yCol = this._colInfo(data, yName);
        if (!xCol || !yCol) {
            return this._errorOption('无法确定 X/Y 数据列');
        }

        const xData = CSVParser.getColumn(data, xCol.name);
        const yData = CSVParser.getColumn(data, yCol.name);

        const groupName = m.group ? this._resolveColName(data, m.group, catCols.length ? catCols : numericCols, 0) : null;
        const groupCol = groupName ? this._colInfo(data, groupName) : null;

        const errorBar = config.errorBar;
        const series = [];
        let _trendLineGraphic = undefined;

        if (groupCol) {
            const groups = {};
            data.rows.forEach((row, i) => {
                const xv = row[xCol.index];
                const yv = row[yCol.index];
                const gv = row[groupCol.index] ?? 'Default';
                if (xv === null || yv === null) return;
                if (!groups[gv]) groups[gv] = [];
                groups[gv].push([xv, yv, i]);
            });

            const groupNames = Object.keys(groups);
            groupNames.forEach(gName => {
                const pts = groups[gName];
                series.push({
                    name: gName,
                    type: 'scatter',
                    data: pts.map(p => [p[0], p[1]]),
                    symbolSize: 10,
                    itemStyle: { opacity: 0.8 },
                });
            });

            if (errorBar && errorBar.enabled) {
                const allSeriesData = xData.map((x, i) => [x, yData[i]]);
                const yErrData = this._computeErrorData(data, yData, errorBar, 'y');
                const xErrData = this._computeErrorData(data, xData, errorBar, 'x');
                const errorSeriesData = [];
                for (let i = 0; i < allSeriesData.length; i++) {
                    const [xv, yv] = allSeriesData[i];
                    if (xv === null || yv === null) continue;
                    const yLow = yErrData?.[i]?.[0] ?? null;
                    const yHigh = yErrData?.[i]?.[1] ?? null;
                    const xLow = xErrData?.[i]?.[0] ?? null;
                    const xHigh = xErrData?.[i]?.[1] ?? null;
                    if (yLow !== null || xLow !== null) {
                        errorSeriesData.push([xv, yv, yLow, yHigh, xLow, xHigh]);
                    }
                }
                if (errorSeriesData.length > 0) {
                    const errSeries = this._buildErrorBarSeries(errorSeriesData, 'cartesian2d');
                    if (errSeries) series.push(errSeries);
                }
            }

            const trendLine = config.trendLine;
            if (trendLine && trendLine.enabled) {
                groupNames.forEach(gName => {
                    const pts = groups[gName];
                    const gxs = pts.map(p => p[0]);
                    const gys = pts.map(p => p[1]);
                    const trendResult = this._computeTrendLine(gxs, gys, trendLine);
                    if (trendResult) {
                        const trendSeries = this._buildTrendLineSeries(trendResult, trendLine);
                        if (trendSeries) {
                            trendSeries.name = gName + ' 趋势线';
                            trendSeries.data.sort((a, b) => a[0] - b[0]);
                            series.push(trendSeries);
                        }
                    }
                });
                const allTrendResult = this._computeTrendLine(xData, yData, trendLine);
                if (allTrendResult) {
                    const graphic = this._buildTrendLineGraphic(allTrendResult, trendLine);
                    if (graphic) _trendLineGraphic = [graphic];
                }
            }
        } else {
            const seriesData = xData.map((x, i) => [x, yData[i]]);

            const yErrData = this._computeErrorData(data, yData, errorBar, 'y');
            const xErrData = this._computeErrorData(data, xData, errorBar, 'x');
            const errorSeriesData = [];
            for (let i = 0; i < seriesData.length; i++) {
                const [xv, yv] = seriesData[i];
                if (xv === null || yv === null) continue;
                const yLow = yErrData?.[i]?.[0] ?? null;
                const yHigh = yErrData?.[i]?.[1] ?? null;
                const xLow = xErrData?.[i]?.[0] ?? null;
                const xHigh = xErrData?.[i]?.[1] ?? null;
                if (yLow !== null || xLow !== null) {
                    errorSeriesData.push([xv, yv, yLow, yHigh, xLow, xHigh]);
                }
            }

            series.push({
                type: 'scatter',
                data: seriesData,
                symbolSize: 10,
                itemStyle: { opacity: 0.8 },
            });

            if (errorSeriesData.length > 0) {
                const errSeries = this._buildErrorBarSeries(errorSeriesData, 'cartesian2d');
                if (errSeries) series.push(errSeries);
            }

            const trendLine = config.trendLine;
            const trendResult = this._computeTrendLine(xData, yData, trendLine);
            if (trendResult) {
                const trendSeries = this._buildTrendLineSeries(trendResult, trendLine);
                if (trendSeries) {
                    trendSeries.data.sort((a, b) => a[0] - b[0]);
                    series.push(trendSeries);
                }
                const graphic = this._buildTrendLineGraphic(trendResult, trendLine);
                if (graphic) _trendLineGraphic = [graphic];
            }
        }

        const showLegend = !!groupCol;
        const option = {
            title: {
                text: config.title || '散点图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.seriesType === 'custom' || params.seriesName === '趋势线') return '';
                    let label = `${xCol.name}: ${params.value[0]}<br>${yCol.name}: ${params.value[1]}`;
                    if (groupCol && params.seriesName) label = params.seriesName + '<br>' + label;
                    return label;
                },
            },
            xAxis: {
                name: xCol.name,
                nameLocation: 'middle',
                nameGap: 30,
                type: 'value',
                scale: true,
            },
            yAxis: {
                name: yCol.name,
                nameLocation: 'middle',
                nameGap: 40,
                type: 'value',
                scale: true,
            },
            series,
            grid: { left: 60, right: 40, top: showLegend ? 80 : 60, bottom: 60 },
            animation: false,
        };
        if (showLegend) {
            option.legend = { top: 32, textStyle: { fontSize: config.fontSize - 2 } };
        }
        if (_trendLineGraphic) option._trendLineGraphic = _trendLineGraphic;
        return option;
    },

    /**
     * 折线图
     */
    line(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('折线图需要至少一列数值数据');
        }

        let xAxisData = [];
        let xAxisType = 'category';
        let seriesCols = numericCols;

        const xName = this._resolveColName(data, m.x, catCols.length ? catCols : numericCols, 0);
        const groupCol = m.group ? this._colInfo(data, m.group) : null;
        const yCol = m.y ? this._colInfo(data, m.y) : null;

        if (groupCol) {
            xAxisData = CSVParser.getColumn(data, groupCol.name);
            xAxisType = 'category';
        } else if (xName && data.headers.includes(xName)) {
            xAxisData = CSVParser.getColumn(data, xName);
            xAxisType = 'category';
        } else if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
        } else if (numericCols.length >= 2) {
            xAxisData = CSVParser.getColumn(data, numericCols[0].name);
            seriesCols = numericCols.slice(1);
        } else {
            xAxisData = data.rows.map((_, i) => i + 1);
        }

        if (yCol) {
            seriesCols = [yCol];
        }

        const errorBar = config.errorBar;
        const series = [];

        let _trendLineGraphic = undefined;
        const trendLine = config.trendLine;

        seriesCols.slice(0, 5).forEach((col, colIdx) => {
            const colValues = CSVParser.getColumn(data, col.name);
            series.push({
                name: col.name,
                type: 'line',
                data: colValues,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2 },
            });

            if (errorBar && errorBar.enabled) {
                const yErrData = this._computeErrorData(data, colValues, errorBar, 'y');
                if (yErrData) {
                    const errSeriesData = [];
                    for (let i = 0; i < colValues.length; i++) {
                        if (colValues[i] === null || !yErrData[i]) continue;
                        errSeriesData.push([xAxisData[i], colValues[i], yErrData[i][0], yErrData[i][1], null, null]);
                    }
                    if (errSeriesData.length > 0) {
                        const errSeries = this._buildErrorBarSeries(errSeriesData, 'cartesian2d');
                        if (errSeries) {
                            errSeries.name = col.name + ' 误差';
                            series.push(errSeries);
                        }
                    }
                }
            }

            if (colIdx === 0 && trendLine && trendLine.enabled && xAxisType === 'category') {
                const numericX = xAxisData.map((v, i) => i);
                const trendResult = this._computeTrendLine(numericX, colValues, trendLine);
                if (trendResult) {
                    const trendSeries = this._buildTrendLineSeries(trendResult, trendLine);
                    if (trendSeries) {
                        trendSeries.data = trendResult.xs.map((x, i) => trendResult.predicted[i]);
                        trendSeries.type = 'line';
                        trendSeries.xAxisIndex = 0;
                        series.push(trendSeries);
                    }
                    const graphic = this._buildTrendLineGraphic(trendResult, trendLine);
                    if (graphic) _trendLineGraphic = [graphic];
                }
            }
            else if (colIdx === 0 && trendLine && trendLine.enabled && xAxisType === 'value') {
                const xNumeric = CSVParser.getColumn(data, xName);
                const trendResult = this._computeTrendLine(xNumeric, colValues, trendLine);
                if (trendResult) {
                    const trendSeries = this._buildTrendLineSeries(trendResult, trendLine);
                    if (trendSeries) {
                        trendSeries.data.sort((a, b) => a[0] - b[0]);
                        series.push(trendSeries);
                    }
                    const graphic = this._buildTrendLineGraphic(trendResult, trendLine);
                    if (graphic) _trendLineGraphic = [graphic];
                }
            }
        });

        const option = {
            title: {
                text: config.title || '折线图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis' },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: {
                type: xAxisType,
                data: xAxisData,
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                min: yMin,
                max: yMax,
            },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
        if (_trendLineGraphic) option._trendLineGraphic = _trendLineGraphic;
        return option;
    },

    /**
     * 柱状图
     */
    bar(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('柱状图需要至少一列数值数据');
        }

        let xAxisData = [];
        let seriesCols = numericCols;

        const xName = this._resolveColName(data, m.x, catCols.length ? catCols : numericCols, 0);
        const groupCol = m.group ? this._colInfo(data, m.group) : null;
        const yCol = m.y ? this._colInfo(data, m.y) : null;

        if (groupCol) {
            xAxisData = CSVParser.getColumn(data, groupCol.name);
        } else if (xName && data.headers.includes(xName)) {
            xAxisData = CSVParser.getColumn(data, xName);
        } else if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
        } else if (numericCols.length >= 2) {
            xAxisData = CSVParser.getColumn(data, numericCols[0].name);
            seriesCols = numericCols.slice(1);
        } else {
            xAxisData = data.rows.map((_, i) => `Item ${i + 1}`);
        }

        if (yCol) {
            seriesCols = [yCol];
        }

        const errorBar = config.errorBar;
        const series = [];

        seriesCols.slice(0, 5).forEach(col => {
            const colValues = CSVParser.getColumn(data, col.name);
            series.push({
                name: col.name,
                type: 'bar',
                data: colValues,
                barMaxWidth: 40,
            });

            if (errorBar && errorBar.enabled) {
                const yErrData = this._computeErrorData(data, colValues, errorBar, 'y');
                if (yErrData) {
                    const errSeriesData = [];
                    for (let i = 0; i < colValues.length; i++) {
                        if (colValues[i] === null || !yErrData[i]) continue;
                        errSeriesData.push([xAxisData[i], colValues[i], yErrData[i][0], yErrData[i][1], null, null]);
                    }
                    if (errSeriesData.length > 0) {
                        const errSeries = this._buildErrorBarSeries(errSeriesData, 'cartesian2d');
                        if (errSeries) {
                            errSeries.name = col.name + ' 误差';
                            series.push(errSeries);
                        }
                    }
                }
            }
        });

        return {
            title: {
                text: config.title || '柱状图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: {
                type: 'category',
                data: xAxisData,
            },
            yAxis: {
                type: 'value',
                min: yMin,
                max: yMax,
            },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 箱线图
     */
    boxplot(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('箱线图需要数值数据');
        }

        const catCols = CSVParser.getCategoricalColumns(data);
        const groupCol = m.group ? this._colInfo(data, m.group) : (catCols[0] || null);
        const valueCol = m.value ? this._colInfo(data, m.value) : numericCols[0];

        let categories = [];
        let boxData = [];

        if (groupCol) {
            const groups = {};
            data.rows.forEach(row => {
                const cat = row[groupCol.index] || 'Default';
                if (!groups[cat]) groups[cat] = [];
                if (row[valueCol.index] !== null) groups[cat].push(row[valueCol.index]);
            });
            categories = Object.keys(groups);
            boxData = categories.map(cat => this._computeBoxplotData(groups[cat]));
        } else {
            categories = numericCols.map(c => c.name);
            boxData = numericCols.map(col => {
                const vals = CSVParser.getColumn(data, col.name).filter(v => v !== null);
                return this._computeBoxplotData(vals);
            });
        }

        return {
            title: {
                text: config.title || '箱线图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'item',
                formatter: (p) => {
                    const d = p.value;
                    return `Min: ${d[0]}<br>Q1: ${d[1]}<br>Median: ${d[2]}<br>Q3: ${d[3]}<br>Max: ${d[4]}`;
                }
            },
            xAxis: {
                type: 'category',
                data: categories,
            },
            yAxis: { type: 'value' },
            series: [{
                type: 'boxplot',
                data: boxData,
                itemStyle: { borderWidth: 2 },
            }],
            legend: {
                top: 32,
                data: ['增加', '减少'],
                textStyle: { fontSize: config.fontSize - 2 },
            },
            grid: { left: 60, right: 40, top: 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 热力图
     */
    heatmap(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length < 2) {
            return this._errorOption('热力图需要至少两列数值数据');
        }

        const xName = this._resolveColName(data, m.x, numericCols, 0);
        const yName = this._resolveColName(data, m.y, numericCols, 1);
        const vName = m.value ? this._resolveColName(data, m.value, numericCols, 2) : (numericCols[2]?.name ?? null);
        const xCol = this._colInfo(data, xName);
        const yCol = this._colInfo(data, yName);
        const vCol = vName ? this._colInfo(data, vName) : null;

        if (!xCol || !yCol) {
            return this._errorOption('无法确定 X/Y 数据列');
        }

        const xData = [...new Set(CSVParser.getColumn(data, xCol.name))].sort((a, b) => a - b);
        const yData = [...new Set(CSVParser.getColumn(data, yCol.name))].sort((a, b) => a - b);

        const heatData = [];
        data.rows.forEach(row => {
            const x = row[xCol.index];
            const y = row[yCol.index];
            const v = vCol ? row[vCol.index] : 1;
            heatData.push([x, y, v]);
        });

        return {
            title: {
                text: config.title || '热力图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                position: 'top',
                formatter: (p) => `${xCol.name}: ${p.value[0]}<br>${yCol.name}: ${p.value[1]}<br>值: ${p.value[2]}`,
            },
            xAxis: {
                type: 'category',
                data: xData,
                splitArea: { show: true },
            },
            yAxis: {
                type: 'category',
                data: yData,
                splitArea: { show: true },
            },
            visualMap: {
                min: Math.min(...heatData.map(d => d[2])),
                max: Math.max(...heatData.map(d => d[2])),
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: 10,
                inRange: {
                    color: generateGradientFromScheme(config.colorScheme || 'academic', 6),
                },
            },
            series: [{
                type: 'heatmap',
                data: heatData,
                label: { show: false },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
                },
            }],
            grid: { left: 80, right: 40, top: 60, bottom: 100 },
            animation: false,
        };
    },

    /**
     * 分组柱状图
     * 按分类列分组，按分组列生成多个系列，值为均值聚合
     */
    group_bar(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0 || catCols.length === 0) {
            return this._errorOption('分组柱状图需要至少一列数值数据和一列分类数据');
        }

        const catName = this._resolveColName(data, m.x, catCols, 0);
        const valName = this._resolveColName(data, m.y, numericCols, 0);
        const groupName = m.group ? this._resolveColName(data, m.group, catCols, 1) : null;

        const catCol = this._colInfo(data, catName);
        const valCol = this._colInfo(data, valName);
        if (!catCol || !valCol) {
            return this._errorOption('无法确定分类/数值数据列');
        }

        const groupCol = groupName ? this._colInfo(data, groupName) : null;
        const agg = this._aggregateGrouped(data, catCol, valCol, groupCol);

        const errorBar = config.errorBar;
        const series = [];

        agg.groupNames.forEach(gName => {
            const seriesData = agg.categories.map(cat => {
                const key = cat + '|' + gName;
                return agg.means[key] ?? null;
            });

            series.push({
                name: gName,
                type: 'bar',
                data: seriesData,
                barMaxWidth: 40,
            });

            if (errorBar && errorBar.enabled) {
                const errData = [];
                agg.categories.forEach((cat, i) => {
                    const key = cat + '|' + gName;
                    const mean = agg.means[key];
                    const se = agg.sem[key];
                    if (mean !== null && se !== null) {
                        errData.push([agg.categories[i], mean, mean - se, mean + se, null, null]);
                    }
                });
                if (errData.length > 0) {
                    const errSeries = this._buildErrorBarSeries(errData, 'cartesian2d');
                    if (errSeries) {
                        errSeries.name = gName + ' 误差';
                        series.push(errSeries);
                    }
                }
            }
        });

        return {
            title: {
                text: config.title || '分组柱状图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: {
                type: 'category',
                data: agg.categories,
            },
            yAxis: { type: 'value', name: valCol.name + ' (均值)' },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 分组折线图
     * 按分类列分组，按分组列生成多条折线，值为均值聚合
     */
    group_line(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0 || catCols.length === 0) {
            return this._errorOption('分组折线图需要至少一列数值数据和一列分类数据');
        }

        const catName = this._resolveColName(data, m.x, catCols, 0);
        const valName = this._resolveColName(data, m.y, numericCols, 0);
        const groupName = m.group ? this._resolveColName(data, m.group, catCols, 1) : null;

        const catCol = this._colInfo(data, catName);
        const valCol = this._colInfo(data, valName);
        if (!catCol || !valCol) {
            return this._errorOption('无法确定分类/数值数据列');
        }

        const groupCol = groupName ? this._colInfo(data, groupName) : null;
        const agg = this._aggregateGrouped(data, catCol, valCol, groupCol);

        const errorBar = config.errorBar;
        const series = [];

        agg.groupNames.forEach(gName => {
            const seriesData = agg.categories.map(cat => {
                const key = cat + '|' + gName;
                return agg.means[key] ?? null;
            });

            series.push({
                name: gName,
                type: 'line',
                data: seriesData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2 },
            });

            if (errorBar && errorBar.enabled) {
                const errData = [];
                agg.categories.forEach((cat, i) => {
                    const key = cat + '|' + gName;
                    const mean = agg.means[key];
                    const se = agg.sem[key];
                    if (mean !== null && se !== null) {
                        errData.push([agg.categories[i], mean, mean - se, mean + se, null, null]);
                    }
                });
                if (errData.length > 0) {
                    const errSeries = this._buildErrorBarSeries(errData, 'cartesian2d');
                    if (errSeries) {
                        errSeries.name = gName + ' 误差';
                        series.push(errSeries);
                    }
                }
            }
        });

        return {
            title: {
                text: config.title || '分组折线图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis' },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: {
                type: 'category',
                data: agg.categories,
                boundaryGap: false,
            },
            yAxis: { type: 'value', name: valCol.name + ' (均值)' },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 直方图
     */
    histogram(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('直方图需要数值数据');
        }

        const colName = this._resolveColName(data, m.x, numericCols, 0);
        const values = CSVParser.getColumn(data, colName).filter(v => v !== null);
        const bins = this._computeHistogram(values, 20);

        return {
            title: {
                text: config.title || `直方图 (${colName})`,
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (p) => `范围: ${p[0].axisValue}<br>频次: ${p[0].value}`,
            },
            xAxis: {
                type: 'category',
                data: bins.map(b => `${b.start.toFixed(1)}~${b.end.toFixed(1)}`),
            },
            yAxis: { type: 'value', name: '频次' },
            series: [{
                type: 'bar',
                data: bins.map(b => b.count),
                barCategoryGap: 0,
                itemStyle: { opacity: 0.85 },
            }],
            grid: { left: 60, right: 40, top: 60, bottom: 80 },
            animation: false,
        };
    },

    /**
     * 面积图
     */
    area(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('面积图需要至少一列数值数据');
        }

        let xAxisData = [];
        let xAxisType = 'category';
        let seriesCols = numericCols;

        const xName = this._resolveColName(data, m.x, catCols.length ? catCols : numericCols, 0);
        const groupCol = m.group ? this._colInfo(data, m.group) : null;
        const yCol = m.y ? this._colInfo(data, m.y) : null;

        if (groupCol) {
            xAxisData = CSVParser.getColumn(data, groupCol.name);
        } else if (xName && data.headers.includes(xName)) {
            xAxisData = CSVParser.getColumn(data, xName);
        } else if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
        } else if (numericCols.length >= 2) {
            xAxisData = CSVParser.getColumn(data, numericCols[0].name);
            seriesCols = numericCols.slice(1);
        } else {
            xAxisData = data.rows.map((_, i) => i + 1);
        }

        if (yCol) seriesCols = [yCol];

        const series = [];
        seriesCols.slice(0, 5).forEach(col => {
            const colValues = CSVParser.getColumn(data, col.name);
            series.push({
                name: col.name,
                type: 'line',
                data: colValues,
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2 },
                areaStyle: { opacity: 0.25 },
                emphasis: { focus: 'series' },
            });
        });

        return {
            title: {
                text: config.title || '面积图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis' },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: {
                type: xAxisType,
                data: xAxisData,
                boundaryGap: false,
            },
            yAxis: { type: 'value' },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 堆叠柱状图
     */
    stacked_bar(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('堆叠柱状图需要至少一列数值数据');
        }

        let xAxisData = [];
        let seriesCols = numericCols;

        const xName = this._resolveColName(data, m.x, catCols.length ? catCols : numericCols, 0);
        const groupCol = m.group ? this._colInfo(data, m.group) : null;
        const yCol = m.y ? this._colInfo(data, m.y) : null;

        if (groupCol) {
            xAxisData = CSVParser.getColumn(data, groupCol.name);
        } else if (xName && data.headers.includes(xName)) {
            xAxisData = CSVParser.getColumn(data, xName);
        } else if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
        } else {
            xAxisData = data.rows.map((_, i) => `Item ${i + 1}`);
        }

        if (yCol) seriesCols = [yCol];

        const series = [];
        seriesCols.slice(0, 8).forEach(col => {
            const colValues = CSVParser.getColumn(data, col.name);
            series.push({
                name: col.name,
                type: 'bar',
                stack: 'total',
                data: colValues,
                emphasis: { focus: 'series' },
                barMaxWidth: 50,
            });
        });

        return {
            title: {
                text: config.title || '堆叠柱状图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { top: 32, textStyle: { fontSize: config.fontSize - 2 } },
            xAxis: { type: 'category', data: xAxisData },
            yAxis: { type: 'value' },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 环形图
     */
    donut(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('环形图需要至少一列数值数据');
        }

        const catName = this._resolveColName(data, m.x, catCols, 0);
        const valName = this._resolveColName(data, m.y, numericCols, 0);
        const catCol = catName ? this._colInfo(data, catName) : null;
        const valCol = this._colInfo(data, valName);

        if (!valCol) return this._errorOption('无法确定数值列');

        const pieData = [];
        if (catCol) {
            data.rows.forEach(row => {
                const label = row[catCol.index];
                const value = row[valCol.index];
                if (label !== null && value !== null && typeof value === 'number') {
                    pieData.push({ name: String(label), value });
                }
            });
        } else {
            const vals = CSVParser.getColumn(data, valCol.name);
            vals.forEach((v, i) => {
                if (v !== null && typeof v === 'number') {
                    pieData.push({ name: `Item ${i + 1}`, value: v });
                }
            });
        }

        return {
            title: {
                text: config.title || '环形图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)',
            },
            legend: {
                orient: 'vertical',
                right: 10,
                top: 'center',
                textStyle: { fontSize: config.fontSize - 2 },
            },
            series: [{
                type: 'pie',
                radius: ['35%', '65%'],
                center: ['45%', '55%'],
                avoidLabelOverlap: true,
                itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%' },
                emphasis: {
                    label: { show: true, fontSize: config.fontSize, fontWeight: 'bold' },
                },
                data: pieData,
            }],
            animation: false,
        };
    },

    /**
     * 雷达图
     */
    radar(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length < 2) {
            return this._errorOption('雷达图需要至少两列数值数据');
        }

        const groupCol = m.group ? this._colInfo(data, m.group) : (catCols.length > 0 ? catCols[0] : null);
        const selectedNumericCols = numericCols.slice(0, 8);

        const indicator = selectedNumericCols.map(col => {
            const vals = CSVParser.getColumn(data, col.name).filter(v => v !== null);
            return {
                name: col.name,
                max: Math.max(...vals) * 1.1 || 1,
            };
        });

        const series = [];

        if (groupCol) {
            const groups = {};
            data.rows.forEach(row => {
                const gName = String(row[groupCol.index] ?? 'Default');
                if (!groups[gName]) groups[gName] = [];
                groups[gName].push(row);
            });

            Object.entries(groups).forEach(([gName, rows]) => {
                const values = selectedNumericCols.map(col => {
                    const vals = rows.map(r => r[col.index]).filter(v => v !== null && typeof v === 'number');
                    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                });
                series.push({
                    name: gName,
                    value: values,
                    areaStyle: { opacity: 0.15 },
                });
            });
        } else {
            data.rows.slice(0, 10).forEach((row, idx) => {
                const values = selectedNumericCols.map(col => {
                    const v = row[col.index];
                    return v !== null && typeof v === 'number' ? v : 0;
                });
                series.push({
                    name: `Row ${idx + 1}`,
                    value: values,
                    areaStyle: { opacity: 0.1 },
                });
            });
        }

        return {
            title: {
                text: config.title || '雷达图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'item' },
            legend: {
                top: 32,
                textStyle: { fontSize: config.fontSize - 2 },
            },
            radar: {
                indicator,
                center: ['50%', '58%'],
                radius: '60%',
                splitNumber: 5,
                axisName: { fontSize: config.fontSize - 2 },
            },
            series: [{
                type: 'radar',
                data: series,
                emphasis: {
                    lineStyle: { width: 3 },
                },
            }],
            animation: false,
        };
    },

    /**
     * 气泡图
     */
    bubble(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length < 3) {
            return this._errorOption('气泡图需要至少三列数值数据（X、Y、大小）');
        }

        const xName = this._resolveColName(data, m.x, numericCols, 0);
        const yName = this._resolveColName(data, m.y, numericCols, 1);
        const vName = m.value ? this._resolveColName(data, m.value, numericCols, 2) : numericCols[2].name;
        const xCol = this._colInfo(data, xName);
        const yCol = this._colInfo(data, yName);
        const vCol = this._colInfo(data, vName);

        if (!xCol || !yCol || !vCol) {
            return this._errorOption('无法确定 X/Y/大小 数据列');
        }

        const groupName = m.group ? this._resolveColName(data, m.group, catCols.length ? catCols : numericCols, 0) : null;
        const groupCol = groupName ? this._colInfo(data, groupName) : null;

        const allValues = CSVParser.getColumn(data, vCol.name).filter(v => v !== null && typeof v === 'number');
        const vMin = Math.min(...allValues);
        const vMax = Math.max(...allValues);
        const sizeRange = [8, 40];

        const mapSize = (v) => {
            if (vMax === vMin) return (sizeRange[0] + sizeRange[1]) / 2;
            return sizeRange[0] + (v - vMin) / (vMax - vMin) * (sizeRange[1] - sizeRange[0]);
        };

        const series = [];

        if (groupCol) {
            const groups = {};
            data.rows.forEach(row => {
                const xv = row[xCol.index];
                const yv = row[yCol.index];
                const vv = row[vCol.index];
                const gv = row[groupCol.index] ?? 'Default';
                if (xv === null || yv === null || vv === null) return;
                if (!groups[gv]) groups[gv] = [];
                groups[gv].push([xv, yv, vv]);
            });

            Object.entries(groups).forEach(([gName, pts]) => {
                series.push({
                    name: gName,
                    type: 'scatter',
                    data: pts,
                    symbolSize: (val) => mapSize(val[2]),
                    itemStyle: { opacity: 0.7 },
                });
            });
        } else {
            const seriesData = [];
            data.rows.forEach(row => {
                const xv = row[xCol.index];
                const yv = row[yCol.index];
                const vv = row[vCol.index];
                if (xv === null || yv === null || vv === null) return;
                seriesData.push([xv, yv, vv]);
            });
            series.push({
                type: 'scatter',
                data: seriesData,
                symbolSize: (val) => mapSize(val[2]),
                itemStyle: { opacity: 0.7 },
            });
        }

        return {
            title: {
                text: config.title || '气泡图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    let label = `${xCol.name}: ${params.value[0]}<br>${yCol.name}: ${params.value[1]}<br>${vCol.name}: ${params.value[2]}`;
                    if (groupCol && params.seriesName) label = params.seriesName + '<br>' + label;
                    return label;
                },
            },
            xAxis: {
                name: xCol.name,
                nameLocation: 'middle',
                nameGap: 30,
                type: 'value',
                scale: true,
            },
            yAxis: {
                name: yCol.name,
                nameLocation: 'middle',
                nameGap: 40,
                type: 'value',
                scale: true,
            },
            series,
            grid: { left: 60, right: 40, top: groupCol ? 80 : 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 相关矩阵热力图
     */
    correlation_matrix(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);

        if (numericCols.length < 2) {
            return this._errorOption('相关矩阵需要至少两列数值数据');
        }

        const cols = numericCols.slice(0, 12);
        const colData = cols.map(col => CSVParser.getColumn(data, col.name));
        const names = cols.map(c => c.name);
        const n = cols.length;

        const pearson = (a, b) => {
            const pairs = [];
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== null && b[i] !== null && typeof a[i] === 'number' && typeof b[i] === 'number') {
                    pairs.push([a[i], b[i]]);
                }
            }
            if (pairs.length < 2) return 0;
            const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
            const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
            let num = 0, denA = 0, denB = 0;
            pairs.forEach(([x, y]) => {
                num += (x - meanA) * (y - meanB);
                denA += (x - meanA) ** 2;
                denB += (y - meanB) ** 2;
            });
            const den = Math.sqrt(denA * denB);
            return den > 0 ? num / den : 0;
        };

        const heatData = [];
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const r = i === j ? 1 : pearson(colData[i], colData[j]);
                heatData.push([j, i, parseFloat(r.toFixed(3))]);
            }
        }

        return {
            title: {
                text: config.title || '相关矩阵',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                formatter: (p) => `${names[p.value[1]]} vs ${names[p.value[0]]}<br>r = ${p.value[2]}`,
            },
            xAxis: {
                type: 'category',
                data: names,
                axisLabel: { rotate: 45, fontSize: config.fontSize - 3 },
                splitArea: { show: true },
            },
            yAxis: {
                type: 'category',
                data: names,
                axisLabel: { fontSize: config.fontSize - 3 },
                splitArea: { show: true },
            },
            visualMap: {
                min: -1,
                max: 1,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: 10,
                inRange: {
                    color: generateDivergingGradient(config.colorScheme || 'academic', 7),
                },
            },
            series: [{
                type: 'heatmap',
                data: heatData,
                label: {
                    show: n <= 8,
                    formatter: (p) => p.value[2].toFixed(2),
                    fontSize: config.fontSize - 3,
                },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
                },
            }],
            grid: { left: 100, right: 40, top: 60, bottom: 100 },
            animation: false,
        };
    },

    /**
     * 小提琴图
     */
    violin(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('小提琴图需要数值数据');
        }

        const catCols = CSVParser.getCategoricalColumns(data);
        const groupCol = m.group ? this._colInfo(data, m.group) : (catCols[0] || null);
        const valueCol = m.value ? this._colInfo(data, m.value) : numericCols[0];

        let categories = [];
        let violinGroups = [];

        if (groupCol) {
            const groups = {};
            data.rows.forEach(row => {
                const cat = row[groupCol.index] || 'Default';
                if (!groups[cat]) groups[cat] = [];
                if (row[valueCol.index] !== null && typeof row[valueCol.index] === 'number') {
                    groups[cat].push(row[valueCol.index]);
                }
            });
            categories = Object.keys(groups);
            violinGroups = categories.map(cat => groups[cat]);
        } else {
            categories = numericCols.slice(0, 8).map(c => c.name);
            violinGroups = numericCols.slice(0, 8).map(col =>
                CSVParser.getColumn(data, col.name).filter(v => v !== null && typeof v === 'number')
            );
        }

        const kde = (values, nPoints) => {
            if (values.length < 2) return [];
            const sorted = [...values].sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const range = max - min || 1;
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
            const stdDev = Math.sqrt(variance);
            const bandwidth = 1.06 * stdDev * Math.pow(values.length, -0.2) || range / 10;
            const step = range * 1.2 / nPoints;
            const start = min - range * 0.1;
            const points = [];
            const coeff = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
            for (let i = 0; i <= nPoints; i++) {
                const x = start + i * step;
                let density = 0;
                for (let j = 0; j < values.length; j++) {
                    const z = (x - values[j]) / bandwidth;
                    density += Math.exp(-0.5 * z * z);
                }
                density = density * coeff / values.length;
                points.push([x, density]);
            }
            return points;
        };

        const scheme = getColorScheme(config.colorScheme || 'academic');
        const colors = scheme.colors || ['#999999'];
        const series = [];
        const bandWidth = 0.35;

        let globalKdeMin = Infinity;
        let globalKdeMax = -Infinity;

        // 第一遍：计算所有 violin 的 KDE 及全局范围
        const violinDefs = violinGroups.map((values, catIdx) => {
            const boxData = this._computeBoxplotData(values);
            const densityPoints = kde(values, 50);
            const maxDensity = Math.max(...densityPoints.map(p => p[1])) || 1;
            const color = colors[catIdx % colors.length];

            globalKdeMin = Math.min(globalKdeMin, densityPoints[0][0]);
            globalKdeMax = Math.max(globalKdeMax, densityPoints[densityPoints.length - 1][0]);

            // 构建闭合轮廓数据线（顶部中心 → 左轮廓上→下 → 底部中心 → 右轮廓下→上 → 回到顶部中心）
            const contourData = [];
            const yTop = densityPoints[densityPoints.length - 1][0];
            const yBottom = densityPoints[0][0];

            // 顶部中心
            contourData.push([catIdx, yTop]);
            // 左轮廓（上→下）
            for (let i = densityPoints.length - 1; i >= 0; i--) {
                const p = densityPoints[i];
                const w = (p[1] / maxDensity) * bandWidth;
                contourData.push([catIdx - w, p[0]]);
            }
            // 底部中心
            contourData.push([catIdx, yBottom]);
            // 右轮廓（下→上）
            for (let i = 0; i < densityPoints.length; i++) {
                const p = densityPoints[i];
                const w = (p[1] / maxDensity) * bandWidth;
                contourData.push([catIdx + w, p[0]]);
            }
            // 回到顶部中心，形成闭合环
            contourData.push([catIdx, yTop]);

            return { boxData, contourData, color, catIdx };
        });

        // 第二遍：生成 series
        violinDefs.forEach(({ boxData, contourData, color, catIdx }) => {
            // 小提琴轮廓：闭合 line + areaStyle 填充到 yAxis baseline
            series.push({
                type: 'line',
                name: categories[catIdx],
                data: contourData,
                smooth: false,
                symbol: 'none',
                lineStyle: { width: 1.5, color: color },
                areaStyle: {
                    color: color,
                    opacity: 0.5,
                    origin: 'start',
                },
                z: 1,
            });

            // 叠加箱线图
            series.push({
                type: 'boxplot',
                data: [[catIdx, boxData[0], boxData[1], boxData[2], boxData[3], boxData[4]]],
                itemStyle: { borderWidth: 2, color: 'rgba(255,255,255,0.7)' },
                boxWidth: [10, 10],
                z: 3,
                tooltip: {
                    formatter: () => {
                        return `${categories[catIdx]}<br>Min: ${boxData[0]}<br>Q1: ${boxData[1]}<br>Median: ${boxData[2]}<br>Q3: ${boxData[3]}<br>Max: ${boxData[4]}`;
                    },
                },
            });
        });

        const yMin = isFinite(globalKdeMin) ? globalKdeMin : 0;
        const yMax = isFinite(globalKdeMax) ? globalKdeMax : 100;

        return {
            title: {
                text: config.title || '小提琴图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'item' },
            xAxis: {
                type: 'value',
                min: -0.5,
                max: categories.length - 0.5,
                axisLabel: {
                    formatter: (v) => {
                        const idx = Math.round(v);
                        return idx >= 0 && idx < categories.length ? categories[idx] : '';
                    },
                },
                splitLine: { show: false },
            },
            yAxis: { type: 'value' },
            series,
            grid: { left: 60, right: 40, top: 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 瀑布图
     */
    waterfall(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length === 0) {
            return this._errorOption('瀑布图需要数值数据');
        }

        const catName = this._resolveColName(data, m.x, catCols.length ? catCols : numericCols, 0);
        const valName = this._resolveColName(data, m.y, numericCols, 0);
        const catCol = catName ? this._colInfo(data, catName) : null;
        const valCol = this._colInfo(data, valName);

        if (!valCol) return this._errorOption('无法确定数值列');

        const categories = [];
        const values = [];

        data.rows.forEach(row => {
            const label = catCol ? row[catCol.index] : `Step ${categories.length + 1}`;
            const val = row[valCol.index];
            if (val !== null && typeof val === 'number') {
                categories.push(String(label ?? `Step ${categories.length + 1}`));
                values.push(val);
            }
        });

        let runningTotal = 0;
        const baseData = [];
        const increaseData = [];
        const decreaseData = [];

        values.forEach((v, i) => {
            if (i === values.length - 1 && (categories[i] === 'Total' || categories[i] === '合计')) {
                baseData.push(0);
                if (v >= 0) {
                    increaseData.push(v);
                    decreaseData.push(0);
                } else {
                    increaseData.push(0);
                    decreaseData.push(Math.abs(v));
                }
            } else {
                baseData.push(runningTotal);
                if (v >= 0) {
                    increaseData.push(v);
                    decreaseData.push(0);
                } else {
                    increaseData.push(0);
                    decreaseData.push(Math.abs(v));
                }
                runningTotal += v;
            }
        });

        return {
            title: {
                text: config.title || '瀑布图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const idx = params[0]?.dataIndex;
                    if (idx === undefined) return '';
                    return `${categories[idx]}<br>值: ${values[idx]}`;
                },
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { rotate: categories.length > 6 ? 30 : 0 },
            },
            yAxis: { type: 'value' },
            series: [
                {
                    name: 'base',
                    type: 'bar',
                    stack: 'waterfall',
                    data: baseData,
                    itemStyle: { color: 'transparent' },
                    emphasis: { itemStyle: { color: 'transparent' } },
                    barMaxWidth: 40,
                },
                {
                    name: '增加',
                    type: 'bar',
                    stack: 'waterfall',
                    data: increaseData,
                    itemStyle: { color: getColorScheme(config.colorScheme || 'academic').colors[0] || '#52c41a' },
                    barMaxWidth: 40,
                },
                {
                    name: '减少',
                    type: 'bar',
                    stack: 'waterfall',
                    data: decreaseData,
                    itemStyle: { color: getColorScheme(config.colorScheme || 'academic').colors[1] || '#ff4d4f' },
                    barMaxWidth: 40,
                },
            ],
            legend: {
                top: 32,
                data: ['增加', '减少'],
                textStyle: { fontSize: config.fontSize - 2 },
            },
            grid: { left: 60, right: 40, top: 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 哑铃图
     */
    dumbbell(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length < 2) {
            return this._errorOption('哑铃图需要至少两列数值数据（起点和终点）');
        }

        const catName = this._resolveColName(data, m.x, catCols, 0);
        const y1Name = this._resolveColName(data, m.y, numericCols, 0);
        const y2Name = m.group ? this._resolveColName(data, m.group, numericCols, 1) : numericCols[1].name;
        const catCol = catName ? this._colInfo(data, catName) : null;
        const y1Col = this._colInfo(data, y1Name);
        const y2Col = this._colInfo(data, y2Name);

        if (!y1Col || !y2Col) return this._errorOption('无法确定两列数值数据');

        const categories = [];
        const y1Data = [];
        const y2Data = [];

        data.rows.forEach(row => {
            const label = catCol ? row[catCol.index] : `Item ${categories.length + 1}`;
            const v1 = row[y1Col.index];
            const v2 = row[y2Col.index];
            if (v1 !== null && v2 !== null && typeof v1 === 'number' && typeof v2 === 'number') {
                categories.push(String(label ?? `Item ${categories.length + 1}`));
                y1Data.push(v1);
                y2Data.push(v2);
            }
        });

        return {
            title: {
                text: config.title || '哑铃图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const idx = params[0]?.dataIndex;
                    if (idx === undefined) return '';
                    return `${categories[idx]}<br>${y1Col.name}: ${y1Data[idx]}<br>${y2Col.name}: ${y2Data[idx]}`;
                },
            },
            legend: {
                top: 32,
                data: [y1Col.name, y2Col.name],
                textStyle: { fontSize: config.fontSize - 2 },
            },
            xAxis: {
                type: 'category',
                data: categories,
            },
            yAxis: { type: 'value', scale: true },
            series: [
                {
                    name: y1Col.name,
                    type: 'scatter',
                    data: y1Data,
                    symbolSize: 12,
                    z: 3,
                },
                {
                    name: y2Col.name,
                    type: 'scatter',
                    data: y2Data,
                    symbolSize: 12,
                    z: 3,
                },
                {
                    type: 'custom',
                    name: '连接线',
                    renderItem: (params, api) => {
                        const idx = params.dataIndex;
                        const p1 = api.coord([idx, y1Data[idx]]);
                        const p2 = api.coord([idx, y2Data[idx]]);
                        return {
                            type: 'line',
                            shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                            style: { stroke: getColorScheme(config.colorScheme || 'academic').grid || '#999', lineWidth: 2 },
                            silent: true,
                        };
                    },
                    data: categories.map((_, i) => [i]),
                    z: 1,
                    tooltip: { show: false },
                },
            ],
            grid: { left: 60, right: 40, top: 80, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 平行坐标图
     */
    parallel(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        const m = config.columnMapping || {};

        if (numericCols.length < 2) {
            return this._errorOption('平行坐标图需要至少两列数值数据');
        }

        const cols = numericCols.slice(0, 10);
        const parallelAxis = cols.map((col, i) => ({
            dim: i,
            name: col.name,
            nameLocation: 'start',
            nameTextStyle: { fontSize: config.fontSize - 3 },
        }));

        const groupCol = m.group ? this._colInfo(data, m.group) : (catCols.length > 0 ? catCols[0] : null);

        const seriesData = [];
        const groups = {};

        data.rows.slice(0, 200).forEach(row => {
            const values = cols.map(col => {
                const v = row[col.index];
                return v !== null && typeof v === 'number' ? v : null;
            });
            if (values.every(v => v === null)) return;

            const gName = groupCol ? String(row[groupCol.index] ?? 'Default') : 'All';
            if (!groups[gName]) groups[gName] = [];
            groups[gName].push(values);
        });

        const series = [];
        Object.entries(groups).forEach(([gName, rows]) => {
            series.push({
                name: gName,
                type: 'parallel',
                data: rows,
                lineStyle: { width: 1, opacity: 0.5 },
                emphasis: { lineStyle: { width: 3, opacity: 1 } },
            });
        });

        return {
            title: {
                text: config.title || '平行坐标图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: { trigger: 'item' },
            legend: {
                top: 32,
                textStyle: { fontSize: config.fontSize - 2 },
            },
            parallelAxis,
            parallel: {
                left: 60,
                right: 60,
                top: 80,
                bottom: 40,
                parallelAxisDefault: {
                    type: 'value',
                    areaSelectStyle: { width: 20 },
                },
            },
            series,
            animation: false,
        };
    },

    // ===== 误差棒辅助函数 =====

    _computeErrorData(data, values, errorBar, axis) {
        if (!errorBar || !errorBar.enabled) return null;

        const type = errorBar.type;
        const plusKey = axis === 'x' ? 'xErrorPlus' : 'yErrorPlus';
        const minusKey = axis === 'x' ? 'xErrorMinus' : 'yErrorMinus';

        if (type === 'column') {
            const plusCol = errorBar[plusKey];
            const minusCol = errorBar[minusKey];
            if (!plusCol && !minusCol) return null;

            const plusData = plusCol ? CSVParser.getColumn(data, plusCol) : null;
            const minusData = minusCol ? CSVParser.getColumn(data, minusCol) : null;

            return values.map((v, i) => {
                if (v === null) return null;
                const plus = plusData ? (plusData[i] ?? 0) : (minusData ? (minusData[i] ?? 0) : 0);
                const minus = minusData ? (minusData[i] ?? 0) : (plusData ? (plusData[i] ?? 0) : 0);
                return [v - Math.abs(minus), v + Math.abs(plus)];
            });
        }

        if (type === 'fixed') {
            const fv = errorBar.fixedValue || 0;
            return values.map(v => v === null ? null : [v - fv, v + fv]);
        }

        if (type === 'percent') {
            const pct = (errorBar.percentValue || 5) / 100;
            return values.map(v => v === null ? null : [v - Math.abs(v) * pct, v + Math.abs(v) * pct]);
        }

        if (type === 'std') {
            const valid = values.filter(v => v !== null);
            if (valid.length === 0) return null;
            const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
            const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
            const std = Math.sqrt(variance);
            return values.map(v => v === null ? null : [v - std, v + std]);
        }

        return null;
    },

    _buildErrorBarSeries(errorDataXY, coordSys, color) {
        if (!errorDataXY || errorDataXY.length === 0) return null;

        const errColor = color || getColorScheme(AppState?.subfigure?.colorScheme || 'academic').text || '#333';

        return {
            type: 'custom',
            name: '误差棒',
            renderItem: function(params, api) {
                const xVal = api.value(0);
                const yVal = api.value(1);
                const yLow = api.value(2);
                const yHigh = api.value(3);
                const xLow = api.value(4);
                const xHigh = api.value(5);

                const point = api.coord([xVal, yVal]);
                const capSize = 4;
                const elements = [];

                if (yLow !== undefined && yHigh !== undefined && yLow !== null && yHigh !== null) {
                    const pLow = api.coord([xVal, yLow]);
                    const pHigh = api.coord([xVal, yHigh]);
                    elements.push({
                        type: 'line',
                        shape: { x1: point[0], y1: pLow[1], x2: point[0], y2: pHigh[1] },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                    elements.push({
                        type: 'line',
                        shape: { x1: point[0] - capSize, y1: pLow[1], x2: point[0] + capSize, y2: pLow[1] },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                    elements.push({
                        type: 'line',
                        shape: { x1: point[0] - capSize, y1: pHigh[1], x2: point[0] + capSize, y2: pHigh[1] },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                }

                if (xLow !== undefined && xHigh !== undefined && xLow !== null && xHigh !== null) {
                    const pLow = api.coord([xLow, yVal]);
                    const pHigh = api.coord([xHigh, yVal]);
                    elements.push({
                        type: 'line',
                        shape: { x1: pLow[0], y1: point[1], x2: pHigh[0], y2: point[1] },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                    elements.push({
                        type: 'line',
                        shape: { x1: pLow[0], y1: point[1] - capSize, x2: pLow[0], y2: point[1] + capSize },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                    elements.push({
                        type: 'line',
                        shape: { x1: pHigh[0], y1: point[1] - capSize, x2: pHigh[0], y2: point[1] + capSize },
                        style: { stroke: errColor, lineWidth: 1.5 },
                    });
                }

                return { type: 'group', children: elements };
            },
            data: errorDataXY,
            z: 10,
            silent: true,
        };
    },

    _buildCategoryErrorBarSeries(errorData, categories, color) {
        if (!errorData || errorData.length === 0) return null;

        const errColor = color || '#333';

        return {
            type: 'custom',
            name: '误差棒',
            renderItem: function(params, api) {
                const catIdx = api.value(0);
                const yLow = api.value(1);
                const yHigh = api.value(2);

                const pointLow = api.coord([catIdx, yLow]);
                const pointHigh = api.coord([catIdx, yHigh]);
                const capSize = 4;

                return {
                    type: 'group',
                    children: [
                        {
                            type: 'line',
                            shape: { x1: pointLow[0], y1: pointLow[1], x2: pointHigh[0], y2: pointHigh[1] },
                            style: { stroke: errColor, lineWidth: 1.5 },
                        },
                        {
                            type: 'line',
                            shape: { x1: pointLow[0] - capSize, y1: pointLow[1], x2: pointLow[0] + capSize, y2: pointLow[1] },
                            style: { stroke: errColor, lineWidth: 1.5 },
                        },
                        {
                            type: 'line',
                            shape: { x1: pointHigh[0] - capSize, y1: pointHigh[1], x2: pointHigh[0] + capSize, y2: pointHigh[1] },
                            style: { stroke: errColor, lineWidth: 1.5 },
                        },
                    ],
                };
            },
            data: errorData,
            z: 10,
            silent: true,
        };
    },

    // ===== 趋势线计算 =====

    _linearRegression(xArr, yArr) {
        const n = xArr.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += xArr[i]; sumY += yArr[i];
            sumXY += xArr[i] * yArr[i];
            sumX2 += xArr[i] * xArr[i];
        }
        const denom = n * sumX2 - sumX * sumX;
        if (Math.abs(denom) < 1e-12) return null;
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    },

    _polynomialRegression(xArr, yArr, degree) {
        const n = xArr.length;
        const d = Math.min(degree, n - 1);
        const size = d + 1;
        const matrix = [];
        const rhs = [];
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                let s = 0;
                for (let k = 0; k < n; k++) s += Math.pow(xArr[k], i + j);
                matrix[i][j] = s;
            }
            let s = 0;
            for (let k = 0; k < n; k++) s += yArr[k] * Math.pow(xArr[k], i);
            rhs[i] = s;
        }
        for (let i = 0; i < size; i++) {
            let maxRow = i;
            for (let k = i + 1; k < size; k++) {
                if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
            }
            [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
            [rhs[i], rhs[maxRow]] = [rhs[maxRow], rhs[i]];
            if (Math.abs(matrix[i][i]) < 1e-12) return null;
            for (let k = i + 1; k < size; k++) {
                const factor = matrix[k][i] / matrix[i][i];
                for (let j = i; j < size; j++) matrix[k][j] -= factor * matrix[i][j];
                rhs[k] -= factor * rhs[i];
            }
        }
        const coeffs = new Array(size);
        for (let i = size - 1; i >= 0; i--) {
            coeffs[i] = rhs[i];
            for (let j = i + 1; j < size; j++) coeffs[i] -= matrix[i][j] * coeffs[j];
            coeffs[i] /= matrix[i][i];
        }
        return coeffs;
    },

    _computeTrendLine(xArr, yArr, trendLine) {
        if (!trendLine || !trendLine.enabled || xArr.length < 2) return null;

        const type = trendLine.type;
        const validPairs = [];
        for (let i = 0; i < xArr.length; i++) {
            if (xArr[i] !== null && yArr[i] !== null && !isNaN(xArr[i]) && !isNaN(yArr[i])) {
                validPairs.push([xArr[i], yArr[i]]);
            }
        }
        if (validPairs.length < 2) return null;

        const xs = validPairs.map(p => p[0]);
        const ys = validPairs.map(p => p[1]);
        let result = null;

        if (type === 'linear') {
            const reg = this._linearRegression(xs, ys);
            if (!reg) return null;
            const predicted = xs.map(x => reg.slope * x + reg.intercept);
            const equation = `y = ${this._fmtCoef(reg.slope)}x + ${this._fmtCoef(reg.intercept)}`;
            result = { type, xs, predicted, equation, params: reg };
        }
        else if (type === 'polynomial') {
            const degree = trendLine.degree || 2;
            const coeffs = this._polynomialRegression(xs, ys, degree);
            if (!coeffs) return null;
            const predicted = xs.map(x => {
                let val = 0;
                for (let i = 0; i < coeffs.length; i++) val += coeffs[i] * Math.pow(x, i);
                return val;
            });
            const terms = [];
            for (let i = coeffs.length - 1; i >= 0; i--) {
                if (i === 0) terms.push(this._fmtCoef(coeffs[i]));
                else if (i === 1) terms.push(`${this._fmtCoef(coeffs[i])}x`);
                else terms.push(`${this._fmtCoef(coeffs[i])}x^${i}`);
            }
            result = { type, xs, predicted, equation: `y = ${terms.join(' + ')}`, params: coeffs };
        }
        else if (type === 'exponential') {
            const validExp = validPairs.filter(p => p[1] > 0);
            if (validExp.length < 2) return null;
            const exs = validExp.map(p => p[0]);
            const eys = validExp.map(p => Math.log(p[1]));
            const reg = this._linearRegression(exs, eys);
            if (!reg) return null;
            const a = Math.exp(reg.intercept);
            const b = reg.slope;
            const predicted = xs.map(x => a * Math.exp(b * x));
            result = { type, xs, predicted, equation: `y = ${this._fmtCoef(a)}·e^(${this._fmtCoef(b)}x)`, params: { a, b } };
        }
        else if (type === 'logarithmic') {
            const validLog = validPairs.filter(p => p[0] > 0);
            if (validLog.length < 2) return null;
            const lxs = validLog.map(p => Math.log(p[0]));
            const lys = validLog.map(p => p[1]);
            const reg = this._linearRegression(lxs, lys);
            if (!reg) return null;
            const predicted = xs.map(x => x > 0 ? reg.slope * Math.log(x) + reg.intercept : null);
            result = { type, xs, predicted, equation: `y = ${this._fmtCoef(reg.slope)}·ln(x) + ${this._fmtCoef(reg.intercept)}`, params: reg };
        }
        else if (type === 'power') {
            const validPow = validPairs.filter(p => p[0] > 0 && p[1] > 0);
            if (validPow.length < 2) return null;
            const pxs = validPow.map(p => Math.log(p[0]));
            const pys = validPow.map(p => Math.log(p[1]));
            const reg = this._linearRegression(pxs, pys);
            if (!reg) return null;
            const a = Math.exp(reg.intercept);
            const b = reg.slope;
            const predicted = xs.map(x => x > 0 ? a * Math.pow(x, b) : null);
            result = { type, xs, predicted, equation: `y = ${this._fmtCoef(a)}·x^${this._fmtCoef(b)}`, params: { a, b } };
        }

        if (result) {
            const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
            let ssRes = 0, ssTot = 0;
            for (let i = 0; i < xs.length; i++) {
                const yPred = result.predicted[i];
                if (yPred !== null && !isNaN(yPred)) {
                    ssRes += (ys[i] - yPred) ** 2;
                }
                ssTot += (ys[i] - yMean) ** 2;
            }
            result.r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
        }

        return result;
    },

    _fmtCoef(v) {
        if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) {
            return v.toExponential(2);
        }
        return parseFloat(v.toFixed(4)).toString();
    },

    _buildTrendLineSeries(trendResult, trendLine) {
        if (!trendResult) return null;

        const seriesData = trendResult.xs.map((x, i) => {
            const y = trendResult.predicted[i];
            return y !== null && !isNaN(y) ? [x, y] : null;
        }).filter(d => d !== null);

        const lineTypeMap = { solid: 'solid', dashed: 'dashed', dotted: 'dotted' };
        const series = {
            type: 'line',
            name: '趋势线',
            data: seriesData,
            smooth: false,
            symbol: 'none',
            lineStyle: {
                width: trendLine.lineWidth || 2,
                type: lineTypeMap[trendLine.lineStyle] || 'solid',
                color: trendLine.color || '#e74c3c',
            },
            itemStyle: { color: trendLine.color || '#e74c3c' },
            z: 5,
        };

        return series;
    },

    _buildTrendLineGraphic(trendResult, trendLine) {
        if (!trendResult || (!trendLine.showEquation && !trendLine.showR2)) return null;

        const parts = [];
        if (trendLine.showEquation) parts.push(trendResult.equation);
        if (trendLine.showR2) parts.push(`R² = ${trendResult.r2.toFixed(4)}`);
        const text = parts.join('  ');

        return {
            type: 'text',
            left: 'right',
            top: 40,
            style: {
                text: text,
                font: '12px Arial',
                fill: trendLine.color || '#e74c3c',
                backgroundColor: 'rgba(255,255,255,0.8)',
                padding: [4, 8],
                borderRadius: 3,
            },
            z: 100,
        };
    },

    // ===== 分组聚合辅助函数 =====

    _aggregateGrouped(data, catCol, valCol, groupCol) {
        const buckets = {};
        const categorySet = new Set();
        const groupNameSet = new Set();

        data.rows.forEach(row => {
            const cat = row[catCol.index];
            const val = row[valCol.index];
            if (cat === null || val === null || typeof val !== 'number') return;
            const gName = groupCol ? (row[groupCol.index] ?? 'Default') : 'All';

            categorySet.add(String(cat));
            groupNameSet.add(String(gName));

            const key = String(cat) + '|' + String(gName);
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(val);
        });

        const categories = [...categorySet];
        const groupNames = [...groupNameSet];
        const means = {};
        const sem = {};

        for (const [key, vals] of Object.entries(buckets)) {
            const n = vals.length;
            const mean = vals.reduce((s, v) => s + v, 0) / n;
            means[key] = mean;
            if (n > 1) {
                const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
                sem[key] = Math.sqrt(variance / n);
            } else {
                sem[key] = 0;
            }
        }

        return { categories, groupNames, means, sem };
    },

    // ===== 辅助函数 =====

    _computeBoxplotData(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const q1 = sorted[Math.floor(n * 0.25)];
        const median = sorted[Math.floor(n * 0.5)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        const min = Math.max(sorted[0], q1 - 1.5 * iqr);
        const max = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
        return [min, q1, median, q3, max];
    },

    _computeHistogram(values, binCount) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const step = (max - min) / binCount || 1;
        const bins = [];
        
        for (let i = 0; i < binCount; i++) {
            bins.push({ start: min + i * step, end: min + (i + 1) * step, count: 0 });
        }
        
        values.forEach(v => {
            const idx = Math.min(Math.floor((v - min) / step), binCount - 1);
            bins[idx].count++;
        });
        
        return bins;
    },

    _errorOption(msg) {
        return {
            title: {
                text: '数据格式错误',
                subtext: msg,
                left: 'center',
                top: 'center',
                textStyle: { color: '#ef4444', fontSize: 16 },
                subtextStyle: { color: '#9ca3af', fontSize: 13 },
            },
            animation: false,
        };
    },
};

function renderChart(templateName, data, config) {
    const fn = ChartTemplates[templateName];
    if (!fn) {
        return ChartTemplates._errorOption(`未知模板: ${templateName}`);
    }
    // 注入配色相关信息
    const enrichedConfig = {
        ...config,
        colorScheme: AppState?.subfigure?.colorScheme || 'academic',
        customSeriesColors: AppState?.subfigure?.customSeriesColors || {},
    };
    const option = fn.call(ChartTemplates, data, enrichedConfig);

    // 启用组件级点击事件，支持图上直接编辑
    if (option.title) {
        option.title.triggerEvent = true;
    }
    if (option.legend) {
        option.legend.triggerEvent = true;
    }

    return option;
}
