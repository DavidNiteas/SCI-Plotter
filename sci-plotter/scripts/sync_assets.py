"""
同步前端资源脚本
将 ../sci-plotter-lite/ 的文件复制到 src/sci_plotter/assets/
"""

import shutil
import sys
from pathlib import Path


def sync():
    script_dir = Path(__file__).parent
    lite_dir = script_dir.parent.parent / "sci-plotter-lite"
    assets_dir = script_dir.parent / "src" / "sci_plotter" / "assets"

    if not lite_dir.exists():
        print(f"错误: 源目录不存在: {lite_dir}")
        sys.exit(1)

    if assets_dir.exists():
        shutil.rmtree(assets_dir)
    assets_dir.mkdir(parents=True, exist_ok=True)

    for item in lite_dir.iterdir():
        dest = assets_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    print(f"同步完成: {lite_dir} -> {assets_dir}")


if __name__ == "__main__":
    sync()
