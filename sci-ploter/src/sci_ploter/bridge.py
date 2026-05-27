"""Python ↔ JavaScript API 桥接

前端通过 window.pywebview.api.* 调用此处暴露的所有 public 方法。
"""

import json
import os
import sys
from pathlib import Path


class JSBridge:
    """暴露给 JavaScript 调用的 Python API"""

    def __init__(self, app_dir: Path, auto_save_dir: Path):
        self.app_dir = app_dir
        self.auto_save_dir = auto_save_dir
        self.auto_save_dir.mkdir(parents=True, exist_ok=True)
        self._recent_files: list[str] = []

    # ── 文件对话框 ──

    def open_file_dialog(self, file_types=None):
        """打开文件选择对话框，返回文件路径"""
        import webview
        ft = file_types or []
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG, file_types=ft
        )
        return result[0] if result else None

    def save_file_dialog(self, suggested_name: str, file_types=None):
        """保存文件对话框，返回文件路径"""
        import webview
        ft = file_types or []
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG, save_filename=suggested_name, file_types=ft
        )
        return result

    def read_file(self, filepath: str) -> str:
        """读取文本文件"""
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    def write_file(self, filepath: str, content: str):
        """写入文本文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        self._add_recent(filepath)

    def _add_recent(self, filepath: str):
        if filepath in self._recent_files:
            self._recent_files.remove(filepath)
        self._recent_files.insert(0, filepath)
        self._recent_files = self._recent_files[:20]

    # ── 自动保存 ──

    def auto_save(self, data: dict):
        """自动保存工作区到用户数据目录"""
        path = self.auto_save_dir / "autosave.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def load_auto_save(self):
        """加载自动保存的工作区"""
        path = self.auto_save_dir / "autosave.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # ── 数据分析 ──

    def analyze_data(self, table_data: dict, method: str, params: dict):
        """执行统计/数据分析"""
        import pandas as pd
        from sci_ploter.backend.analysis import run_analysis

        df = pd.DataFrame(table_data["rows"], columns=table_data["headers"])
        return run_analysis(df, method, params)

    # ── 高级导出 ──

    def export_vector(self, figure_data: dict, fmt: str):
        """导出矢量图，返回保存的文件路径"""
        from sci_ploter.backend.export import export_as_vector

        path = self.save_file_dialog(
            f"figure.{fmt}", [{"name": fmt.upper(), "extensions": [fmt]}]
        )
        if path:
            export_as_vector(figure_data, fmt, path)
        return path

    def export_pdf(self, figure_data: dict):
        """导出 PDF 报告，返回保存的文件路径"""
        from sci_ploter.backend.export import export_as_pdf

        path = self.save_file_dialog(
            "figure.pdf", [{"name": "PDF", "extensions": ["pdf"]}]
        )
        if path:
            export_as_pdf(figure_data, path)
        return path

    # ── 系统信息 ──

    def get_system_info(self):
        return {
            "platform": sys.platform,
            "version": "2.0.0",
            "python": sys.version,
        }
