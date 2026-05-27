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

        window.addEventListener('resize', () => chartInstance?.resize());
        window.addEventListener('tableschanged', () => {
            updateTableSelect();
            updateColumnMappingSelectors();
        });

        // 绘图工具事件
        initDrawingTools();
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
            'axis-title-position': { key: 'titlePosition', type: 'text' },
        };
        Object.entries(axisFields).forEach(([id, { key, type }]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = type === 'text' ? 'input' : 'change';
            el.addEventListener(evt, (e) => {
                let val = e.target.value;
                if (type === 'number') val = val === '' ? null : parseFloat(val);
                AppState.subfigure.axisConfig[key] = val;
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
        document.getElementById('btn-axis-reset')?.addEventListener('click', () => {
            AppState.subfigure.axisConfig = {
                title: '', xLabel: '', yLabel: '',
                xMin: null, xMax: null, yMin: null, yMax: null,
                xScale: 'value', yScale: 'value',
                showGrid: true, showXTicks: true, showYTicks: true,
                titleShow: true, titlePosition: 'center',
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
            const supportsTrendLine = ['scatter', 'line'].includes(AppState.subfigure.template);
            panel.style.display = supportsTrendLine ? '' : 'none';
        }
    }

    function applyAxisConfig(option) {
        const cfg = AppState.subfigure.axisConfig;

        if (cfg.titleShow && cfg.title) {
            option.title = {
                text: cfg.title,
                left: cfg.titlePosition,
                textStyle: { fontSize: AppState.subfigure.fontSize + 4 },
            };
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

        const graphics = buildGraphicElements();
        if (option._trendLineGraphic) {
            graphics.push(...option._trendLineGraphic);
            delete option._trendLineGraphic;
        }
        if (graphics.length > 0) {
            option.graphic = graphics;
        }

        chartInstance.setOption(option, true);
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

    window.SubfigureEditor = {
        init,
        refreshChart,
        updateSnapshotList,
        updateTableSelect,
        updateColumnMappingSelectors,
        applyAspectRatio,
        syncAxisUI,
        updateTrendLinePanelVisibility,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
