"""SCI-Ploter 应用入口 — CLI 参数解析与启动"""

import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="sci-ploter",
        description="SCI-Ploter — 科研绘图桌面应用",
    )
    parser.add_argument(
        "--version", action="version", version="%(prog)s 2.0.0"
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="启用调试模式（允许右键检查元素）"
    )
    parser.add_argument(
        "--dev", action="store_true",
        help="开发模式：从 ../sci-ploter-lite/ 加载前端资源"
    )
    parser.add_argument(
        "--port", type=int, default=0,
        help="内置 HTTP 服务端口（0 表示随机）"
    )
    args = parser.parse_args()

    if args.debug:
        os.environ["SCI_PLOTER_DEBUG"] = "1"
    if args.dev:
        lite_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "sci-ploter-lite")
        )
        os.environ["SCI_PLOTER_DEV"] = lite_path
        print(f"[dev] 前端资源路径: {lite_path}")

    from sci_ploter.gui import run_gui
    run_gui(port=args.port)


if __name__ == "__main__":
    main()
