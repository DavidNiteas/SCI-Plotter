# Desktop 版使用指南

> 基于 PyWebView 的桌面应用，提供本地文件系统、统计分析、矢量导出等增强功能。

## 安装

**要求：** Python >= 3.10

```bash
pip install sci-plotter
```

安装后自动获取所有依赖（pywebview、pandas、numpy、scipy、matplotlib、reportlab、Pillow、chardet）。

---

## 启动

```bash
sci-plotter
```

或：

```bash
python -m sci_plotter
```

启动后会打开一个桌面窗口（默认 1400×900），界面与 Lite 版一致。

---

## 与 Lite 版的区别

Desktop 版与 Lite 版共用同一套前端界面，四窗口工作流完全相同。以下是 Desktop 版独有的功能：

| 功能 | Lite | Desktop |
|------|------|---------|
| CSV / Excel 导入导出 | 浏览器上传下载 | 系统原生文件对话框 |
| 自动保存/恢复 | ❌ | ✅ |
| 统计分析 | JS 引擎 | Python 后端（scipy/pandas） |
| SVG/PDF 矢量导出 | ❌ | ✅ |
| PDF 报告生成 | ❌ | ✅ |
| 打印到物理打印机 | ❌ | ✅ |
| 插件扩展 | ❌ | ✅ |

详细对比请参阅 [Lite 版与 Desktop 版对比](../features/lite-vs-desktop.md)。

---

## 完整工作流

### 1. 数据管理 — 原生文件对话框

Desktop 版的**「导入 CSV」**按钮会弹出系统原生文件选择对话框，无需通过 `<input>` 上传。

**额外支持的导入/导出格式：**
- 导入：CSV、Excel (`.xlsx`)
- 导出：CSV、Excel、JSON（全部数据表）

### 2. 分析工作台 — 统计分析

Desktop 版的分析工作台提供完整的统计分析能力：

| 方法 | 说明 |
|------|------|
| 描述性统计 | 均值、标准差、最小/最大值、四分位数 |
| 独立样本 t 检验 | 两组数据均值差异检验 |
| Mann-Whitney U 检验 | 非参数两组差异检验 |
| Wilcoxon 符号秩检验 | 配对样本非参数检验 |
| 单因素方差分析 (ANOVA) | 多组均值比较 |
| Kruskal-Wallis 检验 | 非参数多组比较 |
| 卡方独立性检验 | 分类变量关联检验 |
| 简单线性回归 | 单自变量线性拟合 |
| 多元线性回归 | 多自变量线性拟合 |
| 相关矩阵 | 变量间相关系数 |
| 正态性检验 | 数据正态性评估 |
| 异常值检测 | 基于 IQR 或 Z-score 识别异常值 |

分析结果同时提供**表格视图**和**图表视图**，图表可直接暂存到快照库用于后续排版。

### 3. 自动保存与恢复

Desktop 版会将工作区自动保存到 `~/.sci-plotter/autosave.json`。下次启动时如有未保存的修改，会自动提示恢复。

### 4. 矢量导出

Desktop 版独享的导出能力：

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| SVG | 可缩放矢量图形 | 网页嵌入、矢量编辑器二次修改 |
| PDF | PDF 矢量图 | 论文投稿、印刷出版 |
| PDF 报告 | 包含图表与说明的完整报告 | 成果汇报、文档归档 |

详细导出说明请参阅 [Desktop 版独有功能](../features/desktop-features.md)。

### 5. 插件扩展

Desktop 版支持通过 Python 插件扩展功能：

1. 在用户主目录创建插件文件夹：`~/.sci-plotter/plugins/`
2. 将 `.py` 文件放入该目录
3. 启动时自动加载所有插件

---

## 开发模式

如果从源码开发或调试前端资源：

```bash
sci-plotter --dev
sci-plotter --debug
sci-plotter --dev --port 8080
```

**pixi 用户**（项目内开发）：

```bash
pixi run dev
```

---

## 命令行参数

| 参数 | 说明 |
|------|------|
| `--version` | 显示版本号 |
| `--dev` | 开发模式，从 `../sci-plotter-lite/` 加载前端资源 |
| `--debug` | 调试模式，允许右键检查元素 |
| `--port PORT` | 指定内置 HTTP 服务端口（0 为随机） |

---

## 工作区管理

| 操作 | 方式 |
|------|------|
| 保存工作区 | `Ctrl + S`，弹出系统保存对话框，保存为 `.json` |
| 打开工作区 | 点击「打开工作区」，弹出系统打开对话框 |
| 自动保存 | 自动执行，无需手动操作 |
| 导出数据 | `Ctrl + E`，支持 PNG/JPEG/SVG/PDF |

工作区文件（`.json`、`.spf`）与 Lite 版完全兼容，可互相打开。

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存工作区 |
| `Ctrl + E` | 导出图片 |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` | 重做 |
| `Ctrl + F` | 查找替换（数据管理页） |
| `Ctrl + C / V / X` | 复制 / 粘贴 / 剪切 |
| `Ctrl + A` | 全选 |
| `Delete` | 删除选中内容 |

---

## 下一步

- 了解 [Lite 版](lite-guide.md) 以便在无需安装的环境快速使用
- [Lite 版与 Desktop 版对比](../features/lite-vs-desktop.md) — 详细功能差异
- [Desktop 版独有功能](../features/desktop-features.md) — 深入了解高级功能
- 返回 [文档首页](../index.md)
