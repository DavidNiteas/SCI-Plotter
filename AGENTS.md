# SCI-Plotter — Agent 开发指南

## ⚠️ 环境管理规则（最高优先级）

**本项目使用 pixi 作为唯一的环境管理工具。严禁使用全局 Python、pip、conda 或任何系统级 Python 命令。**

所有 Python 相关命令必须通过 `pixi run` 执行：

```bash
# ✅ 正确
pixi run test          # 运行 pytest
pixi run lint          # 运行 ruff check
pixi run format        # 运行 ruff format
pixi run dev           # 启动 Desktop 开发模式
pixi run python -c "..."  # 运行任意 Python 命令

# ❌ 禁止
python -m pytest       # 禁止直接调用 python
pip install ...        # 禁止直接调用 pip
conda ...              # 禁止使用 conda
pytest ...             # 禁止直接调用 pytest
ruff ...               # 禁止直接调用 ruff
```

**此规则适用于所有场景**，包括子代理（sub-agent）执行任务时。如果子代理需要使用 Python，必须通过 `pixi run` 前缀。

---

## 项目概述

SCI-Plotter 是一款面向科研人员的交互式绘图工具，采用**双架构方案**：

- **Lite 版** (`sci-plotter-lite/`)：纯前端单页应用（SPA），浏览器打开即用，零构建、零安装。
- **Desktop 版** (`sci-plotter/`)：基于 PyWebView 的 Python 桌面应用，与 Lite 版共用同一套前端代码，额外提供本地文件系统访问、统计分析、矢量导出、自动保存与插件扩展能力。

两套版本的数据格式完全兼容，用户可在 Lite 与 Desktop 之间无缝切换。

| 维度 | 信息 |
|------|------|
| 前端版本 | `1.1.0`（由 `js/state.js` 中 `AppState.version` 维护） |
| Desktop 版本 | `2.0.0`（由 `sci-plotter/pyproject.toml` 与 `sci_plotter/__init__.py` 维护） |
| 许可证 | MIT |
| 自然语言 | 项目内所有注释、UI 文案、文档均使用**中文** |

---

## 技术栈

### 前端（两套版本共用）

| 用途 | 依赖 | 版本 | 引入方式 |
|------|------|------|----------|
| 图表渲染 | Apache ECharts | 5.5.0 | CDN |
| 画布交互 | Fabric.js | 5.3.0 | CDN |
| Excel 读写 | SheetJS (xlsx) | 0.20.3 | CDN |
| 样式与逻辑 | 原生 JavaScript + CSS3 | — | 本地文件 |

**关键点**：
- 前端零构建工具、零 npm 依赖、零打包配置。
- 直接用浏览器打开 `sci-plotter-lite/index.html` 即可运行 Lite 版。
- Desktop 版通过 `pywebview` 嵌入同一套前端页面。
- `jsconfig.json` 仅用于编辑器提示，不参与任何构建。

### Desktop 后端

| 用途 | 依赖 | 最低版本 |
|------|------|----------|
| 桌面窗口 | pywebview | >=4.4 |
| 数据分析 | pandas, numpy, scipy | >=2.0, >=1.24, >=1.10 |
| 矢量导出 | matplotlib, reportlab | >=3.7, >=4.0 |
| 图像处理 | Pillow | >=10.0 |
| 编码检测 | chardet | >=5.0 |

Python 要求：`>=3.10`

---

## 目录结构

