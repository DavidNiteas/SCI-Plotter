/**
 * 数据管理页面
 * 管理数据表的导入、新建、编辑、删除、导出
 * 支持单元格选区、拖拽多选、剪贴板复制/粘贴/剪切、右键菜单
 */

(function() {
    let activeTableId = null;

    let selAnchor = null;
    let selFocus = null;
    let cellEditor = null;

    function init() {
        bindEvents();
        renderTableList();
        setupGlobalListeners();
    }

    function setupGlobalListeners() {
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.grid-context-menu')) return;
            hideContextMenu();
            if (!e.target.closest('#data-grid') && cellEditor) {
                commitEdit();
            }
        });
    }

    function generateUniqueTableName(baseName) {
        const existingNames = new Set(AppState.tables.map(t => t.name));
        if (!existingNames.has(baseName)) return baseName;
        let counter = 1;
        let candidate = `${baseName}-${counter}`;
        while (existingNames.has(candidate)) {
            counter++;
            candidate = `${baseName}-${counter}`;
        }
        return candidate;
    }

    function bindEvents() {
        document.getElementById('btn-import-csv')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.txt';
            input.multiple = true;
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                const before = HistoryManager.captureTablesState();
                const successNames = [];
                const errors = [];
                let lastTableId = null;

                for (const file of files) {
                    try {
                        const data = await CSVParser.parseFile(file);
                        const baseName = file.name.replace(/\.[^.]+$/, '');
                        const tableName = generateUniqueTableName(baseName);
                        const table = createTable(tableName, data.headers, data.rows, 'csv');
                        lastTableId = table.id;
                        successNames.push(table.name);
                    } catch (err) {
                        errors.push(`${file.name}: ${err.message}`);
                    }
                }

                if (lastTableId) {
                    activeTableId = lastTableId;
                    AppState.activeTableId = lastTableId;
                }

                const after = HistoryManager.captureTablesState();
                const desc = successNames.length === 1
                    ? '导入 CSV: ' + successNames[0]
                    : `批量导入 CSV（${successNames.length} 个文件）`;
                HistoryManager.push(HistoryManager.createTableAction(before, after, desc));
                renderTableList();
                renderGrid();
                window.dispatchEvent(new CustomEvent('tableschanged'));

                if (successNames.length > 0) {
                    Toast.success(desc);
                }
                if (errors.length > 0) {
                    Toast.error('部分文件导入失败:\n' + errors.join('\n'));
                }
            };
            input.click();
        });

        document.getElementById('btn-import-xlsx')?.addEventListener('click', () => {
            if (!XlsxHandler?.isAvailable()) {
                Toast.error('Excel 处理库未加载，请检查网络连接');
                return;
            }
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls';
            input.multiple = true;
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                const before = HistoryManager.captureTablesState();
                let totalSheets = 0;
                const successNames = [];
                const errors = [];
                let lastTableId = null;

                for (const file of files) {
                    try {
                        const sheets = await XlsxHandler.parseFile(file);
                        if (sheets.length === 0) {
                            Toast.warning(`${file.name} 中未找到有效数据`);
                            continue;
                        }
                        const fileBaseName = file.name.replace(/\.[^.]+$/, '');
                        sheets.forEach((sheet) => {
                            const tableName = sheets.length === 1
                                ? generateUniqueTableName(fileBaseName)
                                : generateUniqueTableName(`${fileBaseName} - ${sheet.sheetName}`);
                            const table = createTable(tableName, sheet.headers, sheet.rows, 'xlsx');
                            lastTableId = table.id;
                            totalSheets++;
                        });
                        successNames.push(fileBaseName + (sheets.length > 1 ? `（${sheets.length} 个表）` : ''));
                    } catch (err) {
                        errors.push(`${file.name}: ${err.message}`);
                    }
                }

                if (lastTableId) {
                    activeTableId = lastTableId;
                    AppState.activeTableId = lastTableId;
                }

                const after = HistoryManager.captureTablesState();
                const desc = successNames.length === 1 && totalSheets === 1
                    ? '导入 Excel: ' + successNames[0]
                    : `批量导入 Excel（${successNames.length} 个文件，共 ${totalSheets} 个工作表）`;
                HistoryManager.push(HistoryManager.createTableAction(before, after, desc));
                renderTableList();
                renderGrid();
                window.dispatchEvent(new CustomEvent('tableschanged'));

                if (successNames.length > 0) {
                    Toast.success(desc);
                }
                if (errors.length > 0) {
                    Toast.error('部分文件导入失败:\n' + errors.join('\n'));
                }
            };
            input.click();
        });

        document.getElementById('btn-new-table')?.addEventListener('click', () => {
            const before = HistoryManager.captureTablesState();
            const table = createTable('新建数据表', ['A', 'B', 'C'], [[null, null, null], [null, null, null]], 'manual');
            activeTableId = table.id;
            AppState.activeTableId = table.id;
            const after = HistoryManager.captureTablesState();
            HistoryManager.push(HistoryManager.createTableAction(before, after, '新建空表: ' + table.name));
            renderTableList();
            renderGrid();
            window.dispatchEvent(new CustomEvent('tableschanged'));
        });

        document.getElementById('btn-export-table-csv')?.addEventListener('click', () => {
            const table = getTable(activeTableId);
            if (!table) { Toast.warning('请先选择一个数据表'); return; }
            const csv = tableToCSV(table);
            downloadFile(csv, `${table.name}.csv`, 'text/csv');
        });

        document.getElementById('btn-export-table-xlsx')?.addEventListener('click', () => {
            if (!XlsxHandler?.isAvailable()) {
                Toast.error('Excel 处理库未加载，请检查网络连接');
                return;
            }
            const table = getTable(activeTableId);
            if (!table) { Toast.warning('请先选择一个数据表'); return; }
            try {
                XlsxHandler.exportTable(table);
            } catch (err) {
                Toast.error('Excel 导出失败: ' + err.message);
            }
        });

        document.getElementById('btn-export-all-xlsx')?.addEventListener('click', () => {
            if (!XlsxHandler?.isAvailable()) {
                Toast.error('Excel 处理库未加载，请检查网络连接');
                return;
            }
            if (AppState.tables.length === 0) { Toast.warning('暂无数据表可导出'); return; }
            try {
                XlsxHandler.exportAllTables(AppState.tables);
            } catch (err) {
                Toast.error('Excel 导出失败: ' + err.message);
            }
        });

        document.getElementById('btn-export-all-json')?.addEventListener('click', () => {
            const data = exportAllTables();
            const json = JSON.stringify(data, null, 2);
            downloadFile(json, `SCI-Plotter-Tables-${new Date().toISOString().slice(0,10)}.json`);
        });

        document.getElementById('table-name-input')?.addEventListener('change', (e) => {
            if (activeTableId) {
                const table = getTable(activeTableId);
                if (table) {
                    const tid = activeTableId;
                    const oldName = table.name;
                    const newName = e.target.value;
                    table.name = newName;
                    HistoryManager.push(HistoryManager.createAction(
                        '重命名: ' + oldName + ' → ' + newName,
                        function() { const t = getTable(tid); if (t) t.name = oldName; HistoryManager.refreshAllViews(); },
                        function() { const t = getTable(tid); if (t) t.name = newName; HistoryManager.refreshAllViews(); }
                    ));
                    renderTableList();
                }
            }
        });

        document.getElementById('btn-add-row')?.addEventListener('click', () => modifyGrid('addRow'));
        document.getElementById('btn-add-col')?.addEventListener('click', () => modifyGrid('addCol'));
        document.getElementById('btn-del-row')?.addEventListener('click', () => modifyGrid('delRow'));
        document.getElementById('btn-del-col')?.addEventListener('click', () => modifyGrid('delCol'));
        document.getElementById('btn-find-replace')?.addEventListener('click', showFindReplaceDialog);
    }

    function renderTableList() {
        const container = document.getElementById('data-table-list');
        if (!container) return;

        if (AppState.tables.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无数据表<br>点击"导入 CSV"、"导入 Excel"或"新建空表"</p>';
            return;
        }

        container.innerHTML = AppState.tables.map(t => `
            <div class="table-item ${t.id === activeTableId ? 'active' : ''}" data-id="${t.id}">
                <span class="table-item-name">${t.name}</span>
                <span class="table-item-meta">${t.rows.length}×${t.headers.length}</span>
                <button class="table-item-delete" data-id="${t.id}">删除</button>
            </div>
        `).join('');

        container.querySelectorAll('.table-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('table-item-delete')) return;
                activeTableId = item.dataset.id;
                AppState.activeTableId = activeTableId;
                renderTableList();
                renderGrid();
            });
        });

        container.querySelectorAll('.table-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定删除此数据表吗？')) {
                    const delTable = getTable(btn.dataset.id);
                    const delName = delTable ? delTable.name : '';
                    const before = HistoryManager.captureTablesState();
                    const beforeSnapshots = HistoryManager.captureSnapshotState();
                    deleteTable(btn.dataset.id);
                    if (activeTableId === btn.dataset.id) {
                        activeTableId = AppState.tables.length > 0 ? AppState.tables[0].id : null;
                        AppState.activeTableId = activeTableId;
                    }
                    const after = HistoryManager.captureTablesState();
                    const afterSnapshots = HistoryManager.captureSnapshotState();
                    HistoryManager.beginBatch('删除表: ' + delName);
                    HistoryManager.push(HistoryManager.createTableAction(before, after, '删除表: ' + delName));
                    if (JSON.stringify(beforeSnapshots) !== JSON.stringify(afterSnapshots)) {
                        HistoryManager.push(HistoryManager.createSnapshotAction('snapshots', beforeSnapshots, afterSnapshots, '删除表关联快照'));
                    }
                    HistoryManager.endBatch();
                    renderTableList();
                    renderGrid();
                    window.dispatchEvent(new CustomEvent('tableschanged'));
                }
            });
        });
    }

    // ===== 数据网格渲染 =====

    function renderGrid() {
        const table = getTable(activeTableId);
        const nameInput = document.getElementById('table-name-input');
        const grid = document.getElementById('data-grid');

        if (cellEditor) {
            commitEdit();
        }
        selAnchor = null;
        selFocus = null;

        if (!table) {
            if (nameInput) nameInput.value = '';
            if (grid) grid.innerHTML = '<thead><tr><th></th></tr></thead><tbody></tbody>';
            return;
        }

        if (nameInput) nameInput.value = table.name;

        let html = '<thead><tr><th></th>';
        table.headers.forEach((h, i) => {
            html += `<th data-col="${i}">${escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';

        table.rows.forEach((row, rIdx) => {
            html += `<tr><td class="row-num">${rIdx + 1}</td>`;
            row.forEach((cell, cIdx) => {
                const val = cell === null ? '' : escapeHtml(String(cell));
                html += `<td data-row="${rIdx}" data-col="${cIdx}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        grid.innerHTML = html;

        setupGridEvents(grid, table);
    }

    // ===== 网格事件系统 =====

    function setupGridEvents(grid, table) {
        grid.querySelectorAll('th[data-col]').forEach(th => {
            th.addEventListener('dblclick', () => {
                const col = parseInt(th.dataset.col);
                startHeaderEdit(th, table, col);
            });
            th.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const col = parseInt(th.dataset.col);
                selAnchor = { row: -1, col: col };
                selFocus = { row: table.rows.length - 1, col: col };
                updateSelectionUI(grid);
            });
        });

        grid.querySelectorAll('.row-num').forEach(rn => {
            rn.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const tr = rn.closest('tr');
                const row = parseInt(tr.querySelector('td[data-row]')?.dataset.row);
                if (isNaN(row)) return;
                selAnchor = { row: row, col: 0 };
                selFocus = { row: row, col: table.headers.length - 1 };
                updateSelectionUI(grid);
            });
        });

        grid.querySelectorAll('td[data-row][data-col]').forEach(td => {
            td.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (cellEditor && cellEditor.td !== td) {
                    commitEdit();
                }

                const row = parseInt(td.dataset.row);
                const col = parseInt(td.dataset.col);

                if (e.shiftKey && selAnchor) {
                    selFocus = { row, col };
                    updateSelectionUI(grid);
                    return;
                }

                if (cellEditor && cellEditor.td === td) {
                    return;
                }

                e.preventDefault();
                selAnchor = { row, col };
                selFocus = { row, col };

                grid.classList.add('grid-selecting');

                const onMove = (me) => {
                    const target = document.elementFromPoint(me.clientX, me.clientY);
                    const cell = target?.closest?.('td[data-row][data-col]');
                    if (cell && grid.contains(cell)) {
                        const nr = parseInt(cell.dataset.row);
                        const nc = parseInt(cell.dataset.col);
                        if (nr !== selFocus?.row || nc !== selFocus?.col) {
                            selFocus = { row: nr, col: nc };
                            updateSelectionUI(grid);
                        }
                    }
                };

                const onUp = () => {
                    grid.classList.remove('grid-selecting');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);

                updateSelectionUI(grid);
            });

            td.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const row = parseInt(td.dataset.row);
                const col = parseInt(td.dataset.col);
                selAnchor = { row, col };
                selFocus = { row, col };
                updateSelectionUI(grid);
                startCellEdit(td, table, row, col);
            });
        });

        grid.addEventListener('contextmenu', (e) => {
            const td = e.target.closest('td[data-row][data-col]');
            if (td) {
                const row = parseInt(td.dataset.row);
                const col = parseInt(td.dataset.col);
                if (!isCellInSelection(row, col)) {
                    selAnchor = { row, col };
                    selFocus = { row, col };
                    updateSelectionUI(grid);
                }
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY);
            }
        });
    }

    // ===== 选区系统 =====

    function getSelectionRange() {
        if (!selAnchor || !selFocus) return null;
        return {
            minRow: Math.min(selAnchor.row, selFocus.row),
            maxRow: Math.max(selAnchor.row, selFocus.row),
            minCol: Math.min(selAnchor.col, selFocus.col),
            maxCol: Math.max(selAnchor.col, selFocus.col),
        };
    }

    function isCellInSelection(row, col) {
        const range = getSelectionRange();
        if (!range) return false;
        return row >= range.minRow && row <= range.maxRow &&
               col >= range.minCol && col <= range.maxCol;
    }

    function updateSelectionUI(grid) {
        grid = grid || document.getElementById('data-grid');
        if (!grid) return;

        grid.querySelectorAll('td.cell-selected, td.cell-in-range, th.col-selected').forEach(el => {
            el.classList.remove('cell-selected', 'cell-in-range', 'col-selected');
        });

        if (!selAnchor || !selFocus) return;

        const range = getSelectionRange();
        if (!range) return;

        if (selAnchor.row === -1) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
                const th = grid.querySelector(`th[data-col="${c}"]`);
                if (th) th.classList.add('col-selected');
            }
            grid.querySelectorAll(`td[data-col]`).forEach(td => {
                const col = parseInt(td.dataset.col);
                if (col >= range.minCol && col <= range.maxCol) {
                    td.classList.add('cell-in-range');
                }
            });
            return;
        }

        grid.querySelectorAll('td[data-row][data-col]').forEach(td => {
            const row = parseInt(td.dataset.row);
            const col = parseInt(td.dataset.col);
            if (row >= range.minRow && row <= range.maxRow &&
                col >= range.minCol && col <= range.maxCol) {
                if (row === selAnchor.row && col === selAnchor.col) {
                    td.classList.add('cell-selected');
                } else {
                    td.classList.add('cell-in-range');
                }
            }
        });
    }

    function clearSelection() {
        selAnchor = null;
        selFocus = null;
        const grid = document.getElementById('data-grid');
        if (grid) {
            grid.querySelectorAll('td.cell-selected, td.cell-in-range, th.col-selected').forEach(el => {
                el.classList.remove('cell-selected', 'cell-in-range', 'col-selected');
            });
        }
    }

    // ===== 单元格编辑器 =====

    function startCellEdit(td, table, row, col) {
        if (cellEditor) commitEdit();

        const rect = td.getBoundingClientRect();
        const input = document.createElement('input');
        input.className = 'cell-editor-input';
        input.type = 'text';
        input.value = table.rows[row][col] === null ? '' : String(table.rows[row][col]);

        input.style.position = 'fixed';
        input.style.left = rect.left + 'px';
        input.style.top = rect.top + 'px';
        input.style.width = Math.max(rect.width, 80) + 'px';
        input.style.height = rect.height + 'px';
        input.style.zIndex = '10000';

        document.body.appendChild(input);
        input.focus();
        input.select();

        td.classList.add('cell-editing');

        cellEditor = { input, td, row, col, table };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
                const grid = document.getElementById('data-grid');
                const nextRow = row + 1;
                const next = grid?.querySelector(`td[data-row="${nextRow}"][data-col="${col}"]`);
                if (next) {
                    selAnchor = { row: nextRow, col };
                    selFocus = { row: nextRow, col };
                    updateSelectionUI(grid);
                    startCellEdit(next, table, nextRow, col);
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                commitEdit();
                const grid = document.getElementById('data-grid');
                const nextCol = col + (e.shiftKey ? -1 : 1);
                const next = grid?.querySelector(`td[data-row="${row}"][data-col="${nextCol}"]`);
                if (next) {
                    selAnchor = { row, col: nextCol };
                    selFocus = { row, col: nextCol };
                    updateSelectionUI(grid);
                    startCellEdit(next, table, row, nextCol);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });

        input.addEventListener('blur', () => {
            commitEdit();
        });
    }

    let isCommitting = false;

    function commitEdit() {
        if (!cellEditor || isCommitting) return;
        isCommitting = true;

        const editor = cellEditor;
        cellEditor = null;

        const { input, td, row, col, table } = editor;
        const newVal = input.value.trim();
        const num = Number(newVal);
        const parsed = newVal === '' ? null : (isNaN(num) ? newVal : num);
        const oldVal = table.rows[row][col];

        td.classList.remove('cell-editing');
        input.remove();

        if (oldVal !== parsed) {
            const before = HistoryManager.captureTablesState();
            table.rows[row][col] = parsed;
            const after = HistoryManager.captureTablesState();
            HistoryManager.push(HistoryManager.createTableAction(before, after,
                '编辑 [' + (row + 1) + ',' + (col + 1) + ']'));
            window.dispatchEvent(new CustomEvent('tableschanged'));
        }

        const val = parsed === null ? '' : escapeHtml(String(parsed));
        td.innerHTML = val;

        isCommitting = false;
    }

    function cancelEdit() {
        if (!cellEditor) return;
        const editor = cellEditor;
        cellEditor = null;

        const { td, row, col, table } = editor;
        td.classList.remove('cell-editing');
        editor.input.remove();
        const val = table.rows[row][col];
        td.innerHTML = val === null ? '' : escapeHtml(String(val));
    }

    // ===== 表头编辑 =====

    function startHeaderEdit(th, table, col) {
        const oldVal = table.headers[col];
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldVal;
        input.className = 'cell-editor-input header-editor-input';
        input.style.width = '100%';
        input.style.border = 'none';
        input.style.outline = 'none';
        input.style.background = 'transparent';
        input.style.font = 'inherit';
        input.style.padding = '0';

        th.innerHTML = '';
        th.appendChild(input);
        input.focus();
        input.select();

        const finish = () => {
            const newVal = input.value.trim();
            const tid = table.id;
            if (oldVal !== newVal) {
                table.headers[col] = newVal;
                HistoryManager.push(HistoryManager.createAction(
                    '编辑表头: ' + oldVal + ' → ' + newVal,
                    function() { const t = getTable(tid); if (t) t.headers[col] = oldVal; HistoryManager.refreshAllViews(); },
                    function() { const t = getTable(tid); if (t) t.headers[col] = newVal; HistoryManager.refreshAllViews(); }
                ));
                window.dispatchEvent(new CustomEvent('tableschanged'));
            }
            renderGrid();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = oldVal; input.blur(); }
        });
    }

    // ===== 剪贴板操作 =====

    function copySelection() {
        const table = getTable(activeTableId);
        if (!table) return;

        const range = getSelectionRange();
        if (!range || range.minRow < 0) {
            Toast.warning('请先选择单元格');
            return;
        }

        const lines = [];
        for (let r = range.minRow; r <= range.maxRow; r++) {
            const rowParts = [];
            for (let c = range.minCol; c <= range.maxCol; c++) {
                const val = table.rows[r]?.[c];
                rowParts.push(val === null || val === undefined ? '' : String(val));
            }
            lines.push(rowParts.join('\t'));
        }

        const text = lines.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            Toast.success('已复制 ' + (range.maxRow - range.minRow + 1) + '×' + (range.maxCol - range.minCol + 1) + ' 区域');
        }).catch(() => {
            fallbackCopy(text);
        });
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            Toast.success('已复制到剪贴板');
        } catch (e) {
            Toast.error('复制失败');
        }
        document.body.removeChild(ta);
    }

    async function pasteFromClipboard() {
        let text;
        try {
            text = await navigator.clipboard.readText();
        } catch (e) {
            Toast.warning('无法读取剪贴板，请使用 Ctrl+V 或浏览器授权');
            return;
        }
        pasteText(text);
    }

    function pasteText(text) {
        const table = getTable(activeTableId);
        if (!table) return;

        if (!selAnchor) {
            Toast.warning('请先选择粘贴起始位置');
            return;
        }

        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        if (lines.length === 0) return;

        const data = lines.map(line => parseTSVLine(line));

        const startRow = selAnchor.row < 0 ? 0 : selAnchor.row;
        const startCol = selAnchor.col < 0 ? 0 : selAnchor.col;
        const neededRows = startRow + data.length;
        const maxCols = Math.max(...data.map(r => r.length));
        const neededCols = startCol + maxCols;

        const before = HistoryManager.captureTablesState();

        while (table.rows.length < neededRows) {
            table.rows.push(new Array(table.headers.length).fill(null));
        }
        while (table.headers.length < neededCols) {
            const idx = table.headers.length;
            table.headers.push(String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String(Math.floor(idx / 26)) : ''));
            table.rows.forEach(row => row.push(null));
        }

        for (let r = 0; r < data.length; r++) {
            for (let c = 0; c < data[r].length; c++) {
                const tr = startRow + r;
                const tc = startCol + c;
                if (tr < table.rows.length && tc < table.headers.length) {
                    const raw = data[r][c];
                    const num = Number(raw);
                    table.rows[tr][tc] = raw === '' ? null : (isNaN(num) ? raw : num);
                }
            }
        }

        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after,
            '粘贴 ' + data.length + '×' + maxCols + ' 数据'));

        selFocus = {
            row: Math.min(startRow + data.length - 1, table.rows.length - 1),
            col: Math.min(startCol + maxCols - 1, table.headers.length - 1),
        };

        renderGrid();
        renderTableList();
        updateSelectionUI();
        window.dispatchEvent(new CustomEvent('tableschanged'));
        Toast.success('已粘贴 ' + data.length + ' 行 ' + maxCols + ' 列');
    }

    function parseTSVLine(line) {
        return line.split('\t').map(s => s.trim());
    }

    function cutSelection() {
        const table = getTable(activeTableId);
        if (!table) return;

        const range = getSelectionRange();
        if (!range || range.minRow < 0) {
            Toast.warning('请先选择单元格');
            return;
        }

        const lines = [];
        for (let r = range.minRow; r <= range.maxRow; r++) {
            const rowParts = [];
            for (let c = range.minCol; c <= range.maxCol; c++) {
                const val = table.rows[r]?.[c];
                rowParts.push(val === null || val === undefined ? '' : String(val));
            }
            lines.push(rowParts.join('\t'));
        }
        const text = lines.join('\n');

        navigator.clipboard.writeText(text).catch(() => {
            fallbackCopy(text);
        });

        const before = HistoryManager.captureTablesState();
        for (let r = range.minRow; r <= range.maxRow; r++) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
                if (r < table.rows.length && c < table.headers.length) {
                    table.rows[r][c] = null;
                }
            }
        }
        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after,
            '剪切 ' + (range.maxRow - range.minRow + 1) + '×' + (range.maxCol - range.minCol + 1) + ' 区域'));

        renderGrid();
        renderTableList();
        selAnchor = { row: range.minRow, col: range.minCol };
        selFocus = { row: range.maxRow, col: range.maxCol };
        updateSelectionUI();
        window.dispatchEvent(new CustomEvent('tableschanged'));
        Toast.success('已剪切');
    }

    function clearSelectedCells() {
        const table = getTable(activeTableId);
        if (!table) return;

        const range = getSelectionRange();
        if (!range || range.minRow < 0) return;

        const before = HistoryManager.captureTablesState();
        let count = 0;
        for (let r = range.minRow; r <= range.maxRow; r++) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
                if (r < table.rows.length && c < table.headers.length && table.rows[r][c] !== null) {
                    table.rows[r][c] = null;
                    count++;
                }
            }
        }

        if (count === 0) return;

        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after, '清除 ' + count + ' 个单元格'));

        renderGrid();
        selAnchor = { row: range.minRow, col: range.minCol };
        selFocus = { row: range.maxRow, col: range.maxCol };
        updateSelectionUI();
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

    // ===== 键盘导航 =====

    function handleGridKeyboard(e) {
        if (!selAnchor || selAnchor.row < 0) return;

        const table = getTable(activeTableId);
        if (!table) return;

        const grid = document.getElementById('data-grid');

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            copySelection();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            pasteFromClipboard();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            e.preventDefault();
            cutSelection();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            selAnchor = { row: 0, col: 0 };
            selFocus = { row: table.rows.length - 1, col: table.headers.length - 1 };
            updateSelectionUI(grid);
            return;
        }

        if (cellEditor) return;

        const row = selAnchor.row;
        const col = selAnchor.col;
        let nr = row, nc = col;

        switch (e.key) {
            case 'ArrowUp': nr = Math.max(0, row - 1); break;
            case 'ArrowDown': nr = Math.min(table.rows.length - 1, row + 1); break;
            case 'ArrowLeft': nc = Math.max(0, col - 1); break;
            case 'ArrowRight': nc = Math.min(table.headers.length - 1, col + 1); break;
            case 'Tab':
                nc = col + (e.shiftKey ? -1 : 1);
                if (nc < 0) { nc = table.headers.length - 1; nr = Math.max(0, row - 1); }
                if (nc >= table.headers.length) { nc = 0; nr = Math.min(table.rows.length - 1, row + 1); }
                break;
            case 'Enter':
                e.preventDefault();
                if (e.shiftKey) {
                    nr = Math.max(0, row - 1);
                } else {
                    nr = Math.min(table.rows.length - 1, row + 1);
                }
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                clearSelectedCells();
                return;
            case 'F2':
                e.preventDefault();
                const td = grid?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
                if (td) startCellEdit(td, table, row, col);
                return;
            case 'Escape':
                clearSelection();
                return;
            default:
                if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                    e.preventDefault();
                    const editTd = grid?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
                    if (editTd) {
                        startCellEdit(editTd, table, row, col);
                        if (cellEditor) {
                            cellEditor.input.value = e.key;
                        }
                    }
                }
                return;
        }

        if (nr !== row || nc !== col) {
            e.preventDefault();
            if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                selFocus = { row: nr, col: nc };
            } else {
                selAnchor = { row: nr, col: nc };
                selFocus = { row: nr, col: nc };
            }
            updateSelectionUI(grid);

            const target = grid?.querySelector(`td[data-row="${nr}"][data-col="${nc}"]`);
            if (target) {
                target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }
    }

    // ===== 右键菜单 =====

    function showContextMenu(x, y) {
        let menu = document.getElementById('grid-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'grid-context-menu';
            menu.className = 'grid-context-menu';
            document.body.appendChild(menu);
        }

        const items = [
            { label: '复制', shortcut: 'Ctrl+C', action: copySelection, icon: '📋' },
            { label: '剪切', shortcut: 'Ctrl+X', action: cutSelection, icon: '✂️' },
            { label: '粘贴', shortcut: 'Ctrl+V', action: pasteFromClipboard, icon: '📌' },
            { type: 'separator' },
            { label: '清除内容', shortcut: 'Del', action: clearSelectedCells, icon: '🗑' },
        ];

        menu.innerHTML = items.map(item => {
            if (item.type === 'separator') {
                return '<div class="ctx-separator"></div>';
            }
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

        menu.querySelectorAll('.ctx-item').forEach((el, idx) => {
            const realItems = items.filter(i => i.type !== 'separator');
            let itemIdx = 0;
            for (const item of items) {
                if (item.type === 'separator') continue;
                if (el.dataset.action === item.label) {
                    el.addEventListener('click', () => {
                        hideContextMenu();
                        item.action();
                    });
                    break;
                }
                itemIdx++;
            }
        });
    }

    function hideContextMenu() {
        const menu = document.getElementById('grid-context-menu');
        if (menu) menu.style.display = 'none';
    }

    // ===== 查找替换 =====

    let findReplaceDialog = null;
    let findState = {
        matches: [],
        currentIndex: -1,
        lastSearch: '',
    };

    function showFindReplaceDialog() {
        if (findReplaceDialog) {
            findReplaceDialog.style.display = 'flex';
            findReplaceDialog.querySelector('.fr-input-find')?.focus();
            return;
        }

        findReplaceDialog = document.createElement('div');
        findReplaceDialog.className = 'find-replace-dialog';
        findReplaceDialog.id = 'find-replace-dialog';
        findReplaceDialog.innerHTML = `
            <div class="fr-header">
                <span class="fr-title">查找与替换</span>
                <button class="fr-close" title="关闭">&times;</button>
            </div>
            <div class="fr-body">
                <div class="fr-row">
                    <label class="fr-label">查找</label>
                    <input type="text" class="form-input fr-input-find" placeholder="查找内容..." autofocus>
                    <div class="fr-nav">
                        <button class="btn btn-sm btn-icon fr-btn-prev" title="上一个 (Shift+Enter)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button class="btn btn-sm btn-icon fr-btn-next" title="下一个 (Enter)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                    </div>
                </div>
                <div class="fr-row">
                    <label class="fr-label">替换</label>
                    <input type="text" class="form-input fr-input-replace" placeholder="替换为...">
                    <div class="fr-nav">
                        <button class="btn btn-sm fr-btn-replace" title="替换当前">替换</button>
                        <button class="btn btn-sm fr-btn-replace-all" title="全部替换">全部</button>
                    </div>
                </div>
                <div class="fr-options">
                    <label class="checkbox-label">
                        <input type="checkbox" id="fr-case-sensitive">
                        <span>区分大小写</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="fr-whole-cell">
                        <span>匹配整个单元格</span>
                    </label>
                </div>
                <div class="fr-status">
                    <span class="fr-status-text">输入查找内容开始搜索</span>
                </div>
            </div>
        `;

        document.body.appendChild(findReplaceDialog);

        const findInput = findReplaceDialog.querySelector('.fr-input-find');
        const replaceInput = findReplaceDialog.querySelector('.fr-input-replace');
        const closeBtn = findReplaceDialog.querySelector('.fr-close');
        const prevBtn = findReplaceDialog.querySelector('.fr-btn-prev');
        const nextBtn = findReplaceDialog.querySelector('.fr-btn-next');
        const replaceBtn = findReplaceDialog.querySelector('.fr-btn-replace');
        const replaceAllBtn = findReplaceDialog.querySelector('.fr-btn-replace-all');
        const caseSensitiveCheck = findReplaceDialog.querySelector('#fr-case-sensitive');
        const wholeCellCheck = findReplaceDialog.querySelector('#fr-whole-cell');

        closeBtn.addEventListener('click', hideFindReplaceDialog);

        findInput.addEventListener('input', () => {
            performFind();
        });

        findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    findPrev();
                } else {
                    findNext();
                }
            } else if (e.key === 'Escape') {
                hideFindReplaceDialog();
            }
        });

        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                replaceOne();
            } else if (e.key === 'Escape') {
                hideFindReplaceDialog();
            }
        });

        prevBtn.addEventListener('click', findPrev);
        nextBtn.addEventListener('click', findNext);
        replaceBtn.addEventListener('click', replaceOne);
        replaceAllBtn.addEventListener('click', replaceAll);

        caseSensitiveCheck.addEventListener('change', performFind);
        wholeCellCheck.addEventListener('change', performFind);

        findReplaceDialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideFindReplaceDialog();
            }
        });

        setTimeout(() => findInput.focus(), 50);
    }

    function hideFindReplaceDialog() {
        if (findReplaceDialog) {
            findReplaceDialog.style.display = 'none';
        }
        findState = { matches: [], currentIndex: -1, lastSearch: '' };
        clearFindHighlights();
    }

    function performFind() {
        const table = getTable(activeTableId);
        if (!table) {
            updateFindStatus('请先选择数据表');
            return;
        }

        const findInput = findReplaceDialog?.querySelector('.fr-input-find');
        const keyword = findInput?.value || '';
        if (!keyword) {
            findState = { matches: [], currentIndex: -1, lastSearch: '' };
            clearFindHighlights();
            updateFindStatus('输入查找内容开始搜索');
            return;
        }

        const caseSensitive = findReplaceDialog?.querySelector('#fr-case-sensitive')?.checked || false;
        const wholeCell = findReplaceDialog?.querySelector('#fr-whole-cell')?.checked || false;

        findState.matches = [];
        findState.lastSearch = keyword;

        const searchLower = caseSensitive ? keyword : keyword.toLowerCase();

        for (let r = 0; r < table.rows.length; r++) {
            for (let c = 0; c < table.headers.length; c++) {
                const cellVal = table.rows[r][c];
                if (cellVal === null) continue;
                const cellStr = String(cellVal);
                const cellLower = caseSensitive ? cellStr : cellStr.toLowerCase();

                let matched = false;
                if (wholeCell) {
                    matched = cellStr === keyword || (!caseSensitive && cellLower === searchLower);
                } else {
                    matched = cellLower.includes(searchLower);
                }

                if (matched) {
                    findState.matches.push({ row: r, col: c });
                }
            }
        }

        findState.currentIndex = -1;
        clearFindHighlights();

        if (findState.matches.length > 0) {
            updateFindStatus(`找到 ${findState.matches.length} 个匹配项`);
            findNext();
        } else {
            updateFindStatus('未找到匹配项');
        }
    }

    function findNext() {
        if (findState.matches.length === 0) {
            performFind();
            return;
        }

        findState.currentIndex = (findState.currentIndex + 1) % findState.matches.length;
        navigateToMatch();
    }

    function findPrev() {
        if (findState.matches.length === 0) {
            performFind();
            return;
        }

        findState.currentIndex = (findState.currentIndex - 1 + findState.matches.length) % findState.matches.length;
        navigateToMatch();
    }

    function navigateToMatch() {
        if (findState.currentIndex < 0 || findState.currentIndex >= findState.matches.length) return;

        const match = findState.matches[findState.currentIndex];
        selAnchor = { row: match.row, col: match.col };
        selFocus = { row: match.row, col: match.col };

        const grid = document.getElementById('data-grid');
        updateSelectionUI(grid);

        const td = grid?.querySelector(`td[data-row="${match.row}"][data-col="${match.col}"]`);
        if (td) {
            td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }

        highlightAllMatches();

        updateFindStatus(`${findState.currentIndex + 1} / ${findState.matches.length}`);
    }

    function highlightAllMatches() {
        clearFindHighlights();
        const grid = document.getElementById('data-grid');
        if (!grid) return;

        findState.matches.forEach((match, idx) => {
            const td = grid.querySelector(`td[data-row="${match.row}"][data-col="${match.col}"]`);
            if (td) {
                td.classList.add(idx === findState.currentIndex ? 'fr-match-active' : 'fr-match');
            }
        });
    }

    function clearFindHighlights() {
        const grid = document.getElementById('data-grid');
        if (!grid) return;
        grid.querySelectorAll('.fr-match, .fr-match-active').forEach(td => {
            td.classList.remove('fr-match', 'fr-match-active');
        });
    }

    function replaceOne() {
        const table = getTable(activeTableId);
        if (!table || findState.currentIndex < 0 || findState.currentIndex >= findState.matches.length) {
            Toast.warning('没有可替换的匹配项');
            return;
        }

        const match = findState.matches[findState.currentIndex];
        const replaceInput = findReplaceDialog?.querySelector('.fr-input-replace');
        const replaceVal = replaceInput?.value || '';
        const num = Number(replaceVal);
        const parsed = replaceVal === '' ? null : (isNaN(num) ? replaceVal : num);

        const before = HistoryManager.captureTablesState();
        table.rows[match.row][match.col] = parsed;
        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after,
            '替换 [' + (match.row + 1) + ',' + (match.col + 1) + ']'));

        findState.matches.splice(findState.currentIndex, 1);
        if (findState.matches.length === 0) {
            findState.currentIndex = -1;
        } else if (findState.currentIndex >= findState.matches.length) {
            findState.currentIndex = 0;
        }

        renderGrid();
        if (findState.currentIndex >= 0) {
            navigateToMatch();
        } else {
            clearFindHighlights();
        }
        updateFindStatus(findState.matches.length > 0 ? `剩余 ${findState.matches.length} 个匹配项` : '替换完成');
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

    function replaceAll() {
        const table = getTable(activeTableId);
        if (!table || findState.matches.length === 0) {
            Toast.warning('没有可替换的匹配项');
            return;
        }

        const replaceInput = findReplaceDialog?.querySelector('.fr-input-replace');
        const replaceVal = replaceInput?.value || '';
        const num = Number(replaceVal);
        const parsed = replaceVal === '' ? null : (isNaN(num) ? replaceVal : num);

        const before = HistoryManager.captureTablesState();
        const count = findState.matches.length;

        findState.matches.forEach(match => {
            table.rows[match.row][match.col] = parsed;
        });

        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after, `全部替换 (${count} 处)`));

        findState.matches = [];
        findState.currentIndex = -1;

        renderGrid();
        clearFindHighlights();
        updateFindStatus(`已替换 ${count} 处`);
        Toast.success(`已替换 ${count} 个单元格`);
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

    function updateFindStatus(text) {
        const statusEl = findReplaceDialog?.querySelector('.fr-status-text');
        if (statusEl) statusEl.textContent = text;
    }

    // ===== 行列操作 =====

    function modifyGrid(action) {
        const table = getTable(activeTableId);
        if (!table) return;

        const before = HistoryManager.captureTablesState();
        const descriptions = { addRow: '添加行', addCol: '添加列', delRow: '删除行', delCol: '删除列' };

        switch (action) {
            case 'addRow':
                table.rows.push(new Array(table.headers.length).fill(null));
                break;
            case 'addCol':
                const newColName = String.fromCharCode(65 + table.headers.length);
                table.headers.push(newColName);
                table.rows.forEach(row => row.push(null));
                break;
            case 'delRow':
                if (table.rows.length > 1) table.rows.pop();
                else return;
                break;
            case 'delCol':
                if (table.headers.length > 1) {
                    table.headers.pop();
                    table.rows.forEach(row => row.pop());
                } else return;
                break;
        }

        const after = HistoryManager.captureTablesState();
        HistoryManager.push(HistoryManager.createTableAction(before, after, descriptions[action] + ': ' + table.name));

        renderGrid();
        renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

    // ===== 工具函数 =====

    function tableToCSV(table) {
        const lines = [table.headers.join(',')];
        table.rows.forEach(row => {
            lines.push(row.map(c => {
                if (c === null) return '';
                const s = String(c);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(','));
        });
        return lines.join('\n');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.getElementById('download-link');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ===== 全局键盘事件 =====

    document.addEventListener('keydown', (e) => {
        if (AppState.currentPage !== 'datamanage') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            showFindReplaceDialog();
            return;
        }

        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            (activeEl.isContentEditable && !activeEl.closest('#data-grid'))
        );

        if (isInputFocused) return;
        if (cellEditor) return;

        handleGridKeyboard(e);
    });

    window.DataManager = { init, renderTableList, renderGrid, getActiveTableId: () => activeTableId };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
