from pathlib import Path

import pytest

from sci_plotter.backend.io_ops import safe_path


def test_safe_path_normal():
    base = Path("/tmp/test")
    result = safe_path(base, "subdir/file.txt")
    assert result == Path("/tmp/test/subdir/file.txt")


def test_safe_path_traversal():
    base = Path("/tmp/test")
    with pytest.raises(ValueError):
        safe_path(base, "../etc/passwd")
