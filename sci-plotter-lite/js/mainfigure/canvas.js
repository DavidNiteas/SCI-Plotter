/**
 * 主图画布管理
 * 基于 Fabric.js 实现图层、拖拽、缩放、基本绘图工具
 * 支持期刊尺寸预设、画布缩放/平移、子图自动编号
 */

(function() {
    let canvas = null;
    let canvasEl = null;
    let currentTool = 'select';
    let isDrawing = false;
    let drawStart = null;

    const JOURNAL_PRESETS = {
        'nature-single':   { width: 336,  height: 448,  label: 'Nature 单栏' },
        'nature-double':   { width: 692,  height: 519,  label: 'Nature 双栏' },
        'science-single':  { width: 215,  height: 287,  label: 'Science 单栏' },
        'science-double':  { width: 454,  height: 340,  label: 'Science 双栏' },
        'plos-single':     { width: 321,  height: 428,  label: 'PLOS 单栏' },
        'plos-double':     { width: 673,  height: 505,  label: 'PLOS 双栏' },
        'ieee-single':     { width: 336,  height: 448,  label: 'IEEE 单栏' },
        'ieee-double':     { width: 695,  height: 522,  label: 'IEEE 双栏' },
        'elsevier-single': { width: 340,  height: 454,  label: 'Elsevier 单栏' },
        'elsevier-double': { width: 718,  height: 539,  label: 'Elsevier 双栏' },
        'acs-single':      { width: 314,  height: 419,  label: 'ACS 单栏' },
        'acs-double':      { width: 673,  height: 505,  label: 'ACS 双栏' },
    };

    let isPanning = false;
    let panStart = null;
    let spacePressed = false;
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 5;
    const ZOOM_STEP = 0.1;

    const SNAP_THRESHOLD = 5;
    let snapGuideLines = [];
    let snapEnabled = true;

    function init() {
        canvasEl = document.getElementById('main-canvas');
        if (!canvasEl) return;

        canvas = new fabric.Canvas('main-canvas', {
            width: AppState.mainfigure.width,
            height: AppState.mainfigure.height,
            backgroundColor: AppState.mainfigure.bgColor,
            preserveObjectStacking: true,
            selection: true,
        });

        AppState.mainfigure.fabricCanvas = canvas;

        bindEvents();
        bindCanvasEvents();
        bindContextMenu();
        bindDrawingTools();
        bindZoomControls();
        bindNumberingControls();
        bindSnapGuides();
        bindPropertyPanel();
        bindSnapToggle();
        updateLayerList();
        updateSnapshotList();
        updateCanvasSizeInputs();
    }

    function captureCanvasState() {
        const canvasJSON = canvas.toObject(['_sciLayerId', '_sciLocked']);
        const layerMeta = AppState.mainfigure.layers.map(l => ({
            id: l.id,
            type: l.type,
            name: l.name,
            snapshotId: l.snapshotId,
            subfigureData: l.subfigureData ? JSON.parse(JSON.stringify(l.subfigureData)) : undefined,
        }));
        return {
            canvasJSON: canvasJSON,
            layerMeta: layerMeta,
            width: AppState.mainfigure.width,
            height: AppState.mainfigure.height,
            bgColor: AppState.mainfigure.bgColor,
        };
    }

    function restoreCanvasState(state) {
        const isActive = HistoryManager.isRestoringState();
        AppState.mainfigure.width = state.width;
        AppState.mainfigure.height = state.height;
        AppState.mainfigure.bgColor = state.bgColor;

        const wInput = document.getElementById('canvas-width');
        const hInput = document.getElementById('canvas-height');
        const bgInput = document.getElementById('canvas-bg');
        if (wInput) wInput.value = state.width;
        if (hInput) hInput.value = state.height;
        if (bgInput) bgInput.value = state.bgColor;

        canvas.setWidth(state.width);
        canvas.setHeight(state.height);

        canvas.loadFromJSON(state.canvasJSON, function() {
            AppState.mainfigure.layers = state.layerMeta.map(function(meta) {
                var fabricObj = canvas.getObjects().find(function(o) { return o._sciLayerId === meta.id; });
                return {
                    id: meta.id,
                    type: meta.type,
                    name: meta.name,
                    snapshotId: meta.snapshotId,
                    subfigureData: meta.subfigureData ? JSON.parse(JSON.stringify(meta.subfigureData)) : undefined,
                    fabricObject: fabricObj,
                };
            });
            canvas.requestRenderAll();
            updateLayerList();
            if (isActive) {
                canvas.getObjects().forEach(function(obj) {
                    bindObjectEvents(obj);
                });
            }
        });
    }

    function bindObjectEvents(obj) {
        var layer = AppState.mainfigure.layers.find(function(l) { return l.id === obj._sciLayerId; });
        if (layer && layer.type === 'text') {
            obj.off('mousedblclick');
            obj.on('mousedblclick', function() {
                var newText = prompt('编辑文本:', obj.text);
                if (newText !== null) {
                    var before = captureCanvasState();
                    obj.set('text', newText);
                    layer.name = newText.substring(0, 20) + (newText.length > 20 ? '...' : '');
                    canvas.requestRenderAll();
                    var after = captureCanvasState();
                    HistoryManager.push(HistoryManager.createAction('编辑文本', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
                    updateLayerList();
                }
            });
        }
    }

    function bindEvents() {
        const presetSelect = document.getElementById('journal-preset');
        presetSelect?.addEventListener('change', (e) => {
            const key = e.target.value;
            if (key === 'custom' || !JOURNAL_PRESETS[key]) return;
            const preset = JOURNAL_PRESETS[key];
            const before = captureCanvasState();
            AppState.mainfigure.width = preset.width;
            AppState.mainfigure.height = preset.height;
            canvas.setWidth(preset.width);
            canvas.setHeight(preset.height);
            canvas.requestRenderAll();
            updateCanvasSizeInputs();
            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('应用期刊预设: ' + preset.label, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        });

        document.getElementById('canvas-width')?.addEventListener('change', (e) => {
            const w = parseInt(e.target.value) || 1200;
            const before = captureCanvasState();
            AppState.mainfigure.width = w;
            canvas.setWidth(w);
            canvas.requestRenderAll();
            updateCanvasSizeInputs();
            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('修改画布宽度', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            syncPresetToCustom();
        });
        document.getElementById('canvas-height')?.addEventListener('change', (e) => {
            const h = parseInt(e.target.value) || 800;
            const before = captureCanvasState();
            AppState.mainfigure.height = h;
            canvas.setHeight(h);
            canvas.requestRenderAll();
            updateCanvasSizeInputs();
            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('修改画布高度', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            syncPresetToCustom();
        });
        document.getElementById('canvas-bg')?.addEventListener('input', (e) => {
            const before = captureCanvasState();
            AppState.mainfigure.bgColor = e.target.value;
            canvas.setBackgroundColor(e.target.value, () => canvas.requestRenderAll());
            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('修改背景色', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        });

        // 清空画布
        document.getElementById('btn-clear-main')?.addEventListener('click', () => {
            if (confirm('确定要清空主图画布吗？')) clearCanvas();
        });

        // 添加子图事件
        window.addEventListener('addsubfigure', (e) => {
            const { imageUrl, name, snapshotId, subfigureData } = e.detail;
            addImageObject(imageUrl, name, undefined, undefined, snapshotId, subfigureData);
        });

        window.addEventListener('pagechange', (e) => {
            if (e.detail.page === 'mainfigure') {
                setTimeout(() => canvas?.requestRenderAll(), 50);
            }
        });

        window.addEventListener('tableschanged', updateSnapshotList);
    }

    function bindContextMenu() {
        const wrapper = document.getElementById('main-canvas-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = e.target;
            const isCanvasArea = target.tagName === 'CANVAS' || target.closest('.canvas-wrapper');
            if (!isCanvasArea) return;

            const pointer = canvas.getPointer(e);
            const objects = canvas.getObjects();
            let clickedObj = null;
            for (let i = objects.length - 1; i >= 0; i--) {
                if (objects[i].containsPoint(pointer)) {
                    clickedObj = objects[i];
                    break;
                }
            }

            if (clickedObj) {
                canvas.setActiveObject(clickedObj);
                canvas.requestRenderAll();
                updateLayerList();
                showCanvasContextMenu(e.clientX, e.clientY, clickedObj);
            } else {
                canvas.discardActiveObject();
                canvas.requestRenderAll();
                updateLayerList();
                showCanvasContextMenu(e.clientX, e.clientY, null);
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.canvas-context-menu')) return;
            hideCanvasContextMenu();
        });
    }

    function showCanvasContextMenu(x, y, obj) {
        let menu = document.getElementById('canvas-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'canvas-context-menu';
            menu.className = 'grid-context-menu canvas-context-menu';
            document.body.appendChild(menu);
        }

        let items = [];

        if (obj) {
            const layer = AppState.mainfigure.layers.find(l => l.id === obj._sciLayerId);
            const layerName = layer ? layer.name : '对象';
            const isText = layer && layer.type === 'text';
            const isSubfigure = layer && layer.type === 'subfigure';

            items = [
                { label: '复制对象', icon: '📋', action: () => duplicateObject(obj) },
                { type: 'separator' },
            ];

            if (isText) {
                items.push({ label: '编辑文本', icon: '✏️', action: () => editTextObject(obj) });
                items.push({ type: 'separator' });
            }

            if (isSubfigure) {
                items.push({ label: '编辑子图', icon: '🖼️', action: () => { obj.fire('mousedblclick'); } });
                items.push({ type: 'separator' });
            }

            items.push(
                { label: '置于顶层', icon: '⬆️', shortcut: '', action: () => reorderObject('front') },
                { label: '置于底层', icon: '⬇️', shortcut: '', action: () => reorderObject('back') },
                { type: 'separator' },
                { label: '锁定/解锁', icon: '🔒', action: () => toggleLockObject(obj) },
                { type: 'separator' },
                { label: '删除', icon: '🗑️', shortcut: 'Del', action: () => deleteSelectedObject() },
            );
        } else {
            items = [
                { label: '重置缩放', icon: '🔍', action: () => { document.getElementById('btn-zoom-reset')?.click(); } },
                { label: '适应窗口', icon: '⛶', action: () => { document.getElementById('btn-zoom-fit')?.click(); } },
                { type: 'separator' },
                { label: '清空画布', icon: '🗑️', action: () => { if (confirm('确定要清空主图画布吗？')) clearCanvas(); } },
            ];
        }

        menu.innerHTML = items.map(item => {
            if (item.type === 'separator') return '<div class="ctx-separator"></div>';
            return `<div class="ctx-item" data-action="${item.label}">
                <span class="ctx-icon">${item.icon || ''}</span>
                <span class="ctx-label">${item.label}</span>
                <span class="ctx-shortcut">${item.shortcut || ''}</span>
            </div>`;
        }).join('');

        menu.style.display = 'block';

        const menuRect = menu.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        if (x + menuRect.width > viewportW) x = viewportW - menuRect.width - 4;
        if (y + menuRect.height > viewportH) y = viewportH - menuRect.height - 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        menu.querySelectorAll('.ctx-item').forEach(el => {
            const actionItem = items.find(i => i.type !== 'separator' && i.label === el.dataset.action);
            if (actionItem) {
                el.addEventListener('click', () => {
                    hideCanvasContextMenu();
                    actionItem.action();
                });
            }
        });
    }

    function hideCanvasContextMenu() {
        const menu = document.getElementById('canvas-context-menu');
        if (menu) menu.style.display = 'none';
    }

    function duplicateObject(obj) {
        const before = captureCanvasState();
        obj.clone(function(cloned) {
            cloned.set({
                left: obj.left + 20,
                top: obj.top + 20,
                ...commonProps(),
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();

            const origLayer = AppState.mainfigure.layers.find(l => l.id === obj._sciLayerId);
            const layer = {
                id: generateId(),
                type: origLayer ? origLayer.type : 'shape',
                name: (origLayer ? origLayer.name : '对象') + ' 副本',
                fabricObject: cloned,
            };
            AppState.mainfigure.layers.push(layer);
            cloned._sciLayerId = layer.id;

            if (layer.type === 'text') bindObjectEvents(cloned);
            if (cloned.type === 'group') {
                cloned.getObjects().forEach(child => { child._sciLayerId = layer.id; });
            }

            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('复制对象', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            updateLayerList();
        }, ['_sciLayerId', '_sciLocked']);
    }

    function editTextObject(obj) {
        const layer = AppState.mainfigure.layers.find(l => l.id === obj._sciLayerId);
        const newText = prompt('编辑文本:', obj.text);
        if (newText !== null) {
            const before = captureCanvasState();
            obj.set('text', newText);
            if (layer) layer.name = newText.substring(0, 20) + (newText.length > 20 ? '...' : '');
            canvas.requestRenderAll();
            const after = captureCanvasState();
            HistoryManager.push(HistoryManager.createAction('编辑文本', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            updateLayerList();
        }
    }

    function toggleLockObject(obj) {
        const before = captureCanvasState();
        const isLocked = obj._sciLocked || false;
        obj._sciLocked = !isLocked;
        obj.set({
            lockMovementX: !isLocked,
            lockMovementY: !isLocked,
            lockScalingX: !isLocked,
            lockScalingY: !isLocked,
            lockRotation: !isLocked,
            hasControls: isLocked,
        });
        canvas.requestRenderAll();
        const after = captureCanvasState();
        const desc = isLocked ? '解锁对象' : '锁定对象';
        HistoryManager.push(HistoryManager.createAction(desc, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
        Toast.success(isLocked ? '已解锁' : '已锁定');
    }

    function deleteSelectedObject() {
        const active = canvas.getActiveObject();
        if (!active) return;

        const before = captureCanvasState();
        const layerId = active._sciLayerId;

        AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => l.id !== layerId);
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.requestRenderAll();

        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('删除对象', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    function bindCanvasEvents() {
        const wrapper = document.querySelector('.main-canvas-area .canvas-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            wrapper.style.boxShadow = '0 0 0 3px var(--bg-accent)';
        });
        wrapper.addEventListener('dragleave', () => {
            wrapper.style.boxShadow = '';
        });
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.style.boxShadow = '';
            const snapshotId = e.dataTransfer.getData('snapshot-id');
            if (!snapshotId) return;
            const snapshot = AppState.snapshots.find(s => s.id === snapshotId);
            if (!snapshot) return;
            const rect = canvasEl.getBoundingClientRect();
            const x = (e.clientX - rect.left) / canvas.getZoom();
            const y = (e.clientY - rect.top) / canvas.getZoom();
            // 拖放暂存子图时，也携带完整的子图数据
            const subfigureData = snapshot.type === 'subfigure' ? snapshot.data : undefined;
            addImageObject(snapshot.thumbnail, snapshot.name, x, y, snapshot.id, subfigureData);
        });

        let modifyBefore = null;

        canvas.on('selection:created', updateLayerList);
        canvas.on('selection:updated', updateLayerList);
        canvas.on('selection:cleared', updateLayerList);
        canvas.on('object:added', updateLayerList);
        canvas.on('object:removed', updateLayerList);
        canvas.on('object:moving', function() { updatePropertyPanelValues(); });
        canvas.on('object:scaling', function() { updatePropertyPanelValues(); });
        canvas.on('object:rotating', function() { updatePropertyPanelValues(); });

        canvas.on('mouse:down', function(opt) {
            if (spacePressed) return;
            if (currentTool !== 'select') return;
            const target = opt.target;
            if (target) {
                modifyBefore = captureCanvasState();
            }
        });

        canvas.on('object:modified', function(opt) {
            if (HistoryManager.isRestoringState()) { updateLayerList(); return; }
            if (modifyBefore) {
                const after = captureCanvasState();
                const before = modifyBefore;
                modifyBefore = null;
                const obj = opt.target;
                const layer = AppState.mainfigure.layers.find(function(l) { return l.id === obj._sciLayerId; });
                const desc = '修改对象: ' + (layer ? layer.name : '未知');
                HistoryManager.push(HistoryManager.createAction(desc, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            }
            updateLayerList();
        });

        // 绘图工具鼠标事件
        canvas.on('mouse:down', (o) => {
            if (spacePressed) return;
            if (currentTool === 'select') return;
            isDrawing = true;
            drawStart = canvas.getPointer(o.e);
        });

        canvas.on('mouse:move', (o) => {
            if (!isDrawing || currentTool === 'select') return;
            // 实时预览可以后续添加
        });

        canvas.on('mouse:up', (o) => {
            if (!isDrawing || currentTool === 'select') return;
            isDrawing = false;
            const drawEnd = canvas.getPointer(o.e);
            createFabricObject(currentTool, drawStart, drawEnd);
            // 切回选择工具
            currentTool = 'select';
            document.querySelectorAll('#main-tool-grid .tool-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('#main-tool-grid .tool-btn[data-tool="select"]')?.classList.add('active');
            canvas.selection = true;
            canvas.isDrawingMode = false;
        });
    }

    function bindDrawingTools() {
        document.querySelectorAll('#main-tool-grid .tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#main-tool-grid .tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTool = btn.dataset.tool;
                canvas.selection = currentTool === 'select';
            });
        });

        // 对象操作按钮
        document.getElementById('btn-group-objects')?.addEventListener('click', groupSelectedObjects);
        document.getElementById('btn-ungroup-objects')?.addEventListener('click', ungroupSelectedObjects);
        document.getElementById('btn-align-left')?.addEventListener('click', () => alignObjects('left'));
        document.getElementById('btn-align-center')?.addEventListener('click', () => alignObjects('center'));
        document.getElementById('btn-align-right')?.addEventListener('click', () => alignObjects('right'));
        document.getElementById('btn-bring-front')?.addEventListener('click', () => reorderObject('front'));
        document.getElementById('btn-send-back')?.addEventListener('click', () => reorderObject('back'));
    }

    function createFabricObject(tool, start, end) {
        let obj = null;
        const color = '#2563eb';
        const fill = 'rgba(37,99,235,0.15)';

        switch (tool) {
            case 'text':
                const text = prompt('请输入文本:', '文本标注');
                if (!text) return;
                obj = new fabric.Text(text, {
                    left: start.x,
                    top: start.y,
                    fontSize: 18,
                    fontFamily: AppState.subfigure.fontFamily,
                    fill: '#1f2937',
                    ...commonProps(),
                });
                break;
            case 'rect':
                obj = new fabric.Rect({
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    width: Math.abs(end.x - start.x),
                    height: Math.abs(end.y - start.y),
                    fill: fill,
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'roundedRect':
                obj = new fabric.Rect({
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    width: Math.abs(end.x - start.x),
                    height: Math.abs(end.y - start.y),
                    rx: 12,
                    ry: 12,
                    fill: fill,
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'ellipse':
                obj = new fabric.Ellipse({
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    rx: Math.abs(end.x - start.x) / 2,
                    ry: Math.abs(end.y - start.y) / 2,
                    fill: fill,
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
                obj = new fabric.Circle({
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    radius: radius,
                    fill: fill,
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'triangle':
                obj = new fabric.Triangle({
                    left: Math.min(start.x, end.x),
                    top: Math.min(start.y, end.y),
                    width: Math.abs(end.x - start.x),
                    height: Math.abs(end.y - start.y),
                    fill: fill,
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'line':
                obj = new fabric.Line([start.x, start.y, end.x, end.y], {
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'arrow':
                obj = createArrow(start.x, start.y, end.x, end.y, color);
                break;
        }

        if (obj) {
            const before = captureCanvasState();

            canvas.add(obj);
            canvas.setActiveObject(obj);
            canvas.requestRenderAll();

            const layer = {
                id: generateId(),
                type: tool === 'text' ? 'text' : 'shape',
                name: tool === 'text' ? (obj.text?.substring(0, 20) || '文本') : tool,
                fabricObject: obj,
            };
            AppState.mainfigure.layers.push(layer);
            obj._sciLayerId = layer.id;

            if (tool === 'text') {
                bindObjectEvents(obj);
            }
            if (tool === 'arrow' && obj.type === 'group') {
                obj._sciLayerId = layer.id;
                obj.getObjects().forEach(child => { child._sciLayerId = layer.id; });
            }

            const after = captureCanvasState();
            const desc = tool === 'text' ? '添加文本' : '添加形状: ' + tool;
            HistoryManager.push(HistoryManager.createAction(desc, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            updateLayerList();
        }
    }

    function commonProps() {
        return {
            cornerSize: 8,
            cornerColor: '#2563eb',
            cornerStyle: 'circle',
            transparentCorners: false,
            borderColor: '#2563eb',
        };
    }

    function addImageObject(imageUrl, name, x, y, snapshotId, subfigureData) {
        const before = captureCanvasState();
        fabric.Image.fromURL(imageUrl, (img) => {
            const scale = Math.min(
                (canvas.width * 0.4) / img.width,
                (canvas.height * 0.4) / img.height,
                1
            );
            img.set({
                left: x || canvas.width / 2 - (img.width * scale) / 2,
                top: y || canvas.height / 2 - (img.height * scale) / 2,
                scaleX: scale,
                scaleY: scale,
                ...commonProps(),
            });
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.requestRenderAll();

            const layer = {
                id: generateId(),
                type: subfigureData ? 'subfigure' : 'image',
                name: name || '图片',
                fabricObject: img,
                snapshotId: snapshotId,
                subfigureData: subfigureData,
            };
            AppState.mainfigure.layers.push(layer);
            img._sciLayerId = layer.id;

            if (subfigureData) {
                addNumberingToObject(img, name);
                img.on('mousedblclick', () => {
                    if (!confirm('是否跳转到子图编辑器以编辑此子图？\n（当前编辑器中的未保存内容将被覆盖）')) return;
                    // 恢复子图状态
                    AppState.subfigure.selectedTableId = subfigureData.selectedTableId;
                    AppState.subfigure.template = subfigureData.template;
                    AppState.subfigure.colorScheme = subfigureData.colorScheme || 'academic';
                    AppState.subfigure.fontFamily = subfigureData.fontFamily || 'Arial, sans-serif';
                    AppState.subfigure.fontSize = subfigureData.fontSize || 14;
                    AppState.subfigure.textOverlays = subfigureData.textOverlays || [];
                    AppState.subfigure.shapes = subfigureData.shapes || [];
                    AppState.subfigure.aspectRatio = subfigureData.aspectRatio || '4:3';
                    AppState.subfigure.customWidth = subfigureData.customWidth || 600;
                    AppState.subfigure.customHeight = subfigureData.customHeight || 450;

                    // 检查源数据表是否存在
                    const sourceTable = getTable(subfigureData.selectedTableId);
                    if (!sourceTable) {
                        Toast.warning('该子图的源数据表已不存在，图表可能无法正常显示。');
                    }

                    // 刷新编辑器 UI
                    SubfigureEditor?.updateTableSelect();
                    SubfigureEditor?.applyAspectRatio();
                    SubfigureEditor?.refreshChart();

                    // 更新模板按钮高亮
                    document.querySelectorAll('#template-grid .template-card').forEach(c => c.classList.remove('active'));
                    document.querySelector(`#template-grid .template-card[data-template="${AppState.subfigure.template}"]`)?.classList.add('active');

                    // 更新样式选择器
                    const colorSelect = document.getElementById('color-scheme');
                    if (colorSelect) colorSelect.value = AppState.subfigure.colorScheme;
                    const fontSelect = document.getElementById('font-family');
                    if (fontSelect) fontSelect.value = AppState.subfigure.fontFamily;
                    const fontSizeInput = document.getElementById('font-size');
                    if (fontSizeInput) fontSizeInput.value = AppState.subfigure.fontSize;

                    // 更新比例选择器
                    const aspectSelect = document.getElementById('sub-aspect-ratio');
                    if (aspectSelect) aspectSelect.value = AppState.subfigure.aspectRatio;
                    const customWRow = document.getElementById('sub-custom-size-row');
                    const customHRow = document.getElementById('sub-custom-height-row');
                    const isCustom = AppState.subfigure.aspectRatio === 'custom';
                    if (customWRow) customWRow.style.display = isCustom ? 'block' : 'none';
                    if (customHRow) customHRow.style.display = isCustom ? 'block' : 'none';
                    const wInput = document.getElementById('sub-custom-width');
                    const hInput = document.getElementById('sub-custom-height');
                    if (wInput) wInput.value = AppState.subfigure.customWidth;
                    if (hInput) hInput.value = AppState.subfigure.customHeight;

                    switchPage('subfigure');
                });
            }

            const after = captureCanvasState();
            const desc = subfigureData ? '添加子图: ' + name : '添加图片: ' + name;
            HistoryManager.push(HistoryManager.createAction(desc, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
            HistoryManager.endBatch();
            updateLayerList();
        }, { crossOrigin: 'anonymous' });
    }

    function clearCanvas(resetCounter) {
        const before = captureCanvasState();
        clearSnapGuides();
        canvas.clear();
        AppState.mainfigure.layers = [];
        if (resetCounter !== false) AppState.mainfigure.numberingCounter = 0;
        canvas.setBackgroundColor(AppState.mainfigure.bgColor, () => canvas.requestRenderAll());
        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('清空画布', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    function updateLayerList() {
        const container = document.getElementById('layer-list');
        if (!container) return;
        const layers = AppState.mainfigure.layers;
        if (layers.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无图层</p>';
            updatePropertyPanel();
            return;
        }
        const activeObj = canvas.getActiveObject();
        const activeId = activeObj?._sciLayerId;

        container.innerHTML = layers.slice().reverse().map(layer => {
            const isActive = layer.id === activeId;
            const isLocked = layer.fabricObject && layer.fabricObject._sciLocked;
            let thumb = '';
            if (layer.type === 'image' || layer.type === 'subfigure') {
                thumb = `<img src="${layer.fabricObject._element?.src || ''}" style="width:100%;height:100%;object-fit:cover">`;
            } else {
                const icon = layer.type === 'text' ? 'T' : (layer.type === 'group' ? 'G' : (layer.type === 'numbering' ? '#' : (layer.name?.[0] || 'S')));
                thumb = `<span style="font-size:10px">${icon}</span>`;
            }
            const typeLabel = layer.type === 'subfigure' ? '子图' : (layer.type === 'image' ? '图片' : (layer.type === 'text' ? '文本' : (layer.type === 'group' ? '组合' : (layer.type === 'numbering' ? '编号' : '图形'))));
            const lockIcon = isLocked ? '<span class="layer-lock-icon" title="已锁定">🔒</span>' : '';
            return `
                <div class="layer-item ${isActive ? 'active' : ''} ${isLocked ? 'layer-locked' : ''}" data-id="${layer.id}">
                    <div class="layer-thumb">${thumb}</div>
                    <div class="layer-info">
                        <div class="layer-name">${lockIcon}${layer.name}</div>
                        <div class="layer-type">${typeLabel}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', () => {
                const layer = layers.find(l => l.id === item.dataset.id);
                if (layer && layer.fabricObject) {
                    canvas.setActiveObject(layer.fabricObject);
                    canvas.requestRenderAll();
                    updateLayerList();
                }
            });
        });

        updatePropertyPanel();
    }

    // ===== 箭头绘制 =====

    function createArrow(x1, y1, x2, y2, color) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 12;

        const line = new fabric.Line([x1, y1, x2, y2], {
            stroke: color,
            strokeWidth: 2,
            selectable: false,
            evented: false,
        });

        const head = new fabric.Triangle({
            left: x2,
            top: y2,
            width: headLength,
            height: headLength,
            angle: (angle * 180 / Math.PI) + 90,
            fill: color,
            stroke: color,
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
        });

        const group = new fabric.Group([line, head], {
            ...commonProps(),
        });
        return group;
    }

    // ===== 组合/取消组合 =====

    function groupSelectedObjects() {
        const active = canvas.getActiveObject();
        if (!active) return;

        let objectsToGroup;
        if (active.type === 'activeSelection') {
            objectsToGroup = active.getObjects();
            canvas.discardActiveObject();
        } else {
            return;
        }

        const before = captureCanvasState();

        const group = new fabric.Group(objectsToGroup, {
            ...commonProps(),
        });

        const oldIds = objectsToGroup.map(o => o._sciLayerId).filter(Boolean);
        AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => !oldIds.includes(l.id));

        canvas.add(group);
        objectsToGroup.forEach(o => canvas.remove(o));
        canvas.setActiveObject(group);
        canvas.requestRenderAll();

        const layer = {
            id: generateId(),
            type: 'group',
            name: `组合 (${objectsToGroup.length})`,
            fabricObject: group,
        };
        AppState.mainfigure.layers.push(layer);
        group._sciLayerId = layer.id;
        group.getObjects().forEach(child => { child._sciLayerId = layer.id; });

        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('组合对象', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    function ungroupSelectedObjects() {
        const active = canvas.getActiveObject();
        if (!active || active.type !== 'group') return;

        const before = captureCanvasState();

        const items = active.getObjects();
        const groupLeft = active.left;
        const groupTop = active.top;

        const groupLayerId = active._sciLayerId;
        AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => l.id !== groupLayerId);

        canvas.remove(active);
        canvas.discardActiveObject();

        items.forEach(item => {
            const absLeft = item.left + groupLeft;
            const absTop = item.top + groupTop;
            item.set({ left: absLeft, top: absTop });
            item.setCoords();
            canvas.add(item);

            const layer = {
                id: generateId(),
                type: item.type === 'text' ? 'text' : 'shape',
                name: item.type === 'text' ? (item.text?.substring(0, 20) || '文本') : (item.type || '图形'),
                fabricObject: item,
            };
            AppState.mainfigure.layers.push(layer);
            item._sciLayerId = layer.id;
        });

        canvas.requestRenderAll();

        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('取消组合', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    // ===== 对齐工具 =====

    function alignObjects(mode) {
        const active = canvas.getActiveObject();
        if (!active) return;

        let objects;
        if (active.type === 'activeSelection') {
            objects = active.getObjects();
        } else {
            objects = [active];
        }

        if (objects.length < 2 && mode !== 'center') return;

        const before = captureCanvasState();
        const modeNames = { left: '左对齐', right: '右对齐', center: '水平居中' };

        const values = objects.map(o => o.left);
        let target;
        switch (mode) {
            case 'left':
                target = Math.min(...values);
                objects.forEach(o => o.set('left', target));
                break;
            case 'right':
                const maxRight = Math.max(...objects.map(o => o.left + (o.width * (o.scaleX || 1))));
                objects.forEach(o => {
                    o.set('left', maxRight - (o.width * (o.scaleX || 1)));
                });
                break;
            case 'center':
                const centerX = AppState.mainfigure.width / 2;
                objects.forEach(o => {
                    o.set('left', centerX - ((o.width * (o.scaleX || 1)) / 2));
                });
                break;
        }

        objects.forEach(o => o.setCoords());
        canvas.requestRenderAll();

        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction(modeNames[mode], function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    function reorderObject(mode) {
        const active = canvas.getActiveObject();
        if (!active) return;

        const layerId = active._sciLayerId;
        const layerIndex = AppState.mainfigure.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

        const before = captureCanvasState();

        if (mode === 'front') {
            canvas.bringToFront(active);
            const [layer] = AppState.mainfigure.layers.splice(layerIndex, 1);
            AppState.mainfigure.layers.push(layer);
        } else if (mode === 'back') {
            canvas.sendToBack(active);
            const [layer] = AppState.mainfigure.layers.splice(layerIndex, 1);
            AppState.mainfigure.layers.unshift(layer);
        }

        canvas.requestRenderAll();

        const after = captureCanvasState();
        const desc = mode === 'front' ? '置于顶层' : '置于底层';
        HistoryManager.push(HistoryManager.createAction(desc, function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
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

    function exportCanvas(type, quality) {
        if (!canvas) return null;
        return canvas.toDataURL({ format: type, quality: quality, multiplier: 2 });
    }

    function updateCanvasSizeInputs() {
        const wInput = document.getElementById('canvas-width');
        const hInput = document.getElementById('canvas-height');
        if (wInput) wInput.value = AppState.mainfigure.width;
        if (hInput) hInput.value = AppState.mainfigure.height;
    }

    function syncPresetToCustom() {
        const presetSelect = document.getElementById('journal-preset');
        if (!presetSelect) return;
        const w = AppState.mainfigure.width;
        const h = AppState.mainfigure.height;
        let matched = false;
        for (const [key, preset] of Object.entries(JOURNAL_PRESETS)) {
            if (preset.width === w && preset.height === h) {
                presetSelect.value = key;
                matched = true;
                break;
            }
        }
        if (!matched) presetSelect.value = 'custom';
    }

    // ===== 缩放/平移 =====

    function bindZoomControls() {
        const wrapper = document.getElementById('main-canvas-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const currentZoom = canvas.getZoom();
            let newZoom = currentZoom + delta;
            newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
            newZoom = Math.round(newZoom * 100) / 100;

            canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), newZoom);
            AppState.mainfigure.zoom = newZoom;
            updateZoomDisplay();
            canvas.requestRenderAll();
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat && AppState.currentPage === 'mainfigure') {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) return;
                e.preventDefault();
                spacePressed = true;
                canvas.selection = false;
                canvas.defaultCursor = 'grab';
                wrapper.style.cursor = 'grab';
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spacePressed = false;
                isPanning = false;
                canvas.selection = true;
                canvas.defaultCursor = 'default';
                wrapper.style.cursor = '';
            }
        });

        canvas.on('mouse:down', function(opt) {
            if (spacePressed) {
                isPanning = true;
                panStart = { x: opt.e.clientX, y: opt.e.clientY };
                canvas.defaultCursor = 'grabbing';
                wrapper.style.cursor = 'grabbing';
                canvas.selection = false;
            }
        });

        canvas.on('mouse:move', function(opt) {
            if (isPanning && panStart) {
                const vpt = canvas.viewportTransform;
                vpt[4] += opt.e.clientX - panStart.x;
                vpt[5] += opt.e.clientY - panStart.y;
                panStart = { x: opt.e.clientX, y: opt.e.clientY };
                canvas.requestRenderAll();
            }
        });

        canvas.on('mouse:up', function() {
            if (isPanning) {
                isPanning = false;
                panStart = null;
                if (spacePressed) {
                    canvas.defaultCursor = 'grab';
                    wrapper.style.cursor = 'grab';
                } else {
                    canvas.defaultCursor = 'default';
                    wrapper.style.cursor = '';
                }
                canvas.selection = true;
            }
        });

        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            const currentZoom = canvas.getZoom();
            const newZoom = Math.min(ZOOM_MAX, Math.round((currentZoom + ZOOM_STEP) * 100) / 100);
            const center = { x: canvas.width / 2, y: canvas.height / 2 };
            canvas.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
            AppState.mainfigure.zoom = newZoom;
            updateZoomDisplay();
        });

        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            const currentZoom = canvas.getZoom();
            const newZoom = Math.max(ZOOM_MIN, Math.round((currentZoom - ZOOM_STEP) * 100) / 100);
            const center = { x: canvas.width / 2, y: canvas.height / 2 };
            canvas.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
            AppState.mainfigure.zoom = newZoom;
            updateZoomDisplay();
        });

        document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            AppState.mainfigure.zoom = 1;
            updateZoomDisplay();
            canvas.requestRenderAll();
        });

        document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
            const wrapper = document.getElementById('main-canvas-wrapper');
            if (!wrapper) return;
            const wrapperRect = wrapper.getBoundingClientRect();
            const availW = wrapperRect.width - 32;
            const availH = wrapperRect.height - 32;
            const scaleX = availW / canvas.width;
            const scaleY = availH / canvas.height;
            const fitZoom = Math.min(scaleX, scaleY, 1);
            const finalZoom = Math.round(fitZoom * 100) / 100;
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            const center = { x: canvas.width / 2, y: canvas.height / 2 };
            canvas.zoomToPoint(new fabric.Point(center.x, center.y), finalZoom);
            AppState.mainfigure.zoom = finalZoom;
            updateZoomDisplay();
        });
    }

    function updateZoomDisplay() {
        const el = document.getElementById('zoom-level');
        if (el) {
            el.textContent = Math.round(canvas.getZoom() * 100) + '%';
        }
    }

    // ===== 自动编号 =====

    function bindNumberingControls() {
        document.getElementById('auto-numbering')?.addEventListener('change', (e) => {
            AppState.mainfigure.autoNumbering = e.target.checked;
        });
        document.getElementById('numbering-format')?.addEventListener('change', (e) => {
            AppState.mainfigure.numberingFormat = e.target.value;
        });
        document.getElementById('numbering-fontsize')?.addEventListener('change', (e) => {
            AppState.mainfigure.numberingFontSize = parseInt(e.target.value) || 18;
        });
        document.getElementById('numbering-position')?.addEventListener('change', (e) => {
            AppState.mainfigure.numberingPosition = e.target.value;
        });
        document.getElementById('btn-renumber')?.addEventListener('click', renumberSubfigures);
    }

    function generateNumberLabel(format, index) {
        const lowerLetters = 'abcdefghijklmnopqrstuvwxyz';
        const upperLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const letter = lowerLetters[index % 26];
        const upperLetter = upperLetters[index % 26];
        const num = index + 1;

        switch (format) {
            case '(a)': return '(' + letter + ')';
            case 'a)': return letter + ')';
            case 'a.': return letter + '.';
            case '(A)': return '(' + upperLetter + ')';
            case 'A)': return upperLetter + ')';
            case '(1)': return '(' + num + ')';
            case 'Fig.a': return 'Fig.' + letter;
            default: return '(' + letter + ')';
        }
    }

    function addNumberingToObject(imgObj, name) {
        if (!AppState.mainfigure.autoNumbering) return null;

        const format = AppState.mainfigure.numberingFormat || '(a)';
        const fontSize = AppState.mainfigure.numberingFontSize || 18;
        const position = AppState.mainfigure.numberingPosition || 'top-left';
        const index = AppState.mainfigure.numberingCounter++;
        const label = generateNumberLabel(format, index);

        const imgLeft = imgObj.left;
        const imgTop = imgObj.top;
        const imgWidth = imgObj.width * imgObj.scaleX;
        const imgHeight = imgObj.height * imgObj.scaleY;
        const margin = 5;

        let textX, textY, originX, originY;
        switch (position) {
            case 'top-left':
                textX = imgLeft + margin;
                textY = imgTop + margin;
                originX = 'left';
                originY = 'top';
                break;
            case 'top-right':
                textX = imgLeft + imgWidth - margin;
                textY = imgTop + margin;
                originX = 'right';
                originY = 'top';
                break;
            case 'bottom-left':
                textX = imgLeft + margin;
                textY = imgTop + imgHeight - margin;
                originX = 'left';
                originY = 'bottom';
                break;
            case 'bottom-right':
                textX = imgLeft + imgWidth - margin;
                textY = imgTop + imgHeight - margin;
                originX = 'right';
                originY = 'bottom';
                break;
            default:
                textX = imgLeft + margin;
                textY = imgTop + margin;
                originX = 'left';
                originY = 'top';
        }

        const textObj = new fabric.Text(label, {
            left: textX,
            top: textY,
            originX: originX,
            originY: originY,
            fontSize: fontSize,
            fontFamily: AppState.subfigure.fontFamily || 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#1f2937',
            selectable: true,
            ...commonProps(),
        });

        canvas.add(textObj);

        const layer = {
            id: generateId(),
            type: 'numbering',
            name: '编号 ' + label,
            fabricObject: textObj,
            _parentSubfigureId: imgObj._sciLayerId,
        };
        AppState.mainfigure.layers.push(layer);
        textObj._sciLayerId = layer.id;
        return textObj;
    }

    function renumberSubfigures() {
        const before = captureCanvasState();
        const subfigureLayers = AppState.mainfigure.layers.filter(l => l.type === 'subfigure' || l.type === 'image');

        AppState.mainfigure.layers.filter(l => l.type === 'numbering').forEach(l => {
            if (l.fabricObject) canvas.remove(l.fabricObject);
        });
        AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => l.type !== 'numbering');

        AppState.mainfigure.numberingCounter = 0;

        subfigureLayers.forEach(layer => {
            if (layer.fabricObject) {
                addNumberingToObject(layer.fabricObject, layer.name);
            }
        });

        canvas.requestRenderAll();
        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('重新编号', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
        updateLayerList();
    }

    // ===== 对齐参考线 (Snap Guides) =====

    function clearSnapGuides() {
        snapGuideLines.forEach(line => canvas.remove(line));
        snapGuideLines = [];
    }

    function createSnapLine(x1, y1, x2, y2) {
        const line = new fabric.Line([x1, y1, x2, y2], {
            stroke: '#f43f5e',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            strokeDashArray: [4, 4],
        });
        line._isSnapGuide = true;
        canvas.add(line);
        snapGuideLines.push(line);
        return line;
    }

    function getObjectBounds(obj) {
        const br = obj.getBoundingRect(true, true);
        return {
            left: br.left,
            top: br.top,
            right: br.left + br.width,
            bottom: br.top + br.height,
            centerX: br.left + br.width / 2,
            centerY: br.top + br.height / 2,
            width: br.width,
            height: br.height,
        };
    }

    function bindSnapGuides() {
        canvas.on('object:moving', function(opt) {
            if (!snapEnabled) return;
            clearSnapGuides();

            const movingObj = opt.target;
            const movingBounds = getObjectBounds(movingObj);
            const otherObjects = canvas.getObjects().filter(o => o !== movingObj && !o._isSnapGuide && o.selectable !== false);

            const canvasW = canvas.width;
            const canvasH = canvas.height;
            const canvasCenterX = canvasW / 2;
            const canvasCenterY = canvasH / 2;

            let snapX = null;
            let snapY = null;
            let guidesX = [];
            let guidesY = [];

            const refPoints = [];
            otherObjects.forEach(obj => {
                const b = getObjectBounds(obj);
                refPoints.push(
                    { x: b.left, axis: 'x' },
                    { x: b.right, axis: 'x' },
                    { x: b.centerX, axis: 'x' },
                    { y: b.top, axis: 'y' },
                    { y: b.bottom, axis: 'y' },
                    { y: b.centerY, axis: 'y' }
                );
            });

            refPoints.push(
                { x: 0, axis: 'x' },
                { x: canvasCenterX, axis: 'x' },
                { x: canvasW, axis: 'x' },
                { y: 0, axis: 'y' },
                { y: canvasCenterY, axis: 'y' },
                { y: canvasH, axis: 'y' }
            );

            const movingXPoints = [movingBounds.left, movingBounds.right, movingBounds.centerX];
            const movingYPoints = [movingBounds.top, movingBounds.bottom, movingBounds.centerY];

            let bestDistX = SNAP_THRESHOLD + 1;
            let bestSnapX = null;
            let bestGuideX = null;

            for (const ref of refPoints) {
                if (ref.axis !== 'x') continue;
                for (const mp of movingXPoints) {
                    const dist = Math.abs(mp - ref.x);
                    if (dist < bestDistX) {
                        bestDistX = dist;
                        bestSnapX = ref.x - (mp - movingBounds.left);
                        bestGuideX = ref.x;
                    }
                }
            }

            if (bestDistX <= SNAP_THRESHOLD && bestSnapX !== null) {
                snapX = bestSnapX;
                guidesX.push(bestGuideX);
            }

            let bestDistY = SNAP_THRESHOLD + 1;
            let bestSnapY = null;
            let bestGuideY = null;

            for (const ref of refPoints) {
                if (ref.axis !== 'y') continue;
                for (const mp of movingYPoints) {
                    const dist = Math.abs(mp - ref.y);
                    if (dist < bestDistY) {
                        bestDistY = dist;
                        bestSnapY = ref.y - (mp - movingBounds.top);
                        bestGuideY = ref.y;
                    }
                }
            }

            if (bestDistY <= SNAP_THRESHOLD && bestSnapY !== null) {
                snapY = bestSnapY;
                guidesY.push(bestGuideY);
            }

            if (snapX !== null) {
                movingObj.set('left', snapX);
            }
            if (snapY !== null) {
                movingObj.set('top', snapY);
            }

            const extend = 5000;
            guidesX.forEach(x => {
                createSnapLine(x, -extend, x, extend);
            });
            guidesY.forEach(y => {
                createSnapLine(-extend, y, extend, y);
            });

            canvas.requestRenderAll();
        });

        canvas.on('object:modified', function() {
            clearSnapGuides();
            canvas.requestRenderAll();
        });

        canvas.on('object:scaling', function(opt) {
            if (!snapEnabled) return;
            clearSnapGuides();

            const scalingObj = opt.target;
            const movingBounds = getObjectBounds(scalingObj);
            const otherObjects = canvas.getObjects().filter(o => o !== scalingObj && !o._isSnapGuide && o.selectable !== false);

            const canvasW = canvas.width;
            const canvasH = canvas.height;

            let snapRight = null;
            let snapBottom = null;

            const refXPoints = [0, canvasW];
            const refYPoints = [0, canvasH];
            otherObjects.forEach(obj => {
                const b = getObjectBounds(obj);
                refXPoints.push(b.left, b.right);
                refYPoints.push(b.top, b.bottom);
            });

            let bestDistR = SNAP_THRESHOLD + 1;
            for (const rx of refXPoints) {
                const dist = Math.abs(movingBounds.right - rx);
                if (dist < bestDistR) {
                    bestDistR = dist;
                    snapRight = rx;
                }
            }

            let bestDistB = SNAP_THRESHOLD + 1;
            for (const ry of refYPoints) {
                const dist = Math.abs(movingBounds.bottom - ry);
                if (dist < bestDistB) {
                    bestDistB = dist;
                    snapBottom = ry;
                }
            }

            const extend = 5000;
            if (bestDistR <= SNAP_THRESHOLD && snapRight !== null) {
                const origWidth = scalingObj.width;
                const newScaleX = (snapRight - movingBounds.left) / origWidth;
                scalingObj.set('scaleX', newScaleX);
                scalingObj.setCoords();
                createSnapLine(snapRight, -extend, snapRight, extend);
            }
            if (bestDistB <= SNAP_THRESHOLD && snapBottom !== null) {
                const origHeight = scalingObj.height;
                const newScaleY = (snapBottom - movingBounds.top) / origHeight;
                scalingObj.set('scaleY', newScaleY);
                scalingObj.setCoords();
                createSnapLine(-extend, snapBottom, extend, snapBottom);
            }

            canvas.requestRenderAll();
        });
    }

    function bindSnapToggle() {
        const toggle = document.getElementById('snap-guide-toggle');
        if (toggle) {
            toggle.checked = snapEnabled;
            toggle.addEventListener('change', (e) => {
                snapEnabled = e.target.checked;
                if (!snapEnabled) {
                    clearSnapGuides();
                    canvas.requestRenderAll();
                }
            });
        }
    }

    // ===== 对象属性面板 (Property Panel) =====

    function bindPropertyPanel() {
        const fields = ['prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-angle', 'prop-opacity', 'prop-fill', 'prop-stroke', 'prop-stroke-width', 'prop-font-size'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const eventName = (el.type === 'color' || el.tagName === 'SELECT') ? 'input' : 'change';
            el.addEventListener(eventName, () => {
                const active = canvas.getActiveObject();
                if (!active) return;
                applyPropertyChange(active, id);
            });
        });

        document.getElementById('prop-lock-btn')?.addEventListener('click', () => {
            const active = canvas.getActiveObject();
            if (active) toggleLockObject(active);
            updatePropertyPanel();
        });
    }

    function applyPropertyChange(obj, fieldId) {
        const before = captureCanvasState();
        const val = document.getElementById(fieldId)?.value;

        switch (fieldId) {
            case 'prop-x':
                obj.set('left', parseFloat(val) || 0);
                break;
            case 'prop-y':
                obj.set('top', parseFloat(val) || 0);
                break;
            case 'prop-width': {
                const newW = parseFloat(val) || 1;
                obj.set('scaleX', newW / obj.width);
                break;
            }
            case 'prop-height': {
                const newH = parseFloat(val) || 1;
                obj.set('scaleY', newH / obj.height);
                break;
            }
            case 'prop-angle':
                obj.set('angle', parseFloat(val) || 0);
                break;
            case 'prop-opacity':
                obj.set('opacity', parseFloat(val) || 1);
                break;
            case 'prop-fill':
                obj.set('fill', val);
                break;
            case 'prop-stroke':
                obj.set('stroke', val);
                break;
            case 'prop-stroke-width':
                obj.set('strokeWidth', parseFloat(val) || 0);
                break;
            case 'prop-font-size':
                if (obj.type === 'text' || obj.type === 'i-text') {
                    obj.set('fontSize', parseInt(val) || 14);
                }
                break;
        }

        obj.setCoords();
        canvas.requestRenderAll();

        const after = captureCanvasState();
        HistoryManager.push(HistoryManager.createAction('修改属性', function() { restoreCanvasState(before); }, function() { restoreCanvasState(after); }));
    }

    function updatePropertyPanel() {
        const panel = document.getElementById('property-panel');
        if (!panel) return;

        const active = canvas.getActiveObject();
        if (!active) {
            panel.innerHTML = '<p class="empty-tip">选择对象以查看属性</p>';
            return;
        }

        const bounds = getObjectBounds(active);
        const isLocked = active._sciLocked || false;
        const isText = active.type === 'text' || active.type === 'i-text';
        const fill = active.fill || '#000000';
        const stroke = active.stroke || '#000000';

        let textFields = '';
        if (isText) {
            textFields = `
                <div class="form-row">
                    <label>字号</label>
                    <input type="number" class="form-input" id="prop-font-size" value="${active.fontSize || 14}" min="1" max="200">
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="prop-section">
                <div class="prop-section-title">位置与尺寸</div>
                <div class="prop-grid">
                    <div class="prop-field">
                        <label>X</label>
                        <input type="number" class="form-input prop-input" id="prop-x" value="${Math.round(bounds.left)}" step="1">
                    </div>
                    <div class="prop-field">
                        <label>Y</label>
                        <input type="number" class="form-input prop-input" id="prop-y" value="${Math.round(bounds.top)}" step="1">
                    </div>
                    <div class="prop-field">
                        <label>宽</label>
                        <input type="number" class="form-input prop-input" id="prop-width" value="${Math.round(bounds.width)}" step="1" min="1">
                    </div>
                    <div class="prop-field">
                        <label>高</label>
                        <input type="number" class="form-input prop-input" id="prop-height" value="${Math.round(bounds.height)}" step="1" min="1">
                    </div>
                </div>
            </div>
            <div class="prop-section">
                <div class="prop-section-title">变换</div>
                <div class="prop-grid">
                    <div class="prop-field">
                        <label>旋转角度</label>
                        <input type="number" class="form-input prop-input" id="prop-angle" value="${Math.round(active.angle || 0)}" step="1">
                    </div>
                    <div class="prop-field">
                        <label>不透明度</label>
                        <input type="number" class="form-input prop-input" id="prop-opacity" value="${active.opacity !== undefined ? active.opacity : 1}" step="0.1" min="0" max="1">
                    </div>
                </div>
            </div>
            <div class="prop-section">
                <div class="prop-section-title">外观</div>
                <div class="prop-grid">
                    <div class="prop-field">
                        <label>填充色</label>
                        <input type="color" class="form-color" id="prop-fill" value="${toHexColor(fill)}">
                    </div>
                    <div class="prop-field">
                        <label>描边色</label>
                        <input type="color" class="form-color" id="prop-stroke" value="${toHexColor(stroke)}">
                    </div>
                    <div class="prop-field">
                        <label>描边宽度</label>
                        <input type="number" class="form-input prop-input" id="prop-stroke-width" value="${active.strokeWidth || 0}" step="0.5" min="0">
                    </div>
                </div>
                ${textFields}
            </div>
            <div class="prop-section">
                <button class="btn btn-secondary prop-lock-btn ${isLocked ? 'prop-locked' : ''}" id="prop-lock-btn">
                    <span>${isLocked ? '🔒' : '🔓'}</span>
                    ${isLocked ? '解锁对象' : '锁定对象'}
                </button>
            </div>
        `;

        bindPropertyPanel();
    }

    function updatePropertyPanelValues() {
        const active = canvas.getActiveObject();
        if (!active) return;
        const bounds = getObjectBounds(active);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = val;
        };
        setVal('prop-x', Math.round(bounds.left));
        setVal('prop-y', Math.round(bounds.top));
        setVal('prop-width', Math.round(bounds.width));
        setVal('prop-height', Math.round(bounds.height));
        setVal('prop-angle', Math.round(active.angle || 0));
    }

    function toHexColor(color) {
        if (!color || color === 'transparent' || color === 'rgba(0,0,0,0)') return '#000000';
        if (color.startsWith('#')) {
            if (color.length === 4) {
                return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
            }
            return color.substring(0, 7);
        }
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return '#' + r + g + b;
        }
        return '#000000';
    }

    window.MainFigureCanvas = {
        init,
        addImageObject,
        clearCanvas,
        exportCanvas,
        updateLayerList,
        updateSnapshotList,
        captureCanvasState,
        restoreCanvasState,
        deleteSelectedObject,
        duplicateObject,
        updatePropertyPanel,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
