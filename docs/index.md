# SCI-Plotter 文档

> 面向科研人员的交互式绘图工具，支持浏览器直接使用或安装桌面版。

## 选择版本

| 版本 | 特点 | 适合谁 |
|------|------|--------|
| [Lite 版](getting-started/lite-guide.md) | 零安装，浏览器打开即用 | 快速出图、轻度使用、跨设备协作 |
| [Desktop 版](getting-started/desktop-guide.md) | 本地文件、统计分析、矢量导出 | 深度使用、论文出版、批量处理 |

两套版本共用前端代码，数据格式完全兼容，可随时在 Lite 与 Desktop 之间切换。

---

## 快速上手

- [5 分钟快速上手](getting-started/quick-start.md) — Lite 与 Desktop 双版本完整工作流
- [Lite 版使用指南](getting-started/lite-guide.md) — 零安装，三步完成第一张科研图
- [Desktop 版使用指南](getting-started/desktop-guide.md) — 安装、启动与完整工作流

---

## 使用手册

- [完整用户指南](user-guide.md) — 四窗口工作流的详细操作说明
- [功能特性参考](features.md) — 全部 18 种图表模板、14 种配色方案、12 种统计方法与导出格式

### 分章指南

- [数据管理](user-guide/data-management.md) — 数据导入、编辑、分析工作台与统计分析
- [图表模板](user-guide/chart-templates.md) — 18 种图表模板的数据要求、列映射与示例文件
- [样式与自定义](user-guide/styling-and-customization.md) — 配色方案、坐标轴、误差棒、趋势线
- [导出与分享](user-guide/export-and-sharing.md) — 导出格式、工作区保存/加载、版本兼容
- [主图排版](user-guide/main-figure-layout.md) — 画布设置、图层管理、对齐辅助、自动编号

---

## 版本选择与高级功能

- [Lite 版与 Desktop 版对比](features/lite-vs-desktop.md) — 详细功能对照表与选择建议
- [Desktop 版独有功能](features/desktop-features.md) — 统计分析、矢量导出、自动保存、插件系统

---

## 四窗口工作流

无论使用哪个版本，核心工作流程一致：

1. **数据管理** — 导入 CSV/Excel，编辑表格，管理多张数据表
2. **分析工作台** — 列选择、排序、过滤、缺失值处理、标准化、计算新列、统计分析
3. **子图编辑** — 选择图表模板（18 种），调整配色与标注
4. **主图排版** — 组合子图，自由拖拽缩放，添加文本与图形，最终导出

---

## 支持的图表（18 种）

| 类别 | 模板 |
|------|------|
| 基础图表 | 散点图、折线图、柱状图、直方图、面积图 |
| 分组与堆叠 | 分组柱状图、分组折线图、堆叠柱状图 |
| 统计图表 | 箱线图、小提琴图、热力图、相关矩阵 |
| 特殊图表 | 环形图、雷达图、气泡图、瀑布图、哑铃图、平行坐标图 |

每种图表都有对应的示例数据文件（`demo/` 目录），可直接导入体验。

---

## 导出格式

| 格式 | Lite | Desktop | 说明 |
|------|------|---------|------|
| 工作区备份 (`.json`) | ✅ | ✅ | 全量备份，恢复继续编辑 |
| 可编辑图 (`.spf`) | ✅ | ✅ | 自包含格式，跨设备传递 |
| PNG / JPEG | ✅ | ✅ | 支持 1x~4x DPI |
| SVG / PDF | ❌ | ✅ | 矢量图，适合论文出版 |

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存工作区 |
| `Ctrl + E` | 导出图片 |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` | 重做 |
| `Delete` | 删除选中内容 |

---

## 技术栈

| 用途 | 技术 |
|------|------|
| 图表渲染 | Apache ECharts 5.5 |
| 画布交互 | Fabric.js 5.3 |
| 桌面窗口 | PyWebView |
| 数据分析 | pandas, numpy, scipy |
| 矢量导出 | matplotlib, reportlab |

---

## 项目链接

- [项目首页](../README.md)
- [Desktop 版说明](../sci-plotter/README.md)
- [开发者指南 (AGENTS.md)](../AGENTS.md)
- [MIT 许可证](../LICENSE)
