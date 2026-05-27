"""插件系统钩子与加载器"""

import importlib.util
import sys
from pathlib import Path

PLUGINS_DIR = Path.home() / ".sci-plotter" / "plugins"


def discover_plugins():
    """发现用户插件目录中的插件"""
    if not PLUGINS_DIR.exists():
        return []
    plugins = []
    for f in PLUGINS_DIR.glob("*.py"):
        plugins.append({"name": f.stem, "path": str(f)})
    return plugins


def load_plugin(path: str):
    """动态加载单个插件"""
    spec = importlib.util.spec_from_file_location("_plugin", path)
    if not spec or not spec.loader:
        raise ImportError(f"无法加载插件: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["_plugin"] = module
    spec.loader.exec_module(module)
    return module
