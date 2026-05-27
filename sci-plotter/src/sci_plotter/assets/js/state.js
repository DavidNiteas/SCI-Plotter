/**
 * SCI-Plotter 全局状态管理
 * 管理数据表、分析工作台、子图、主图、版本控制
 */

const AppState = {
    version: '1.1.0',
    currentPage: 'datamanage',

    // ===== 数据表系统 =====
    tables: [],           // { id, name, headers[], rows[][], createdAt, source? }
    tableCounter: 0,
    activeTableId: null,  // 当前选中的表

    // ===== 分析工作台 =====
    workbench: {
        sourceTableId: null,
        selectedColumns: [],   // 列索引数组
        previewRows: [],       // 预览数据
        filters: [],           // { column, operator, value }
        sortColumn: null,
        sortAsc: true,
    },

    // ===== 子图编辑器 =====
    subfigure: {
        selectedTableId: null,
        template: 'scatter',
        chartInstance: null,
        textOverlays: [],
        shapes: [],           // { id, type, x, y, width, height, ... }
        colorScheme: 'academic',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        aspectRatio: '4:3',   // 子图比例: 4:3, 16:9, 1:1, 3:4, custom
        customWidth: 600,
        customHeight: 450,
    },

    // ===== 主图状态 =====
    mainfigure: {
        fabricCanvas: null,
        width: 1200,
        height: 800,
        bgColor: '#ffffff',
        layers: [],
    },

    // ===== 版本控制 =====
    snapshots: [],
    snapshotCounter: 0,
};

// ===== 数据表管理 =====

function generateId() {
    return 'sp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

function createTable(name, headers, rows, source) {
    const table = {
        id: generateId(),
        name: name || `数据表 ${++AppState.tableCounter}`,
        headers: headers || [],
        rows: rows || [],
        createdAt: Date.now(),
        source: source,
    };
    AppState.tables.push(table);
    return table;
}

function deleteTable(id) {
    AppState.tables = AppState.tables.filter(t => t.id !== id);
    if (AppState.activeTableId === id) AppState.activeTableId = null;
    if (AppState.workbench.sourceTableId === id) AppState.workbench.sourceTableId = null;
    if (AppState.subfigure.selectedTableId === id) AppState.subfigure.selectedTableId = null;
}

function getTable(id) {
    return AppState.tables.find(t => t.id === id);
}

function renameTable(id, newName) {
    const t = getTable(id);
    if (t) t.name = newName;
}

function updateTableData(id, headers, rows) {
    const t = getTable(id);
    if (t) {
        t.headers = headers;
        t.rows = rows;
    }
}

// ===== 快照/暂存 =====

function createSnapshot(name, type, thumbnail, data) {
    const snapshot = {
        id: generateId(),
        name: name || `暂存 ${++AppState.snapshotCounter}`,
        type: type,
        timestamp: Date.now(),
        thumbnail: thumbnail,
        data: JSON.parse(JSON.stringify(data)),
    };
    AppState.snapshots.push(snapshot);
    return snapshot;
}

function deleteSnapshot(id) {
    AppState.snapshots = AppState.snapshots.filter(s => s.id !== id);
}

function getSnapshotsByType(type) {
    return AppState.snapshots.filter(s => s.type === type);
}

// ===== 保存/导出 =====

function exportAllTables() {
    return {
        version: AppState.version,
        exportedAt: Date.now(),
        tables: AppState.tables,
        tableCounter: AppState.tableCounter,
    };
}

function importAllTables(data) {
    if (data.tables) {
        AppState.tables = data.tables;
    }
    if (data.tableCounter) {
        AppState.tableCounter = data.tableCounter;
    }
}

function exportWorkspace() {
    return {
        version: AppState.version,
        exportedAt: Date.now(),
        tables: AppState.tables,
        tableCounter: AppState.tableCounter,
        subfigure: {
            selectedTableId: AppState.subfigure.selectedTableId,
            template: AppState.subfigure.template,
            textOverlays: AppState.subfigure.textOverlays,
            shapes: AppState.subfigure.shapes,
            colorScheme: AppState.subfigure.colorScheme,
            fontFamily: AppState.subfigure.fontFamily,
            fontSize: AppState.subfigure.fontSize,
            aspectRatio: AppState.subfigure.aspectRatio,
            customWidth: AppState.subfigure.customWidth,
            customHeight: AppState.subfigure.customHeight,
        },
        mainfigure: {
            width: AppState.mainfigure.width,
            height: AppState.mainfigure.height,
            bgColor: AppState.mainfigure.bgColor,
            layers: AppState.mainfigure.layers.map(l => ({
                id: l.id,
                type: l.type,
                name: l.name,
                snapshotId: l.snapshotId,
                subfigureData: l.subfigureData,
                left: l.fabricObject?.left,
                top: l.fabricObject?.top,
                scaleX: l.fabricObject?.scaleX,
                scaleY: l.fabricObject?.scaleY,
                angle: l.fabricObject?.angle,
            })),
        },
        snapshots: AppState.snapshots,
        snapshotCounter: AppState.snapshotCounter,
    };
}

function importWorkspace(data) {
    if (!data || data.version !== AppState.version) {
        console.warn('工作区版本不匹配，尝试兼容加载');
    }
    if (data.tables) AppState.tables = data.tables;
    if (data.tableCounter) AppState.tableCounter = data.tableCounter;
    if (data.subfigure) Object.assign(AppState.subfigure, data.subfigure);
    if (data.mainfigure) Object.assign(AppState.mainfigure, data.mainfigure);
    if (data.snapshots) AppState.snapshots = data.snapshots;
    if (data.snapshotCounter) AppState.snapshotCounter = data.snapshotCounter;
}

function exportEditableFigure() {
    const figure = {
        format: 'sci-plotter-figure',
        version: AppState.version,
        exportedAt: Date.now(),
        mainfigure: {
            width: AppState.mainfigure.width,
            height: AppState.mainfigure.height,
            bgColor: AppState.mainfigure.bgColor,
            layers: [],
        },
        subfigures: {},
    };

    const usedSnapshotIds = new Set();
    AppState.mainfigure.layers.forEach(l => {
        if (l.snapshotId) usedSnapshotIds.add(l.snapshotId);
    });

    AppState.mainfigure.layers.forEach(l => {
        figure.mainfigure.layers.push({
            id: l.id,
            type: l.type,
            name: l.name,
            snapshotId: l.snapshotId,
            subfigureData: l.subfigureData,
            left: l.fabricObject?.left,
            top: l.fabricObject?.top,
            scaleX: l.fabricObject?.scaleX,
            scaleY: l.fabricObject?.scaleY,
            angle: l.fabricObject?.angle,
        });
    });

    AppState.snapshots.forEach(s => {
        if (usedSnapshotIds.has(s.id) || s.type === 'subfigure') {
            figure.subfigures[s.id] = s;
        }
    });

    return figure;
}

function importEditableFigure(data) {
    if (data.format !== 'sci-plotter-figure') {
        throw new Error('不支持的文件格式');
    }
    if (data.subfigures) {
        Object.values(data.subfigures).forEach(s => {
            if (!AppState.snapshots.find(ex => ex.id === s.id)) {
                AppState.snapshots.push(s);
            }
        });
    }
    if (data.mainfigure) {
        AppState.mainfigure.width = data.mainfigure.width || 1200;
        AppState.mainfigure.height = data.mainfigure.height || 800;
        AppState.mainfigure.bgColor = data.mainfigure.bgColor || '#ffffff';
        return data.mainfigure.layers;
    }
    return [];
}
