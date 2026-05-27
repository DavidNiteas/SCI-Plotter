/**
 * 分析工作台
 * 列选择、数据预览、排序、过滤、组合新列、生成新表、统计分析
 */

(function() {
    let previewData = { headers: [], rows: [] };
    let statChartInstance = null;
    let lastStatMethod = null;
    let lastStatResult = null;

    function init() {
        bindEvents();
        bindStatViewToggle();
        updateSourceSelect();
        updatePreprocessCols();
    }

    function bindEvents() {
        document.getElementById('wb-source-table')?.addEventListener('change', (e) => {
            AppState.workbench.sourceTableId = e.target.value || null;
            AppState.workbench.selectedColumns = [];
            AppState.workbench.filters = [];
            AppState.workbench.sortColumn = null;
            updateColumnList();
            updateFilterList();
            updateSortSelect();
            updateNewColSelects();
            refreshPreview();
            updateStatParams();
            updatePreprocessCols();
        });

        document.getElementById('wb-sort-col')?.addEventListener('change', refreshPreview);
        document.getElementById('wb-sort-dir')?.addEventListener('change', refreshPreview);

        document.getElementById('btn-wb-add-filter')?.addEventListener('click', addFilter);

        document.getElementById('wb-newcol-mode')?.addEventListener('change', updateNewColParams);

        document.getElementById('btn-wb-add-col')?.addEventListener('click', addComputedColumn);

        document.getElementById('btn-wb-create-table')?.addEventListener('click', createNewTable);

        document.getElementById('wb-stat-method')?.addEventListener('change', updateStatParams);

        document.getElementById('btn-wb-run-stat')?.addEventListener('click', runStatAnalysis);

        document.getElementById('btn-wb-apply-missing')?.addEventListener('click', applyMissingHandler);
        document.getElementById('btn-wb-apply-norm')?.addEventListener('click', applyNormalization);

        document.getElementById('wb-missing-method')?.addEventListener('change', (e) => {
            const fixedRow = document.getElementById('wb-missing-fixed-row');
            if (fixedRow) fixedRow.style.display = e.target.value === 'fill_fixed' ? '' : 'none';
        });

        window.addEventListener('tableschanged', () => {
            updateSourceSelect();
            updateColumnList();
            updateFilterList();
            updateSortSelect();
            updateNewColSelects();
            updateStatParams();
            updatePreprocessCols();
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
        updateNewColParams();
    }

    function buildColOptions(table) {
        if (!table) return '<option value="">选择...</option>';
        return '<option value="">选择...</option>' +
            table.headers.map((h, i) => `<option value="${i}">${escapeHtml(h)}</option>`).join('');
    }

    function updateNewColParams() {
        const container = document.getElementById('wb-newcol-params');
        if (!container) return;
        const mode = document.getElementById('wb-newcol-mode')?.value || 'arithmetic';
        const table = getTable(AppState.workbench.sourceTableId);
        const colOpts = buildColOptions(table);

        let html = '';

        switch (mode) {
            case 'arithmetic':
                html += `<div class="form-row"><label>列 A</label><select class="form-select" id="wb-newcol-a">${colOpts}</select></div>`;
                html += `<div class="form-row"><label>运算符</label><select class="form-select" id="wb-newcol-op">
                    <option value="+">+ (加)</option>
                    <option value="-">- (减)</option>
                    <option value="*">× (乘)</option>
                    <option value="/">÷ (除)</option>
                    <option value="^">^ (幂)</option>
                    <option value="%">% (取模)</option>
                    <option value="max">max (最大值)</option>
                    <option value="min">min (最小值)</option>
                </select></div>`;
                html += `<div class="form-row"><label>列 B</label><select class="form-select" id="wb-newcol-b">${colOpts}</select></div>`;
                break;

            case 'function':
                html += `<div class="form-row"><label>函数</label><select class="form-select" id="wb-newcol-func">
                    <optgroup label="基础数学">
                        <option value="abs">|x| 绝对值</option>
                        <option value="sqrt">√x 平方根</option>
                        <option value="cbrt">∛x 立方根</option>
                        <option value="square">x² 平方</option>
                        <option value="cube">x³ 立方</option>
                        <option value="reciprocal">1/x 倒数</option>
                        <option value="negate">-x 取反</option>
                    </optgroup>
                    <optgroup label="对数与指数">
                        <option value="ln">ln 自然对数</option>
                        <option value="log2">log₂ 以2为底</option>
                        <option value="log10">log₁₀ 常用对数</option>
                        <option value="exp">eˣ 指数</option>
                        <option value="exp10">10ˣ 10的幂</option>
                    </optgroup>
                    <optgroup label="三角函数">
                        <option value="sin">sin 正弦</option>
                        <option value="cos">cos 余弦</option>
                        <option value="tan">tan 正切</option>
                        <option value="asin">arcsin 反正弦</option>
                        <option value="acos">arccos 反余弦</option>
                        <option value="atan">arctan 反正切</option>
                        <option value="deg2rad">角度→弧度</option>
                        <option value="rad2deg">弧度→角度</option>
                    </optgroup>
                    <optgroup label="取整">
                        <option value="ceil">⌈x⌉ 向上取整</option>
                        <option value="floor">⌊x⌋ 向下取整</option>
                        <option value="round">四舍五入</option>
                        <option value="trunc">截断小数</option>
                    </optgroup>
                    <optgroup label="其他">
                        <option value="sign">sign 符号 (+1/-1/0)</option>
                        <option value="factorial">n! 阶乘</option>
                    </optgroup>
                </select></div>`;
                html += `<div class="form-row"><label>输入列</label><select class="form-select" id="wb-newcol-col">${colOpts}</select></div>`;
                break;

            case 'transform':
                html += `<div class="form-row"><label>变换方法</label><select class="form-select" id="wb-newcol-transform">
                    <optgroup label="标准化">
                        <option value="zscore">Z-score 标准化</option>
                        <option value="minmax">Min-Max 归一化 [0,1]</option>
                        <option value="minmax_custom">Min-Max 自定义范围</option>
                        <option value="decimal_scale">小数定标标准化</option>
                    </optgroup>
                    <optgroup label="排名与排序">
                        <option value="rank">排名（升序）</option>
                        <option value="rank_desc">排名（降序）</option>
                        <option value="percent_rank">百分比排名</option>
                    </optgroup>
                    <optgroup label="累积运算">
                        <option value="cumsum">累积求和</option>
                        <option value="cumprod">累积乘积</option>
                        <option value="cummax">累积最大值</option>
                        <option value="cummin">累积最小值</option>
                        <option value="diff">逐行差值</option>
                        <option value="pct_change">逐行变化率 (%)</option>
                    </optgroup>
                    <optgroup label="百分比">
                        <option value="pct_sum">占列总和百分比</option>
                        <option value="pct_max">占列最大值百分比</option>
                    </optgroup>
                    <optgroup label="移动窗口">
                        <option value="moving_avg">移动平均</option>
                        <option value="moving_sum">移动求和</option>
                        <option value="moving_max">移动最大值</option>
                        <option value="moving_min">移动最小值</option>
                        <option value="moving_std">移动标准差</option>
                    </optgroup>
                </select></div>`;
                html += `<div class="form-row"><label>输入列</label><select class="form-select" id="wb-newcol-col">${colOpts}</select></div>`;
                html += `<div id="wb-newcol-transform-extra"></div>`;
                break;

            case 'conditional':
                html += `<div class="form-row"><label>条件列</label><select class="form-select" id="wb-newcol-col">${colOpts}</select></div>`;
                html += `<div class="form-row"><label>条件</label><select class="form-select" id="wb-newcol-cond-op">
                    <option value="gt">> 大于</option>
                    <option value="lt">< 小于</option>
                    <option value="gte">≥ 大于等于</option>
                    <option value="lte">≤ 小于等于</option>
                    <option value="eq">= 等于</option>
                    <option value="neq">≠ 不等于</option>
                </select></div>`;
                html += `<div class="form-row"><label>阈值</label><input type="number" class="form-input" id="wb-newcol-cond-val" placeholder="数值"></div>`;
                html += `<div class="form-row"><label>满足时</label><input type="text" class="form-input" id="wb-newcol-cond-true" placeholder="值（留空则取原值）"></div>`;
                html += `<div class="form-row"><label>不满足时</label><input type="text" class="form-input" id="wb-newcol-cond-false" placeholder="值（留空则为空）"></div>`;
                html += `<div class="form-row"><label>输出类型</label><select class="form-select" id="wb-newcol-cond-type">
                    <option value="value">输出原列值 / 自定义值</option>
                    <option value="flag">输出标记 1 / 0</option>
                    <option value="clamp">钳位（满足取阈值，不满足取原值）</option>
                </select></div>`;
                break;
        }

        container.innerHTML = html;

        if (mode === 'transform') {
            bindTransformExtra();
        }
    }

    function bindTransformExtra() {
        const extraDiv = document.getElementById('wb-newcol-transform-extra');
        const transformSelect = document.getElementById('wb-newcol-transform');
        if (!extraDiv || !transformSelect) return;

        const update = () => {
            const val = transformSelect.value;
            let extra = '';
            if (val === 'minmax_custom') {
                extra = `<div class="form-row"><label>最小值</label><input type="number" class="form-input" id="wb-newcol-range-min" value="0" step="any"></div>`;
                extra += `<div class="form-row"><label>最大值</label><input type="number" class="form-input" id="wb-newcol-range-max" value="1" step="any"></div>`;
            } else if (val.startsWith('moving_')) {
                extra = `<div class="form-row"><label>窗口大小</label><input type="number" class="form-input" id="wb-newcol-window" value="3" min="2" max="100"></div>`;
            }
            extraDiv.innerHTML = extra;
        };

        transformSelect.addEventListener('change', update);
        update();
    }

    const FILTER_OPERATORS = {
        number: [
            { value: 'eq', label: '= 等于' },
            { value: 'neq', label: '≠ 不等于' },
            { value: 'gt', label: '> 大于' },
            { value: 'lt', label: '< 小于' },
            { value: 'gte', label: '≥ 大于等于' },
            { value: 'lte', label: '≤ 小于等于' },
            { value: 'empty', label: '为空' },
            { value: 'notempty', label: '不为空' },
        ],
        text: [
            { value: 'eq', label: '= 等于' },
            { value: 'neq', label: '≠ 不等于' },
            { value: 'contains', label: '包含' },
            { value: 'startswith', label: '开头是' },
            { value: 'endswith', label: '结尾是' },
            { value: 'empty', label: '为空' },
            { value: 'notempty', label: '不为空' },
        ]
    };

    function detectColumnType(table, colIdx) {
        if (!table) return 'text';
        for (const row of table.rows) {
            const v = row[colIdx];
            if (v !== null && v !== undefined && v !== '') {
                return typeof v === 'number' ? 'number' : 'text';
            }
        }
        return 'text';
    }

    function addFilter() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) { Toast.warning('请先选择源数据表'); return; }
        AppState.workbench.filters.push({ column: 0, operator: 'eq', value: '' });
        updateFilterList();
        refreshPreview();
    }

    function removeFilter(idx) {
        AppState.workbench.filters.splice(idx, 1);
        updateFilterList();
        refreshPreview();
    }

    function updateFilterList() {
        const container = document.getElementById('wb-filter-list');
        if (!container) return;
        const table = getTable(AppState.workbench.sourceTableId);
        const filters = AppState.workbench.filters;

        if (!table || filters.length === 0) {
            container.innerHTML = '<p class="empty-tip">' + (table ? '无过滤条件' : '先选择源表') + '</p>';
            return;
        }

        let html = '';
        filters.forEach((f, i) => {
            const colType = detectColumnType(table, f.column);
            const ops = FILTER_OPERATORS[colType];
            const needValue = f.operator !== 'empty' && f.operator !== 'notempty';

            html += '<div class="wb-filter-item">';
            html += '<div class="wb-filter-row">';
            html += `<select class="form-select wb-filter-col" data-idx="${i}">`;
            table.headers.forEach((h, ci) => {
                html += `<option value="${ci}" ${ci === f.column ? 'selected' : ''}>${escapeHtml(h)}</option>`;
            });
            html += '</select>';
            html += `<select class="form-select wb-filter-op" data-idx="${i}">`;
            ops.forEach(op => {
                html += `<option value="${op.value}" ${op.value === f.operator ? 'selected' : ''}>${op.label}</option>`;
            });
            html += '</select>';
            html += '</div>';
            if (needValue) {
                html += `<input type="text" class="form-input wb-filter-value" data-idx="${i}" placeholder="值" value="${escapeHtml(f.value)}">`;
            }
            html += `<button class="wb-filter-remove" data-idx="${i}" title="删除">×</button>`;
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.wb-filter-col').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                filters[idx].column = parseInt(e.target.value);
                const colType = detectColumnType(table, filters[idx].column);
                filters[idx].operator = FILTER_OPERATORS[colType][0].value;
                filters[idx].value = '';
                updateFilterList();
                refreshPreview();
            });
        });

        container.querySelectorAll('.wb-filter-op').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                filters[idx].operator = e.target.value;
                if (e.target.value === 'empty' || e.target.value === 'notempty') {
                    filters[idx].value = '';
                }
                updateFilterList();
                refreshPreview();
            });
        });

        container.querySelectorAll('.wb-filter-value').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                filters[idx].value = e.target.value;
                refreshPreview();
            });
        });

        container.querySelectorAll('.wb-filter-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeFilter(parseInt(e.target.dataset.idx));
            });
        });
    }

    function applyFilters(rows, sourceTable, colIdxs) {
        const filters = AppState.workbench.filters;
        if (filters.length === 0) return rows;

        return rows.filter(row => {
            return filters.every(f => {
                const origIdx = f.column;
                const mappedIdx = colIdxs.indexOf(origIdx);
                if (mappedIdx === -1) return true;

                const cellVal = row[mappedIdx];
                const op = f.operator;
                const filterVal = f.value;

                if (op === 'empty') return cellVal === null || cellVal === undefined || cellVal === '';
                if (op === 'notempty') return cellVal !== null && cellVal !== undefined && cellVal !== '';

                if (cellVal === null || cellVal === undefined) return false;

                const colType = detectColumnType(sourceTable, origIdx);

                if (colType === 'number') {
                    const numCell = typeof cellVal === 'number' ? cellVal : parseFloat(cellVal);
                    const numFilter = parseFloat(filterVal);
                    if (isNaN(numFilter)) return false;
                    switch (op) {
                        case 'eq': return numCell === numFilter;
                        case 'neq': return numCell !== numFilter;
                        case 'gt': return numCell > numFilter;
                        case 'lt': return numCell < numFilter;
                        case 'gte': return numCell >= numFilter;
                        case 'lte': return numCell <= numFilter;
                        default: return true;
                    }
                }

                const strCell = String(cellVal);
                const strFilter = String(filterVal);
                switch (op) {
                    case 'eq': return strCell === strFilter;
                    case 'neq': return strCell !== strFilter;
                    case 'contains': return strCell.toLowerCase().includes(strFilter.toLowerCase());
                    case 'startswith': return strCell.toLowerCase().startsWith(strFilter.toLowerCase());
                    case 'endswith': return strCell.toLowerCase().endsWith(strFilter.toLowerCase());
                    default: return true;
                }
            });
        });
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

        const totalBeforeFilter = rows.length;
        rows = applyFilters(rows, sourceTable, colIdxs);
        const totalAfterFilter = rows.length;

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
        if (totalBeforeFilter !== totalAfterFilter) {
            info.textContent = `${totalAfterFilter} / ${totalBeforeFilter} 行 × ${headers.length} 列（已过滤）`;
        } else {
            info.textContent = `${rows.length} 行 × ${headers.length} 列`;
        }
    }

    function addComputedColumn() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) { Toast.warning('请先选择源数据表'); return; }

        const name = document.getElementById('wb-newcol-name')?.value.trim();
        if (!name) { Toast.warning('请填写新列名称'); return; }

        const mode = document.getElementById('wb-newcol-mode')?.value || 'arithmetic';

        switch (mode) {
            case 'arithmetic':
                computeArithmetic(table, name);
                break;
            case 'function':
                computeFunction(table, name);
                break;
            case 'transform':
                computeTransform(table, name);
                break;
            case 'conditional':
                computeConditional(table, name);
                break;
            default:
                Toast.warning('未知的计算模式');
                return;
        }

        updateColumnList();
        updateSortSelect();
        updateNewColSelects();
        refreshPreview();
        DataManager?.renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));

        document.getElementById('wb-newcol-name').value = '';
    }

    function computeArithmetic(table, name) {
        const aIdx = document.getElementById('wb-newcol-a')?.value;
        const op = document.getElementById('wb-newcol-op')?.value;
        const bIdx = document.getElementById('wb-newcol-b')?.value;

        if (aIdx === '' || aIdx === undefined || bIdx === '' || bIdx === undefined) {
            Toast.warning('请选择列 A 和列 B');
            return;
        }

        const ai = parseInt(aIdx);
        const bi = parseInt(bIdx);

        table.headers.push(name);
        table.rows.forEach(row => {
            const av = toNum(row[ai]);
            const bv = toNum(row[bi]);
            let result = null;
            if (av !== null && bv !== null) {
                switch (op) {
                    case '+': result = av + bv; break;
                    case '-': result = av - bv; break;
                    case '*': result = av * bv; break;
                    case '/': result = bv !== 0 ? av / bv : null; break;
                    case '^': result = Math.pow(av, bv); break;
                    case '%': result = bv !== 0 ? av % bv : null; break;
                    case 'max': result = Math.max(av, bv); break;
                    case 'min': result = Math.min(av, bv); break;
                }
                if (result !== null && !isFinite(result)) result = null;
            }
            row.push(result);
        });
    }

    function computeFunction(table, name) {
        const func = document.getElementById('wb-newcol-func')?.value;
        const colIdx = document.getElementById('wb-newcol-col')?.value;

        if (!func || colIdx === '' || colIdx === undefined) {
            Toast.warning('请选择函数和输入列');
            return;
        }

        const ci = parseInt(colIdx);
        const funcMap = buildFuncMap();
        const fn = funcMap[func];
        if (!fn) { Toast.warning('未知函数: ' + func); return; }

        table.headers.push(name);
        table.rows.forEach(row => {
            const v = toNum(row[ci]);
            if (v === null) {
                row.push(null);
            } else {
                const result = fn(v);
                row.push(result !== null && isFinite(result) ? result : null);
            }
        });
    }

    function buildFuncMap() {
        return {
            abs: (x) => Math.abs(x),
            sqrt: (x) => x >= 0 ? Math.sqrt(x) : null,
            cbrt: (x) => Math.cbrt(x),
            square: (x) => x * x,
            cube: (x) => x * x * x,
            reciprocal: (x) => x !== 0 ? 1 / x : null,
            negate: (x) => -x,
            ln: (x) => x > 0 ? Math.log(x) : null,
            log2: (x) => x > 0 ? Math.log2(x) : null,
            log10: (x) => x > 0 ? Math.log10(x) : null,
            exp: (x) => Math.exp(x),
            exp10: (x) => Math.pow(10, x),
            sin: (x) => Math.sin(x),
            cos: (x) => Math.cos(x),
            tan: (x) => Math.tan(x),
            asin: (x) => (x >= -1 && x <= 1) ? Math.asin(x) : null,
            acos: (x) => (x >= -1 && x <= 1) ? Math.acos(x) : null,
            atan: (x) => Math.atan(x),
            deg2rad: (x) => x * Math.PI / 180,
            rad2deg: (x) => x * 180 / Math.PI,
            ceil: (x) => Math.ceil(x),
            floor: (x) => Math.floor(x),
            round: (x) => Math.round(x),
            trunc: (x) => Math.trunc(x),
            sign: (x) => Math.sign(x),
            factorial: (x) => {
                if (x < 0 || !Number.isInteger(x) || x > 170) return null;
                let r = 1;
                for (let i = 2; i <= x; i++) r *= i;
                return r;
            },
        };
    }

    function computeTransform(table, name) {
        const method = document.getElementById('wb-newcol-transform')?.value;
        const colIdx = document.getElementById('wb-newcol-col')?.value;

        if (!method || colIdx === '' || colIdx === undefined) {
            Toast.warning('请选择变换方法和输入列');
            return;
        }

        const ci = parseInt(colIdx);
        const values = table.rows.map(r => toNum(r[ci]));
        const validValues = values.filter(v => v !== null);

        if (validValues.length === 0) {
            Toast.warning('所选列没有有效的数值数据');
            return;
        }

        let results;

        switch (method) {
            case 'zscore':
                results = computeZScore(values, validValues);
                break;
            case 'minmax':
                results = computeMinMax(values, validValues, 0, 1);
                break;
            case 'minmax_custom': {
                const rMin = parseFloat(document.getElementById('wb-newcol-range-min')?.value) || 0;
                const rMax = parseFloat(document.getElementById('wb-newcol-range-max')?.value) || 1;
                results = computeMinMax(values, validValues, rMin, rMax);
                break;
            }
            case 'decimal_scale':
                results = computeDecimalScale(values, validValues);
                break;
            case 'rank':
                results = computeRank(values, false);
                break;
            case 'rank_desc':
                results = computeRank(values, true);
                break;
            case 'percent_rank':
                results = computePercentRank(values);
                break;
            case 'cumsum':
                results = computeCumulative(values, (a, b) => a + b, 0);
                break;
            case 'cumprod':
                results = computeCumulative(values, (a, b) => a * b, 1);
                break;
            case 'cummax':
                results = computeCumulative(values, (a, b) => Math.max(a, b), -Infinity);
                break;
            case 'cummin':
                results = computeCumulative(values, (a, b) => Math.min(a, b), Infinity);
                break;
            case 'diff':
                results = computeDiff(values);
                break;
            case 'pct_change':
                results = computePctChange(values);
                break;
            case 'pct_sum': {
                const sum = validValues.reduce((a, b) => a + b, 0);
                results = values.map(v => (v !== null && sum !== 0) ? (v / sum) * 100 : null);
                break;
            }
            case 'pct_max': {
                const max = Math.max(...validValues);
                results = values.map(v => (v !== null && max !== 0) ? (v / max) * 100 : null);
                break;
            }
            case 'moving_avg':
                results = computeMovingWindow(values, 'avg');
                break;
            case 'moving_sum':
                results = computeMovingWindow(values, 'sum');
                break;
            case 'moving_max':
                results = computeMovingWindow(values, 'max');
                break;
            case 'moving_min':
                results = computeMovingWindow(values, 'min');
                break;
            case 'moving_std':
                results = computeMovingWindow(values, 'std');
                break;
            default:
                Toast.warning('未知的变换方法');
                return;
        }

        table.headers.push(name);
        results.forEach((v, i) => {
            table.rows[i].push(v !== null && isFinite(v) ? v : null);
        });
    }

    function computeZScore(values, validValues) {
        const n = validValues.length;
        const mean = validValues.reduce((a, b) => a + b, 0) / n;
        const variance = validValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (n > 1 ? n - 1 : n);
        const std = Math.sqrt(variance);
        if (std === 0) return values.map(() => 0);
        return values.map(v => v !== null ? (v - mean) / std : null);
    }

    function computeMinMax(values, validValues, targetMin, targetMax) {
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const range = max - min;
        if (range === 0) return values.map(v => v !== null ? targetMin : null);
        return values.map(v => v !== null ? targetMin + ((v - min) / range) * (targetMax - targetMin) : null);
    }

    function computeDecimalScale(values, validValues) {
        const maxAbs = Math.max(...validValues.map(v => Math.abs(v)));
        if (maxAbs === 0) return values.map(() => 0);
        const divisor = Math.pow(10, Math.floor(Math.log10(maxAbs)) + 1);
        return values.map(v => v !== null ? v / divisor : null);
    }

    function computeRank(values, descending) {
        const indexed = values.map((v, i) => ({ v, i })).filter(x => x.v !== null);
        indexed.sort((a, b) => descending ? b.v - a.v : a.v - b.v);
        const ranks = new Array(values.length).fill(null);
        let pos = 0;
        while (pos < indexed.length) {
            let end = pos;
            while (end < indexed.length && indexed[end].v === indexed[pos].v) end++;
            const avgRank = (pos + 1 + end) / 2;
            for (let k = pos; k < end; k++) {
                ranks[indexed[k].i] = avgRank;
            }
            pos = end;
        }
        return ranks;
    }

    function computePercentRank(values) {
        const validCount = values.filter(v => v !== null).length;
        if (validCount <= 1) return values.map(() => null);
        const ranks = computeRank(values, false);
        return ranks.map(r => r !== null ? ((r - 1) / (validCount - 1)) * 100 : null);
    }

    function computeCumulative(values, op, init) {
        const results = [];
        let acc = init;
        for (const v of values) {
            if (v !== null) {
                acc = op(acc, v);
                results.push(acc);
            } else {
                results.push(null);
            }
        }
        return results;
    }

    function computeDiff(values) {
        const results = [null];
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== null && values[i - 1] !== null) {
                results.push(values[i] - values[i - 1]);
            } else {
                results.push(null);
            }
        }
        return results;
    }

    function computePctChange(values) {
        const results = [null];
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== null && values[i - 1] !== null && values[i - 1] !== 0) {
                results.push(((values[i] - values[i - 1]) / Math.abs(values[i - 1])) * 100);
            } else {
                results.push(null);
            }
        }
        return results;
    }

    function computeMovingWindow(values, type) {
        const windowSize = parseInt(document.getElementById('wb-newcol-window')?.value) || 3;
        const results = [];
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            const window = values.slice(start, i + 1).filter(v => v !== null);
            if (window.length === 0) {
                results.push(null);
                continue;
            }
            switch (type) {
                case 'avg':
                    results.push(window.reduce((a, b) => a + b, 0) / window.length);
                    break;
                case 'sum':
                    results.push(window.reduce((a, b) => a + b, 0));
                    break;
                case 'max':
                    results.push(Math.max(...window));
                    break;
                case 'min':
                    results.push(Math.min(...window));
                    break;
                case 'std': {
                    const mean = window.reduce((a, b) => a + b, 0) / window.length;
                    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
                    results.push(Math.sqrt(variance));
                    break;
                }
            }
        }
        return results;
    }

    function computeConditional(table, name) {
        const colIdx = document.getElementById('wb-newcol-col')?.value;
        const condOp = document.getElementById('wb-newcol-cond-op')?.value;
        const condValStr = document.getElementById('wb-newcol-cond-val')?.value;
        const trueValStr = document.getElementById('wb-newcol-cond-true')?.value;
        const falseValStr = document.getElementById('wb-newcol-cond-false')?.value;
        const outputType = document.getElementById('wb-newcol-cond-type')?.value || 'value';

        if (colIdx === '' || colIdx === undefined || condValStr === '' || condValStr === undefined) {
            Toast.warning('请选择条件列并填写阈值');
            return;
        }

        const ci = parseInt(colIdx);
        const condVal = parseFloat(condValStr);

        table.headers.push(name);
        table.rows.forEach(row => {
            const v = toNum(row[ci]);
            if (v === null) {
                row.push(null);
                return;
            }

            let condMet = false;
            switch (condOp) {
                case 'gt': condMet = v > condVal; break;
                case 'lt': condMet = v < condVal; break;
                case 'gte': condMet = v >= condVal; break;
                case 'lte': condMet = v <= condVal; break;
                case 'eq': condMet = v === condVal; break;
                case 'neq': condMet = v !== condVal; break;
            }

            switch (outputType) {
                case 'flag':
                    row.push(condMet ? 1 : 0);
                    break;
                case 'clamp':
                    row.push(condMet ? condVal : v);
                    break;
                case 'value': {
                    if (condMet) {
                        row.push(trueValStr !== '' && trueValStr !== undefined ? parseVal(trueValStr) : v);
                    } else {
                        row.push(falseValStr !== '' && falseValStr !== undefined ? parseVal(falseValStr) : null);
                    }
                    break;
                }
            }
        });
    }

    function toNum(v) {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') return isNaN(v) ? null : v;
        const n = Number(v);
        return isNaN(n) ? null : n;
    }

    function parseVal(s) {
        if (s === '' || s === undefined || s === null) return null;
        const n = Number(s);
        return isNaN(n) ? s : n;
    }

    function createNewTable() {
        if (previewData.headers.length === 0) {
            Toast.warning('预览为空，无法生成新表');
            return;
        }
        const name = document.getElementById('wb-newtable-name')?.value.trim() || '处理后数据';
        createTable(name, previewData.headers, previewData.rows.map(r => [...r]), 'workbench');
        DataManager?.renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
        Toast.success(`已创建新表: ${name}`);
        document.getElementById('wb-newtable-name').value = '';
    }

    // ── 统计分析 UI ──

    function getColumnOptions() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) return [];
        return table.headers.map((h, i) => ({ label: h, value: h, index: i }));
    }

    function buildSelect(id, label, options) {
        return `<div class="form-row"><label>${label}</label><select class="form-select" id="${id}"><option value="">选择...</option>${options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')}</select></div>`;
    }

    function buildMultiSelect(id, label, options) {
        return `<div class="form-row"><label>${label}</label><div class="wb-multi-select" id="${id}">${options.map(o => `<label><input type="checkbox" value="${escapeHtml(o.value)}"><span>${escapeHtml(o.label)}</span></label>`).join('')}</div></div>`;
    }

    function buildInput(id, label, type, placeholder, defaultVal) {
        return `<div class="form-row"><label>${label}</label><input type="${type}" class="form-input" id="${id}" placeholder="${placeholder || ''}" value="${defaultVal || ''}"></div>`;
    }

    function updateStatParams() {
        const container = document.getElementById('wb-stat-params');
        if (!container) return;

        const method = document.getElementById('wb-stat-method')?.value;
        const opts = getColumnOptions();

        if (!method || opts.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="wb-stat-params-inner">';

        switch (method) {
            case 'describe':
                html += '<p class="text-muted">对当前表所有数值列进行描述性统计</p>';
                break;
            case 'ttest':
            case 'mann_whitney':
                html += buildSelect('wb-stat-group', '分组列', opts);
                html += buildSelect('wb-stat-value', '数值列', opts);
                break;
            case 'wilcoxon':
                html += buildSelect('wb-stat-cola', '配对列 A', opts);
                html += buildSelect('wb-stat-colb', '配对列 B', opts);
                break;
            case 'anova':
            case 'kruskal':
                html += buildSelect('wb-stat-group', '分组列', opts);
                html += buildSelect('wb-stat-value', '数值列', opts);
                break;
            case 'chi_square':
                html += buildSelect('wb-stat-cola', '分类列 A', opts);
                html += buildSelect('wb-stat-colb', '分类列 B', opts);
                break;
            case 'regression':
                html += buildSelect('wb-stat-x', '自变量 X', opts);
                html += buildSelect('wb-stat-y', '因变量 Y', opts);
                break;
            case 'multi_regression':
                html += buildMultiSelect('wb-stat-xs', '自变量（可多选）', opts);
                html += buildSelect('wb-stat-y', '因变量 Y', opts);
                break;
            case 'correlation':
                html += '<p class="text-muted">对当前表所有数值列计算 Pearson 相关矩阵</p>';
                break;
            case 'normality':
                html += buildSelect('wb-stat-col', '检验列', opts);
                break;
            case 'outliers':
                html += buildSelect('wb-stat-col', '检测列', opts);
                html += `<div class="form-row"><label>检测方法</label><select class="form-select" id="wb-stat-outlier-method"><option value="iqr">IQR 法</option><option value="zscore">Z-score 法</option></select></div>`;
                html += buildInput('wb-stat-threshold', '阈值（IQR 默认 1.5 / Z 默认 3.0）', 'number', '留空使用默认值', '');
                break;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function collectStatParams() {
        const method = document.getElementById('wb-stat-method')?.value;
        if (!method) return null;

        const getVal = (id) => document.getElementById(id)?.value || null;

        switch (method) {
            case 'describe':
                return { method, params: {} };
            case 'ttest':
            case 'mann_whitney':
                return { method, params: { group_column: getVal('wb-stat-group'), value_column: getVal('wb-stat-value') } };
            case 'wilcoxon':
                return { method, params: { column_a: getVal('wb-stat-cola'), column_b: getVal('wb-stat-colb') } };
            case 'anova':
            case 'kruskal':
                return { method, params: { group_column: getVal('wb-stat-group'), value_column: getVal('wb-stat-value') } };
            case 'chi_square':
                return { method, params: { column_a: getVal('wb-stat-cola'), column_b: getVal('wb-stat-colb') } };
            case 'regression':
                return { method, params: { x_column: getVal('wb-stat-x'), y_column: getVal('wb-stat-y') } };
            case 'multi_regression': {
                const checks = document.querySelectorAll('#wb-stat-xs input[type="checkbox"]:checked');
                const xCols = Array.from(checks).map(c => c.value);
                return { method, params: { x_columns: xCols, y_column: getVal('wb-stat-y') } };
            }
            case 'correlation':
                return { method, params: {} };
            case 'normality':
                return { method, params: { column: getVal('wb-stat-col') } };
            case 'outliers': {
                const threshold = getVal('wb-stat-threshold');
                return {
                    method,
                    params: {
                        column: getVal('wb-stat-col'),
                        method: getVal('wb-stat-outlier-method') || 'iqr',
                        threshold: threshold ? parseFloat(threshold) : null,
                    }
                };
            }
            default:
                return null;
        }
    }

    async function runStatAnalysis() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) {
            Toast.warning('请先选择源数据表');
            return;
        }

        const config = collectStatParams();
        if (!config) {
            Toast.warning('请先选择分析方法并填写参数');
            return;
        }

        const tableData = { headers: table.headers, rows: table.rows };

        const resultPanel = document.getElementById('wb-stat-result-panel');
        const resultDiv = document.getElementById('wb-stat-result');

        if (resultPanel) resultPanel.style.display = '';
        if (resultDiv) resultDiv.innerHTML = '<p class="text-muted">分析中...</p>';

        try {
            const result = await SciPloterBridge.analyze(tableData, config.method, config.params);
            if (!result) {
                if (resultDiv) resultDiv.innerHTML = '<div class="stat-error">分析失败：桌面版功能不可用</div>';
                return;
            }
            if (result.error) {
                if (resultDiv) resultDiv.innerHTML = `<div class="stat-error">${escapeHtml(result.error)}</div>`;
                return;
            }
            lastStatMethod = config.method;
            lastStatResult = result;
            renderStatResult(config.method, result);
            renderAnalysisChart(config.method, result);
        } catch (e) {
            if (resultDiv) resultDiv.innerHTML = `<div class="stat-error">分析出错：${escapeHtml(e.message)}</div>`;
        }
    }

    function renderStatResult(method, r) {
        const div = document.getElementById('wb-stat-result');
        if (!div) return;

        let html = '';

        switch (method) {
            case 'describe':
                html = renderDescribe(r);
                break;
            case 'ttest':
                html = renderTTest(r);
                break;
            case 'mann_whitney':
                html = renderMannWhitney(r);
                break;
            case 'wilcoxon':
                html = renderWilcoxon(r);
                break;
            case 'anova':
                html = renderAnova(r);
                break;
            case 'kruskal':
                html = renderKruskal(r);
                break;
            case 'chi_square':
                html = renderChiSquare(r);
                break;
            case 'regression':
                html = renderRegression(r);
                break;
            case 'multi_regression':
                html = renderMultiRegression(r);
                break;
            case 'correlation':
                html = renderCorrelation(r);
                break;
            case 'normality':
                html = renderNormality(r);
                break;
            case 'outliers':
                html = renderOutliers(r);
                break;
            default:
                html = `<pre>${escapeHtml(JSON.stringify(r, null, 2))}</pre>`;
        }

        div.innerHTML = html;
    }

    // ── 结果渲染器 ──

    function fmtNum(v, d) {
        if (v === null || v === undefined) return '-';
        d = d !== undefined ? d : 4;
        return typeof v === 'number' ? v.toFixed(d) : String(v);
    }

    function sigClass(sig) {
        return sig ? 'stat-significant' : 'stat-not-significant';
    }

    function sigLabel(sig) {
        return sig ? '显著 (p < 0.05)' : '不显著 (p ≥ 0.05)';
    }

    function statRow(label, value) {
        return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
    }

    function renderDescribe(r) {
        let html = '<div class="stat-title">描述性统计</div>';
        html += statRow('样本量', r.count);
        html += '<table class="stat-table"><thead><tr><th>列</th><th>均值</th><th>标准差</th><th>最小</th><th>最大</th></tr></thead><tbody>';
        for (const col of r.columns) {
            const s = r.stats[col];
            html += `<tr><td>${escapeHtml(col)}</td><td>${fmtNum(s.mean)}</td><td>${fmtNum(s.std)}</td><td>${fmtNum(s.min)}</td><td>${fmtNum(s.max)}</td></tr>`;
        }
        html += '</tbody></table>';
        return html;
    }

    function renderTTest(r) {
        let html = '<div class="stat-title">独立样本 t 检验</div>';
        html += statRow('t 统计量', fmtNum(r.t_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += `<div class="stat-group-header">组 1</div>`;
        html += statRow('均值', fmtNum(r.group1_mean));
        html += statRow('样本量', r.group1_n);
        html += `<div class="stat-group-header">组 2</div>`;
        html += statRow('均值', fmtNum(r.group2_mean));
        html += statRow('样本量', r.group2_n);
        return html;
    }

    function renderMannWhitney(r) {
        let html = '<div class="stat-title">Mann-Whitney U 检验</div>';
        html += statRow('U 统计量', fmtNum(r.u_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += `<div class="stat-group-header">组 1</div>`;
        html += statRow('中位数', fmtNum(r.group1_median));
        html += statRow('样本量', r.group1_n);
        html += `<div class="stat-group-header">组 2</div>`;
        html += statRow('中位数', fmtNum(r.group2_median));
        html += statRow('样本量', r.group2_n);
        return html;
    }

    function renderWilcoxon(r) {
        let html = '<div class="stat-title">Wilcoxon 符号秩检验</div>';
        html += statRow('W 统计量', fmtNum(r.w_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += statRow('配对列 A 中位数', fmtNum(r.median_a));
        html += statRow('配对列 B 中位数', fmtNum(r.median_b));
        html += statRow('差值中位数', fmtNum(r.median_difference));
        html += statRow('样本量', r.n);
        return html;
    }

    function renderAnova(r) {
        let html = '<div class="stat-title">单因素方差分析（ANOVA）</div>';
        html += statRow('F 统计量', fmtNum(r.f_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += statRow('组间自由度', r.df_between);
        html += statRow('组内自由度', r.df_within);
        html += statRow('组数', r.n_groups);
        html += statRow('总样本量', r.n_total);
        html += '<table class="stat-table"><thead><tr><th>组</th><th>均值</th><th>标准差</th><th>N</th></tr></thead><tbody>';
        for (const [name, s] of Object.entries(r.groups)) {
            html += `<tr><td>${escapeHtml(name)}</td><td>${fmtNum(s.mean)}</td><td>${fmtNum(s.std)}</td><td>${s.n}</td></tr>`;
        }
        html += '</tbody></table>';
        return html;
    }

    function renderKruskal(r) {
        let html = '<div class="stat-title">Kruskal-Wallis H 检验</div>';
        html += statRow('H 统计量', fmtNum(r.h_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += statRow('自由度', r.degrees_of_freedom);
        html += statRow('组数', r.n_groups);
        html += statRow('总样本量', r.n_total);
        html += '<table class="stat-table"><thead><tr><th>组</th><th>中位数</th><th>N</th></tr></thead><tbody>';
        for (const [name, s] of Object.entries(r.groups)) {
            html += `<tr><td>${escapeHtml(name)}</td><td>${fmtNum(s.median)}</td><td>${s.n}</td></tr>`;
        }
        html += '</tbody></table>';
        return html;
    }

    function renderChiSquare(r) {
        let html = '<div class="stat-title">卡方独立性检验</div>';
        html += statRow('χ² 统计量', fmtNum(r.chi2_statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">显著性</span><span class="stat-value ${sigClass(r.significant)}">${sigLabel(r.significant)}</span></div>`;
        html += statRow('自由度', r.degrees_of_freedom);
        html += statRow("Cramér's V", fmtNum(r.cramers_v));
        html += statRow('样本量', r.n);

        const ct = r.contingency_table;
        if (ct) {
            html += '<div class="stat-group-header">列联表</div>';
            html += '<table class="stat-table"><thead><tr><th></th>';
            ct.columns.forEach(c => html += `<th>${escapeHtml(c)}</th>`);
            html += '</tr></thead><tbody>';
            ct.index.forEach((row, ri) => {
                html += `<tr><td style="font-weight:600">${escapeHtml(row)}</td>`;
                ct.values[ri].forEach(v => html += `<td>${v}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table>';
        }
        return html;
    }

    function renderRegression(r) {
        let html = '<div class="stat-title">简单线性回归</div>';
        html += statRow('回归方程', r.equation);
        html += statRow('R²', fmtNum(r.r_squared));
        html += statRow('p 值', fmtNum(r.p_value));
        html += statRow('标准误', fmtNum(r.std_error));
        html += statRow('样本量', r.n);
        return html;
    }

    function renderMultiRegression(r) {
        let html = '<div class="stat-title">多元线性回归</div>';
        html += statRow('R²', fmtNum(r.r_squared));
        html += statRow('调整 R²', fmtNum(r.adj_r_squared));
        html += statRow('F 统计量', fmtNum(r.f_statistic));
        html += statRow('F p 值', fmtNum(r.f_p_value));
        html += statRow('自变量数', r.n_predictors);
        html += statRow('样本量', r.n);

        html += '<div class="stat-group-header">回归系数</div>';
        html += '<table class="stat-table"><thead><tr><th>变量</th><th>系数</th><th>标准误</th><th>t</th><th>p</th></tr></thead><tbody>';
        for (const [name, c] of Object.entries(r.coefficients)) {
            html += `<tr><td>${escapeHtml(name)}</td><td>${fmtNum(c.value)}</td><td>${fmtNum(c.std_error)}</td>`;
            html += `<td>${fmtNum(c.t_statistic)}</td><td>${fmtNum(c.p_value)}</td></tr>`;
        }
        html += '</tbody></table>';
        return html;
    }

    function renderCorrelation(r) {
        let html = '<div class="stat-title">Pearson 相关矩阵</div>';
        html += '<table class="stat-table"><thead><tr><th></th>';
        r.columns.forEach(c => html += `<th>${escapeHtml(c)}</th>`);
        html += '</tr></thead><tbody>';
        r.columns.forEach((c, i) => {
            html += `<tr><td style="font-weight:600">${escapeHtml(c)}</td>`;
            r.matrix[i].forEach(v => html += `<td>${fmtNum(v, 3)}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderNormality(r) {
        const testName = r.test === 'shapiro_wilk' ? 'Shapiro-Wilk 检验' : "D'Agostino-Pearson 检验";
        let html = `<div class="stat-title">${testName}</div>`;
        html += statRow('检验统计量', fmtNum(r.statistic));
        html += statRow('p 值', fmtNum(r.p_value));
        html += `<div class="stat-row"><span class="stat-label">正态性</span><span class="stat-value ${r.is_normal ? 'stat-significant' : 'stat-not-significant'}">${r.is_normal ? '符合正态分布' : '不符合正态分布'}</span></div>`;
        html += statRow('均值', fmtNum(r.mean));
        html += statRow('标准差', fmtNum(r.std));
        html += statRow('偏度', fmtNum(r.skewness));
        html += statRow('峰度', fmtNum(r.kurtosis));
        html += statRow('样本量', r.n);
        return html;
    }

    function renderOutliers(r) {
        const methodName = r.method === 'iqr' ? 'IQR 法' : 'Z-score 法';
        let html = `<div class="stat-title">异常值检测（${methodName}）</div>`;
        html += statRow('异常值数量', r.n_outliers);
        html += statRow('异常值比例', fmtNum(r.outlier_ratio * 100, 2) + '%');
        html += statRow('总样本量', r.n_total);

        if (r.method === 'iqr') {
            html += statRow('下界', fmtNum(r.bounds.lower));
            html += statRow('上界', fmtNum(r.bounds.upper));
        } else {
            html += statRow('Z 阈值', fmtNum(r.bounds.z_threshold, 1));
        }

        html += '<div class="stat-group-header">数据概况</div>';
        html += statRow('均值', fmtNum(r.stats.mean));
        html += statRow('标准差', fmtNum(r.stats.std));
        html += statRow('最小值', fmtNum(r.stats.min));
        html += statRow('Q1', fmtNum(r.stats.q1));
        html += statRow('中位数', fmtNum(r.stats.median));
        html += statRow('Q3', fmtNum(r.stats.q3));
        html += statRow('最大值', fmtNum(r.stats.max));

        if (r.n_outliers > 0 && r.outlier_values.length > 0) {
            html += '<div class="stat-group-header">异常值（前 100 个）</div>';
            const display = r.outlier_values.slice(0, 20);
            html += `<p class="text-muted">${display.map(v => fmtNum(v, 2)).join(', ')}`;
            if (r.n_outliers > 20) html += ` ... 还有 ${r.n_outliers - 20} 个`;
            html += '</p>';
        }
        return html;
    }

    function bindStatViewToggle() {
        const buttons = document.querySelectorAll('.stat-view-btn');
        const resultDiv = document.getElementById('wb-stat-result');
        const chartWrap = document.getElementById('wb-stat-chart-wrap');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const view = btn.dataset.view;
                if (view === 'table') {
                    if (resultDiv) resultDiv.style.display = '';
                    if (chartWrap) chartWrap.style.display = 'none';
                } else {
                    if (resultDiv) resultDiv.style.display = 'none';
                    if (chartWrap) chartWrap.style.display = '';
                    if (statChartInstance) statChartInstance.resize();
                    if (lastStatMethod && lastStatResult) {
                        renderAnalysisChart(lastStatMethod, lastStatResult);
                    }
                }
            });
        });

        document.getElementById('btn-stat-chart-snapshot')?.addEventListener('click', () => {
            if (!statChartInstance) return;
            const url = statChartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
            const snapshot = createSnapshot('分析图表', 'analysis_chart', url, { method: lastStatMethod });
            SubfigureEditor?.updateSnapshotList();
            Toast.success('已暂存分析图表: ' + snapshot.name);
        });
    }

    function renderAnalysisChart(method, r) {
        const chartDom = document.getElementById('wb-stat-chart');
        if (!chartDom) return;

        if (!statChartInstance) {
            statChartInstance = echarts.init(chartDom, null, { renderer: 'canvas' });
        }

        let option = null;

        switch (method) {
            case 'describe':
                option = buildDescribeChart(r);
                break;
            case 'ttest':
                option = buildTTestChart(r);
                break;
            case 'mann_whitney':
                option = buildMannWhitneyChart(r);
                break;
            case 'anova':
                option = buildAnovaChart(r);
                break;
            case 'kruskal':
                option = buildKruskalChart(r);
                break;
            case 'regression':
                option = buildRegressionChart(r);
                break;
            case 'correlation':
                option = buildCorrelationChart(r);
                break;
            case 'normality':
                option = buildNormalityChart(r);
                break;
            case 'outliers':
                option = buildOutliersChart(r);
                break;
        }

        if (!option) {
            statChartInstance.setOption({
                title: { text: '该分析方法暂无可视化图表', left: 'center', top: 'center', textStyle: { color: '#9ca3af', fontSize: 14 } },
                animation: false,
            }, true);
            return;
        }

        option.animation = false;
        statChartInstance.setOption(option, true);
    }

    function buildDescribeChart(r) {
        const cols = r.columns;
        const means = cols.map(c => r.stats[c]?.mean ?? 0);
        const stds = cols.map(c => r.stats[c]?.std ?? 0);

        return {
            title: { text: '描述性统计 — 均值与标准差', left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: cols, axisLabel: { rotate: cols.length > 6 ? 30 : 0 } },
            yAxis: { type: 'value' },
            series: [{
                type: 'bar',
                data: means,
                barMaxWidth: 40,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                markLine: {
                    silent: true,
                    data: stds.map((std, i) => ({
                        yAxis: means[i] + std,
                        lineStyle: { type: 'dashed', color: '#999' },
                        label: { show: false },
                    })),
                },
            }],
            grid: { left: 50, right: 20, top: 50, bottom: 60 },
        };
    }

    function buildTTestChart(r) {
        return {
            title: { text: 't 检验 — 组均值对比', left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: ['组 1', '组 2'] },
            yAxis: { type: 'value' },
            series: [{
                type: 'bar',
                data: [r.group1_mean, r.group2_mean],
                barMaxWidth: 60,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                label: { show: true, position: 'top', formatter: '{c}' },
            }],
            graphic: [{
                type: 'text',
                right: 10,
                top: 40,
                style: {
                    text: `p = ${fmtNum(r.p_value)}\n${r.significant ? '* 显著' : 'ns 不显著'}`,
                    font: '12px Arial',
                    fill: r.significant ? '#16a34a' : '#9ca3af',
                    textAlign: 'right',
                },
            }],
            grid: { left: 50, right: 20, top: 50, bottom: 40 },
        };
    }

    function buildMannWhitneyChart(r) {
        return {
            title: { text: 'Mann-Whitney U — 组中位数对比', left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: ['组 1', '组 2'] },
            yAxis: { type: 'value' },
            series: [{
                type: 'bar',
                data: [r.group1_median, r.group2_median],
                barMaxWidth: 60,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                label: { show: true, position: 'top', formatter: '{c}' },
            }],
            graphic: [{
                type: 'text',
                right: 10,
                top: 40,
                style: {
                    text: `p = ${fmtNum(r.p_value)}\n${r.significant ? '* 显著' : 'ns 不显著'}`,
                    font: '12px Arial',
                    fill: r.significant ? '#16a34a' : '#9ca3af',
                    textAlign: 'right',
                },
            }],
            grid: { left: 50, right: 20, top: 50, bottom: 40 },
        };
    }

    function buildAnovaChart(r) {
        const groups = Object.entries(r.groups);
        const categories = groups.map(([name]) => name);
        const means = groups.map(([, s]) => s.mean);
        const stds = groups.map(([, s]) => s.std);

        return {
            title: { text: `ANOVA — 组均值对比 (p=${fmtNum(r.p_value, 4)})`, left: 'center', textStyle: { fontSize: 13 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const p = params[0];
                    const idx = p.dataIndex;
                    return `${categories[idx]}<br>均值: ${fmtNum(means[idx])}<br>标准差: ${fmtNum(stds[idx])}<br>N: ${groups[idx][1].n}`;
                },
            },
            xAxis: { type: 'category', data: categories, axisLabel: { rotate: categories.length > 5 ? 30 : 0 } },
            yAxis: { type: 'value' },
            series: [{
                type: 'bar',
                data: means,
                barMaxWidth: 40,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                label: { show: true, position: 'top', formatter: (p) => fmtNum(p.value, 2) },
            }],
            grid: { left: 50, right: 20, top: 50, bottom: 60 },
        };
    }

    function buildKruskalChart(r) {
        const groups = Object.entries(r.groups);
        const categories = groups.map(([name]) => name);
        const medians = groups.map(([, s]) => s.median);

        return {
            title: { text: `Kruskal-Wallis — 组中位数对比 (p=${fmtNum(r.p_value, 4)})`, left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: categories, axisLabel: { rotate: categories.length > 5 ? 30 : 0 } },
            yAxis: { type: 'value' },
            series: [{
                type: 'bar',
                data: medians,
                barMaxWidth: 40,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                label: { show: true, position: 'top', formatter: (p) => fmtNum(p.value, 2) },
            }],
            grid: { left: 50, right: 20, top: 50, bottom: 60 },
        };
    }

    function buildRegressionChart(r) {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) return null;

        const params = collectStatParams();
        if (!params || !params.params.x_column || !params.params.y_column) return null;

        const xColName = params.params.x_column;
        const yColName = params.params.y_column;
        const xIdx = table.headers.indexOf(xColName);
        const yIdx = table.headers.indexOf(yColName);
        if (xIdx < 0 || yIdx < 0) return null;

        const scatterData = [];
        table.rows.forEach(row => {
            const xv = row[xIdx];
            const yv = row[yIdx];
            if (xv !== null && yv !== null && typeof xv === 'number' && typeof yv === 'number') {
                scatterData.push([xv, yv]);
            }
        });

        if (scatterData.length < 2) return null;

        const xVals = scatterData.map(d => d[0]);
        const xMin = Math.min(...xVals);
        const xMax = Math.max(...xVals);
        const slope = r.slope ?? 0;
        const intercept = r.intercept ?? 0;
        const lineData = [
            [xMin, slope * xMin + intercept],
            [xMax, slope * xMax + intercept],
        ];

        return {
            title: { text: `回归: ${r.equation}  (R²=${fmtNum(r.r_squared)})`, left: 'center', textStyle: { fontSize: 12 } },
            tooltip: { trigger: 'item' },
            xAxis: { type: 'value', name: xColName, nameLocation: 'middle', nameGap: 28, scale: true },
            yAxis: { type: 'value', name: yColName, nameLocation: 'middle', nameGap: 40, scale: true },
            series: [
                {
                    type: 'scatter',
                    data: scatterData,
                    symbolSize: 6,
                    itemStyle: { opacity: 0.7 },
                },
                {
                    type: 'line',
                    data: lineData,
                    symbol: 'none',
                    lineStyle: { width: 2, color: '#e74c3c' },
                    itemStyle: { color: '#e74c3c' },
                },
            ],
            grid: { left: 55, right: 20, top: 50, bottom: 55 },
        };
    }

    function buildCorrelationChart(r) {
        const cols = r.columns;
        const matrix = r.matrix;
        const heatData = [];
        let minVal = 1, maxVal = -1;

        for (let i = 0; i < cols.length; i++) {
            for (let j = 0; j < cols.length; j++) {
                const v = matrix[i][j];
                heatData.push([j, i, v]);
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
        }

        return {
            title: { text: 'Pearson 相关矩阵', left: 'center', textStyle: { fontSize: 13 } },
            tooltip: {
                position: 'top',
                formatter: (p) => `${cols[p.value[1]]} × ${cols[p.value[0]]}<br>r = ${fmtNum(p.value[2], 3)}`,
            },
            xAxis: {
                type: 'category',
                data: cols,
                axisLabel: { rotate: 45, fontSize: 10 },
                splitArea: { show: true },
            },
            yAxis: {
                type: 'category',
                data: cols,
                axisLabel: { fontSize: 10 },
                splitArea: { show: true },
            },
            visualMap: {
                min: minVal,
                max: maxVal,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: 5,
                inRange: { color: ['#3b82f6', '#dbeafe', '#ffffff', '#fecaca', '#ef4444'] },
                textStyle: { fontSize: 10 },
            },
            series: [{
                type: 'heatmap',
                data: heatData,
                label: {
                    show: cols.length <= 8,
                    formatter: (p) => fmtNum(p.value[2], 2),
                    fontSize: 10,
                },
                emphasis: {
                    itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' },
                },
            }],
            grid: { left: 80, right: 20, top: 40, bottom: 80 },
        };
    }

    function buildNormalityChart(r) {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) return null;

        const params = collectStatParams();
        if (!params || !params.params.column) return null;

        const colName = params.params.column;
        const colIdx = table.headers.indexOf(colName);
        if (colIdx < 0) return null;

        const values = table.rows.map(row => row[colIdx]).filter(v => v !== null && typeof v === 'number');
        if (values.length === 0) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const binCount = Math.min(Math.ceil(Math.sqrt(n)), 30);
        const min = sorted[0];
        const max = sorted[n - 1];
        const step = (max - min) / binCount || 1;
        const bins = [];
        for (let i = 0; i < binCount; i++) {
            bins.push({ start: min + i * step, end: min + (i + 1) * step, count: 0 });
        }
        values.forEach(v => {
            const idx = Math.min(Math.floor((v - min) / step), binCount - 1);
            bins[idx].count++;
        });

        const mean = r.mean;
        const std = r.std;
        const normalCurve = bins.map(b => {
            const mid = (b.start + b.end) / 2;
            const density = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((mid - mean) / std) ** 2);
            return density * n * step;
        });

        return {
            title: { text: `正态性检验 — ${colName}`, left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'axis' },
            xAxis: {
                type: 'category',
                data: bins.map(b => fmtNum((b.start + b.end) / 2, 1)),
                axisLabel: { rotate: 45, fontSize: 9 },
            },
            yAxis: { type: 'value' },
            series: [
                {
                    type: 'bar',
                    data: bins.map(b => b.count),
                    barCategoryGap: 0,
                    itemStyle: { opacity: 0.6 },
                },
                {
                    type: 'line',
                    data: normalCurve,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 2, color: '#e74c3c' },
                    itemStyle: { color: '#e74c3c' },
                },
            ],
            grid: { left: 45, right: 20, top: 50, bottom: 70 },
        };
    }

    function buildOutliersChart(r) {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) return null;

        const params = collectStatParams();
        if (!params || !params.params.column) return null;

        const colName = params.params.column;
        const colIdx = table.headers.indexOf(colName);
        if (colIdx < 0) return null;

        const values = table.rows.map(row => row[colIdx]).filter(v => v !== null && typeof v === 'number');
        if (values.length === 0) return null;

        const outlierSet = new Set(r.outlier_values);
        const normalData = [];
        const outlierData = [];
        values.forEach((v, i) => {
            if (outlierSet.has(v)) {
                outlierData.push([i, v]);
            } else {
                normalData.push([i, v]);
            }
        });

        const markLines = [];
        if (r.method === 'iqr') {
            markLines.push({ yAxis: r.bounds.lower, name: '下界' });
            markLines.push({ yAxis: r.bounds.upper, name: '上界' });
        }

        return {
            title: { text: `异常值检测 — ${colName}`, left: 'center', textStyle: { fontSize: 13 } },
            tooltip: { trigger: 'item' },
            xAxis: { type: 'value', name: '序号', show: false },
            yAxis: { type: 'value', name: colName },
            series: [
                {
                    name: '正常值',
                    type: 'scatter',
                    data: normalData,
                    symbolSize: 4,
                    itemStyle: { opacity: 0.4, color: '#94a3b8' },
                },
                {
                    name: '异常值',
                    type: 'scatter',
                    data: outlierData,
                    symbolSize: 8,
                    itemStyle: { color: '#ef4444' },
                    markLine: markLines.length > 0 ? {
                        silent: true,
                        data: markLines.map(m => ({
                            yAxis: m.yAxis,
                            lineStyle: { type: 'dashed', color: '#f59e0b' },
                            label: { formatter: m.name + ': ' + fmtNum(m.yAxis, 2), fontSize: 10 },
                        })),
                    } : undefined,
                },
            ],
            legend: { top: 28, textStyle: { fontSize: 11 } },
            grid: { left: 50, right: 20, top: 60, bottom: 30 },
        };
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── 数据预处理：列选择器刷新 ──

    function updatePreprocessCols() {
        const table = getTable(AppState.workbench.sourceTableId);
        const missingContainer = document.getElementById('wb-missing-cols');
        const normContainer = document.getElementById('wb-norm-cols');

        if (!table) {
            if (missingContainer) missingContainer.innerHTML = '<p class="empty-tip" style="padding:8px">先选择源表</p>';
            if (normContainer) normContainer.innerHTML = '<p class="empty-tip" style="padding:8px">先选择源表</p>';
            return;
        }

        if (missingContainer) {
            missingContainer.innerHTML = table.headers.map((h, i) =>
                `<label><input type="checkbox" value="${i}"><span>${escapeHtml(h)}</span></label>`
            ).join('');
        }

        if (normContainer) {
            const numericCols = [];
            table.headers.forEach((h, i) => {
                const isNumeric = table.rows.some(row => {
                    const v = row[i];
                    return v !== null && v !== undefined && v !== '' && typeof v === 'number';
                });
                if (isNumeric) numericCols.push({ h, i });
            });
            if (numericCols.length === 0) {
                normContainer.innerHTML = '<p class="empty-tip" style="padding:8px">无数值列</p>';
            } else {
                normContainer.innerHTML = numericCols.map(({ h, i }) =>
                    `<label><input type="checkbox" value="${i}"><span>${escapeHtml(h)}</span></label>`
                ).join('');
            }
        }
    }

    function getCheckedIndices(containerId) {
        const checks = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);
        return Array.from(checks).map(c => parseInt(c.value));
    }

    function getColValues(table, colIdx) {
        return table.rows.map(row => row[colIdx]);
    }

    function computeMean(values) {
        const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (valid.length === 0) return null;
        return valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    function computeMedian(values) {
        const valid = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
        if (valid.length === 0) return null;
        const mid = Math.floor(valid.length / 2);
        return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
    }

    function computeMode(values) {
        const freq = {};
        let maxFreq = 0;
        let mode = null;
        for (const v of values) {
            if (v === null || v === undefined || v === '') continue;
            const key = String(v);
            freq[key] = (freq[key] || 0) + 1;
            if (freq[key] > maxFreq) {
                maxFreq = freq[key];
                mode = typeof v === 'number' ? v : v;
            }
        }
        return mode;
    }

    function computePercentile(values, pct) {
        const valid = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
        if (valid.length === 0) return null;
        const idx = (pct / 100) * (valid.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return valid[lo];
        return valid[lo] + (valid[hi] - valid[lo]) * (idx - lo);
    }

    // ── 缺失值处理 ──

    function applyMissingHandler() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) { Toast.warning('请先选择源数据表'); return; }

        const method = document.getElementById('wb-missing-method')?.value;
        if (!method) { Toast.warning('请选择处理方法'); return; }

        let colIndices = getCheckedIndices('wb-missing-cols');
        if (colIndices.length === 0) {
            colIndices = table.headers.map((_, i) => i);
        }

        let affectedCount = 0;

        switch (method) {
            case 'drop_rows': {
                const originalLen = table.rows.length;
                table.rows = table.rows.filter(row =>
                    !colIndices.some(ci => row[ci] === null || row[ci] === undefined || row[ci] === '')
                );
                affectedCount = originalLen - table.rows.length;
                if (affectedCount === 0) {
                    Toast.warning('没有包含缺失值的行');
                    return;
                }
                break;
            }
            case 'fill_mean': {
                for (const ci of colIndices) {
                    const mean = computeMean(getColValues(table, ci));
                    if (mean === null) continue;
                    table.rows.forEach(row => {
                        if (row[ci] === null || row[ci] === undefined || row[ci] === '') {
                            row[ci] = mean;
                            affectedCount++;
                        }
                    });
                }
                break;
            }
            case 'fill_median': {
                for (const ci of colIndices) {
                    const median = computeMedian(getColValues(table, ci));
                    if (median === null) continue;
                    table.rows.forEach(row => {
                        if (row[ci] === null || row[ci] === undefined || row[ci] === '') {
                            row[ci] = median;
                            affectedCount++;
                        }
                    });
                }
                break;
            }
            case 'fill_mode': {
                for (const ci of colIndices) {
                    const mode = computeMode(getColValues(table, ci));
                    if (mode === null) continue;
                    table.rows.forEach(row => {
                        if (row[ci] === null || row[ci] === undefined || row[ci] === '') {
                            row[ci] = mode;
                            affectedCount++;
                        }
                    });
                }
                break;
            }
            case 'fill_fixed': {
                const fixedValStr = document.getElementById('wb-missing-fixed-val')?.value;
                if (fixedValStr === '' || fixedValStr === undefined) {
                    Toast.warning('请填写固定值');
                    return;
                }
                const fixedVal = parseVal(fixedValStr);
                for (const ci of colIndices) {
                    table.rows.forEach(row => {
                        if (row[ci] === null || row[ci] === undefined || row[ci] === '') {
                            row[ci] = fixedVal;
                            affectedCount++;
                        }
                    });
                }
                break;
            }
            case 'fill_forward': {
                for (const ci of colIndices) {
                    let lastValid = null;
                    table.rows.forEach(row => {
                        if (row[ci] !== null && row[ci] !== undefined && row[ci] !== '') {
                            lastValid = row[ci];
                        } else if (lastValid !== null) {
                            row[ci] = lastValid;
                            affectedCount++;
                        }
                    });
                }
                break;
            }
            case 'fill_backward': {
                for (const ci of colIndices) {
                    let nextValid = null;
                    for (let i = table.rows.length - 1; i >= 0; i--) {
                        const row = table.rows[i];
                        if (row[ci] !== null && row[ci] !== undefined && row[ci] !== '') {
                            nextValid = row[ci];
                        } else if (nextValid !== null) {
                            row[ci] = nextValid;
                            affectedCount++;
                        }
                    }
                }
                break;
            }
        }

        afterPreprocess(`缺失值处理完成，影响 ${affectedCount} 个单元格`);
    }

    // ── 数据标准化 ──

    function applyNormalization() {
        const table = getTable(AppState.workbench.sourceTableId);
        if (!table) { Toast.warning('请先选择源数据表'); return; }

        const method = document.getElementById('wb-norm-method')?.value;
        if (!method) { Toast.warning('请选择标准化方法'); return; }

        let colIndices = getCheckedIndices('wb-norm-cols');
        if (colIndices.length === 0) {
            colIndices = table.headers.map((_, i) => i).filter(i => {
                return table.rows.some(row => typeof row[i] === 'number' && !isNaN(row[i]));
            });
        }

        if (colIndices.length === 0) {
            Toast.warning('没有可处理的数值列');
            return;
        }

        let processedCols = 0;

        for (const ci of colIndices) {
            const values = getColValues(table, ci);
            const validNums = values.filter(v => typeof v === 'number' && !isNaN(v));
            if (validNums.length === 0) continue;

            let results;

            switch (method) {
                case 'zscore': {
                    const mean = validNums.reduce((a, b) => a + b, 0) / validNums.length;
                    const variance = validNums.reduce((a, b) => a + (b - mean) ** 2, 0) / (validNums.length > 1 ? validNums.length - 1 : validNums.length);
                    const std = Math.sqrt(variance);
                    if (std === 0) {
                        results = values.map(v => typeof v === 'number' ? 0 : v);
                    } else {
                        results = values.map(v => typeof v === 'number' ? (v - mean) / std : v);
                    }
                    break;
                }
                case 'minmax': {
                    const min = Math.min(...validNums);
                    const max = Math.max(...validNums);
                    const range = max - min;
                    if (range === 0) {
                        results = values.map(v => typeof v === 'number' ? 0.5 : v);
                    } else {
                        results = values.map(v => typeof v === 'number' ? (v - min) / range : v);
                    }
                    break;
                }
                case 'maxabs': {
                    const maxAbs = Math.max(...validNums.map(v => Math.abs(v)));
                    if (maxAbs === 0) {
                        results = values.map(v => typeof v === 'number' ? 0 : v);
                    } else {
                        results = values.map(v => typeof v === 'number' ? v / maxAbs : v);
                    }
                    break;
                }
                case 'robust': {
                    const median = computeMedian(validNums);
                    const q1 = computePercentile(validNums, 25);
                    const q3 = computePercentile(validNums, 75);
                    const iqr = q3 - q1;
                    if (iqr === 0) {
                        results = values.map(v => typeof v === 'number' ? 0 : v);
                    } else {
                        results = values.map(v => typeof v === 'number' ? (v - median) / iqr : v);
                    }
                    break;
                }
                case 'decimal_scale': {
                    const maxAbs = Math.max(...validNums.map(v => Math.abs(v)));
                    if (maxAbs === 0) {
                        results = values.map(v => typeof v === 'number' ? 0 : v);
                    } else {
                        const divisor = Math.pow(10, Math.floor(Math.log10(maxAbs)) + 1);
                        results = values.map(v => typeof v === 'number' ? v / divisor : v);
                    }
                    break;
                }
                case 'log': {
                    const hasNonPositive = validNums.some(v => v <= 0);
                    if (hasNonPositive) {
                        Toast.warning(`列 "${table.headers[ci]}" 包含非正值，Log 变换已跳过`);
                        continue;
                    }
                    results = values.map(v => typeof v === 'number' ? Math.log(v) : v);
                    break;
                }
                default:
                    Toast.warning('未知的标准化方法');
                    return;
            }

            if (results) {
                results.forEach((v, ri) => {
                    if (typeof v === 'number' && !isFinite(v)) {
                        table.rows[ri][ci] = null;
                    } else {
                        table.rows[ri][ci] = v;
                    }
                });
                processedCols++;
            }
        }

        afterPreprocess(`标准化完成，处理了 ${processedCols} 列`);
    }

    function afterPreprocess(message) {
        updateTableData(AppState.workbench.sourceTableId,
            getTable(AppState.workbench.sourceTableId).headers,
            getTable(AppState.workbench.sourceTableId).rows
        );
        updateColumnList();
        updateFilterList();
        updateSortSelect();
        updateNewColSelects();
        updatePreprocessCols();
        refreshPreview();
        updateStatParams();
        DataManager?.renderTableList();
        window.dispatchEvent(new CustomEvent('tableschanged'));
        Toast.success(message);
    }

    window.Workbench = { init, refreshPreview, updateSourceSelect };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