```
SCI-Plotter/
├── index.html                    # 门户页：引导用户选择 Lite 或 Desktop
├── README.md                     # 面向用户的说明文档
├── LICENSE                       # MIT
├── AGENTS.md                     # 本文件
├── pixi.toml                     # Pixi 工作区配置
├── pixi.lock                     # Pixi 锁定文件
├── start.sh                      # Linux/macOS 一键启动脚本
├── start.ps1                     # Windows 一键启动脚本
├── .gitignore
│
├── demo/                         # 18 组示例 CSV 数据
│   ├── area_demo.csv
│   ├── bar_demo.csv
│   ├── boxplot_demo.csv
│   ├── bubble_demo.csv
│   ├── correlation_matrix_demo.csv
│   ├── donut_demo.csv
│   ├── dumbbell_demo.csv
│   ├── group_bar_demo.csv
│   ├── group_line_demo.csv
│   ├── heatmap_demo.csv
│   ├── histogram_demo.csv
│   ├── line_demo.csv
│   ├── parallel_demo.csv
│   ├── radar_demo.csv
│   ├── scatter_demo.csv
│   ├── stacked_bar_demo.csv
│   ├── violin_demo.csv
│   └── waterfall_demo.csv
│
├── docs/                         # MkDocs 风格文档（Markdown）
│   ├── features.md
│   ├── features/
│   ├── getting-started/
│   ├── index.md
│   ├── user-guide.md
│   └── user-guide/
│
├── sci-plotter-lite/             # 🌐 Lite 版本（纯前端，零构建）
│   ├── index.html                # SPA 入口，按顺序加载所有 CSS/JS
│   ├── jsconfig.json             # 编辑器配置（不参与构建）
│   ├── css/
│   │   ├── base.css             # CSS 变量、重置、工具类
│   │   ├── layout.css           # 宏观布局（header、sidebar、canvas、dock）
│   │   └── components.css       # 组件样式（按钮、面板、表单、表格、图层列表等）
│   └── js/                       # IIFE 模块化 JavaScript
│       ├── state.js             # 全局状态 AppState、数据表 CRUD、快照、导入导出
│       ├── history.js           # 撤销/重做命令模式（HistoryManager）
│       ├── csv-parser.js        # 轻量级 CSV 解析器（CSVParser）
│       ├── xlsx-handler.js      # SheetJS 封装（XlsxHandler）
│       ├── color-schemes.js     # 14 种科研配色方案与 ECharts 主题生成
│       ├── export.js            # 保存/导出系统（ExportSystem）
│       ├── bridge.js            # 双架构桥接层（SciPloterBridge）
│       ├── analysis.js          # 纯 JS 统计引擎（StatAnalysis，12 种方法）
│       ├── app.js               # 应用入口：初始化各模块、键盘快捷键监听
│       ├── ui/
│       │   ├── dock.js          # 底部 Dock 栏与四窗口切换
│       │   └── toast.js         # 轻提示通知系统（Toast）
│       ├── datamanage/
│       │   ├── manager.js       # 数据管理页：导入 CSV/XLSX、新建表、单元格编辑
│       │   └── workbench.js     # 分析工作台：列选择、排序、计算新列、生成新表
│       ├── subfigure/
│       │   ├── templates.js     # 18 种图表模板
│       │   └── editor.js        # 子图编辑器：ECharts 渲染、绘图工具、暂存/发送
│       └── mainfigure/
│           └── canvas.js        # 主图画布：Fabric.js、图层、拖拽、缩放、绘图工具
│
└── sci-plotter/                  # 🖥️ Desktop 版本（Python 包）
    ├── pyproject.toml            # Hatchling 构建配置
    ├── README.md                 # Python 包文档
    ├── scripts/sync_assets.py    # 将 ../sci-plotter-lite/ 同步到 src/sci_plotter/assets/
    ├── src/sci_plotter/
    │   ├── __init__.py           # 版本号 2.0.0
    │   ├── __main__.py           # python -m sci_plotter 入口
    │   ├── app.py                # CLI 参数解析（--dev, --debug, --port）
    │   ├── gui.py                # PyWebView 窗口创建与启动
    │   ├── server.py             # 可选内置 HTTP 服务（开发模式）
    │   ├── bridge.py             # Python ↔ JS 桥接（JSBridge）
    │   ├── assets/               # 前端静态资源（构建时通过 sync_assets.py 同步）
    │   └── backend/
    │       ├── __init__.py
    │       ├── analysis.py       # 12 种统计/数据分析方法
    │       ├── export.py         # 矢量图（SVG/PDF）与 PDF 报告导出
    │       ├── io_ops.py         # 安全路径校验与目录操作
    │       └── plugins.py        # 插件系统（从 ~/.sci-plotter/plugins/ 加载）
    └── tests/                    # pytest 单元测试
        ├── __init__.py
        ├── test_analysis.py      # 覆盖 12 种统计方法
        └── test_io_ops.py        # 覆盖安全路径解析与路径遍历防护
```

