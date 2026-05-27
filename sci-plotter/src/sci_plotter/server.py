"""可选的内置 HTTP 服务（开发模式使用）"""

import functools
import http.server
import socketserver
import threading
from pathlib import Path


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server(assets_dir: Path, port: int = 0) -> str:
    """启动静态文件服务，返回访问 URL"""
    handler = functools.partial(QuietHandler, directory=str(assets_dir))
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    actual_port = httpd.server_address[1]

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{actual_port}/"
    print(f"[server] 静态服务运行于 {url}")
    return url
