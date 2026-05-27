"""文件系统操作与安全路径校验"""

from pathlib import Path


def safe_path(base: Path, rel: str) -> Path:
    """解析相对路径并确保不跳出 base 目录"""
    target = (base / rel).resolve()
    base = base.resolve()
    if not str(target).startswith(str(base)):
        raise ValueError(f"路径越界: {rel}")
    return target


def ensure_dir(path: Path) -> Path:
    """确保目录存在"""
    path.mkdir(parents=True, exist_ok=True)
    return path