---

## 架构与模块划分

### 1. 双架构桥接（`js/bridge.js` ↔ `bridge.py`）

前端通过统一对象 `SciPloterBridge` 调用能力，它会自动检测当前运行环境：

- **Lite 版**：使用 `Blob` + `<a download>` 实现文件下载，使用 `<input type="file">` + `FileReader` 实现文件上传。
- **Desktop 版**：通过 `window.pywebview.api.*` 调用 Python 端 `JSBridge` 类暴露的方法，实现原生文件对话框、自动保存、数据分析、矢量导出。

前端可通过 `SciPloterBridge.getCapabilities()` 查询当前环境支持的功能，并据此显示/隐藏 `data-desktop-only` 标记的 UI 元素。

### 2. 全局状态 (`js/state.js`)

所有模块共享一个全局对象 `AppState`，包含：
- `tables[]` — 数据表数组，每条为 `{ id, name, headers[], rows[][], createdAt, source }`
- `workbench` — 分析工作台的列选择、排序、预览状态
- `subfigure` — 子图编辑器的当前数据表、模板、ECharts 实例、样式、绘图形状
- `mainfigure` — 主图画布的 Fabric.js 实例、尺寸、背景色、图层数组
- `snapshots[]` — 全局快照库（暂存子图），支持版本控制
- `version` — 前端版本字符串 `'1.1.0'`

该文件同时提供一组全局函数：`generateId`, `createTable`, `deleteTable`, `getTable`, `renameTable`, `updateTableData`, `createSnapshot`, `deleteSnapshot`, `exportAllTables`, `importAllTables`, `exportWorkspace`, `importWorkspace`, `exportEditableFigure`, `importEditableFigure`。

### 3. 模块组织方式（前端）

每个 `.js` 文件都是一个 **IIFE（立即执行函数表达式）**，通过暴露全局对象实现模块化：

