# SCI-Ploter — Agent 开发指南

## 项目概述

SCI-Ploter 是一款面向科研人员的**纯前端交互式绘图工具**，采用单页应用（SPA）架构，浏览器打开即用，无需后端或构建步骤。核心工作流分为四个窗口：数据管理、分析工作台、子图编辑、主图排版。

- **版本**: `1.1.0`（由 `js/state.js` 中的 `AppState.version` 维护）
- **许可证**: MIT
- **自然语言**: 项目内所有注释、UI 文案、文档均使用**中文**。

## 技术栈

| 用途 | 依赖 | 引入方式 |
|------|------|----------|
| 图表渲染 | Apache ECharts 5.5.0 | CDN (`https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`) |
| 画布交互 | Fabric.js 5.3.0 | CDN (`https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js`) |
| 样式与逻辑 | 原生 JavaScript + CSS3 | 本地文件 |

**关键点**：
- 零构建工具、零 npm 依赖、零打包配置。
- 没有 `package.json`、`pyproject.toml`、`vite.config.js` 等构建配置文件。
- 直接用浏览器打开 `index.html` 即可运行；也可部署到 GitHub Pages / Vercel / Netlify 等静态托管服务。

## 文件结构

```
SCI-Ploter/
├── index.html                    # 应用入口，加载所有 CSS 与 JS
├── LICENSE                       # MIT
├── README.md                     # 面向用户的说明文档
├── .github/workflows/static.yml  # GitHub Pages 自动部署工作流
├── demo/                         # 6 组示例 CSV 数据
├── css/
│   ├── base.css                 # CSS 变量、重置、工具类
│   ├── layout.css               # 布局系统（header、sidebar、canvas、dock）
│   └── components.css           # 组件样式（按钮、面板、表单、表格、图层列表等）
└── js/
    ├── app.js                   # 应用入口：初始化各模块、键盘快捷键监听
    ├── state.js                 # 全局状态 AppState、数据表 CRUD、快照、导入导出
    ├── csv-parser.js            # 轻量级 CSV 解析器（CSVParser）
    ├── color-schemes.js         # 科研配色方案（ColorSchemes）与 ECharts 主题生成
    ├── export.js                # 保存/导出系统（ExportSystem）
    ├── ui/
    │   └── dock.js              # 底部 Dock 栏与四窗口切换
    ├── datamanage/
    │   ├── manager.js           # 数据管理页：导入 CSV、新建表、单元格编辑
    │   └── workbench.js         # 分析工作台：列选择、排序、计算新列、生成新表
    ├── subfigure/
    │   ├── templates.js         # 6 种图表模板（散点/折线/柱状/箱线/热力/直方）
    │   └── editor.js            # 子图编辑器：ECharts 渲染、绘图工具、暂存/发送
    └── mainfigure/
        └── canvas.js            # 主图画布：Fabric.js、图层、拖拽、缩放、绘图工具
```

## 架构与模块划分

### 1. 全局状态 (`js/state.js`)

所有模块共享一个全局对象 `AppState`，包含：
- `tables[]` — 数据表数组，每条为 `{ id, name, headers[], rows[][], createdAt, source }`
- `workbench` — 分析工作台的列选择、排序、预览状态
- `subfigure` — 子图编辑器的当前数据表、模板、ECharts 实例、样式、绘图形状
- `mainfigure` — 主图画布的 Fabric.js 实例、尺寸、背景色、图层数组
- `snapshots[]` — 全局快照库（暂存子图），支持版本控制

该文件同时提供一组全局函数：`generateId`, `createTable`, `deleteTable`, `getTable`, `renameTable`, `updateTableData`, `createSnapshot`, `deleteSnapshot`, `exportAllTables`, `importAllTables`, `exportWorkspace`, `importWorkspace`, `exportEditableFigure`, `importEditableFigure`。

### 2. 模块组织方式

每个 `.js` 文件都是一个 **IIFE（立即执行函数表达式）**，通过暴露全局对象实现模块化：

