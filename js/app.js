/**
 * SCI-Ploter 应用入口
 */

(function() {
    function init() {
        console.log('SCI-Ploter v' + AppState.version + ' 初始化中...');

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

        console.log('SCI-Ploter 初始化完成');
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

        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        if (!isInput && (e.key === 'Delete' || e.key === 'Backspace') && AppState.currentPage === 'mainfigure' && AppState.mainfigure.fabricCanvas) {
            const c = AppState.mainfigure.fabricCanvas;
            const activeObj = c.getActiveObject();
            if (activeObj) {
                c.remove(activeObj);
                AppState.mainfigure.layers = AppState.mainfigure.layers.filter(l => l.fabricObject !== activeObj);
                c.requestRenderAll();
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