```javascript
(function() {
    // 私有作用域
    function init() { ... }
    function privateHelper() { ... }

    // 暴露公共 API 到全局
    window.SomeModule = { init, publicMethod };

    // 自动在 DOM 就绪时初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

已暴露的全局模块对象：
- `AppState` / 状态辅助函数（来自 `state.js`）
- `HistoryManager`（来自 `history.js`）
- `CSVParser`（来自 `csv-parser.js`）
- `XlsxHandler`（来自 `xlsx-handler.js`）
- `ColorSchemes` / `getColorScheme` / `getEChartsTheme`（来自 `color-schemes.js`）
- `ExportSystem`（来自 `export.js`）
- `SciPloterBridge`（来自 `bridge.js`）
- `StatAnalysis`（来自 `analysis.js`）
- `Toast`（来自 `ui/toast.js`）
- `switchPage`（来自 `ui/dock.js`）
- `DataManager`（来自 `datamanage/manager.js`）
- `Workbench`（来自 `datamanage/workbench.js`）
- `ChartTemplates` / `renderChart`（来自 `subfigure/templates.js`）
- `SubfigureEditor`（来自 `subfigure/editor.js`）
- `MainFigureCanvas`（来自 `mainfigure/canvas.js`）

### 4. 跨模块通信

不使用任何前端框架，依赖以下机制：
- **直接调用全局对象**：如 `DataManager?.renderTableList()`、`SubfigureEditor?.refreshChart()`
- **`CustomEvent` 事件**（在 `window` 上派发）：
  - `tableschanged` — 数据表增删改后广播，触发各页面下拉框刷新
  - `addsubfigure` — 子图编辑器点击“发送到主图”时触发，主图画布监听并添加图片对象
  - `pagechange` — Dock 切换页面时广播
  - `historychange` — 撤销/重做状态变化时广播
- **可选链调用**：模块间普遍使用 `?.` 避免初始化顺序问题

### 5. 页面系统

四个功能页面对应 `sci-plotter-lite/index.html` 中的四个 `<section class="page">`：

| ID | 名称 | 负责模块 |
|----|------|----------|
| `page-datamanage` | 数据管理 | `DataManager` |
| `page-workbench` | 分析工作台 | `Workbench` |
| `page-subfigure` | 子图编辑 | `SubfigureEditor` |
| `page-mainfigure` | 主图排版 | `MainFigureCanvas` |

页面切换通过添加/移除 `.hidden` 类实现，初始仅 `page-datamanage` 可见。

### 6. Python 后端模块

| 文件 | 职责 |
|------|------|
| `app.py` | 命令行入口，解析 `--version`、`--dev`（开发模式）、`--debug`（启用开发者工具）、`--port`（内置服务端口） |
| `gui.py` | 创建 PyWebView 窗口（1400×900，最小 1000×600），挂载 `JSBridge`，决定加载 `assets/index.html` 或开发模式外部路径 |
| `server.py` | 开发模式下启动静默 HTTP 静态服务（`127.0.0.1`），避免 `file://` 协议的 CORS 限制 |
| `bridge.py` | 暴露给 JS 的 API：文件对话框、读写文件、自动保存、数据分析、矢量/PDF 导出、系统信息 |
| `backend/analysis.py` | 12 种统计方法路由：`describe`、`ttest`、`correlation`、`regression`、`anova`、`chi_square`、`mann_whitney`、`wilcoxon`、`kruskal`、`multi_regression`、`normality`、`outliers` |
| `backend/export.py` | matplotlib 矢量图导出（SVG/PDF）、reportlab PDF 报告生成 |
| `backend/io_ops.py` | `safe_path` 路径越界校验（防止路径遍历）、`ensure_dir` 目录创建 |
| `backend/plugins.py` | 动态发现与加载 `~/.sci-plotter/plugins/*.py` 插件 |

---

## 构建、运行与测试

> **重要**：所有 Python 命令必须通过 `pixi run` 执行，禁止直接调用 python/pip/pytest/ruff。

### Lite 版（零构建）

```bash
cd sci-plotter-lite
# 直接打开
open index.html

# 或启动本地静态服务器（推荐，避免部分浏览器 file:// 限制）
# 可用任意静态服务器，例如 python -m http.server（需通过 pixi run python 调用）
```

### Desktop 版开发

```bash
# pixi 自动管理依赖，无需手动 pip install

# 同步前端资源（将 ../sci-plotter-lite/ 复制到 assets/）
pixi run python sci-plotter/scripts/sync_assets.py

# 以开发模式启动（直接引用外部 sci-plotter-lite 目录，无需同步）
pixi run dev

# 以开发模式启动并指定端口
pixi run python -m sci_plotter --dev --port 8080

# 启用调试模式（允许右键检查元素）
pixi run python -m sci_plotter --debug
```

### 一键启动脚本

项目根目录提供两个辅助脚本，用于自动检测 Pixi、安装环境并启动应用：
- `start.sh` — Bash 脚本（Linux/macOS）
- `start.ps1` — PowerShell 脚本（Windows）

脚本功能包括：自动检测/安装 Pixi、执行 `pixi install`、检测图形环境（无 GUI 时回退到 Lite 版 HTTP 服务器）、启动 Desktop 应用。

### 测试

- **前端**：当前**没有自动化测试套件**（无 Jest、Mocha、Playwright 等配置），依赖手动验证。
- **Python**：使用 pytest（通过 pixi）。

```bash
pixi run test            # 运行全部测试（等价于 pytest sci-plotter/tests）
```

Python 测试文件：
- `tests/test_analysis.py` — 覆盖全部 12 种统计方法（描述统计、t 检验、方差分析、相关、回归、非参检验、卡方、正态性、异常值等）以及 `run_analysis` 路由与参数缺失异常
- `tests/test_io_ops.py` — 覆盖安全路径解析与路径遍历防护

