# SCI-Ploter Desktop

基于 PyWebView 的科研绘图桌面应用，与 SCI-Ploter-Lite 共用前端代码，提供本地文件系统访问、统计分析、矢量导出等增强功能。

## 安装

```bash
pip install sci-ploter
```

## 使用

```bash
# 启动桌面应用
sci-ploter

# 或
python -m sci_ploter
```

## 开发

```bash
cd sci-ploter

# 安装开发依赖
pip install -e ".[dev]"

# 同步前端资源（从 ../sci-ploter-lite/）
python scripts/sync_assets.py

# 以开发模式启动（引用外部 lite 目录，无需同步）
SCI_PLOTER_DEV=../sci-ploter-lite python -m sci_ploter

# 运行测试
pytest
```

## 功能对比

| 功能 | Lite (浏览器) | Full (桌面版) |
|------|--------------|--------------|
| CSV 导入/导出 | ✅ | ✅ |
| 子图编辑 (ECharts) | ✅ | ✅ |
| 主图排版 (Fabric.js) | ✅ | ✅ |
| 工作区保存/打开 | 下载/上传 | 直接文件对话框 |
| 自动保存/恢复 | ❌ | ✅ |
| 统计分析 (T检验/回归) | ❌ | ✅ |
| SVG/PDF 矢量导出 | ❌ | ✅ |
| 打印到物理打印机 | ❌ | ✅ |
| 插件扩展 | ❌ | ✅ |
