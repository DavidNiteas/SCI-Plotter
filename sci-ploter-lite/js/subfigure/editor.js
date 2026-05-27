/**
 * 子图编辑器
 * 从数据表中选择数据，使用 ECharts 渲染图表，支持基本绘图工具
 */

(function() {
    let chartDom = null;
    let chartInstance = null;
    let currentTool = 'select';

    function init() {
        chartDom = document.getElementById('subfigure-chart');
        if (!chartDom) return;

        chartInstance = echarts.init(chartDom, null, { renderer: 'canvas' });
        AppState.subfigure.chartInstance = chartInstance;

        bindEvents();
        updateTableSelect();
        applyAspectRatio();
        renderEmptyChart();

        window.addEventListener('resize', () => chartInstance?.resize());
        window.addEventListener('tableschanged', updateTableSelect);

        // 绘图工具事件
        initDrawingTools();
    }

    function bindEvents() {
        // 数据表选择
        document.getElementById('sub-table-select')?.addEventListener('change', (e) => {
            AppState.subfigure.selectedTableId = e.target.value || null;
            refreshChart();
        });

        // 模板选择
        document.querySelectorAll('#template-grid .template-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('#template-grid .template-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                AppState.subfigure.template = card.dataset.template;
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
    }

    function updateTableSelect() {
        const select = document.getElementById('sub-table-select');
        if (!select) return;
        select.innerHTML = '<option value="">选择数据表...</option>' +
            AppState.tables.map(t => `<option value="${t.id}" ${t.id === AppState.subfigure.selectedTableId ? 'selected' : ''}>${t.name}</option>`).join('');
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

        // 构造 CSVParser 格式的数据对象
        const data = { headers: table.headers, rows: table.rows };

        const config = {
            title: AppState.subfigure.template,
            fontSize: AppState.subfigure.fontSize,
            fontFamily: AppState.subfigure.fontFamily,
        };

        const option = renderChart(AppState.subfigure.template, data, config);

        // 应用配色主题
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

        // 添加绘图工具图形
        const graphics = buildGraphicElements();
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

            // 切回选择工具（单次操作）
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
            AppState.subfigure.shapes.push(shape);
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

        return graphics;
    }

    // ===== 暂存与发送 =====

    function createSubfigureSnapshot() {
        if (!chartInstance) return;
        const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
        const snapshot = createSnapshot(
            `子图 ${AppState.subfigure.template}`,
            'subfigure',
            url,
            {
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
            }
        );
        updateSnapshotList();
        alert(`已暂存: ${snapshot.name}`);
    }

    function stageToMain() {
        if (!chartInstance) return;
        // 1. 生成缩略图并创建快照
        const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
        const subfigureData = {
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
        };
        const snapshot = createSnapshot(
            `子图 ${AppState.subfigure.template}`,
            'subfigure',
            url,
            subfigureData
        );
        updateSnapshotList();

        // 2. 发送到主图（携带完整子图信息和快照ID）
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
                deleteSnapshot(btn.dataset.id);
                updateSnapshotList();
            });
        });
    }

    window.SubfigureEditor = {
        init,
        refreshChart,
        updateSnapshotList,
        updateTableSelect,
        applyAspectRatio,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