### 代码检查

Python 使用 ruff 进行 lint 与格式检查（通过 pixi），配置见 `pyproject.toml`：
- `line-length = 100`
- `target-version = "py310"`
- lint select: `["E", "F", "W", "I"]`

```bash
pixi run lint            # ruff check sci-plotter/src sci-plotter/tests
pixi run format          # ruff format sci-plotter/src sci-plotter/tests
```

---

## 代码风格指南

### 语言
- **注释、变量名、UI 字符串全部使用中文**。代码标识符（函数名、变量名）使用英文驼峰或下划线风格，如 `createTable`, `activeTableId`, `chartInstance`, `run_analysis`。

### JavaScript
- 使用 `const` / `let`，不使用 `var`。
- 字符串优先使用单引号。
- IIFE 包裹每个模块，避免污染全局命名空间（除了显式暴露的 API 对象）。
- DOM 操作前习惯性加可选链或判空，如 `document.getElementById('xxx')?.addEventListener(...)`。
- 数值转换时手动处理空字符串与 `null`：空单元格存储为 `null`，数字字符串转为 `number`。

### CSS
- 全面使用 CSS 自定义属性（变量），定义在 `css/base.css` 的 `:root` 中。
- 命名规范：
  - 颜色变量前缀 `--bg-` / `--text-` / `--border-`
  - 尺寸变量前缀 `--header-height`, `--sidebar-width`, `--radius-sm`
- 三个 CSS 文件职责分离：
  - `base.css`：变量、重置、通用工具类（`.hidden`, `.text-muted`, `.empty-tip`）
  - `layout.css`：宏观布局（header、body、sidebar、canvas、dock）
  - `components.css`：可复用组件（按钮、面板、表单、数据表格、模板卡片、工具按钮、图层/快照列表）

### HTML
- 全部内联 SVG 图标，不依赖外部图标库。
- `sci-plotter-lite/index.html` 中按依赖顺序加载脚本：
  1. `state.js`
  2. `history.js`
  3. `ui/toast.js`
  4. `bridge.js`
  5. `analysis.js`
  6. `csv-parser.js`
  7. `xlsx-handler.js`
  8. `color-schemes.js`
  9. `datamanage/manager.js`
  10. `datamanage/workbench.js`
  11. `subfigure/templates.js`
  12. `subfigure/editor.js`
  13. `mainfigure/canvas.js`
  14. `export.js`
  15. `ui/dock.js`
  16. `app.js`

### Python
- 遵循 PEP 8，行宽 100 字符。
- 模块级 docstring 使用中文。
- 类型注解：鼓励对函数参数与返回值使用类型提示（如 `def get_assets_dir() -> Path:`）。
- 导入分组：标准库 → 第三方库 → 本地模块。

---

## 数据格式与兼容性

### 数据表
- 内部存储为 `{ headers: string[], rows: any[][] }`，`null` 表示空单元格，数字自动识别为 `number` 类型。

### CSV 解析
- `CSVParser` 支持自动检测分隔符（逗号、制表符、分号、竖线），正确处理引号与转义。

### Excel 解析
- `XlsxHandler` 基于 SheetJS，支持 `.xlsx` 导入与导出。

### 导出格式

| 格式 | 说明 | 文件扩展名 | Lite | Desktop |
|------|------|------------|------|---------|
| 工作区备份 | 包含全部状态（数据表、子图、主图、快照）| `.json` | ✅ download | ✅ 直接保存 |
| 可编辑图文件 | 自包含格式，记录主图图层与所需快照 | `.spf`（实为 JSON）| ✅ download | ✅ 直接保存 |
| 全部数据表 | 仅数据表 | `.json` | ✅ download | ✅ 直接保存 |
| 单表 CSV | 当前选中表 | `.csv` | ✅ download | ✅ 直接保存 |
| 单表 XLSX | 当前选中表 | `.xlsx` | ✅ download | ✅ 直接保存 |
| 图片 | PNG / JPEG，支持 1x~4x DPI | `.png` / `.jpeg` | ✅ | ✅ |
| 矢量图 | SVG / PDF | `.svg` / `.pdf` | ❌ | ✅ |
| PDF 报告 | reportlab 生成 | `.pdf` | ❌ | ✅ |

