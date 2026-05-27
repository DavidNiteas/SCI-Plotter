"""PyWebView 桌面窗口管理"""

import os
import sys
from pathlib import Path


def get_assets_dir() -> Path:
    """获取前端资源目录"""
    dev_path = os.environ.get("SCI_PLOTTER_DEV")
    if dev_path:
        p = Path(dev_path)
        if p.exists():
            return p
        print(f"[警告] 开发路径不存在: {dev_path}，回退到包内资源")

    pkg_dir = Path(__file__).parent
    return pkg_dir / "assets"


def run_gui(port: int = 0):
    """启动桌面 GUI"""
    import webview

    from sci_plotter.bridge import JSBridge

    assets_dir = get_assets_dir()
    index_html = assets_dir / "index.html"

    if not index_html.exists():
        print(
            f"错误: 前端资源未找到: {index_html}\n"
            f"请运行: python scripts/sync_assets.py\n"
            f"或以开发模式启动: sci-plotter --dev"
        )
        sys.exit(1)

    auto_save_dir = Path.home() / ".sci-plotter"
    bridge = JSBridge(app_dir=assets_dir, auto_save_dir=auto_save_dir)

    url = str(index_html)
    if port > 0 or os.environ.get("SCI_PLOTTER_DEV"):
        from sci_plotter.server import start_server
        url = start_server(assets_dir, port)

    window = webview.create_window(
        title="SCI-Plotter Desktop — 科研绘图工具",
        url=url,
        width=1400,
        height=900,
        min_size=(1000, 600),
        text_select=True,
    )
    window.expose(
        bridge.open_file_dialog,
        bridge.save_file_dialog,
        bridge.read_file,
        bridge.write_file,
        bridge.auto_save,
        bridge.load_auto_save,
        bridge.analyze_data,
        bridge.export_vector,
        bridge.export_pdf,
        bridge.get_system_info,
    )

    debug = bool(os.environ.get("SCI_PLOTTER_DEBUG"))
    webview.start(debug=debug)
