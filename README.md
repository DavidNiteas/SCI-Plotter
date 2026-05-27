# SCI-Plotter

> 面向科研人员的交互式绘图工具，提供 **Lite 浏览器版** 与 **Desktop 桌面版** 两种使用方式。

## 双架构方案

| 版本 | 使用方式 | 特点 | 适用场景 |
|------|---------|------|---------|
| **Lite** 🌐 | 浏览器直接打开 | 零安装，即开即用，免维护 | 快速绘图、轻度使用、跨设备 |
| **Desktop** 🖥️ | `pip install sci-plotter` | 本地文件系统、统计分析、矢量导出 | 深度使用、批量处理、高质量出版 |

两套版本**共用同一套前端代码**，数据格式完全兼容。

---

## 核心功能

- **数据管理**：支持多表管理，可导入 CSV、手动创建、编辑单元格
- **分析工作台**：列选择、排序、加减乘除计算新列、一键生成新表
- **科研配色**：内置 Nature、Science、Viridis 等经典配色
- **双画布工作流**：
  - **子图编辑**：专注单图绘制（散点、折线、柱状、箱线、热力图、直方图），支持矩形、圆形、直线、文本标注
  - **主图排版**：自由组合子图、添加文本与图形、拖拽缩放
- **版本控制**：随时暂存当前子图，保留历史快照
- **多种保存格式**：
  - **工作区备份**（`.json`）：全量备份，下次打开继续编辑
  - **可编辑图文件**（`.spf`）：自包含描述性格式，可在相同版本软件中复原
  - **PNG / JPEG**：支持 1x~4x DPI 导出
  - **SVG / PDF**（仅 Desktop）：矢量图导出，适合论文印刷

### 功能差异

| 功能 | Lite | Desktop |
|------|------|---------|
| CSV 导入/导出 | ✅ upload/download | ✅ 直接文件对话框 |
| 子图编辑 (ECharts) | ✅ | ✅ |
| 主图排版 (Fabric.js) | ✅ | ✅ |
| 工作区保存/打开 | ✅ download/upload | ✅ 直接读写 |
| 自动保存/恢复 | ❌ | ✅ |
| 统计分析 (T检验/回归) | ❌ | ✅ |
| SVG/PDF 矢量导出 | ❌ | ✅ |
| 打印到物理打印机 | ❌ | ✅ |
| 插件扩展 | ❌ | ✅ |

---

## 快速开始

### Lite 版 — 浏览器直接打开

```bash
cd sci-plotter-lite
# 直接用浏览器打开 index.html
# 或启动本地服务器
python -m http.server 8080
# 访问 http://localhost:8080
```

### Desktop 版 — pip 安装

```bash
pip install sci-plotter
sci-plotter
```

开发模式（引用外部前端资源，无需重新构建）：

```bash
cd sci-plotter
pip install -e ".[dev]"
sci-plotter --dev
```

---

## 四窗口工作流

1. **数据管理** — 导入 CSV、编辑表格、手动录入数据
2. **分析工作台** — 列选择、排序、计算新列、生成处理后数据表
3. **子图编辑** — 选择数据表和模板，绘制单图，添加标注与基本图形
4. **主图排版** — 组合子图，自由拖拽缩放，添加文本与图形，最终导出

---

## 目录结构

```
SCI-Plotter/
├── index.html                    # 🚪 门户页：引导到 Lite 或 Desktop
├── README.md                     # 本文档
├── LICENSE                       # MIT
├── AGENTS.md                     # 项目约定
├── sci-plotter-lite/              # 🌐 Lite 版本（纯前端）
│   ├── index.html                # SPA 入口
│   ├── css/                      # 样式系统
│   ├── js/                       # 前端模块
│   │   ├── bridge.js             # ← 双架构桥接层
│   │   ├── state.js              # 全局状态
│   │   ├── csv-parser.js         # CSV 解析
│   │   ├── color-schemes.js      # 科研配色
│   │   ├── export.js             # 保存/导出（适配桥接）
│   │   ├── app.js                # 应用入口
│   │   ├── ui/dock.js            # 页面切换
│   │   ├── datamanage/           # 数据管理 + 工作台
│   │   ├── subfigure/            # 子图模板 + 编辑器
│   │   └── mainfigure/           # 主图画布
│   └── demo/                     # 6 组示例 CSV 数据
│
└── sci-plotter/                   # 🖥️ Desktop 版本（Python 包）
    ├── pyproject.toml            # Hatchling 构建配置
    ├── README.md                 # Python 包文档
    ├── scripts/sync_assets.py    # 同步前端资源到 assets/
    ├── src/sci_plotter/           # Python 包
    │   ├── __init__.py
    │   ├── __main__.py           # python -m sci_plotter
    │   ├── app.py                # CLI 入口
    │   ├── gui.py                # PyWebView 窗口
    │   ├── server.py             # 内置 HTTP 服务（开发模式）
    │   ├── bridge.py             # Python ↔ JS 桥接
    │   ├── assets/               # 前端静态资源（构建时同步）
    │   └── backend/              # Python 后端
    │       ├── analysis.py       # 统计/数据分析
    │       ├── export.py         # 矢量图/PDF 导出
    │       ├── io_ops.py         # 文件系统操作
    │       └── plugins.py        # 插件系统
    └── tests/                    # pytest 单元测试
```

---

## 技术栈

### 前端（两套版本共用）

| 用途 | 依赖 | 许可证 |
|------|------|--------|
| 图表渲染 | [Apache ECharts 5.5](https://echarts.apache.org/) | Apache-2.0 |
| 画布交互 | [Fabric.js 5.3](http://fabricjs.com/) | MIT |
| 其他 | 原生 JavaScript + CSS3 | — |

### Desktop 后端

| 用途 | 依赖 |
|------|------|
| 桌面窗口 | [pywebview](https://pywebview.flowrl.com/) |
| 数据分析 | pandas, numpy, scipy |
| 矢量导出 | matplotlib, reportlab |
| 图像处理 | Pillow |

---

## 支持的图表模板

| 模板 | 说明 | CSV 要求 | Demo 文件 |
|------|------|----------|-----------|
| 散点图 | 两列数值的分布关系 | ≥2 列数值 | `demo/scatter_demo.csv` |
| 折线图 | 趋势展示，第一列作 x 轴 | ≥2 列数值 | `demo/line_demo.csv` |
| 柱状图 | 数值比较 | ≥1 列数值 + 分类列，或 ≥2 列数值 | `demo/bar_demo.csv` |
| 箱线图 | 统计分布 | ≥1 列数值 + 分类列 | `demo/boxplot_demo.csv` |
| 热力图 | 矩阵热力 | ≥3 列数值 | `demo/heatmap_demo.csv` |
| 直方图 | 频率分布 | ≥1 列数值 | `demo/histogram_demo.csv` |

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存工作区 |
| `Ctrl + E` | 导出图片 |
| `Delete` | 删除主画布选中对象 |

---

## 许可证

[MIT](LICENSE)