### 版本兼容性
- `importWorkspace` 与 `importEditableFigure` 会检查 `version` 字段，版本不匹配时控制台警告但尝试兼容加载。

---

## 手动验证清单（前端）

当修改前端代码后，建议按以下流程手动验证：

1. 在数据管理页导入 `demo/` 下的示例 CSV 或 XLSX。
2. 在分析工作台选择列、排序、处理缺失值、添加计算列、生成新表。
3. 在子图编辑页切换 18 种模板，调整配色、字体、字号。
4. 使用绘图工具在子图上添加形状/文本/显著性标记。
5. 点击“暂存当前子图”与“发送到主图”。
6. 在主图排版页拖拽暂存子图到画布，添加文本/形状，调整图层、对齐、自动编号。
7. 测试导出：工作区 JSON、可编辑图文件 `.spf`、PNG/JPEG 图片。
8. 测试快捷键：`Ctrl+S` 保存工作区，`Ctrl+E` 导出图片，`Ctrl+Z/Y` 撤销/重做，`Delete` 删除主画布选中对象。
9. **Desktop 版额外验证**：文件对话框、自动保存恢复、统计分析（12 种方法）、SVG/PDF 导出、插件加载。

---

## 安全与隐私注意事项

- **纯前端运行（Lite）**：所有数据保存在浏览器内存中，无后端上传、无数据库、无用户追踪。
- **Desktop 版本地文件读写**：仅通过原生文件对话框或 `<input type="file">` 读取用户本地文件，不访问文件系统其他位置；`safe_path` 校验防止路径遍历。
- **自动保存**：Desktop 版将自动保存数据写入用户主目录下的 `~/.sci-plotter/autosave.json`。
- **插件系统**：Desktop 版动态加载 `~/.sci-plotter/plugins/*.py`，插件在用户本地运行，具备当前进程权限，**无沙箱隔离**。
- **XSS 防护**：数据表格渲染时使用 `escapeHtml` 转义文本内容；但绘图文本（`prompt` 输入）未做额外过滤，属于自包含场景。
- **跨域**：Fabric.js 加载图片时设置 `crossOrigin: 'anonymous'`，但在纯本地 `file://` 协议下可能受 CORS 限制；Desktop 开发模式通过内置 HTTP 服务规避此问题。

---

## 给 Agent 的关键提示

- **修改前端代码时**，需意识到 Desktop 版通过 `sync_assets.py` 或 `--dev` 模式引用同一套前端资源。任何 `js/` 或 `css/` 的变更同时影响 Lite 与 Desktop。
- **修改桥接 API 时**，需同步更新 `js/bridge.js` 的封装方法与 `sci_plotter/bridge.py` 的 `JSBridge` 类，并保持前后端方法名一致。
- **新增图表模板**时，在 `ChartTemplates` 对象中添加方法，并在 `index.html` 的模板网格中增加对应按钮。
- **新增配色方案**时，在 `ColorSchemes` 对象中添加定义，并在 `index.html` 的 `<select id="color-scheme">` 中增加选项。
- **若修改状态结构**，务必同步更新 `exportWorkspace()` / `importWorkspace()` 以及 `exportEditableFigure()` / `importEditableFigure()`，避免保存/加载时数据丢失。
- **不要引入需要构建工具的依赖**（如 npm 包、webpack、vite），保持项目的“零构建”特性；若必须引入新库，优先通过 CDN 在 `index.html` 中加载。
- **不要假设 GitHub Actions 工作流已存在**：当前项目根目录没有 `.github/workflows/`，若需添加 CI/CD 请从 scratch 创建。
- **不要假设 Docker 配置已存在**：当前项目无任何容器化配置。
