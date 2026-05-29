/**
 * 子图编辑器
 * 从数据表中选择数据，使用 ECharts 渲染图表，支持基本绘图工具
 */

(function() {
    let chartDom = null;
    let chartInstance = null;
    let currentTool = 'select';
    let significancePendingClick = null;

    const TEMPLATE_SCHEMA = {
        scatter:    { x: 'numeric', y: 'numeric', group: 'categorical' },
        line:       { x: 'any',     y: 'numeric', group: 'categorical' },
        bar:        { x: 'any',     y: 'numeric', group: 'categorical' },
        group_bar:  { x: 'categorical', y: 'numeric', group: 'categorical' },
        group_line: { x: 'categorical', y: 'numeric', group: 'categorical' },
        boxplot:    { group: 'categorical', value: 'numeric' },
        heatmap:    { x: 'numeric', y: 'numeric', value: 'numeric' },
        histogram:  { x: 'numeric' },
        area:       { x: 'any', y: 'numeric', group: 'categorical' },
        stacked_bar: { x: 'categorical', y: 'numeric', group: 'categorical' },
        donut:      { x: 'categorical', y: 'numeric' },
        radar:      { group: 'categorical' },
        bubble:     { x: 'numeric', y: 'numeric', value: 'numeric', group: 'categorical' },
        correlation_matrix: {},
        violin:     { group: 'categorical', value: 'numeric' },
        waterfall:  { x: 'categorical', y: 'numeric' },
        dumbbell:   { x: 'categorical', y: 'numeric', group: 'numeric' },
        parallel:   { group: 'categorical' },
    };

    function init() {
        chartDom = document.getElementById('subfigure-chart');
        if (!chartDom) return;

        chartInstance = echarts.init(chartDom, null, { renderer: 'canvas' });
        AppState.subfigure.chartInstance = chartInstance;

        bindEvents();
        updateTableSelect();
        updateColumnMappingSelectors();
        applyMappingSchema();
        applyAspectRatio();
        syncAxisUI();
        updateErrorBarVisibility();
        updateErrorBarTypeVisibility();
        updateTrendLineVisibility();
        updateTrendLineDegreeVisibility();
        updateTrendLinePanelVisibility();
        renderEmptyChart();

        // 配色系统初始化
        initColorSchemeSelect();
        initPaletteEditor();
        initSeriesColorsPanel();
        syncColorSchemeUI();

        window.addEventListener('resize', () => chartInstance?.resize());
        window.addEventListener('tableschanged', () => {
            updateTableSelect();
            updateColumnMappingSelectors();
        });

        // 绘图工具事件
        initDrawingTools();

        // 图例控制面板初始化
        initLegendPanel();
    }

    function bindEvents() {
        // 数据表选择
        document.getElementById('sub-table-select')?.addEventListener('change', (e) => {
            AppState.subfigure.selectedTableId = e.target.value || null;
            resetColumnMapping();
            updateColumnMappingSelectors();
            refreshChart();
        });

        // 列映射选择器
        ['x', 'y', 'group', 'value'].forEach(field => {
            document.getElementById('sub-col-' + field)?.addEventListener('change', (e) => {
                AppState.subfigure.columnMapping[field] = e.target.value || null;
                refreshChart();
            });
        });

        // 模板选择
        document.querySelectorAll('#template-grid .template-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('#template-grid .template-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                AppState.subfigure.template = card.dataset.template;
                applyMappingSchema();
                updateTrendLinePanelVisibility();
                refreshChart();
            });
        });

        // 样式变更
        document.getElementById('color-scheme')?.addEventListener('change', (e) => {
            AppState.subfigure.colorScheme = e.target.value;
            refreshChart();
        });
        document.getElementById('font-family')?.addEventListener('change', (e) => {
            AppState.subfigure.fontFamily = e.target.value;
            refreshChart();
        });
        document.getElementById('font-size')?.addEventListener('input', (e) => {
            AppState.subfigure.fontSize = parseInt(e.target.value);
            refreshChart();
        });

        // 比例选择
        const aspectSelect = document.getElementById('sub-aspect-ratio');
        const customWRow = document.getElementById('sub-custom-size-row');
        const customHRow = document.getElementById('sub-custom-height-row');
        aspectSelect?.addEventListener('change', (e) => {
            AppState.subfigure.aspectRatio = e.target.value;
            const isCustom = e.target.value === 'custom';
            if (customWRow) customWRow.style.display = isCustom ? 'block' : 'none';
            if (customHRow) customHRow.style.display = isCustom ? 'block' : 'none';
            applyAspectRatio();
        });
        document.getElementById('sub-custom-width')?.addEventListener('change', (e) => {
            AppState.subfigure.customWidth = parseInt(e.target.value) || 600;
            applyAspectRatio();
        });
        document.getElementById('sub-custom-height')?.addEventListener('change', (e) => {
            AppState.subfigure.customHeight = parseInt(e.target.value) || 450;
            applyAspectRatio();
        });

        // 操作按钮
        document.getElementById('btn-snapshot-sub')?.addEventListener('click', createSubfigureSnapshot);
        document.getElementById('btn-stage-sub')?.addEventListener('click', stageToMain);

        // 坐标轴控制
        const axisFields = {
            'axis-title': { key: 'title', type: 'text' },
            'axis-x-label': { key: 'xLabel', type: 'text' },
            'axis-y-label': { key: 'yLabel', type: 'text' },
            'axis-x-min': { key: 'xMin', type: 'number' },
            'axis-x-max': { key: 'xMax', type: 'number' },
            'axis-y-min': { key: 'yMin', type: 'number' },
            'axis-y-max': { key: 'yMax', type: 'number' },
            'axis-x-scale': { key: 'xScale', type: 'text' },
            'axis-y-scale': { key: 'yScale', type: 'text' },
            'axis-title-position': { key: 'titlePosition', type: 'select' },
        };
        Object.entries(axisFields).forEach(([id, { key, type }]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = type === 'text' ? 'input' : 'change';
            el.addEventListener(evt, (e) => {
                let val = e.target.value;
                if (type === 'number') val = val === '' ? null : parseFloat(val);
                AppState.subfigure.axisConfig[key] = val;
                // 标题位置选择器切换时显示/隐藏手动滑块
                if (id === 'axis-title-position') {
                    updateTitleLeftRowVisibility();
                }
                refreshChart();
            });
        });

        document.getElementById('axis-title-show')?.addEventListener('change', (e) => {
            AppState.subfigure.axisConfig.titleShow = e.target.checked;
            refreshChart();
        });
        document.getElementById('axis-show-grid')?.addEventListener('change', (e) => {
            AppState.subfigure.axisConfig.showGrid = e.target.checked;
            refreshChart();
        });
        document.getElementById('axis-show-x-ticks')?.addEventListener('change', (e) => {
            AppState.subfigure.axisConfig.showXTicks = e.target.checked;
            refreshChart();
        });
        document.getElementById('axis-show-y-ticks')?.addEventListener('change', (e) => {
            AppState.subfigure.axisConfig.showYTicks = e.target.checked;
            refreshChart();
        });
        document.getElementById('axis-title-left')?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            AppState.subfigure.axisConfig.titleLeft = val + '%';
            document.getElementById('title-left-display').textContent = val + '%';
            refreshChart();
        });

        // 恢复标题自动位置
        document.getElementById('btn-title-auto-pos')?.addEventListener('click', () => {
            AppState.subfigure.axisConfig.titleLeft = null;
            const slider = document.getElementById('axis-title-left');
            if (slider) slider.value = 50;
            document.getElementById('title-left-display').textContent = '50%';
            refreshChart();
        });

        document.getElementById('btn-axis-reset')?.addEventListener('click', () => {
            AppState.subfigure.axisConfig = {
                title: '', xLabel: '', yLabel: '',
                xMin: null, xMax: null, yMin: null, yMax: null,
                xScale: 'value', yScale: 'value',
                showGrid: true, showXTicks: true, showYTicks: true,
                titleShow: true, titlePosition: 'center',
                titleLeft: null,
            };
            syncAxisUI();
            refreshChart();
        });

        // 误差棒控制
        document.getElementById('error-bar-enabled')?.addEventListener('change', (e) => {
            AppState.subfigure.errorBar.enabled = e.target.checked;
            updateErrorBarVisibility();
            refreshChart();
        });
        document.getElementById('error-bar-type')?.addEventListener('change', (e) => {
            AppState.subfigure.errorBar.type = e.target.value;
            updateErrorBarTypeVisibility();
            refreshChart();
        });
        ['yerr-plus', 'yerr-minus', 'xerr-plus', 'xerr-minus'].forEach(field => {
            const keyMap = {
                'yerr-plus': 'yErrorPlus',
                'yerr-minus': 'yErrorMinus',
                'xerr-plus': 'xErrorPlus',
                'xerr-minus': 'xErrorMinus',
            };
            document.getElementById('sub-col-' + field)?.addEventListener('change', (e) => {
                AppState.subfigure.errorBar[keyMap[field]] = e.target.value || null;
                refreshChart();
            });
        });
        document.getElementById('error-bar-fixed-value')?.addEventListener('change', (e) => {
            AppState.subfigure.errorBar.fixedValue = parseFloat(e.target.value) || 0;
            refreshChart();
        });
        document.getElementById('error-bar-percent-value')?.addEventListener('change', (e) => {
            AppState.subfigure.errorBar.percentValue = parseFloat(e.target.value) || 5;
            refreshChart();
        });

        document.getElementById('trend-line-enabled')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.enabled = e.target.checked;
            updateTrendLineVisibility();
            refreshChart();
        });
        document.getElementById('trend-line-type')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.type = e.target.value;
            updateTrendLineDegreeVisibility();
            refreshChart();
        });
        document.getElementById('trend-line-color')?.addEventListener('input', (e) => {
            AppState.subfigure.trendLine.color = e.target.value;
            refreshChart();
        });
        document.getElementById('trend-line-width')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.lineWidth = parseFloat(e.target.value) || 2;
            refreshChart();
        });
        document.getElementById('trend-line-style')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.lineStyle = e.target.value;
            refreshChart();
        });
        document.getElementById('trend-line-degree')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.degree = parseInt(e.target.value) || 2;
            refreshChart();
        });
        document.getElementById('trend-line-show-equation')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.showEquation = e.target.checked;
            refreshChart();
        });
        document.getElementById('trend-line-show-r2')?.addEventListener('change', (e) => {
            AppState.subfigure.trendLine.showR2 = e.target.checked;
            refreshChart();
        });

        // 单系列多色开关
        document.getElementById('use-data-point-colors')?.addEventListener('change', (e) => {
            AppState.subfigure.useDataPointColors = e.target.checked;
            refreshChart();
        });

        // 重置系列颜色
        document.getElementById('btn-reset-series-colors')?.addEventListener('click', () => {
            AppState.subfigure.customSeriesColors = {};
            refreshChart();
            updateSeriesColorsPanel();
        });

        // 管理自定义配色按钮
        document.getElementById('btn-manage-palettes')?.addEventListener('click', openPaletteEditor);
    }

    function updateTableSelect() {
        const select = document.getElementById('sub-table-select');
        if (!select) return;
        select.innerHTML = '<option value="">选择数据表...</option>' +
            AppState.tables.map(t => `<option value="${t.id}" ${t.id === AppState.subfigure.selectedTableId ? 'selected' : ''}>${t.name}</option>`).join('');
    }

    function resetColumnMapping() {
        AppState.subfigure.columnMapping = { x: null, y: null, group: null, value: null };
        AppState.subfigure.errorBar.yErrorPlus = null;
        AppState.subfigure.errorBar.yErrorMinus = null;
        AppState.subfigure.errorBar.xErrorPlus = null;
        AppState.subfigure.errorBar.xErrorMinus = null;
    }

    function updateColumnMappingSelectors() {
        const table = getTable(AppState.subfigure.selectedTableId);
        const tip = document.getElementById('col-mapping-tip');
        const panel = document.getElementById('panel-column-mapping');
        const errorPanel = document.getElementById('panel-error-bar');

        if (!table || !table.headers.length) {
            ['x', 'y', 'group', 'value'].forEach(field => {
                const sel = document.getElementById('sub-col-' + field);
                if (sel) sel.innerHTML = '<option value="">自动</option>';
            });
            ['yerr-plus', 'yerr-minus', 'xerr-plus', 'xerr-minus'].forEach(field => {
                const sel = document.getElementById('sub-col-' + field);
                if (sel) sel.innerHTML = '<option value="">无</option>';
            });
            if (tip) tip.style.display = '';
            if (panel) panel.style.display = 'none';
            if (errorPanel) errorPanel.style.display = 'none';
            return;
        }

        if (panel) panel.style.display = '';
        if (tip) tip.style.display = 'none';

        const data = { headers: table.headers, rows: table.rows };
        const numericCols = CSVParser.getNumericColumns(data).map(c => c.name);
        const catCols = CSVParser.getCategoricalColumns(data).map(c => c.name);
        const allCols = table.headers;

        const schema = TEMPLATE_SCHEMA[AppState.subfigure.template] || {};

        ['x', 'y', 'group', 'value'].forEach(field => {
            const sel = document.getElementById('sub-col-' + field);
            if (!sel) return;

            const filter = schema[field];
            let cols = allCols;
            if (filter === 'numeric') cols = numericCols;
            else if (filter === 'categorical') cols = catCols;

            const current = AppState.subfigure.columnMapping[field];
            sel.innerHTML = '<option value="">自动</option>' +
                cols.map(name => {
                    const selected = name === current ? ' selected' : '';
                    return `<option value="${name}"${selected}>${name}</option>`;
                }).join('');
        });

        const supportsErrorBar = ['scatter', 'line', 'bar', 'group_bar', 'group_line'].includes(AppState.subfigure.template);
        if (errorPanel) errorPanel.style.display = supportsErrorBar ? '' : 'none';

        ['yerr-plus', 'yerr-minus', 'xerr-plus', 'xerr-minus'].forEach(field => {
            const sel = document.getElementById('sub-col-' + field);
            if (!sel) return;
            const keyMap = {
                'yerr-plus': 'yErrorPlus',
                'yerr-minus': 'yErrorMinus',
                'xerr-plus': 'xErrorPlus',
                'xerr-minus': 'xErrorMinus',
            };
            const current = AppState.subfigure.errorBar[keyMap[field]];
            sel.innerHTML = '<option value="">无</option>' +
                numericCols.map(name => {
                    const selected = name === current ? ' selected' : '';
                    return `<option value="${name}"${selected}>${name}</option>`;
                }).join('');
        });

        applyMappingSchema();
        updateErrorBarVisibility();
        updateErrorBarTypeVisibility();
    }

    function applyMappingSchema() {
        const schema = TEMPLATE_SCHEMA[AppState.subfigure.template] || {};
        ['x', 'y', 'group', 'value'].forEach(field => {
            const row = document.getElementById('mapping-row-' + field);
            if (row) {
                row.style.display = schema[field] ? '' : 'none';
            }
        });
    }

    function applyAspectRatio() {
        if (!chartDom) return;
        const ratio = AppState.subfigure.aspectRatio;
        let w, h;
        switch (ratio) {
            case '4:3': w = 600; h = 450; break;
            case '16:9': w = 640; h = 360; break;
            case '1:1': w = 500; h = 500; break;
            case '3:4': w = 450; h = 600; break;
            case 'custom':
            default: w = AppState.subfigure.customWidth; h = AppState.subfigure.customHeight; break;
        }
        chartDom.style.width = w + 'px';
        chartDom.style.height = h + 'px';
        chartDom.style.margin = '0 auto';
        chartInstance?.resize();
    }

    function syncAxisUI() {
        const cfg = AppState.subfigure.axisConfig;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
        setVal('axis-title', cfg.title);
        setVal('axis-x-label', cfg.xLabel);
        setVal('axis-y-label', cfg.yLabel);
        setVal('axis-x-min', cfg.xMin);
        setVal('axis-x-max', cfg.xMax);
        setVal('axis-y-min', cfg.yMin);
        setVal('axis-y-max', cfg.yMax);
        setVal('axis-x-scale', cfg.xScale);
        setVal('axis-y-scale', cfg.yScale);
        setVal('axis-title-position', cfg.titlePosition);
        setChk('axis-title-show', cfg.titleShow);
        setChk('axis-show-grid', cfg.showGrid);
        setChk('axis-show-x-ticks', cfg.showXTicks);
        setChk('axis-show-y-ticks', cfg.showYTicks);

        // 同步手动标题位置控件的显示
        const titleLeftRow = document.getElementById('axis-title-left-row');
        const btnAutoPosRow = document.getElementById('btn-title-auto-pos-row');
        if (titleLeftRow) titleLeftRow.style.display = (cfg.titlePosition === 'manual') ? '' : 'none';
        if (btnAutoPosRow) btnAutoPosRow.style.display = (cfg.titlePosition === 'manual') ? '' : 'none';
        const titleLeftSlider = document.getElementById('axis-title-left');
        const titleLeftDisplay = document.getElementById('title-left-display');
        if (titleLeftSlider && titleLeftDisplay) {
            const tl = cfg.titleLeft;
            if (tl != null) {
                const val = parseInt(tl);
                titleLeftSlider.value = isNaN(val) ? 50 : val;
                titleLeftDisplay.textContent = (isNaN(val) ? 50 : val) + '%';
            }
        }

        // 同步画布比例选择器
        const aspectSelect = document.getElementById('sub-aspect-ratio');
        if (aspectSelect) aspectSelect.value = AppState.subfigure.aspectRatio || '16:9';
        const customWRow = document.getElementById('sub-custom-size-row');
        const customHRow = document.getElementById('sub-custom-height-row');
        if (customWRow) customWRow.style.display = (AppState.subfigure.aspectRatio === 'custom') ? 'block' : 'none';
        if (customHRow) customHRow.style.display = (AppState.subfigure.aspectRatio === 'custom') ? 'block' : 'none';
    }

    function updateErrorBarVisibility() {
        const controls = document.getElementById('error-bar-controls');
        if (controls) controls.style.display = AppState.subfigure.errorBar.enabled ? '' : 'none';
    }

    function updateErrorBarTypeVisibility() {
        const type = AppState.subfigure.errorBar.type;
        const colControls = document.getElementById('error-bar-column-controls');
        const fixedRow = document.getElementById('error-bar-fixed-row');
        const percentRow = document.getElementById('error-bar-percent-row');
        if (colControls) colControls.style.display = type === 'column' ? '' : 'none';
        if (fixedRow) fixedRow.style.display = type === 'fixed' ? '' : 'none';
        if (percentRow) percentRow.style.display = type === 'percent' ? '' : 'none';
    }

    function updateTrendLineVisibility() {
        const controls = document.getElementById('trend-line-controls');
        if (controls) controls.style.display = AppState.subfigure.trendLine.enabled ? '' : 'none';
    }

    function updateTrendLineDegreeVisibility() {
        const degreeRow = document.getElementById('trend-line-degree-row');
        if (degreeRow) degreeRow.style.display = AppState.subfigure.trendLine.type === 'polynomial' ? '' : 'none';
    }

    function updateTrendLinePanelVisibility() {
        const panel = document.getElementById('panel-trend-line');
        if (panel) {
            const supportsTrendLine = ['scatter', 'line', 'area', 'bubble'].includes(AppState.subfigure.template);
            panel.style.display = supportsTrendLine ? '' : 'none';
        }
    }

    function updateTitleLeftRowVisibility() {
        const isManual = AppState.subfigure.axisConfig.titlePosition === 'manual';
        const titleLeftRow = document.getElementById('axis-title-left-row');
        const btnAutoPosRow = document.getElementById('btn-title-auto-pos-row');
        if (titleLeftRow) titleLeftRow.style.display = isManual ? '' : 'none';
        if (btnAutoPosRow) btnAutoPosRow.style.display = isManual ? '' : 'none';
    }

    function applyAxisConfig(option) {
        const cfg = AppState.subfigure.axisConfig;

        if (cfg.titleShow) {
            const titleLeft = cfg.titlePosition === 'manual' && cfg.titleLeft != null
                ? cfg.titleLeft
                : cfg.titlePosition;
            if (option.title) {
                option.title.left = titleLeft;
                if (cfg.title) option.title.text = cfg.title;
            } else {
                option.title = {
                    text: cfg.title,
                    left: titleLeft,
                    textStyle: { fontSize: AppState.subfigure.fontSize + 4 },
                };
            }
        } else if (!cfg.titleShow) {
            option.title = { show: false };
        }

        const gridShow = cfg.showGrid;

        if (option.xAxis) {
            const applyX = (ax) => {
                if (cfg.xLabel) ax.name = cfg.xLabel;
                if (ax.type === 'value' || ax.type === 'log') {
                    if (cfg.xScale === 'log' && ax.type !== 'category') ax.type = 'log';
                    if (cfg.xMin !== null) ax.min = cfg.xMin;
                    if (cfg.xMax !== null) ax.max = cfg.xMax;
                }
                ax.splitLine = { show: gridShow };
                ax.axisTick = { show: cfg.showXTicks };
            };
            if (Array.isArray(option.xAxis)) option.xAxis.forEach(applyX);
            else applyX(option.xAxis);
        }

        if (option.yAxis) {
            const applyY = (ax) => {
                if (cfg.yLabel) ax.name = cfg.yLabel;
                if (ax.type === 'value' || ax.type === 'log') {
                    if (cfg.yScale === 'log' && ax.type !== 'category') ax.type = 'log';
                    if (cfg.yMin !== null) ax.min = cfg.yMin;
                    if (cfg.yMax !== null) ax.max = cfg.yMax;
                }
                ax.splitLine = { show: gridShow };
                ax.axisTick = { show: cfg.showYTicks };
            };
            if (Array.isArray(option.yAxis)) option.yAxis.forEach(applyY);
            else applyY(option.yAxis);
        }
    }

    function renderEmptyChart() {
        if (!chartInstance) return;
        chartInstance.setOption({
            title: {
                text: '请选择数据表',
                subtext: '在左侧选择已导入的数据表',
                left: 'center',
                top: 'center',
                textStyle: { color: '#9ca3af', fontSize: 16 },
                subtextStyle: { color: '#d1d5db', fontSize: 13 },
            },
            animation: false,
        }, true);
    }

    function refreshChart() {
        if (!chartInstance) return;

        const table = getTable(AppState.subfigure.selectedTableId);
        if (!table || !table.headers.length) {
            renderEmptyChart();
            return;
        }

        const data = { headers: table.headers, rows: table.rows };

        const config = {
            title: AppState.subfigure.template,
            fontSize: AppState.subfigure.fontSize,
            fontFamily: AppState.subfigure.fontFamily,
            columnMapping: { ...AppState.subfigure.columnMapping },
            errorBar: { ...AppState.subfigure.errorBar },
            trendLine: { ...AppState.subfigure.trendLine },
        };

        const option = renderChart(AppState.subfigure.template, data, config);

        const theme = getEChartsTheme(AppState.subfigure.colorScheme);
        Object.assign(option, {
            color: theme.color,
            textStyle: theme.textStyle,
        });

        if (option.xAxis) {
            const axisConfig = option.xAxis.type === 'value' ? theme.valueAxis : theme.categoryAxis;
            if (Array.isArray(option.xAxis)) {
                option.xAxis.forEach(ax => Object.assign(ax, axisConfig));
            } else {
                Object.assign(option.xAxis, axisConfig);
            }
        }
        if (option.yAxis) {
            if (Array.isArray(option.yAxis)) {
                option.yAxis.forEach(ax => Object.assign(ax, theme.valueAxis));
            } else {
                Object.assign(option.yAxis, theme.valueAxis);
            }
        }

        applyAxisConfig(option);

        // 应用手动设置的系列颜色（按 series.name 匹配）
        if (option.series && AppState.subfigure.customSeriesColors) {
            option.series.forEach(s => {
                if (s.name && AppState.subfigure.customSeriesColors[s.name]) {
                    const customColor = AppState.subfigure.customSeriesColors[s.name];
                    if (!s.itemStyle) s.itemStyle = {};
                    s.itemStyle.color = customColor;
                    if (s.lineStyle) s.lineStyle.color = customColor;
                }
                // 对 pie/radar 等单 series 多数据项图表，按 data[i].name 匹配颜色
                if (s.data && Array.isArray(s.data)) {
                    s.data.forEach(d => {
                        const itemName = d && d.name;
                        if (itemName && AppState.subfigure.customSeriesColors[itemName]) {
                            const customColor = AppState.subfigure.customSeriesColors[itemName];
                            if (typeof d === 'object' && d !== null) {
                                if (!d.itemStyle) d.itemStyle = {};
                                d.itemStyle.color = customColor;
                            }
                        }
                    });
                }
            });
        }

        // 单系列数据点多色支持
        const templatesSupportingDataPointColors = ['scatter', 'line', 'bar', 'area', 'histogram', 'boxplot', 'violin'];
        if (AppState.subfigure.useDataPointColors &&
            templatesSupportingDataPointColors.includes(AppState.subfigure.template) &&
            option.series && option.series.length === 1) {
            const s = option.series[0];
            if (!s.itemStyle) s.itemStyle = {};
            s.itemStyle.color = getDataPointColorCallback(AppState.subfigure.colorScheme, s.data?.length || 1);
        }

        const graphics = buildGraphicElements();
        if (option._trendLineGraphic) {
            graphics.push(...option._trendLineGraphic);
            delete option._trendLineGraphic;
        }
        if (graphics.length > 0) {
            option.graphic = graphics;
        }

        chartInstance.setOption(option, true);

        // 更新系列颜色微调面板
        updateSeriesColorsPanel();
        updateLegendPanel();
    }

    // ===== 绘图工具 =====

    function initDrawingTools() {
        document.querySelectorAll('#sub-tool-grid .tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#sub-tool-grid .tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTool = btn.dataset.tool;
            });
        });

        if (!chartInstance) return;

        chartInstance.getZr().on('click', (params) => {
            if (currentTool === 'select') return;

            const point = [params.offsetX, params.offsetY];
            const tool = currentTool;

            if (tool === 'significance') {
                if (!significancePendingClick) {
                    significancePendingClick = point;
                    Toast.info('请点击第二个位置以完成显著性标注');
                    return;
                }
                const firstPoint = significancePendingClick;
                significancePendingClick = null;
                currentTool = 'select';
                document.querySelectorAll('#sub-tool-grid .tool-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('#sub-tool-grid .tool-btn[data-tool="select"]')?.classList.add('active');
                addSignificanceAnnotation(firstPoint, point);
                return;
            }

            currentTool = 'select';
            document.querySelectorAll('#sub-tool-grid .tool-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('#sub-tool-grid .tool-btn[data-tool="select"]')?.classList.add('active');

            addShape(tool, point);
        });
    }

    function addShape(type, point) {
        const [x, y] = point;
        const id = generateId();
        let shape = null;

        switch (type) {
            case 'text':
                const text = prompt('请输入文本:', '标注');
                if (!text) return;
                shape = { id, type: 'text', x, y, text, fontSize: 14, color: '#333' };
                break;
            case 'rect':
                shape = { id, type: 'rect', x, y, width: 80, height: 50, fill: 'rgba(37,99,235,0.15)', stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'roundedRect':
                shape = { id, type: 'roundedRect', x, y, width: 80, height: 50, r: 8, fill: 'rgba(37,99,235,0.15)', stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'ellipse':
                shape = { id, type: 'ellipse', x, y, rx: 50, ry: 30, fill: 'rgba(37,99,235,0.15)', stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'circle':
                shape = { id, type: 'circle', x, y, r: 30, fill: 'rgba(37,99,235,0.15)', stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'triangle':
                shape = { id, type: 'triangle', x, y, width: 60, height: 50, fill: 'rgba(37,99,235,0.15)', stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'line':
                shape = { id, type: 'line', x, y, x2: x + 60, y2: y + 40, stroke: '#2563eb', lineWidth: 2 };
                break;
            case 'arrow':
                shape = { id, type: 'arrow', x, y, x2: x + 60, y2: y + 40, stroke: '#2563eb', lineWidth: 2 };
                break;
        }

        if (shape) {
            const before = JSON.parse(JSON.stringify(AppState.subfigure.shapes));
            AppState.subfigure.shapes.push(shape);
            const after = JSON.parse(JSON.stringify(AppState.subfigure.shapes));
            HistoryManager.push(HistoryManager.createSnapshotAction('subfigure.shapes', before, after, '添加形状: ' + type));
            refreshChart();
        }
    }

    function buildGraphicElements() {
        const graphics = [];

        // 文本叠加层
        AppState.subfigure.textOverlays.forEach(t => {
            graphics.push({
                type: 'text',
                id: t.id,
                left: t.x,
                top: t.y,
                style: {
                    text: t.text,
                    font: `${t.fontSize}px ${t.fontFamily}`,
                    fill: t.color,
                },
                draggable: true,
                cursor: 'move',
                ondragend: function(params) {
                    const el = AppState.subfigure.textOverlays.find(o => o.id === t.id);
                    if (el) { el.x = params.target.x; el.y = params.target.y; }
                },
            });
        });

        // 绘图工具形状
        AppState.subfigure.shapes.forEach(s => {
            const savePos = (params) => {
                const el = AppState.subfigure.shapes.find(sh => sh.id === s.id);
                if (!el) return;
                if (s.type === 'line' || s.type === 'arrow') {
                    const dx = (params.target?.shape?.x1 || s.x) - s.x;
                    const dy = (params.target?.shape?.y1 || s.y) - s.y;
                    el.x += dx; el.y += dy;
                    el.x2 += dx; el.y2 += dy;
                } else {
                    el.x = params.target?.x ?? s.x;
                    el.y = params.target?.y ?? s.y;
                }
            };
            switch (s.type) {
                case 'text':
                    graphics.push({
                        type: 'text', left: s.x, top: s.y,
                        style: { text: s.text, font: `${s.fontSize}px Arial`, fill: s.color },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'rect':
                    graphics.push({
                        type: 'rect', left: s.x, top: s.y,
                        shape: { width: s.width, height: s.height, r: s.r || 0 },
                        style: { fill: s.fill, stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'roundedRect':
                    graphics.push({
                        type: 'rect', left: s.x, top: s.y,
                        shape: { width: s.width, height: s.height, r: s.r || 8 },
                        style: { fill: s.fill, stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'ellipse':
                    graphics.push({
                        type: 'ellipse', left: s.x, top: s.y,
                        shape: { cx: 0, cy: 0, rx: s.rx, ry: s.ry },
                        style: { fill: s.fill, stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'circle':
                    graphics.push({
                        type: 'circle', left: s.x, top: s.y,
                        shape: { r: s.r },
                        style: { fill: s.fill, stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'triangle':
                    graphics.push({
                        type: 'polygon', left: s.x, top: s.y,
                        shape: { points: [[0, s.height], [s.width/2, 0], [s.width, s.height]] },
                        style: { fill: s.fill, stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
                case 'line':
                case 'arrow':
                    graphics.push({
                        type: 'line', left: 0, top: 0,
                        shape: { x1: s.x, y1: s.y, x2: s.x2, y2: s.y2 },
                        style: { stroke: s.stroke, lineWidth: s.lineWidth },
                        draggable: true, ondragend: savePos,
                    });
                    break;
            }
        });

        AppState.subfigure.significanceAnnotations.forEach(ann => {
            const by = ann.bracketY;
            graphics.push({
                type: 'line', left: 0, top: 0,
                shape: { x1: ann.x1, y1: ann.y1, x2: ann.x1, y2: by },
                style: { stroke: ann.color, lineWidth: ann.lineWidth },
                silent: true,
            });
            graphics.push({
                type: 'line', left: 0, top: 0,
                shape: { x1: ann.x1, y1: by, x2: ann.x2, y2: by },
                style: { stroke: ann.color, lineWidth: ann.lineWidth },
                silent: true,
            });
            graphics.push({
                type: 'line', left: 0, top: 0,
                shape: { x1: ann.x2, y1: ann.y2, x2: ann.x2, y2: by },
                style: { stroke: ann.color, lineWidth: ann.lineWidth },
                silent: true,
            });
            graphics.push({
                type: 'text',
                left: (ann.x1 + ann.x2) / 2,
                top: by - ann.fontSize - 2,
                style: {
                    text: ann.label,
                    font: `bold ${ann.fontSize}px Arial`,
                    fill: ann.color,
                    textAlign: 'center',
                    textVerticalAlign: 'bottom',
                },
                silent: true,
            });
        });

        return graphics;
    }

    function addSignificanceAnnotation(point1, point2) {
        const labelOptions = ['ns', '*', '**', '***', '****'];
        const labelStr = labelOptions.join(' / ');
        const text = prompt(`请输入显著性标记 (${labelStr} 或自定义):`, '*');
        if (!text && text !== '') return;

        const [x1, y1] = point1;
        const [x2, y2] = point2;
        const id = generateId();
        const bracketY = Math.min(y1, y2) - 20;
        const tickLength = 10;

        const annotation = {
            id,
            x1, y1,
            x2, y2,
            bracketY,
            tickLength,
            label: text || 'ns',
            fontSize: 14,
            color: '#333',
            lineWidth: 1.5,
        };

        const before = JSON.parse(JSON.stringify(AppState.subfigure.significanceAnnotations));
        AppState.subfigure.significanceAnnotations.push(annotation);
        const after = JSON.parse(JSON.stringify(AppState.subfigure.significanceAnnotations));
        HistoryManager.push(HistoryManager.createSnapshotAction(
            'subfigure.significanceAnnotations', before, after, '添加显著性标注: ' + annotation.label
        ));
        refreshChart();
    }

    // ===== 暂存与发送 =====

    function buildSubfigureMeta() {
        return {
            selectedTableId: AppState.subfigure.selectedTableId,
            template: AppState.subfigure.template,
            colorScheme: AppState.subfigure.colorScheme,
            fontFamily: AppState.subfigure.fontFamily,
            fontSize: AppState.subfigure.fontSize,
            textOverlays: AppState.subfigure.textOverlays,
            shapes: AppState.subfigure.shapes,
            aspectRatio: AppState.subfigure.aspectRatio,
            customWidth: AppState.subfigure.customWidth,
            customHeight: AppState.subfigure.customHeight,
            columnMapping: { ...AppState.subfigure.columnMapping },
            axisConfig: { ...AppState.subfigure.axisConfig },
            errorBar: { ...AppState.subfigure.errorBar },
            trendLine: { ...AppState.subfigure.trendLine },
            significanceAnnotations: JSON.parse(JSON.stringify(AppState.subfigure.significanceAnnotations)),
            useDataPointColors: AppState.subfigure.useDataPointColors,
            customSeriesColors: { ...AppState.subfigure.customSeriesColors },
        };
    }

    function createSubfigureSnapshot() {
        if (!chartInstance) return;
        const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
        const beforeSnapshots = HistoryManager.captureSnapshotState();
        const snapshot = createSnapshot(
            `子图 ${AppState.subfigure.template}`,
            'subfigure',
            url,
            buildSubfigureMeta()
        );
        const afterSnapshots = HistoryManager.captureSnapshotState();
        HistoryManager.push(HistoryManager.createSnapshotAction('snapshots', beforeSnapshots, afterSnapshots, '暂存子图: ' + snapshot.name));
        updateSnapshotList();
        Toast.success(`已暂存: ${snapshot.name}`);
    }

    function stageToMain() {
        if (!chartInstance) return;
        const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
        const subfigureData = buildSubfigureMeta();

        const beforeSnapshots = HistoryManager.captureSnapshotState();
        const snapshot = createSnapshot(
            `子图 ${AppState.subfigure.template}`,
            'subfigure',
            url,
            subfigureData
        );
        const afterSnapshots = HistoryManager.captureSnapshotState();

        HistoryManager.beginBatch('发送到主图');
        HistoryManager.push(HistoryManager.createSnapshotAction('snapshots', beforeSnapshots, afterSnapshots, '暂存子图'));

        window.dispatchEvent(new CustomEvent('addsubfigure', {
            detail: {
                imageUrl: url,
                name: `子图 ${AppState.subfigure.template}`,
                snapshotId: snapshot.id,
                subfigureData: JSON.parse(JSON.stringify(subfigureData)),
            }
        }));
        switchPage('mainfigure');
    }

    function updateSnapshotList() {
        const container = document.getElementById('snapshot-list');
        if (!container) return;
        const snapshots = getSnapshotsByType('subfigure');
        if (snapshots.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无暂存子图</p>';
            return;
        }
        container.innerHTML = snapshots.map(s => `
            <div class="snapshot-item" draggable="true" data-id="${s.id}">
                <div class="snapshot-thumb"><img src="${s.thumbnail}" alt="${s.name}"></div>
                <div class="snapshot-meta">
                    <span class="snapshot-name">${s.name}</span>
                    <button class="snapshot-delete" data-id="${s.id}">删除</button>
                </div>
                <span class="snapshot-time">${new Date(s.timestamp).toLocaleString()}</span>
            </div>
        `).join('');

        container.querySelectorAll('.snapshot-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('snapshot-id', item.dataset.id);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
        container.querySelectorAll('.snapshot-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const before = HistoryManager.captureSnapshotState();
                deleteSnapshot(btn.dataset.id);
                const after = HistoryManager.captureSnapshotState();
                HistoryManager.push(HistoryManager.createSnapshotAction('snapshots', before, after, '删除暂存子图'));
                updateSnapshotList();
            });
        });
    }

    // ===== 配色系统 =====

    function initColorSchemeSelect() {
        const select = document.getElementById('color-scheme');
        if (!select) return;
        select.addEventListener('change', (e) => {
            AppState.subfigure.colorScheme = e.target.value;
            // 切换配色时重置系列颜色微调
            AppState.subfigure.customSeriesColors = {};
            refreshChart();
        });
    }

    function syncColorSchemeUI() {
        const select = document.getElementById('color-scheme');
        if (!select) return;
        const current = AppState.subfigure.colorScheme;
        const allSchemes = getAllColorSchemes();
        select.innerHTML = '';
        Object.entries(allSchemes).forEach(([key, scheme]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = scheme.name || key;
            if (key === current) opt.selected = true;
            select.appendChild(opt);
        });

        // 同步单系列多色开关
        const cb = document.getElementById('use-data-point-colors');
        if (cb) cb.checked = !!AppState.subfigure.useDataPointColors;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== 图例控制面板 =====

    let selectedLegendItem = null;

    function initLegendPanel() {
        // 颜色修改
        document.getElementById('legend-editor-color')?.addEventListener('input', (e) => {
            if (!selectedLegendItem) return;
            if (!AppState.subfigure.customSeriesColors) {
                AppState.subfigure.customSeriesColors = {};
            }
            AppState.subfigure.customSeriesColors[selectedLegendItem] = e.target.value;
            refreshChart();
        });

        // 字体修改
        document.getElementById('legend-editor-font-family')?.addEventListener('change', (e) => {
            if (!selectedLegendItem) return;
            AppState.subfigure.fontFamily = e.target.value;
            refreshChart();
        });

        // 字号修改
        document.getElementById('legend-editor-font-size')?.addEventListener('input', (e) => {
            if (!selectedLegendItem) return;
            AppState.subfigure.fontSize = parseInt(e.target.value);
            refreshChart();
        });
    }

    function updateLegendPanel() {
        const container = document.getElementById('legend-items-container');
        const emptyTip = document.getElementById('legend-empty-tip');
        const editor = document.getElementById('legend-item-editor');
        if (!container) return;

        const option = chartInstance.getOption();
        const legend = option.legend?.[0] || option.legend;

        // 没有图例时显示空提示
        if (!legend) {
            container.innerHTML = '';
            if (emptyTip) emptyTip.style.display = '';
            if (editor) editor.style.display = 'none';
            selectedLegendItem = null;
            return;
        }
        if (emptyTip) emptyTip.style.display = 'none';

        // 获取当前选中状态
        const selectedMap = legend.selected || {};

        // 图例条目来源：legend.data > 从 series/data 提取
        // 严格只显示 ECharts 会渲染在图例上的条目，过滤辅助 series
        let legendData = [];
        if (legend.data && legend.data.length) {
            legendData = legend.data;
        } else {
            const isAuxSeries = (name) => {
                return name === 'base' || name === '连接线' || name === '误差棒' ||
                    name.includes('误差') || name.includes('趋势线') ||
                    name.endsWith('_left') || name.endsWith('_right');
            };

            // 对于 pie/radar 等单 series 多数据项图表，从 data[].name 提取
            const firstSeries = option.series?.[0];
            if (firstSeries && firstSeries.data && Array.isArray(firstSeries.data) &&
                firstSeries.data.some(d => d && d.name)) {
                legendData = firstSeries.data
                    .filter(d => d && d.name && !isAuxSeries(d.name))
                    .map(d => d.name);
            } else {
                // 标准图表：从 series[].name 提取
                legendData = (option.series || [])
                    .filter(s => s.name && !isAuxSeries(s.name))
                    .map(s => s.name);
            }
        }

        // 去重并过滤空值
        legendData = [...new Set(legendData)].filter(n => n != null && n !== '');

        if (legendData.length === 0) {
            container.innerHTML = '';
            if (emptyTip) emptyTip.style.display = '';
            if (editor) editor.style.display = 'none';
            selectedLegendItem = null;
            return;
        }

        // 渲染列表
        container.innerHTML = '';
        legendData.forEach(name => {
            const item = document.createElement('div');
            item.className = 'column-checkitem';
            item.dataset.name = name;

            const isChecked = selectedMap[name] !== false;
            const isActive = selectedLegendItem === name;
            if (isActive) item.classList.add('active');

            item.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor:pointer;">
                <span style="flex:1; font-size:13px; cursor:pointer; user-select:none;">${escapeHtml(name)}</span>
            `;

            const checkbox = item.querySelector('input[type="checkbox"]');
            const labelSpan = item.querySelector('span');

            // 复选框切换可见性（阻止冒泡避免触发 item 的 click）
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            checkbox.addEventListener('change', () => {
                chartInstance.dispatchAction({
                    type: 'legendToggleSelect',
                    name: name,
                });
            });

            // 点击文字区域选中条目
            labelSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                selectLegendItem(name);
            });

            // 点击条目空白区域也选中条目
            item.addEventListener('click', () => {
                selectLegendItem(name);
            });

            container.appendChild(item);
        });

        // 如果之前有选中的条目，刷新编辑器显示
        if (selectedLegendItem && legendData.includes(selectedLegendItem)) {
            selectLegendItem(selectedLegendItem);
        } else {
            selectedLegendItem = null;
            if (editor) editor.style.display = 'none';
            container.querySelectorAll('.column-checkitem').forEach(el => el.classList.remove('active'));
        }
    }

    function selectLegendItem(name) {
        selectedLegendItem = name;

        // 高亮列表项
        const container = document.getElementById('legend-items-container');
        container?.querySelectorAll('.column-checkitem').forEach(el => {
            el.classList.toggle('active', el.dataset.name === name);
        });

        // 显示并填充编辑器
        const editor = document.getElementById('legend-item-editor');
        const nameSpan = document.getElementById('legend-editor-series-name');
        const colorInput = document.getElementById('legend-editor-color');
        const fontSelect = document.getElementById('legend-editor-font-family');
        const sizeInput = document.getElementById('legend-editor-font-size');
        if (!editor) return;

        editor.style.display = '';
        if (nameSpan) nameSpan.textContent = name;

        // 读取当前颜色
        const customColor = AppState.subfigure.customSeriesColors?.[name];
        const scheme = getColorScheme(AppState.subfigure.colorScheme);
        if (colorInput) {
            colorInput.value = customColor || scheme.colors[0] || '#999999';
        }

        // 字体/字号：从全局取默认值
        if (fontSelect) fontSelect.value = AppState.subfigure.fontFamily;
        if (sizeInput) sizeInput.value = AppState.subfigure.fontSize;
    }

    function initSeriesColorsPanel() {
        updateSeriesColorsPanel();
    }

    function updateSeriesColorsPanel() {
        const row = document.getElementById('series-colors-row');
        const container = document.getElementById('series-colors-container');
        if (!row || !container || !chartInstance) return;

        // 获取当前 option 中的 series 名称
        const option = chartInstance.getOption();
        const seriesList = (option.series || []).filter(s => s.name && s.name !== 'base' && s.name !== '连接线');
        if (seriesList.length === 0) {
            row.style.display = 'none';
            return;
        }

        row.style.display = '';
        const scheme = getColorScheme(AppState.subfigure.colorScheme);
        const colors = scheme.colors || ['#999999'];

        container.innerHTML = seriesList.map((s, idx) => {
            const name = s.name;
            const currentColor = AppState.subfigure.customSeriesColors?.[name] || colors[idx % colors.length];
            return `
                <div class="series-color-item">
                    <input type="color" value="${currentColor}" data-series-name="${name}">
                    <span class="series-color-name">${name}</span>
                </div>
            `;
        }).join('');

        container.querySelectorAll('input[type="color"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const seriesName = e.target.dataset.seriesName;
                if (!AppState.subfigure.customSeriesColors) {
                    AppState.subfigure.customSeriesColors = {};
                }
                AppState.subfigure.customSeriesColors[seriesName] = e.target.value;
                refreshChart();
            });
        });
    }

    // ===== 配色编辑器 =====

    let currentEditingPaletteId = null;

    function initPaletteEditor() {
        const modal = document.getElementById('palette-editor-modal');
        const closeBtn = document.getElementById('palette-modal-close');
        const baseSelect = document.getElementById('palette-base');
        const addColorBtn = document.getElementById('btn-add-palette-color');
        const removeColorBtn = document.getElementById('btn-remove-palette-color');
        const saveBtn = document.getElementById('btn-save-palette');
        const updateBtn = document.getElementById('btn-update-palette');
        const deleteBtn = document.getElementById('btn-delete-palette');
        const exportBtn = document.getElementById('btn-export-palette');
        const importBtn = document.getElementById('btn-import-palette');
        const importFile = document.getElementById('palette-import-file');

        closeBtn?.addEventListener('click', closePaletteEditor);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closePaletteEditor();
        });

        baseSelect?.addEventListener('change', () => {
            const base = getColorScheme(baseSelect.value);
            renderPaletteColors(base.colors || ['#2563eb', '#3b82f6']);
            document.getElementById('palette-bg-color').value = base.background || '#ffffff';
            document.getElementById('palette-text-color').value = base.text || '#1f2937';
            document.getElementById('palette-grid-color').value = base.grid || '#e5e7eb';
            updatePalettePreview();
        });

        addColorBtn?.addEventListener('click', () => {
            const container = document.getElementById('palette-colors-container');
            const inputs = container.querySelectorAll('input[type="color"]');
            if (inputs.length >= 12) {
                Toast.warn('最多12个颜色');
                return;
            }
            const lastColor = inputs.length > 0 ? inputs[inputs.length - 1].value : '#2563eb';
            addPaletteColorInput(lastColor);
            updatePalettePreview();
        });

        removeColorBtn?.addEventListener('click', () => {
            const container = document.getElementById('palette-colors-container');
            const inputs = container.querySelectorAll('input[type="color"]');
            if (inputs.length <= 2) {
                Toast.warn('最少需要2个颜色');
                return;
            }
            inputs[inputs.length - 1].parentElement.remove();
            updatePalettePreview();
        });

        saveBtn?.addEventListener('click', () => {
            const name = document.getElementById('palette-name').value.trim();
            if (!name) {
                Toast.warn('请输入配色名称');
                return;
            }
            const palette = createCustomPalette(name, 'academic');
            applyPaletteFromEditor(palette.id);
            Toast.success(`已保存自定义配色: ${name}`);
            syncColorSchemeUI();
            closePaletteEditor();
        });

        updateBtn?.addEventListener('click', () => {
            if (!currentEditingPaletteId || !AppState.customPalettes[currentEditingPaletteId]) {
                Toast.warn('请先选择一个自定义配色');
                return;
            }
            const name = document.getElementById('palette-name').value.trim();
            if (!name) {
                Toast.warn('请输入配色名称');
                return;
            }
            applyPaletteFromEditor(currentEditingPaletteId);
            Toast.success('已更新自定义配色');
            syncColorSchemeUI();
            closePaletteEditor();
        });

        deleteBtn?.addEventListener('click', () => {
            if (!currentEditingPaletteId || !AppState.customPalettes[currentEditingPaletteId]) {
                Toast.warn('没有可删除的自定义配色');
                return;
            }
            if (!confirm('确定要删除此自定义配色吗？')) return;
            deleteCustomPalette(currentEditingPaletteId);
            Toast.success('已删除自定义配色');
            syncColorSchemeUI();
            closePaletteEditor();
        });

        exportBtn?.addEventListener('click', () => {
            if (!currentEditingPaletteId) {
                Toast.warn('没有可导出的自定义配色');
                return;
            }
            const data = exportCustomPalette(currentEditingPaletteId);
            if (!data) {
                Toast.warn('导出失败');
                return;
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.getElementById('download-link');
            a.href = url;
            a.download = `palette_${currentEditingPaletteId}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Toast.success('配色已导出为 JSON');
        });

        importBtn?.addEventListener('click', () => {
            importFile?.click();
        });

        importFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const palette = importCustomPalette(data);
                    if (palette) {
                        Toast.success(`已导入配色: ${palette.name}`);
                        syncColorSchemeUI();
                        openPaletteEditorFor(palette.id);
                    } else {
                        Toast.warn('导入失败：文件格式不正确');
                    }
                } catch (err) {
                    Toast.warn('导入失败：' + err.message);
                }
            };
            reader.readAsText(file);
            importFile.value = '';
        });

        // 监听颜色变化实时更新预览
        document.getElementById('palette-colors-container')?.addEventListener('input', updatePalettePreview);
        document.getElementById('palette-bg-color')?.addEventListener('input', updatePalettePreview);
        document.getElementById('palette-text-color')?.addEventListener('input', updatePalettePreview);
        document.getElementById('palette-grid-color')?.addEventListener('input', updatePalettePreview);
    }

    function openPaletteEditor() {
        const modal = document.getElementById('palette-editor-modal');
        if (!modal) return;

        // 如果当前选中的是自定义配色，直接进入编辑模式
        const currentScheme = AppState.subfigure.colorScheme;
        if (AppState.customPalettes?.[currentScheme]) {
            openPaletteEditorFor(currentScheme);
            return;
        }

        currentEditingPaletteId = null;
        document.getElementById('palette-name').value = '';
        const base = getColorScheme('academic');
        document.getElementById('palette-base').value = 'academic';
        renderPaletteColors(base.colors || ['#2563eb', '#3b82f6']);
        document.getElementById('palette-bg-color').value = base.background || '#ffffff';
        document.getElementById('palette-text-color').value = base.text || '#1f2937';
        document.getElementById('palette-grid-color').value = base.grid || '#e5e7eb';
        updatePalettePreview();
        updatePaletteEditorButtons();
        modal.classList.remove('hidden');
    }

    function openPaletteEditorFor(paletteId) {
        const modal = document.getElementById('palette-editor-modal');
        const palette = AppState.customPalettes?.[paletteId];
        if (!palette || !modal) return;
        currentEditingPaletteId = paletteId;
        document.getElementById('palette-name').value = palette.name || '';
        renderPaletteColors(palette.colors || ['#2563eb']);
        document.getElementById('palette-bg-color').value = palette.background || '#ffffff';
        document.getElementById('palette-text-color').value = palette.text || '#1f2937';
        document.getElementById('palette-grid-color').value = palette.grid || '#e5e7eb';
        // 编辑模式不修改"基于预设"选择器
        updatePalettePreview();
        updatePaletteEditorButtons();
        modal.classList.remove('hidden');
    }

    function closePaletteEditor() {
        const modal = document.getElementById('palette-editor-modal');
        if (modal) modal.classList.add('hidden');
        currentEditingPaletteId = null;
    }

    function renderPaletteColors(colors) {
        const container = document.getElementById('palette-colors-container');
        if (!container) return;
        container.innerHTML = '';
        (colors || []).forEach(c => addPaletteColorInput(c));
    }

    function addPaletteColorInput(color) {
        const container = document.getElementById('palette-colors-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'palette-color-item';
        div.innerHTML = `<input type="color" value="${color}">`;
        container.appendChild(div);
    }

    function updatePalettePreview() {
        const container = document.getElementById('palette-preview-bar');
        if (!container) return;
        const colors = getPaletteColorsFromEditor();
        container.innerHTML = colors.map(c => `<div class="palette-preview-segment" style="background:${c}"></div>`).join('');
    }

    function getPaletteColorsFromEditor() {
        const container = document.getElementById('palette-colors-container');
        if (!container) return [];
        return Array.from(container.querySelectorAll('input[type="color"]')).map(i => i.value);
    }

    function applyPaletteFromEditor(paletteId) {
        const colors = getPaletteColorsFromEditor();
        const bg = document.getElementById('palette-bg-color')?.value || '#ffffff';
        const text = document.getElementById('palette-text-color')?.value || '#1f2937';
        const grid = document.getElementById('palette-grid-color')?.value || '#e5e7eb';
        const name = document.getElementById('palette-name')?.value.trim() || '未命名配色';
        updateCustomPalette(paletteId, { name, colors, background: bg, text, grid });
    }

    function updatePaletteEditorButtons() {
        const saveBtn = document.getElementById('btn-save-palette');
        const updateBtn = document.getElementById('btn-update-palette');
        const deleteBtn = document.getElementById('btn-delete-palette');
        const isEditing = !!currentEditingPaletteId;
        if (saveBtn) saveBtn.style.display = isEditing ? 'none' : '';
        if (updateBtn) updateBtn.style.display = isEditing ? '' : 'none';
        if (deleteBtn) deleteBtn.style.display = isEditing ? '' : 'none';
    }

    window.SubfigureEditor = {
        init,
        refreshChart,
        updateSnapshotList,
        updateTableSelect,
        updateColumnMappingSelectors,
        applyAspectRatio,
        syncAxisUI,
        updateTrendLinePanelVisibility,
        syncColorSchemeUI,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
