/**
 * 数据管理页面
 * 管理数据表的导入、新建、编辑、删除、导出
 */

(function() {
    let activeTableId = null;

    function init() {
        bindEvents();
        renderTableList();
    }

    function bindEvents() {
        // 导入 CSV
        document.getElementById('btn-import-csv')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.txt';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const data = await CSVParser.parseFile(file);
                    const table = createTable(file.name.replace(/\.[^.]+$/, ''), data.headers, data.rows, 'csv');
                    activeTableId = table.id;
                    AppState.activeTableId = table.id;
                    renderTableList();
                    renderGrid();
                    // 同步更新其他页面的下拉框
                    window.dispatchEvent(new CustomEvent('tableschanged'));
                } catch (err) {
                    alert('CSV 解析失败: ' + err.message);
                }
            };
            input.click();
        });

        // 新建空表
        document.getElementById('btn-new-table')?.addEventListener('click', () => {
            const table = createTable('新建数据表', ['A', 'B', 'C'], [[null, null, null], [null, null, null]], 'manual');
            activeTableId = table.id;
            AppState.activeTableId = table.id;
            renderTableList();
            renderGrid();
            window.dispatchEvent(new CustomEvent('tableschanged'));
        });

        // 导出当前表为 CSV
        document.getElementById('btn-export-table-csv')?.addEventListener('click', () => {
            const table = getTable(activeTableId);
            if (!table) { alert('请先选择一个数据表'); return; }
            const csv = tableToCSV(table);
            downloadFile(csv, `${table.name}.csv`, 'text/csv');
        });

        // 导出全部表为 JSON
        document.getElementById('btn-export-all-json')?.addEventListener('click', () => {
            const data = exportAllTables();
            const json = JSON.stringify(data, null, 2);
            downloadFile(json, `SCI-Ploter-Tables-${new Date().toISOString().slice(0,10)}.json`);
        });

        // 表名输入框
        document.getElementById('table-name-input')?.addEventListener('change', (e) => {
            if (activeTableId) {
                renameTable(activeTableId, e.target.value);
                renderTableList();
            }
        });

        // 行列操作
        document.getElementById('btn-add-row')?.addEventListener('click', () => modifyGrid('addRow'));
        document.getElementById('btn-add-col')?.addEventListener('click', () => modifyGrid('addCol'));
        document.getElementById('btn-del-row')?.addEventListener('click', () => modifyGrid('delRow'));
        document.getElementById('btn-del-col')?.addEventListener('click', () => modifyGrid('delCol'));
    }

    function renderTableList() {
        const container = document.getElementById('data-table-list');
        if (!container) return;

        if (AppState.tables.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无数据表<br>点击"导入 CSV"或"新建空表"</p>';
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
                    deleteTable(btn.dataset.id);
                    if (activeTableId === btn.dataset.id) {
                        activeTableId = AppState.tables.length > 0 ? AppState.tables[0].id : null;
                        AppState.activeTableId = activeTableId;
                    }
                    renderTableList();
                    renderGrid();
                    window.dispatchEvent(new CustomEvent('tableschanged'));
                }
            });
        });
    }

    function renderGrid() {
        const table = getTable(activeTableId);
        const nameInput = document.getElementById('table-name-input');
        const grid = document.getElementById('data-grid');

        if (!table) {
            if (nameInput) nameInput.value = '';
            if (grid) grid.innerHTML = '<thead><tr><th></th></tr></thead><tbody></tbody>';
            return;
        }

        if (nameInput) nameInput.value = table.name;

        // 渲染表头
        let html = '<thead><tr><th></th>';
        table.headers.forEach((h, i) => {
            html += `<th contenteditable="true" data-col="${i}">${escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 渲染数据行
        table.rows.forEach((row, rIdx) => {
            html += `<tr><td>${rIdx + 1}</td>`;
            row.forEach((cell, cIdx) => {
                const val = cell === null ? '' : escapeHtml(String(cell));
                html += `<td contenteditable="true" data-row="${rIdx}" data-col="${cIdx}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        grid.innerHTML = html;

        // 绑定编辑事件
        grid.querySelectorAll('th[contenteditable], td[contenteditable]').forEach(cell => {
            cell.addEventListener('blur', () => {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                const newVal = cell.textContent.trim();

                if (cell.tagName === 'TH') {
                    // 表头编辑
                    const cIdx = parseInt(cell.dataset.col);
                    table.headers[cIdx] = newVal;
                } else {
                    // 数据编辑
                    const num = Number(newVal);
                    table.rows[row][col] = newVal === '' ? null : (isNaN(num) ? newVal : num);
                }
            });

            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    cell.blur();
                    // 移动到下一行同列
                    const nextRow = parseInt(cell.dataset.row) + 1;
                    const next = grid.querySelector(`td[data-row="${nextRow}"][data-col="${cell.dataset.col}"]`);
                    if (next) next.focus();
                } else if (e.key === 'Tab') {
                    // 默认 Tab 行为即可，但需要在失去焦点时保存
                    setTimeout(() => {
                        const active = document.activeElement;
                        if (active && active.classList.contains('editing')) {
                            active.classList.remove('editing');
                        }
                    }, 0);
                }
            });

            cell.addEventListener('focus', () => cell.classList.add('editing'));
        });
    }

    function modifyGrid(action) {
        const table = getTable(activeTableId);
        if (!table) return;

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
                break;
            case 'delCol':
                if (table.headers.length > 1) {
                    table.headers.pop();
                    table.rows.forEach(row => row.pop());
                }
                break;
        }
        renderGrid();
        renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
    }

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

    window.DataManager = { init, renderTableList, renderGrid, getActiveTableId: () => activeTableId };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
