/**
 * SciPloterBridge — 统一桥接层
 * Lite/Full 双架构共用，适配浏览器沙箱与桌面文件系统
 */

const SciPloterBridge = (function() {
    const isDesktop = typeof window !== 'undefined' && !!window.pywebview;

    async function callApi(method, ...args) {
        if (!isDesktop) throw new Error(`桌面版功能不可用: ${method}`);
        return await window.pywebview.api[method](...args);
    }

    /* ========== Lite 版 Fallback 工具 ========== */

    function liteDownloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function liteOpenFile(accept) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept || '*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    document.body.removeChild(input);
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.body.removeChild(input);
                    resolve({ name: file.name, content: ev.target.result });
                };
                reader.onerror = () => {
                    document.body.removeChild(input);
                    resolve(null);
                };
                reader.readAsText(file);
            };
            input.oncancel = () => {
                document.body.removeChild(input);
                resolve(null);
            };
            input.click();
        });
    }

    return {
        isDesktop,

        /* ========== 文件操作 ========== */

        async openWorkspace() {
            if (isDesktop) {
                const path = await callApi('open_file_dialog',
                    [{ name: '工作区/可编辑图', extensions: ['json', 'spf'] }]);
                if (!path) return null;
                const content = await callApi('read_file', path);
                return JSON.parse(content);
            }
            const file = await liteOpenFile('.json,.spf');
            return file ? JSON.parse(file.content) : null;
        },

        async saveWorkspace(data, suggestedName) {
            suggestedName = suggestedName || 'workspace.json';
            if (isDesktop) {
                const path = await callApi('save_file_dialog', suggestedName,
                    [{ name: 'JSON', extensions: ['json'] }]);
                if (path) await callApi('write_file', path, JSON.stringify(data, null, 2));
                return;
            }
            liteDownloadFile(JSON.stringify(data, null, 2), suggestedName, 'application/json');
        },

        async saveEditableFigure(data, suggestedName) {
            suggestedName = suggestedName || 'figure.spf';
            if (isDesktop) {
                const path = await callApi('save_file_dialog', suggestedName,
                    [{ name: 'SCI-Ploter 可编辑图', extensions: ['spf'] }]);
                if (path) await callApi('write_file', path, JSON.stringify(data, null, 2));
                return;
            }
            liteDownloadFile(JSON.stringify(data, null, 2), suggestedName, 'application/json');
        },

        async openEditableFigure() {
            if (isDesktop) {
                const path = await callApi('open_file_dialog',
                    [{ name: '可编辑图', extensions: ['spf'] }]);
                if (!path) return null;
                const content = await callApi('read_file', path);
                return JSON.parse(content);
            }
            const file = await liteOpenFile('.spf');
            return file ? JSON.parse(file.content) : null;
        },

        /* ========== 仅桌面版功能 ========== */

        async analyze(data, method, params) {
            params = params || {};
            if (!isDesktop) {
                alert('⚠️ 高级分析功能仅在桌面版可用\n请安装：pip install sci-ploter');
                return null;
            }
            return await callApi('analyze_data', data, method, params);
        },

        async exportVector(figureData, format) {
            if (!isDesktop) {
                alert('⚠️ ' + format.toUpperCase() + ' 导出仅在桌面版可用');
                return null;
            }
            return await callApi('export_vector', figureData, format);
        },

        async exportPDF(figureData) {
            if (!isDesktop) {
                alert('⚠️ PDF 导出仅在桌面版可用');
                return null;
            }
            return await callApi('export_pdf', figureData);
        },

        async autoSave(data) {
            if (!isDesktop) return;
            await callApi('auto_save', data);
        },

        async loadAutoSave() {
            if (!isDesktop) return null;
            return await callApi('load_auto_save');
        },

        /* ========== UI 能力检测 ========== */

        getCapabilities() {
            return {
                fileSystem: isDesktop,
                autoSave: isDesktop,
                vectorExport: isDesktop,
                pdfExport: isDesktop,
                dataAnalysis: isDesktop,
                printing: isDesktop,
                plugins: isDesktop,
            };
        }
    };
})();
