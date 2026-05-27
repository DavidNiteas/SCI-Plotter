/**
 * 分析工作台
 * 列选择、数据预览、排序、过滤、组合新列、生成新表
 */

(function() {
    let previewData = { headers: [], rows: [] };

    function init() {
        bindEvents();
        updateSourceSelect();
    }

    function bindEvents() {
        // 源表选择
        document.getElementById('wb-source-table')?.addEventListener('change', (e) => {
            AppState.workbench.sourceTableId = e.target.value || null;
            AppState.workbench.selectedColumns = [];
            AppState.workbench.filters = [];
            AppState.workbench.sortColumn = null;
            updateColumnList();
            updateSortSelect();
            updateNewColSelects();
            refreshPreview();
        });

        // 排序
        document.getElementById('wb-sort-col')?.addEventListener('change', refreshPreview);
        document.getElementById('wb-sort-dir')?.addEventListener('change', refreshPreview);

        // 添加计算列
        document.getElementById('btn-wb-add-col')?.addEventListener('click', addComputedColumn);

        // 生成新表
        document.getElementById('btn-wb-create-table')?.addEventListener('click', createNewTable);

        // 监听表变化
        window.addEventListener('tableschanged', () => {
            updateSourceSelect();
            updateColumnList();
            updateSortSelect();
            updateNewColSelects();
        });
    }

    function updateSourceSelect() {
        const select = document.getElementById('wb-source-table');
        if (!select) return;
        select.innerHTML = '<option value="">选择数据表...</option>' +
            AppState.tables.map(t => `<option value="${t.id}" ${t.id === AppState.workbench.sourceTableId ? 'selected' : ''}>${t.name}</option>`).join('');
    }

    function updateColumnList() {
        const container = document.getElementById('wb-column-list');
        if (!container) return;
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) {
            container.innerHTML = '<p class="empty-tip">先选择源表</p>';
            return;
        }

        container.innerHTML = table.headers.map((h, i) => `
            <label class="column-checkitem">
                <input type="checkbox" value="${i}" ${AppState.workbench.selectedColumns.includes(i) ? 'checked' : ''}>
                <span>${h}</span>
            </label>
        `).join('');

        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.value);
                if (cb.checked) {
                    if (!AppState.workbench.selectedColumns.includes(idx)) {
                        AppState.workbench.selectedColumns.push(idx);
                    }
                } else {
                    AppState.workbench.selectedColumns = AppState.workbench.selectedColumns.filter(c => c !== idx);
                }
                refreshPreview();
            });
        });
    }

    function updateSortSelect() {
        const select = document.getElementById('wb-sort-col');
        if (!select) return;
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) {
            select.innerHTML = '<option value="">无</option>';
            return;
        }
        select.innerHTML = '<option value="">无</option>' +
            table.headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');
    }

    function updateNewColSelects() {
        const table = getTable(AppState.workbench.sourceTableId);
        const a = document.getElementById('wb-newcol-a');
        const b = document.getElementById('wb-newcol-b');
        if (!a || !b) return;

        const options = table
            ? '<option value="">选择...</option>' + table.headers.map((h, i) => `<option value="${i}">${h}</option>`).join('')
            : '<option value="">选择...</option>';

        a.innerHTML = options;
        b.innerHTML = options;
    }

    function refreshPreview() {
        const sourceTable = getTable(AppState.workbench.sourceTableId);
        const grid = document.getElementById('wb-preview-grid');
        const title = document.getElementById('wb-preview-title');
        const info = document.getElementById('wb-preview-info');

        if (!sourceTable) {
            if (grid) grid.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
            if (title) title.textContent = '预览';
            if (info) info.textContent = '';
            return;
        }

        // 1. 选择列
        let headers = [];
        let colIdxs = [];
        if (AppState.workbench.selectedColumns.length > 0) {
            headers = AppState.workbench.selectedColumns.map(i => sourceTable.headers[i]);
            colIdxs = [...AppState.workbench.selectedColumns];
        } else {
            headers = [...sourceTable.headers];
            colIdxs = sourceTable.headers.map((_, i) => i);
        }

        let rows = sourceTable.rows.map(row => colIdxs.map(i => row[i]));

        // 2. 排序
        const sortCol = document.getElementById('wb-sort-col')?.value;
        const sortDir = document.getElementById('wb-sort-dir')?.value;
        if (sortCol !== '' && sortCol !== null) {
            const sortIdx = colIdxs.indexOf(parseInt(sortCol));
            if (sortIdx !== -1) {
                rows = [...rows].sort((a, b) => {
                    const av = a[sortIdx], bv = b[sortIdx];
                    if (av === null) return 1;
                    if (bv === null) return -1;
                    if (typeof av === 'number' && typeof bv === 'number') {
                        return sortDir === 'asc' ? av - bv : bv - av;
                    }
                    return sortDir === 'asc'
                        ? String(av).localeCompare(String(bv))
                        : String(bv).localeCompare(String(av));
                });
            }
        }

        previewData = { headers, rows };

        // 渲染
        let html = '<thead><tr>';
        headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
        html += '</tr></thead><tbody>';
        rows.slice(0, 50).forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                const val = cell === null ? '' : escapeHtml(String(cell));
                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });
        if (rows.length > 50) {
            html += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-muted)">... 还有 ${rows.length - 50} 行</td></tr>`;
        }
        html += '</tbody>';
        grid.innerHTML = html;

        title.textContent = sourceTable.name;
        info.textContent = `${rows.length} 行 × ${headers.length} 列`;
    }

    function addComputedColumn() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) { alert('请先选择源数据表'); return; }

        const name = document.getElementById('wb-newcol-name')?.value.trim();
        const aIdx = document.getElementById('wb-newcol-a')?.value;
        const op = document.getElementById('wb-newcol-op')?.value;
        const bIdx = document.getElementById('wb-newcol-b')?.value;

        if (!name || aIdx === '' || bIdx === '') {
            alert('请填写完整的计算列信息');
            return;
        }

        const ai = parseInt(aIdx);
        const bi = parseInt(bIdx);

        // 添加到源表
        table.headers.push(name);
        table.rows.forEach(row => {
            const av = row[ai];
            const bv = row[bi];
            let result = null;
            if (av !== null && bv !== null && typeof av === 'number' && typeof bv === 'number') {
                switch (op) {
                    case '+': result = av + bv; break;
                    case '-': result = av - bv; break;
                    case '*': result = av * bv; break;
                    case '/': result = bv !== 0 ? av / bv : null; break;
                }
            }
            row.push(result);
        });

        // 刷新
        updateColumnList();
        updateSortSelect();
        updateNewColSelects();
        refreshPreview();
        DataManager?.renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));

        document.getElementById('wb-newcol-name').value = '';
    }

    function createNewTable() {
        if (previewData.headers.length === 0) {
            alert('预览为空，无法生成新表');
            return;
        }
        const name = document.getElementById('wb-newtable-name')?.value.trim() || '处理后数据';
        createTable(name, previewData.headers, previewData.rows.map(r => [...r]), 'workbench');
        DataManager?.renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
        alert(`已创建新表: ${name}`);
        document.getElementById('wb-newtable-name').value = '';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    window.Workbench = { init, refreshPreview, updateSourceSelect };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