```javascript
(function() {
    // 私有作用域
    function init() { ... }
    window.SomeModule = { init, publicMethod };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

已暴露的全局模块对象：
- `AppState` / 状态辅助函数（来自 `state.js`）
- `CSVParser`（来自 `csv-parser.js`）
- `ColorSchemes` / `getColorScheme` / `getEChartsTheme`（来自 `color-schemes.js`）
- `ExportSystem`（来自 `export.js`）
- `switchPage`（来自 `ui/dock.js`）
- `DataManager`（来自 `datamanage/manager.js`）
- `Workbench`（来自 `datamanage/workbench.js`）
- `ChartTemplates` / `renderChart`（来自 `subfigure/templates.js`）
- `SubfigureEditor`（来自 `subfigure/editor.js`）
- `MainFigureCanvas`（来自 `mainfigure/canvas.js`）

### 3. 跨模块通信

不使用任何前端框架，依赖以下机制：
- **直接调用全局对象**：如 `DataManager?.renderTableList()`、`SubfigureEditor?.refreshChart()`
- **CustomEvent 事件**：
  - `tableschanged` — 数据表增删改后广播，触发各页面下拉框刷新
  - `addsubfigure` — 子图编辑器点击“发送到主图”时触发，主图画布监听并添加图片对象
  - `pagechange` — Dock 切换页面时广播
- **可选链调用**：模块间普遍使用 `?.` 避免初始化顺序问题

### 4. 页面系统

四个功能页面对应 `index.html` 中的四个 `<section class="page">`：

| ID | 名称 | 负责模块 |
|----|------|----------|
| `page-datamanage` | 数据管理 | `DataManager` |
| `page-workbench` | 分析工作台 | `Workbench` |
| `page-subfigure` | 子图编辑 | `SubfigureEditor` |
| `page-mainfigure` | 主图排版 | `MainFigureCanvas` |

页面切换通过添加/移除 `.hidden` 类实现，初始仅 `page-datamanage` 可见。

## 代码风格指南

### 语言
- **注释、变量名、UI 字符串全部使用中文**。例如：`function 创建快照()` 并不常见，但注释和 UI 文本一定是中文。
- 代码标识符（函数名、变量名）使用英文驼峰或下划线风格，如 `createTable`, `activeTableId`, `chartInstance`。

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
- `index.html` 中按依赖顺序加载脚本：
  1. `state.js`
  2. `csv-parser.js`
  3. `color-schemes.js`
  4. `datamanage/manager.js`
  5. `datamanage/workbench.js`
  6. `subfigure/templates.js`
  7. `subfigure/editor.js`
  8. `mainfigure/canvas.js`
  9. `export.js`
  10. `ui/dock.js`
  11. `app.js`

## 构建与运行

### 本地开发
无需任何安装步骤：

```bash
# 直接用浏览器打开
open index.html

# 或启动任意静态服务器（可选）
python -m http.server 8080
npx serve .
```

### 部署
- **GitHub Pages**：仓库已包含 `.github/workflows/static.yml`，推送到 `main` 分支即自动部署。需在仓库 Settings > Pages 中将 Source 设为 "GitHub Actions"。
- **其他静态托管**：直接上传仓库根目录即可，无构建产物。

## 测试策略

当前项目**没有自动化测试套件**（无 Jest、Mocha、Playwright 等配置）。

测试依赖**手动验证**：
1. 在数据管理页导入 `demo/` 下的示例 CSV。
2. 在分析工作台选择列、排序、添加计算列、生成新表。
3. 在子图编辑页切换 6 种模板，调整配色、字体、字号。
4. 使用绘图工具在子图上添加形状/文本。
5. 点击“暂存当前子图”与“发送到主图”。
6. 在主图排版页拖拽暂存子图到画布，添加文本/形状，调整图层。
7. 测试导出：工作区 JSON、可编辑图文件 `.spf`、PNG/JPEG 图片。
8. 测试快捷键：`Ctrl+S` 保存工作区，`Ctrl+E` 导出图片，`Delete` 删除主画布选中对象。

## 数据格式与兼容性

### 数据表
- 内部存储为 `{ headers: string[], rows: any[][] }`，`null` 表示空单元格，数字自动识别为 `number` 类型。

### CSV 解析
- `CSVParser` 支持自动检测分隔符（逗号、制表符、分号、竖线），正确处理引号与转义。

### 导出格式
| 格式 | 说明 | 文件扩展名 |
|------|------|------------|
| 工作区备份 | 包含全部状态（数据表、子图、主图、快照）| `.json` |
| 可编辑图文件 | 自包含格式，记录主图图层与所需快照 | `.spf`（实为 JSON）|
| 全部数据表 | 仅数据表 | `.json` |
| 单表 CSV | 当前选中表 | `.csv` |
| 图片 | PNG / JPEG，支持 1x~4x DPI | `.png` / `.jpeg` |

### 版本兼容性
- `importWorkspace` 与 `importEditableFigure` 会检查 `version` 字段，版本不匹配时控制台警告但尝试兼容加载。

## 安全与隐私注意事项

- **纯前端运行**：所有数据保存在浏览器内存中，无后端上传、无数据库、无用户追踪。
- **本地文件读写**：仅通过 `<input type="file">` 与 `FileReader` 读取用户本地文件，不访问文件系统其他位置。
- **XSS 防护**：数据表格渲染时使用 `escapeHtml` 转义文本内容；但绘图文本（`prompt` 输入）未做额外过滤，属于自包含场景。
- **跨域**：Fabric.js 加载图片时设置 `crossOrigin: 'anonymous'`，但在纯本地 `file://` 协议下可能受 CORS 限制。

## 给 Agent 的关键提示

- 修改任何模块时，注意其暴露的全局 API 是否被其他模块调用（如 `DataManager.renderTableList()` 在 `export.js`、`workbench.js` 中均有调用）。
- 新增图表模板时，在 `ChartTemplates` 对象中添加方法，并在 `index.html` 的模板网格中增加对应按钮。
- 新增配色方案时，在 `ColorSchemes` 对象中添加定义，并在 `index.html` 的 `<select id="color-scheme">` 中增加选项。
- 若修改状态结构，务必同步更新 `exportWorkspace()` / `importWorkspace()` 以及 `exportEditableFigure()` / `importEditableFigure()`，避免保存/加载时数据丢失。
- 不要引入需要构建工具的依赖（如 npm 包、webpack、vite），保持项目的“零构建”特性；若必须引入新库，优先通过 CDN 在 `index.html` 中加载。
