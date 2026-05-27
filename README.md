# SCI-Ploter

> 面向科研人员的纯前端交互式绘图工具，浏览器即用，无需安装。

## 简介

SCI-Ploter 帮助科研人员快速制作论文级别的数据图表。采用**四窗口工作流**：

1. **数据管理** — 导入 CSV、编辑表格、手动录入数据
2. **分析工作台** — 列选择、排序、计算新列、生成处理后数据表
3. **子图编辑** — 选择数据表和模板，绘制单图，添加标注与基本图形
4. **主图排版** — 组合子图，自由拖拽缩放，添加文本与图形，最终导出

## 核心功能

- **纯前端运行**：无后端、无数据库，所有数据保存在本地浏览器
- **数据管理**：支持多表管理，可导入 CSV、手动创建、编辑单元格
- **分析工作台**：列选择、排序、加减乘除计算新列、一键生成新表
- **科研配色**：内置 Nature、Science、Viridis 等经典配色
- **双画布工作流**：
  - **子图编辑**：专注单图绘制（散点、折线、柱状、箱线、热力图、直方图），支持矩形、圆形、直线、文本标注
  - **主图排版**：自由组合子图、添加文本与图形、拖拽缩放
- **版本控制**：随时暂存当前子图，保留历史快照
- **多种保存格式**：
  - **工作区备份**：全量备份，下次打开继续编辑
  - **数据表 JSON**：导出全部数据表，一键读取
  - **单表 CSV**：导出当前选中的表为 CSV
  - **可编辑图文件**（`.spf`）：自包含描述性格式，可在相同版本软件中复原
  - **PNG / JPEG**：支持 1x~4x DPI 导出

## 快速开始

1. 克隆仓库或下载源码
2. 直接用浏览器打开 `index.html`，或部署到 GitHub Pages / Vercel / Netlify
3. 在**数据管理**页面上传 CSV 文件（`demo/` 目录下提供 6 组示例数据）
4. 切换到**分析工作台**，选择需要的列，排序或计算新列，生成处理后的表
5. 切换到**子图编辑**，选择数据表和图表模板，调整样式，点击"发送到主图"
6. 切换到**主图排版**，从左侧子图库拖拽子图到画布，添加文本和图形
7. 导出为所需格式

## 技术栈

| 用途 | 依赖 | 许可证 |
|------|------|--------|
| 图表渲染 | [Apache ECharts](https://echarts.apache.org/) | Apache-2.0 |
| 画布交互 | [Fabric.js](http://fabricjs.com/) | MIT |
| 其他 | 原生 JavaScript + CSS3 | — |

> 零构建工具，零 npm 依赖，直接运行。

## 文件结构

```
SCI-Ploter/
├── index.html                    # 应用入口
├── LICENSE                       # MIT
├── README.md                     # 本文档
├── .github/workflows/static.yml  # GitHub Pages 自动部署
├── demo/                         # 6 组示例 CSV 数据
├── css/
│   ├── base.css                 # 设计变量
│   ├── layout.css               # 布局系统
│   └── components.css           # 组件样式
└── js/
    ├── app.js                   # 应用入口与协调
    ├── state.js                 # 全局状态、数据表、快照、导出
    ├── csv-parser.js            # CSV 解析器
    ├── color-schemes.js         # 科研配色方案
    ├── export.js                # 保存/导出系统
    ├── ui/
    │   └── dock.js              # 底部 Dock 栏（4 窗口切换）
    ├── datamanage/
    │   ├── manager.js           # 数据管理：导入、编辑、导出
    │   └── workbench.js         # 分析工作台：列处理、计算、生成新表
    ├── subfigure/
    │   ├── templates.js         # 6 种图表模板
    │   └── editor.js            # 子图编辑器：数据选择、绘图工具
    └── mainfigure/
        └── canvas.js            # 主图画布：Fabric.js、图层、绘图工具
```

## 支持的图表模板

| 模板 | 说明 | CSV 要求 | Demo 文件 |
|------|------|----------|-----------|
| 散点图 | 两列数值的分布关系 | ≥2 列数值 | `demo/scatter_demo.csv` |
| 折线图 | 趋势展示，第一列作 x 轴 | ≥2 列数值 | `demo/line_demo.csv` |
| 柱状图 | 数值比较 | ≥1 列数值 + 分类列，或 ≥2 列数值 | `demo/bar_demo.csv` |
| 箱线图 | 统计分布 | ≥1 列数值 + 分类列 | `demo/boxplot_demo.csv` |
| 热力图 | 矩阵热力 | ≥3 列数值 | `demo/heatmap_demo.csv` |
| 直方图 | 频率分布 | ≥1 列数值 | `demo/histogram_demo.csv` |

### Demo 数据说明

| 文件 | 场景 |
|------|------|
| `scatter_demo.csv` | 三种处理条件下药物浓度与细胞存活率的关系 |
| `line_demo.csv` | 三种酶在 24 小时内的活性变化曲线 |
| `bar_demo.csv` | 六种纤维材料的拉伸强度与弹性模量对比 |
| `boxplot_demo.csv` | 三种药物处理下 BRCA1/TP53/EGFR 基因表达水平 |
| `heatmap_demo.csv` | 不同温度-pH 组合对反应产率的影响矩阵 |
| `histogram_demo.csv` | 纳米颗粒粒径分布（100 个样本）|

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存工作区 |
| `Ctrl + E` | 导出图片 |
| `Delete` | 删除主画布选中对象 |

## 部署到 GitHub Pages

1. 在仓库 **Settings > Pages** 中，Source 选择 "GitHub Actions"
2. 工作流文件已包含在 `.github/workflows/static.yml` 中
3. 推送到 `main` 分支即可自动部署

## 许可证

[MIT](LICENSE)
