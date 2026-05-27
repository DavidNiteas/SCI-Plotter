/**
 * 子图模板定义
 * 每个模板是一个函数，接收数据对象和配置，返回 ECharts option
 */

const ChartTemplates = {
    /**
     * 散点图
     */
    scatter(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        if (numericCols.length < 2) {
            return this._errorOption('散点图需要至少两列数值数据');
        }

        const xCol = numericCols[0];
        const yCol = numericCols[1];
        const xData = CSVParser.getColumn(data, xCol.name);
        const yData = CSVParser.getColumn(data, yCol.name);
        
        const seriesData = xData.map((x, i) => [x, yData[i]]);

        return {
            title: {
                text: config.title || '散点图',
                left: 'center',
                textStyle: { fontSize: config.fontSize + 4 },
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => `${xCol.name}: ${params.value[0]}<br>${yCol.name}: ${params.value[1]}`,
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
            series: [{
                type: 'scatter',
                data: seriesData,
                symbolSize: 10,
                itemStyle: { opacity: 0.8 },
            }],
            grid: { left: 60, right: 40, top: 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 折线图
     */
    line(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        
        if (numericCols.length === 0) {
            return this._errorOption('折线图需要至少一列数值数据');
        }

        let xAxisData = [];
        let xAxisType = 'category';
        let seriesCols = numericCols;
        
        if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
            xAxisType = 'category';
        } else if (numericCols.length >= 2) {
            // 无分类列时，第一列数值作为 x 轴
            xAxisData = CSVParser.getColumn(data, numericCols[0].name);
            xAxisType = 'category';
            seriesCols = numericCols.slice(1);
        } else {
            xAxisData = data.rows.map((_, i) => i + 1);
        }

        const series = seriesCols.slice(0, 5).map((col, idx) => ({
            name: col.name,
            type: 'line',
            data: CSVParser.getColumn(data, col.name),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2 },
        }));

        return {
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
            yAxis: { type: 'value' },
            series,
            grid: { left: 60, right: 40, top: 80, bottom: 50 },
            animation: false,
        };
    },

    /**
     * 柱状图
     */
    bar(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        const catCols = CSVParser.getCategoricalColumns(data);
        
        if (numericCols.length === 0) {
            return this._errorOption('柱状图需要至少一列数值数据');
        }

        let xAxisData = [];
        let seriesCols = numericCols;
        
        if (catCols.length > 0) {
            xAxisData = CSVParser.getColumn(data, catCols[0].name);
        } else if (numericCols.length >= 2) {
            // 无分类列时，第一列数值作为 x 轴标签
            xAxisData = CSVParser.getColumn(data, numericCols[0].name);
            seriesCols = numericCols.slice(1);
        } else {
            xAxisData = data.rows.map((_, i) => `Item ${i + 1}`);
        }

        const series = seriesCols.slice(0, 5).map(col => ({
            name: col.name,
            type: 'bar',
            data: CSVParser.getColumn(data, col.name),
            barMaxWidth: 40,
        }));

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
            yAxis: { type: 'value' },
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
        
        if (numericCols.length === 0) {
            return this._errorOption('箱线图需要数值数据');
        }

        // 按第一列分类（如果有分类列），或直接按列分组
        const catCols = CSVParser.getCategoricalColumns(data);
        let categories = [];
        let boxData = [];

        if (catCols.length > 0) {
            // 按分类分组
            const groups = {};
            const colIdx = numericCols[0].index;
            data.rows.forEach(row => {
                const cat = row[catCols[0].index] || 'Default';
                if (!groups[cat]) groups[cat] = [];
                if (row[colIdx] !== null) groups[cat].push(row[colIdx]);
            });
            categories = Object.keys(groups);
            boxData = categories.map(cat => this._computeBoxplotData(groups[cat]));
        } else {
            // 每列一个箱线
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
            grid: { left: 60, right: 40, top: 60, bottom: 60 },
            animation: false,
        };
    },

    /**
     * 热力图
     */
    heatmap(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        if (numericCols.length < 2) {
            return this._errorOption('热力图需要至少两列数值数据');
        }

        // 构建矩阵：取前两列数值作为 x, y，第三列（或计数）作为值
        const xCol = numericCols[0];
        const yCol = numericCols[1];
        const vCol = numericCols[2];
        
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
                    color: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7'],
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
     * 直方图
     */
    histogram(data, config) {
        const numericCols = CSVParser.getNumericColumns(data);
        if (numericCols.length === 0) {
            return this._errorOption('直方图需要数值数据');
        }

        const values = CSVParser.getColumn(data, numericCols[0].name).filter(v => v !== null);
        const bins = this._computeHistogram(values, 20);

        return {
            title: {
                text: config.title || `直方图 (${numericCols[0].name})`,
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
    return fn.call(ChartTemplates, data, config);
}
