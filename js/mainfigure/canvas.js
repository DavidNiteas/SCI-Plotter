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
            const { imageUrl, name } = e.detail;
            addImageObject(imageUrl, name);
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
            addImageObject(snapshot.thumbnail, snapshot.name, x, y, snapshot.id);
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
            case 'line':
                obj = new fabric.Line([start.x, start.y, end.x, end.y], {
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                break;
            case 'arrow':
                obj = new fabric.Line([start.x, start.y, end.x, end.y], {
                    stroke: color,
                    strokeWidth: 2,
                    ...commonProps(),
                });
                // Fabric.js 没有原生箭头，简化处理
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

    function addImageObject(imageUrl, name, x, y, snapshotId) {
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
                type: 'image',
                name: name || '图片',
                fabricObject: img,
                snapshotId: snapshotId,
            };
            AppState.mainfigure.layers.push(layer);
            img._sciLayerId = layer.id;
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
            if (layer.type === 'image') {
                thumb = `<img src="${layer.fabricObject._element?.src || ''}" style="width:100%;height:100%;object-fit:cover">`;
            } else {
                const icon = layer.type === 'text' ? 'T' : (layer.name?.[0] || 'S');
                thumb = `<span style="font-size:10px">${icon}</span>`;
            }
            return `
                <div class="layer-item ${isActive ? 'active' : ''}" data-id="${layer.id}">
                    <div class="layer-thumb">${thumb}</div>
                    <div class="layer-info">
                        <div class="layer-name">${layer.name}</div>
                        <div class="layer-type">${layer.type === 'image' ? '子图' : (layer.type === 'text' ? '文本' : '图形')}</div>
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
