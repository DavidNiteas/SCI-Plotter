/**
 * 科研配色方案
 * 提供多种适合论文发表的配色组合，支持自定义配色
 */

const ColorSchemes = {
    academic: {
        name: '学术蓝',
        colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e40af', '#1d4ed8'],
        background: '#ffffff',
        text: '#1f2937',
        grid: '#e5e7eb',
    },
    nature: {
        name: 'Nature',
        colors: ['#e15759', '#4e79a7', '#59a14f', '#edc948', '#b07aa1', '#9c755f', '#bab0ac', '#76b7b2', '#ff9da7'],
        background: '#ffffff',
        text: '#000000',
        grid: '#f0f0f0',
    },
    science: {
        name: 'Science',
        colors: ['#d62728', '#1f77b4', '#2ca02c', '#ff7f0e', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'],
        background: '#ffffff',
        text: '#000000',
        grid: '#eeeeee',
    },
    viridis: {
        name: 'Viridis',
        colors: ['#440154', '#31688e', '#35b779', '#fde725', '#21918c', '#443983', '#90d743'],
        background: '#fafafa',
        text: '#1a1a1a',
        grid: '#e8e8e8',
    },
    warm: {
        name: '暖色',
        colors: ['#c0392b', '#e74c3c', '#d35400', '#e67e22', '#f39c12', '#f1c40f', '#e74c3c'],
        background: '#fffbf5',
        text: '#2c3e50',
        grid: '#f0e6d3',
    },
    cool: {
        name: '冷色',
        colors: ['#2c3e50', '#34495e', '#1abc9c', '#16a085', '#2980b9', '#3498db', '#9b59b6'],
        background: '#f5f8fa',
        text: '#2c3e50',
        grid: '#e0e8ef',
    },
    pastel: {
        name: '柔和色',
        colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#eecbff', '#ffcba4'],
        background: '#ffffff',
        text: '#555555',
        grid: '#f5f5f5',
    },
    monochrome: {
        name: '黑白',
        colors: ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd'],
        background: '#ffffff',
        text: '#000000',
        grid: '#eeeeee',
    },
    seaborn: {
        name: 'Seaborn',
        colors: ['#4c72b0', '#dd8452', '#55a868', '#c44e52', '#8172b3', '#937860', '#da8bc3', '#8c8c8c', '#ccb974', '#64b5cd'],
        background: '#fafafa',
        text: '#333333',
        grid: '#e0e0e0',
    },
    lancet: {
        name: 'Lancet',
        colors: ['#00468b', '#ed5565', '#48a9a6', '#f4a261', '#8b5e3c', '#6d6875', '#b5838d', '#e5989b', '#ffb4a2'],
        background: '#ffffff',
        text: '#1a1a1a',
        grid: '#e8e8e8',
    },
    jama: {
        name: 'JAMA',
        colors: ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477', '#66aa00', '#b82e2e'],
        background: '#ffffff',
        text: '#000000',
        grid: '#f0f0f0',
    },
    cell: {
        name: 'Cell',
        colors: ['#1f78b4', '#33a02c', '#e31a1c', '#ff7f00', '#6a3d9a', '#b15928', '#a6cee3', '#b2df8a', '#fb9a99'],
        background: '#ffffff',
        text: '#000000',
        grid: '#eeeeee',
    },
    tableau10: {
        name: 'Tableau 10',
        colors: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
        background: '#ffffff',
        text: '#333333',
        grid: '#e6e6e6',
    },
    okabe_ito: {
        name: 'Okabe-Ito (色盲友好)',
        colors: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#000000', '#999999'],
        background: '#ffffff',
        text: '#000000',
        grid: '#eeeeee',
    },
};

function getColorScheme(name) {
    if (ColorSchemes[name]) {
        return ColorSchemes[name];
    }
    if (AppState?.customPalettes?.[name]) {
        return AppState.customPalettes[name];
    }
    return ColorSchemes.academic;
}

function getEChartsTheme(schemeName) {
    const s = getColorScheme(schemeName);
    return {
        color: s.colors,
        backgroundColor: 'transparent',
        textStyle: {
            color: s.text,
            fontFamily: AppState?.subfigure?.fontFamily || 'Arial, sans-serif',
        },
        title: {
            textStyle: { color: s.text },
            subtextStyle: { color: s.text },
        },
        legend: {
            textStyle: { color: s.text },
        },
        tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: s.grid,
            textStyle: { color: s.text },
        },
        categoryAxis: {
            axisLine: { lineStyle: { color: s.grid } },
            axisTick: { lineStyle: { color: s.grid } },
            axisLabel: { color: s.text },
            splitLine: { lineStyle: { color: s.grid } },
        },
        valueAxis: {
            axisLine: { lineStyle: { color: s.grid } },
            axisTick: { lineStyle: { color: s.grid } },
            axisLabel: { color: s.text },
            splitLine: { lineStyle: { color: s.grid } },
        },
    };
}

