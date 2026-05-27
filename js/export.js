/**
 * 保存与导出系统
 */

(function() {
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.getElementById('download-link');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // ===== 工作区 =====
    function saveWorkspace() {
        const workspace = exportWorkspace();
        const json = JSON.stringify(workspace, null, 2);
        const date = new Date().toISOString().slice(0, 10);
        downloadFile(json, `SCI-Ploter-Workspace-${date}.json`);
    }

    async function openWorkspace() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.spf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await readFile(file);
                const data = JSON.parse(text);

                if (data.format === 'sci-ploter-figure') {
                    const layers = importEditableFigure(data);
                    SubfigureEditor?.updateSnapshotList();
                    MainFigureCanvas?.updateSnapshotList();
                    if (MainFigureCanvas && layers.length > 0) {
                        MainFigureCanvas.clearCanvas();
                        layers.forEach(layerData => {
                            if (layerData.snapshotId) {
                                const snap = AppState.snapshots.find(s => s.id === layerData.snapshotId);
                                if (snap) {
                                    MainFigureCanvas.addImageObject(snap.thumbnail, layerData.name, layerData.left, layerData.top, snap.id);
                                }
                            }
                        });
                    }
                    alert('图文件加载成功');
                } else {
                    importWorkspace(data);
                    SubfigureEditor?.updateTableSelect();
                    SubfigureEditor?.refreshChart();
                    SubfigureEditor?.updateSnapshotList();
                    DataManager?.renderTableList();
                    DataManager?.renderGrid();
                    Workbench?.updateSourceSelect();
                    MainFigureCanvas?.updateSnapshotList();
                    if (MainFigureCanvas) MainFigureCanvas.clearCanvas();
                    alert('工作区加载成功');
                }
            } catch (err) {
                alert('加载失败: ' + err.message);
            }
        };
        input.click();
    }

    // ===== 可编辑图保存 =====
    function saveEditableFigure() {
        const figure = exportEditableFigure();
        const json = JSON.stringify(figure, null, 2);
        const date = new Date().toISOString().slice(0, 10);
        downloadFile(json, `Figure-${date}.spf`, 'application/json');
    }

    // ===== 图片导出 =====
    function exportAsImage() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex;
            align-items: center; justify-content: center; z-index: 10000;
        `;
        dialog.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px; width: 360px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <h3 style="margin: 0 0 16px; font-size: 16px;">导出图片</h3>
                <div style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:500;">格式</label>
                    <select id="export-format" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
                        <option value="png">PNG (无损)</option>
                        <option value="jpeg">JPEG (有损)</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:500;">DPI (倍率)</label>
                    <select id="export-dpi" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
                        <option value="1">1x (标准)</option>
                        <option value="2" selected>2x (论文推荐)</option>
                        <option value="3">3x (高清)</option>
                        <option value="4">4x (印刷级)</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display:block; margin-bottom:6px; font-size:13px; font-weight:500;">质量 (JPEG)</label>
                    <input type="range" id="export-quality" min="0.5" max="1" step="0.05" value="0.95" style="width:100%;">
                    <span id="quality-value" style="font-size:12px; color:#6b7280;">95%</span>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="export-cancel" style="padding:8px 16px; border:1px solid #d1d5db; background:white; border-radius:6px; cursor:pointer;">取消</button>
                    <button id="export-confirm" style="padding:8px 16px; border:none; background:#2563eb; color:white; border-radius:6px; cursor:pointer; font-weight:500;">导出</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        const qualityInput = dialog.querySelector('#export-quality');
        const qualityValue = dialog.querySelector('#quality-value');
        qualityInput.addEventListener('input', () => {
            qualityValue.textContent = Math.round(qualityInput.value * 100) + '%';
        });

        dialog.querySelector('#export-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('#export-confirm').addEventListener('click', () => {
            const format = dialog.querySelector('#export-format').value;
            const dpi = parseInt(dialog.querySelector('#export-dpi').value);
            const quality = parseFloat(qualityInput.value);
            performExport(format, dpi, quality);
            dialog.remove();
        });
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.remove(); });
    }

    function performExport(format, dpi, quality) {
        if (AppState.currentPage === 'subfigure' && AppState.subfigure.chartInstance) {
            const url = AppState.subfigure.chartInstance.getDataURL({
                type: format, pixelRatio: dpi, backgroundColor: '#ffffff',
            });
            const link = document.createElement('a');
            link.href = url;
            link.download = `subfigure-${Date.now()}.${format}`;
            link.click();
        } else if (AppState.currentPage === 'mainfigure' && AppState.mainfigure.fabricCanvas) {
            const c = AppState.mainfigure.fabricCanvas;
            const origW = c.width, origH = c.height, origZ = c.getZoom();
            if (dpi > 1) {
                c.setWidth(origW * dpi);
                c.setHeight(origH * dpi);
                c.setZoom(dpi);
                c.requestRenderAll();
            }
            const url = c.toDataURL({ format, quality, multiplier: 1 });
            if (dpi > 1) {
                c.setWidth(origW); c.setHeight(origH); c.setZoom(origZ); c.requestRenderAll();
            }
            const link = document.createElement('a');
            link.href = url;
            link.download = `figure-${Date.now()}.${format}`;
            link.click();
        }
    }

    function init() {
        document.getElementById('btn-save-workspace')?.addEventListener('click', saveWorkspace);
        document.getElementById('btn-open-workspace')?.addEventListener('click', openWorkspace);
        document.getElementById('btn-export')?.addEventListener('click', exportAsImage);
        document.getElementById('btn-save-figure')?.addEventListener('click', saveEditableFigure);
        document.getElementById('btn-export-main')?.addEventListener('click', exportAsImage);
    }

    window.ExportSystem = {
        saveWorkspace, openWorkspace, saveEditableFigure, exportAsImage,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
