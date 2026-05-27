/**
 * 全局撤销/重做历史管理器
 * 基于命令模式，支持批量操作与 UI 状态同步
 */

(function() {
    const MAX_HISTORY = 50;

    let undoStack = [];
    let redoStack = [];
    let batchBuffer = null;
    let isRestoring = false;

    function push(action) {
        if (isRestoring) return;

        if (!action || typeof action.undo !== 'function' || typeof action.redo !== 'function') {
            console.warn('HistoryManager.push: action 缺少 undo/redo 方法');
            return;
        }

        if (batchBuffer) {
            batchBuffer.push(action);
            return;
        }

        undoStack.push(action);
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        redoStack = [];
        updateUI();
    }

    function beginBatch(description) {
        batchBuffer = [];
        batchBuffer._description = description;
    }

    function endBatch() {
        if (!batchBuffer) return;

        const actions = batchBuffer;
        const description = batchBuffer._description || '批量操作';
        batchBuffer = null;

        if (actions.length === 0) return;

        if (actions.length === 1) {
            push(actions[0]);
            return;
        }

        push({
            type: 'batch',
            description: description,
            undo: function() {
                for (let i = actions.length - 1; i >= 0; i--) {
                    actions[i].undo();
                }
            },
            redo: function() {
                for (let i = 0; i < actions.length; i++) {
                    actions[i].redo();
                }
            },
        });
    }

    function cancelBatch() {
        batchBuffer = null;
    }

    function undo() {
        if (undoStack.length === 0) return false;
        const action = undoStack.pop();
        isRestoring = true;
        try {
            action.undo();
        } catch (e) {
            console.error('撤销失败:', e);
        }
        isRestoring = false;
        redoStack.push(action);
        updateUI();
        window.dispatchEvent(new CustomEvent('historychange'));
        return true;
    }

    function redo() {
        if (redoStack.length === 0) return false;
        const action = redoStack.pop();
        isRestoring = true;
        try {
            action.redo();
        } catch (e) {
            console.error('重做失败:', e);
        }
        isRestoring = false;
        undoStack.push(action);
        updateUI();
        window.dispatchEvent(new CustomEvent('historychange'));
        return true;
    }

    function clear() {
        undoStack = [];
        redoStack = [];
        batchBuffer = null;
        isRestoring = false;
        updateUI();
    }

    function canUndo() {
        return undoStack.length > 0;
    }

    function canRedo() {
        return redoStack.length > 0;
    }

    function getUndoDescription() {
        if (undoStack.length === 0) return null;
        return undoStack[undoStack.length - 1].description || '';
    }

    function getRedoDescription() {
        if (redoStack.length === 0) return null;
        return redoStack[redoStack.length - 1].description || '';
    }

    function isRestoringState() {
        return isRestoring;
    }

    function updateUI() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        if (undoBtn) {
            undoBtn.disabled = undoStack.length === 0;
            undoBtn.title = undoStack.length > 0
                ? '撤销: ' + (undoStack[undoStack.length - 1].description || '') + ' (Ctrl+Z)'
                : '撤销 (Ctrl+Z)';
        }
        if (redoBtn) {
            redoBtn.disabled = redoStack.length === 0;
            redoBtn.title = redoStack.length > 0
                ? '重做: ' + (redoStack[redoStack.length - 1].description || '') + ' (Ctrl+Shift+Z)'
                : '重做 (Ctrl+Shift+Z)';
        }
    }

    // ===== 便捷工厂方法 =====

    function createTableAction(before, after, description) {
        const beforeSnapshot = JSON.parse(JSON.stringify(before));
        const afterSnapshot = JSON.parse(JSON.stringify(after));
        return {
            type: 'tables',
            description: description || '数据表变更',
            undo: function() {
                AppState.tables = JSON.parse(JSON.stringify(beforeSnapshot));
                AppState.tableCounter = beforeSnapshot._tableCounter || AppState.tableCounter;
                refreshAllViews();
            },
            redo: function() {
                AppState.tables = JSON.parse(JSON.stringify(afterSnapshot));
                AppState.tableCounter = afterSnapshot._tableCounter || AppState.tableCounter;
                refreshAllViews();
            },
        };
    }

    function createSnapshotAction(key, before, after, description) {
        const beforeVal = JSON.parse(JSON.stringify(before));
        const afterVal = JSON.parse(JSON.stringify(after));
        return {
            type: key,
            description: description || '状态变更',
            undo: function() {
                const val = JSON.parse(JSON.stringify(beforeVal));
                applyState(key, val);
                refreshAllViews();
            },
            redo: function() {
                const val = JSON.parse(JSON.stringify(afterVal));
                applyState(key, val);
                refreshAllViews();
            },
        };
    }

    function createAction(description, undoFn, redoFn) {
        return {
            type: 'custom',
            description: description,
            undo: undoFn,
            redo: redoFn,
        };
    }

    function applyState(key, val) {
        switch (key) {
            case 'tables':
                AppState.tables = val.tables || val;
                if (val._tableCounter !== undefined) AppState.tableCounter = val._tableCounter;
                break;
            case 'snapshots':
                AppState.snapshots = val;
                break;
            case 'mainfigure.layers':
                AppState.mainfigure.layers = val;
                break;
            case 'subfigure.shapes':
                AppState.subfigure.shapes = val;
                break;
            case 'subfigure.textOverlays':
                AppState.subfigure.textOverlays = val;
                break;
            case 'subfigure.significanceAnnotations':
                AppState.subfigure.significanceAnnotations = val;
                break;
            case 'subfigure.trendLine':
                AppState.subfigure.trendLine = val;
                break;
            default:
                if (AppState[key] !== undefined) {
                    AppState[key] = val;
                }
                break;
        }
    }

    function captureTablesState() {
        const data = JSON.parse(JSON.stringify(AppState.tables));
        data._tableCounter = AppState.tableCounter;
        return data;
    }

    function captureSnapshotState() {
        return JSON.parse(JSON.stringify(AppState.snapshots));
    }

    function refreshAllViews() {
        DataManager?.renderTableList();
        DataManager?.renderGrid();
        Workbench?.updateSourceSelect();
        SubfigureEditor?.updateTableSelect();
        SubfigureEditor?.updateSnapshotList();
        SubfigureEditor?.refreshChart();
        MainFigureCanvas?.updateSnapshotList();
        MainFigureCanvas?.updateLayerList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

    window.HistoryManager = {
        push,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
        getUndoDescription,
        getRedoDescription,
        beginBatch,
        endBatch,
        cancelBatch,
        isRestoringState,
        createTableAction,
        createSnapshotAction,
        createAction,
        captureTablesState,
        captureSnapshotState,
        refreshAllViews,
    };

    function initButtons() {
        document.getElementById('btn-undo')?.addEventListener('click', undo);
        document.getElementById('btn-redo')?.addEventListener('click', redo);
        updateUI();
    }

    if (document.readyState !== 'loading') {
        initButtons();
    } else {
        document.addEventListener('DOMContentLoaded', initButtons);
    }
})();