// ===== 颜色工具函数 =====

/**
 * 将十六进制颜色字符串解析为 {r, g, b}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
}

/**
 * 将 {r, g, b} 转换为十六进制颜色字符串
 */
function rgbToHex(r, g, b) {
    const toHex = (c) => {
        const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 在两个颜色之间进行线性插值
 */
function interpolateColor(color1, color2, ratio) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    return rgbToHex(
        c1.r + (c2.r - c1.r) * ratio,
        c1.g + (c2.g - c1.g) * ratio,
        c1.b + (c2.b - c1.b) * ratio
    );
}

/**
 * 从配色方案生成连续渐变颜色数组
 * @param {string} schemeName - 配色方案名称
 * @param {number} steps - 需要的颜色阶数（>=2）
 * @returns {string[]} 渐变颜色数组
 */
function generateGradientFromScheme(schemeName, steps) {
    const scheme = getColorScheme(schemeName);
    const colors = scheme.colors;
    if (!colors || colors.length === 0) {
        return Array(steps).fill('#999999');
    }
    if (steps <= 1) {
        return [colors[0]];
    }

    const result = [];
    for (let i = 0; i < steps; i++) {
        const position = i / (steps - 1);
        const scaledPosition = position * (colors.length - 1);
        const index = Math.floor(scaledPosition);
        const ratio = scaledPosition - index;

        if (index >= colors.length - 1) {
            result.push(colors[colors.length - 1]);
        } else {
            result.push(interpolateColor(colors[index], colors[index + 1], ratio));
        }
    }
    return result;
}

/**
 * 从配色方案生成分发散变颜色数组（用于相关性矩阵等）
 * 中间色为 scheme.background 或白色，两端为 scheme 的极值色
 * @param {string} schemeName - 配色方案名称
 * @param {number} steps - 需要的颜色阶数（>=3，默认7）
 * @returns {string[]} 发散渐变颜色数组
 */
function generateDivergingGradient(schemeName, steps) {
    const scheme = getColorScheme(schemeName);
    const colors = scheme.colors;
    const midColor = scheme.background || '#ffffff';

    if (!colors || colors.length < 2) {
        return ['#2166ac', '#67a9cf', '#d1e5f0', midColor, '#fddbc7', '#ef8a62', '#b2182b'];
    }

    steps = Math.max(3, steps || 7);
    const half = Math.floor(steps / 2);
    const result = [];

    // 左侧：从第一个颜色到中间色
    for (let i = 0; i < half; i++) {
        const ratio = i / Math.max(1, half - 1);
        result.push(interpolateColor(colors[0], midColor, ratio));
    }

    // 中间色
    if (steps % 2 === 1) {
        result.push(midColor);
    }

    // 右侧：从中间色到第二个颜色（或最后一个颜色）
    const rightEnd = colors.length > 1 ? colors[1] : colors[0];
    for (let i = half - 1; i >= 0; i--) {
        const ratio = i / Math.max(1, half - 1);
        result.push(interpolateColor(rightEnd, midColor, ratio));
    }

    return result;
}

/**
 * 获取指定数量的分类颜色，支持循环取色
 * @param {string} schemeName - 配色方案名称
 * @param {number} count - 需要的颜色数量
 * @returns {string[]} 颜色数组
 */
function getCategoricalColors(schemeName, count) {
    const scheme = getColorScheme(schemeName);
    const colors = scheme.colors || [];
    if (colors.length === 0) return Array(count).fill('#999999');

    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

// ===== 自定义配色管理 =====

/**
 * 获取所有可用配色方案（内置 + 自定义）
 * @returns {Object} 合并后的配色对象
 */
function getAllColorSchemes() {
    const custom = AppState?.customPalettes || {};
    return { ...ColorSchemes, ...custom };
}

/**
 * 基于现有配色方案创建自定义配色
 * @param {string} name - 自定义配色名称
 * @param {string} baseSchemeName - 基于的内置配色名称
 * @returns {Object|null} 新创建的配色对象
 */
function createCustomPalette(name, baseSchemeName) {
    const base = getColorScheme(baseSchemeName);
    const id = 'custom_' + (++AppState.customPaletteCounter) + '_' + Date.now().toString(36);
    const palette = {
        id,
        name: name || `自定义配色 ${AppState.customPaletteCounter}`,
        colors: [...base.colors],
        background: base.background,
        text: base.text,
        grid: base.grid,
        createdAt: Date.now(),
    };
    AppState.customPalettes[id] = palette;
    return palette;
}

/**
 * 更新自定义配色
 * @param {string} id - 配色ID
 * @param {Object} updates - 更新内容
 * @returns {Object|null} 更新后的配色对象
 */
function updateCustomPalette(id, updates) {
    const palette = AppState?.customPalettes?.[id];
    if (!palette) return null;
    Object.assign(palette, updates);
    return palette;
}

/**
 * 删除自定义配色
 * @param {string} id - 配色ID
 * @returns {boolean} 是否删除成功
 */
function deleteCustomPalette(id) {
    if (!AppState?.customPalettes?.[id]) return false;
    delete AppState.customPalettes[id];
    // 如果当前正在使用被删除的配色，回退到 academic
    if (AppState?.subfigure?.colorScheme === id) {
        AppState.subfigure.colorScheme = 'academic';
    }
    return true;
}

/**
 * 导出自定义配色为JSON对象
 * @param {string} id - 配色ID
 * @returns {Object|null}
 */
function exportCustomPalette(id) {
    const palette = AppState?.customPalettes?.[id];
    if (!palette) return null;
    return {
        format: 'sci-plotter-palette',
        version: AppState?.version || '1.1.0',
        exportedAt: Date.now(),
        palette: JSON.parse(JSON.stringify(palette)),
    };
}

/**
 * 从JSON对象导入自定义配色
 * @param {Object} data - JSON数据
 * @returns {Object|null} 导入的配色对象
 */
function importCustomPalette(data) {
    if (!data || data.format !== 'sci-plotter-palette' || !data.palette) {
        return null;
    }
    const imported = data.palette;
    const id = 'custom_' + (++AppState.customPaletteCounter) + '_' + Date.now().toString(36);
    const palette = {
        id,
        name: imported.name || `导入配色 ${AppState.customPaletteCounter}`,
        colors: Array.isArray(imported.colors) ? [...imported.colors] : ['#2563eb', '#3b82f6'],
        background: imported.background || '#ffffff',
        text: imported.text || '#1f2937',
        grid: imported.grid || '#e5e7eb',
        createdAt: Date.now(),
    };
    AppState.customPalettes[id] = palette;
    return palette;
}

/**
 * 将配色方案中的所有颜色按数据点方式应用（用于单系列多色）
 * @param {string} schemeName - 配色方案名称
 * @param {number} dataLength - 数据点数量
 * @returns {Function} ECharts itemStyle.color 回调函数
 */
function getDataPointColorCallback(schemeName, dataLength) {
    const scheme = getColorScheme(schemeName);
    const colors = scheme.colors || ['#999999'];
    return function(params) {
        return colors[params.dataIndex % colors.length];
    };
}

window.getColorScheme = getColorScheme;
window.getEChartsTheme = getEChartsTheme;
window.ColorSchemes = ColorSchemes;
window.generateGradientFromScheme = generateGradientFromScheme;
window.generateDivergingGradient = generateDivergingGradient;
window.getCategoricalColors = getCategoricalColors;
window.getAllColorSchemes = getAllColorSchemes;
window.createCustomPalette = createCustomPalette;
window.updateCustomPalette = updateCustomPalette;
window.deleteCustomPalette = deleteCustomPalette;
window.exportCustomPalette = exportCustomPalette;
window.importCustomPalette = importCustomPalette;
window.getDataPointColorCallback = getDataPointColorCallback;
window.hexToRgb = hexToRgb;
window.rgbToHex = rgbToHex;
window.interpolateColor = interpolateColor;
