/**
 * 主图画布管理
 * 基于 Fabric.js 实现图层、拖拽、缩放、基本绘图工具
 */

(function() {
    let canvas = null;
    let canvasEl = null;
    let currentTool = 'select';
    let isDrawing = false;
    let drawStart = null;

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
        bindDrawingTools();
        updateLayerList();
        updateSnapshotList();
        updateCanvasSizeInputs();
    }

    function bindEvents() {
        // 画布尺寸
        document.getElementById('canvas-width')?.addEventListener('change', (e) => {
            const w = parseInt(e.target.value) || 1200;
            AppState.mainfigure.width = w;
            canvas.setWidth(w);
            canvas.requestRenderAll();
        });
        document.getElementById('canvas-height')?.addEventListener('change', (e) => {
            const h = parseInt(e.target.value) || 800;
            AppState.mainfigure.height = h;
            canvas.setHeight(h);
            canvas.requestRenderAll();
        });
        document.getElementById('canvas-bg')?.addEventListener('input', (e) => {
            AppState.mainfigure.bgColor = e.target.value;
            canvas.setBackgroundColor(e.target.value, () => canvas.requestRenderAll());
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

        canvas.on('selection:created', updateLayerList);
        canvas.on('selection:updated', updateLayerList);
        canvas.on('selection:cleared', updateLayerList);
        canvas.on('object:modified', updateLayerList);
        canvas.on('object:added', updateLayerList);
        canvas.on('object:removed', updateLayerList);

        // 绘图工具鼠标事件
        canvas.on('mouse:down', (o) => {
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
            updateLayerList();

            if (tool === 'text') {
                obj.on('mousedblclick', () => {
                    const newText = prompt('编辑文本:', obj.text);
                    if (newText !== null) {
                        obj.set('text', newText);
                        layer.name = newText.substring(0, 20) + (newText.length > 20 ? '...' : '');
                        canvas.requestRenderAll();
                        updateLayerList();
                    }
                });
            }
            // 箭头由多个对象组成（Group），需要特殊处理
            if (tool === 'arrow' && obj.type === 'group') {
                obj._sciLayerId = layer.id;
                // 为组内每个子对象也绑定 layer ID
                obj.getObjects().forEach(child => { child._sciLayerId = layer.id; });
            }
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

            // 双击子图跳转回编辑器
            if (subfigureData) {
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
                        alert('警告：该子图的源数据表已不存在，图表可能无法正常显示。');
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

                    // 切换页面
                    switchPage('subfigure');
                });
            }

            updateLayerList();
        }, { crossOrigin: 'anonymous' });
    }

    function clearCanvas() {
        canvas.clear();
        AppState.mainfigure.layers = [];
        canvas.setBackgroundColor(AppState.mainfigure.bgColor, () => canvas.requestRenderAll());
        updateLayerList();
    }

    function updateLayerList() {
        const container = document.getElementById('layer-list');
        if (!container) return;
        const layers = AppState.mainfigure.layers;
        if (layers.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无图层</p>';
            return;
        }
        const activeObj = canvas.getActiveObject();
        const activeId = activeObj?._sciLayerId;

        container.innerHTML = layers.slice().reverse().map(layer => {
            const isActive = layer.id === activeId;
            let thumb = '';
            if (layer.type === 'image' || layer.type === 'subfigure') {
                thumb = `<img src="${layer.fabricObject._element?.src || ''}" style="width:100%;height:100%;object-fit:cover">`;
            } else {
                const icon = layer.type === 'text' ? 'T' : (layer.type === 'group' ? 'G' : (layer.name?.[0] || 'S'));
                thumb = `<span style="font-size:10px">${icon}</span>`;
            }
            const typeLabel = layer.type === 'subfigure' ? '子图' : (layer.type === 'image' ? '图片' : (layer.type === 'text' ? '文本' : (layer.type === 'group' ? '组合' : '图形')));
            return `
                <div class="layer-item ${isActive ? 'active' : ''}" data-id="${layer.id}">
                    <div class="layer-thumb">${thumb}</div>
                    <div class="layer-info">
                        <div class="layer-name">${layer.name}</div>
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
            // 单选时也允许"组合"，虽然意义不大
            return;
        }

        const group = new fabric.Group(objectsToGroup, {
            ...commonProps(),
        });

        // 删除旧图层记录
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
        updateLayerList();
    }

    function ungroupSelectedObjects() {
        const active = canvas.getActiveObject();
        if (!active || active.type !== 'group') return;

        const items = active.getObjects();
        const groupLeft = active.left;
        const groupTop = active.top;

        // 删除组合图层
        const groupLayerId = active._sciLayerId;
        AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => l.id !== groupLayerId);

        canvas.remove(active);
        canvas.discardActiveObject();

        items.forEach(item => {
            // 将相对于组中心的坐标转换为绝对坐标
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

        const values = objects.map(o => o.left);
        let target;
        switch (mode) {
            case 'left':
                target = Math.min(...values);
                objects.forEach(o => o.set('left', target));
                break;
            case 'right':
                target = Math.max(...values);
                objects.forEach(o => o.set('left', target + (values[0] === target ? 0 : 0)));
                // 右对齐：将所有对象的右边缘对齐到最右边
                const maxRight = Math.max(...objects.map(o => o.left + (o.width * (o.scaleX || 1))));
                objects.forEach(o => {
                    o.set('left', maxRight - (o.width * (o.scaleX || 1)));
                });
                break;
            case 'center':
                // 水平居中（基于画布中心或选区中心）
                const centerX = AppState.mainfigure.width / 2;
                objects.forEach(o => {
                    o.set('left', centerX - ((o.width * (o.scaleX || 1)) / 2));
                });
                break;
        }

        objects.forEach(o => o.setCoords());
        canvas.requestRenderAll();
        updateLayerList();
    }

    function reorderObject(mode) {
        const active = canvas.getActiveObject();
        if (!active) return;

        const layerId = active._sciLayerId;
        const layerIndex = AppState.mainfigure.layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

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
                deleteSnapshot(btn.dataset.id);
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

    window.MainFigureCanvas = {
        init,
        addImageObject,
        clearCanvas,
        exportCanvas,
        updateLayerList,
        updateSnapshotList,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
