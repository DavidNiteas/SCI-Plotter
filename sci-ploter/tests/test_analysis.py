import numpy as np
import pandas as pd
import pytest

from sci_ploter.backend.analysis import (
    correlation_matrix,
    describe_statistics,
    linear_regression,
    run_analysis,
    t_test,
)


def sample_df():
    return pd.DataFrame({
        "group": ["A", "A", "A", "B", "B", "B"],
        "value": [10, 12, 11, 20, 22, 21],
        "x": [1, 2, 3, 4, 5, 6],
        "y": [2, 4, 5, 8, 10, 12],
    })


def test_describe_statistics():
    df = sample_df()
    result = describe_statistics(df, {})
    assert "columns" in result
    assert "value" in result["columns"]
    assert result["count"] == 6


def test_t_test():
    df = sample_df()
    result = t_test(df, {"group_column": "group", "value_column": "value"})
    assert "t_statistic" in result
    assert "p_value" in result
    assert result["significant"] is True


def test_correlation_matrix():
    df = sample_df()
    result = correlation_matrix(df, {})
    assert "columns" in result
    assert "matrix" in result


def test_linear_regression():
    df = sample_df()
    result = linear_regression(df, {"x_column": "x", "y_column": "y"})
    assert "slope" in result
    assert "r_squared" in result
    assert result["n"] == 6


def test_run_analysis_unknown_method():
    df = sample_df()
    with pytest.raises(ValueError):
        run_analysis(df, "unknown", {})
