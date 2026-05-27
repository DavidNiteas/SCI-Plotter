/**
 * Excel (.xlsx) 导入/导出处理器
 * 基于 SheetJS (xlsx) 库，支持多工作表导入与单表/多表导出
 */

(function() {
    function isAvailable() {
        return typeof XLSX !== 'undefined';
    }

    function parseWorkbook(workbook) {
        const sheets = [];
        workbook.SheetNames.forEach(name => {
            const worksheet = workbook.Sheets[name];
            const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            if (aoa.length === 0) return;

            const headers = aoa[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
            const rows = [];

            for (let i = 1; i < aoa.length; i++) {
                const rawRow = aoa[i];
                if (!rawRow || rawRow.every(cell => cell === null || cell === undefined || cell === '')) continue;

                const typedRow = [];
                for (let j = 0; j < headers.length; j++) {
                    const cell = j < rawRow.length ? rawRow[j] : null;
                    if (cell === null || cell === undefined || cell === '') {
                        typedRow.push(null);
                    } else if (typeof cell === 'number') {
                        typedRow.push(cell);
                    } else {
                        const s = String(cell);
                        const num = Number(s);
                        typedRow.push(s !== '' && !isNaN(num) ? num : s);
                    }
                }
                rows.push(typedRow);
            }

            if (headers.some(h => h !== '') || rows.length > 0) {
                sheets.push({ sheetName: name, headers, rows });
            }
        });
        return sheets;
    }

    async function parseFile(file) {
        if (!isAvailable()) throw new Error('SheetJS 库未加载');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(parseWorkbook(workbook));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    function buildWorksheet(table) {
        const aoa = [table.headers];
        table.rows.forEach(row => {
            aoa.push(row.map(cell => (cell === null ? '' : cell)));
        });
        return XLSX.utils.aoa_to_sheet(aoa);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.getElementById('download-link');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function exportTable(table, filename) {
        if (!isAvailable()) throw new Error('SheetJS 库未加载');
        const wb = XLSX.utils.book_new();
        const ws = buildWorksheet(table);
        XLSX.utils.book_append_sheet(wb, ws, table.name.slice(0, 31) || 'Sheet1');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, filename || `${table.name}.xlsx`);
    }

    function exportAllTables(tables, filename) {
        if (!isAvailable()) throw new Error('SheetJS 库未加载');
        if (!tables || tables.length === 0) return;
        const wb = XLSX.utils.book_new();
        const usedNames = new Set();

        tables.forEach(table => {
            let sheetName = (table.name || 'Sheet').slice(0, 31);
            let finalName = sheetName;
            let counter = 1;
            while (usedNames.has(finalName)) {
                const suffix = '_' + counter;
                finalName = sheetName.slice(0, 31 - suffix.length) + suffix;
                counter++;
            }
            usedNames.add(finalName);

            const ws = buildWorksheet(table);
            XLSX.utils.book_append_sheet(wb, ws, finalName);
        });

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, filename || `SCI-Plotter-Tables-${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    window.XlsxHandler = {
        isAvailable,
        parseFile,
        exportTable,
        exportAllTables,
    };
})();
