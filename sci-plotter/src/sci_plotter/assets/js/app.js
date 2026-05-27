/**
 * SCI-Plotter 应用入口
 */

(function() {
    function init() {
        const caps = SciPloterBridge?.getCapabilities?.() || {};
        const edition = caps.fileSystem ? 'Desktop' : 'Lite';
        console.log(`SCI-Plotter v${AppState.version} [${edition}] 初始化中...`);

        // 桌面版标识
        if (caps.fileSystem) {
            const header = document.querySelector('.app-header .logo span');
            if (header) header.textContent = 'SCI-Plotter Desktop';
        }

        // 桌面版特有按钮显示
        document.querySelectorAll('[data-desktop-only]').forEach(el => {
            el.style.display = caps.fileSystem ? '' : 'none';
        });

        if (window.DataManager) {
            DataManager.renderTableList();
            DataManager.renderGrid();
        }
        if (window.SubfigureEditor) {
            SubfigureEditor.updateTableSelect();
            SubfigureEditor.updateSnapshotList();
        }
        if (window.MainFigureCanvas) {
            MainFigureCanvas.updateLayerList();
            MainFigureCanvas.updateSnapshotList();
        }
        if (window.Workbench) {
            Workbench.updateSourceSelect();
        }

        document.addEventListener('keydown', handleKeyboard);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => {
                    AppState.subfigure.chartInstance?.resize();
                    AppState.mainfigure.fabricCanvas?.requestRenderAll();
                }, 100);
            }
        });

        if (typeof StatAnalysis !== 'undefined') {
            console.log('JS 统计分析引擎已加载');
        }

        console.log('SCI-Plotter 初始化完成');
    }

    function handleKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            ExportSystem?.saveWorkspace();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            ExportSystem?.exportAsImage();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            HistoryManager?.undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            HistoryManager?.redo();
        }

        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        if (!isInput && (e.key === 'Delete' || e.key === 'Backspace') && AppState.currentPage === 'mainfigure' && AppState.mainfigure.fabricCanvas) {
            const c = AppState.mainfigure.fabricCanvas;
            const activeObj = c.getActiveObject();
            if (activeObj) {
                const before = MainFigureCanvas.captureCanvasState();

                if (activeObj.type === 'group') {
                    activeObj.getObjects().forEach(child => c.remove(child));
                }
                c.remove(activeObj);
                const activeId = activeObj._sciLayerId;
                AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => {
                    if (l.id === activeId) return false;
                    if (l.fabricObject && l.fabricObject._sciLayerId === activeId) return false;
                    return true;
                });
                c.requestRenderAll();

                const after = MainFigureCanvas.captureCanvasState();
                HistoryManager.push(HistoryManager.createAction('删除对象', function() { MainFigureCanvas.restoreCanvasState(before); }, function() { MainFigureCanvas.restoreCanvasState(after); }));

                MainFigureCanvas?.updateLayerList();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
