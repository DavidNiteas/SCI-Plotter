/**
 * 科研配色方案
 * 提供多种适合论文发表的配色组合
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
    return ColorSchemes[name] || ColorSchemes.academic;
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
