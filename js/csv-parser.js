/**
 * 轻量级 CSV 解析器
 * 支持标准 CSV 格式，自动检测分隔符，处理引号
 */

const CSVParser = {
    /**
     * 解析 CSV 文本
     * @param {string} text - CSV 文本内容
     * @param {Object} options - 配置选项
     * @returns {Object} { headers: string[], rows: any[][] }
     */
    parse(text, options = {}) {
        const delimiter = options.delimiter || this.detectDelimiter(text);
        const lines = this.splitLines(text);
        
        if (lines.length === 0) {
            return { headers: [], rows: [] };
        }

        const headers = this.parseLine(lines[0], delimiter).map(h => h.trim());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cells = this.parseLine(line, delimiter);
            
            // 尝试将数值字符串转为数字
            const typedCells = cells.map(cell => {
                const trimmed = cell.trim();
                if (trimmed === '') return null;
                const num = Number(trimmed);
                return isNaN(num) ? trimmed : num;
            });
            
            rows.push(typedCells);
        }

        return { headers, rows };
    },

    /**
     * 自动检测分隔符
     */
    detectDelimiter(text) {
        const firstLine = text.split(/\r?\n/)[0] || '';
        const candidates = [',', '\t', ';', '|'];
        let best = ',';
        let maxCount = 0;
        
        for (const delim of candidates) {
            // 转义正则特殊字符，避免 | 被解释为"或"
            const escaped = delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const count = (firstLine.match(new RegExp(escaped, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                best = delim;
            }
        }
        return best;
    },

    /**
     * 按行分割，处理不同换行符
     */
    splitLines(text) {
        return text.split(/\r?\n/);
    },

    /**
     * 解析单行 CSV，正确处理引号
     */
    parseLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // 跳过下一个引号
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    },

    /**
     * 从文件读取并解析
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = this.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    /**
     * 提取某一列数据
     */
    getColumn(data, columnNameOrIndex) {
        if (typeof columnNameOrIndex === 'number') {
            return data.rows.map(row => row[columnNameOrIndex]);
        }
        const index = data.headers.indexOf(columnNameOrIndex);
        if (index === -1) return [];
        return data.rows.map(row => row[index]);
    },

    /**
     * 按列名获取数据，自动识别数值列
     */
    getNumericColumns(data) {
        if (!data.headers.length) return [];
        const numericCols = [];
        for (let i = 0; i < data.headers.length; i++) {
            const isNumeric = data.rows.length > 0 && 
                data.rows.every(row => row[i] === null || typeof row[i] === 'number');
            if (isNumeric) numericCols.push({ name: data.headers[i], index: i });
        }
        return numericCols;
    },

    getCategoricalColumns(data) {
        if (!data.headers.length) return [];
        const catCols = [];
        for (let i = 0; i < data.headers.length; i++) {
            const isCat = data.rows.length > 0 && 
                data.rows.some(row => row[i] !== null && typeof row[i] === 'string');
            if (isCat) catCols.push({ name: data.headers[i], index: i });
        }
        return catCols;
    }
};
