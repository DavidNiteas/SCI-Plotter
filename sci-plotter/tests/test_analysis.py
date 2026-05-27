import numpy as np
import pandas as pd
import pytest

from sci_plotter.backend.analysis import (
    anova_one_way,
    chi_square_test,
    correlation_matrix,
    describe_statistics,
    kruskal_wallis,
    linear_regression,
    mann_whitney_u,
    multiple_regression,
    normality_test,
    outlier_detection,
    run_analysis,
    t_test,
    wilcoxon_signed_rank,
)


def sample_df():
    return pd.DataFrame({
        "group": ["A", "A", "A", "B", "B", "B"],
        "value": [10, 12, 11, 20, 22, 21],
        "x": [1, 2, 3, 4, 5, 6],
        "y": [2, 4, 5, 8, 10, 12],
    })


def multi_group_df():
    return pd.DataFrame({
        "group": ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
        "value": [10, 12, 11, 20, 22, 21, 15, 16, 14],
        "x": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "y": [2, 4, 5, 8, 10, 12, 6, 7, 9],
    })


def categorical_df():
    np.random.seed(42)
    n = 100
    return pd.DataFrame({
        "treatment": np.random.choice(["drug", "placebo"], n),
        "outcome": np.random.choice(["improved", "stable", "worsened"], n),
    })


def paired_df():
    return pd.DataFrame({
        "before": [12, 15, 18, 20, 22, 25, 14, 16],
        "after": [14, 17, 16, 23, 25, 28, 15, 19],
    })


def normal_df():
    np.random.seed(0)
    return pd.DataFrame({"val": np.random.normal(100, 15, 50)})


# ── 已有方法的测试 ──


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


# ── ANOVA 方差分析 ──


def test_anova_one_way():
    df = multi_group_df()
    result = anova_one_way(df, {"group_column": "group", "value_column": "value"})
    assert "f_statistic" in result
    assert "p_value" in result
    assert result["n_groups"] == 3
    assert result["n_total"] == 9
    assert result["df_between"] == 2
    assert result["df_within"] == 6
    assert "A" in result["groups"]
    assert result["significant"] is True


def test_anova_via_router():
    df = multi_group_df()
    result = run_analysis(df, "anova", {"group_column": "group", "value_column": "value"})
    assert "f_statistic" in result


def test_anova_missing_params():
    df = sample_df()
    with pytest.raises(ValueError):
        anova_one_way(df, {})


def test_anova_too_few_groups():
    df = pd.DataFrame({"group": ["A", "A", "A"], "value": [10, 12, 11]})
    with pytest.raises(ValueError, match="至少需要 2 个组"):
        anova_one_way(df, {"group_column": "group", "value_column": "value"})


# ── 卡方检验 ──


def test_chi_square_test():
    df = categorical_df()
    result = chi_square_test(df, {"column_a": "treatment", "column_b": "outcome"})
    assert "chi2_statistic" in result
    assert "p_value" in result
    assert "degrees_of_freedom" in result
    assert "cramers_v" in result
    assert "contingency_table" in result
    assert result["n"] > 0


def test_chi_square_via_router():
    df = categorical_df()
    result = run_analysis(df, "chi_square", {"column_a": "treatment", "column_b": "outcome"})
    assert "chi2_statistic" in result


def test_chi_square_missing_params():
    df = categorical_df()
    with pytest.raises(ValueError):
        chi_square_test(df, {})


# ── Mann-Whitney U 检验 ──


def test_mann_whitney_u():
    df = pd.DataFrame({
        "group": ["A"] * 10 + ["B"] * 10,
        "value": [10, 12, 11, 13, 10, 11, 12, 10, 13, 11,
                  20, 22, 21, 23, 20, 21, 22, 20, 23, 21],
    })
    result = mann_whitney_u(df, {"group_column": "group", "value_column": "value"})
    assert "u_statistic" in result
    assert "p_value" in result
    assert result["significant"] is True
    assert result["group1_n"] == 10
    assert result["group2_n"] == 10


def test_mann_whitney_via_router():
    df = sample_df()
    result = run_analysis(df, "mann_whitney", {"group_column": "group", "value_column": "value"})
    assert "u_statistic" in result


def test_mann_whitney_wrong_groups():
    df = multi_group_df()
    with pytest.raises(ValueError, match="恰好 2 个组"):
        mann_whitney_u(df, {"group_column": "group", "value_column": "value"})


# ── Wilcoxon 符号秩检验 ──


def test_wilcoxon_signed_rank():
    df = paired_df()
    result = wilcoxon_signed_rank(df, {"column_a": "before", "column_b": "after"})
    assert "w_statistic" in result
    assert "p_value" in result
    assert result["n"] == 8
    assert "median_a" in result
    assert "median_b" in result
    assert "median_difference" in result


def test_wilcoxon_via_router():
    df = paired_df()
    result = run_analysis(df, "wilcoxon", {"column_a": "before", "column_b": "after"})
    assert "w_statistic" in result


def test_wilcoxon_missing_params():
    df = paired_df()
    with pytest.raises(ValueError):
        wilcoxon_signed_rank(df, {})


def test_wilcoxon_insufficient_data():
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    with pytest.raises(ValueError, match="至少需要 6 对"):
        wilcoxon_signed_rank(df, {"column_a": "a", "column_b": "b"})


def test_wilcoxon_all_zero_differences():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5, 6], "b": [1, 2, 3, 4, 5, 6]})
    result = wilcoxon_signed_rank(df, {"column_a": "a", "column_b": "b"})
    assert result["p_value"] == 1.0
    assert result["significant"] is False


# ── Kruskal-Wallis 检验 ──


def test_kruskal_wallis():
    df = multi_group_df()
    result = kruskal_wallis(df, {"group_column": "group", "value_column": "value"})
    assert "h_statistic" in result
    assert "p_value" in result
    assert result["n_groups"] == 3
    assert result["n_total"] == 9
    assert result["degrees_of_freedom"] == 2
    assert "A" in result["groups"]


def test_kruskal_via_router():
    df = multi_group_df()
    result = run_analysis(df, "kruskal", {"group_column": "group", "value_column": "value"})
    assert "h_statistic" in result


def test_kruskal_missing_params():
    df = multi_group_df()
    with pytest.raises(ValueError):
        kruskal_wallis(df, {})


# ── 多元线性回归 ──


def test_multiple_regression():
    df = multi_group_df()
    result = multiple_regression(df, {"x_columns": ["x", "value"], "y_column": "y"})
    assert "r_squared" in result
    assert "adj_r_squared" in result
    assert "f_statistic" in result
    assert "f_p_value" in result
    assert "coefficients" in result
    assert "intercept" in result["coefficients"]
    assert "x" in result["coefficients"]
    assert "value" in result["coefficients"]
    assert result["n_predictors"] == 2
    assert result["r_squared"] > 0.5


def test_multi_regression_via_router():
    df = multi_group_df()
    result = run_analysis(df, "multi_regression", {"x_columns": ["x"], "y_column": "y"})
    assert "r_squared" in result


def test_multiple_regression_missing_params():
    df = sample_df()
    with pytest.raises(ValueError):
        multiple_regression(df, {})


def test_multiple_regression_empty_x():
    df = sample_df()
    with pytest.raises(ValueError, match="非空列表"):
        multiple_regression(df, {"x_columns": [], "y_column": "y"})


# ── 正态性检验 ──


def test_normality_test():
    df = normal_df()
    result = normality_test(df, {"column": "val"})
    assert "test" in result
    assert result["test"] == "shapiro_wilk"
    assert "statistic" in result
    assert "p_value" in result
    assert "is_normal" in result
    assert "skewness" in result
    assert "kurtosis" in result
    assert result["n"] == 50


def test_normality_via_router():
    df = normal_df()
    result = run_analysis(df, "normality", {"column": "val"})
    assert "test" in result


def test_normality_missing_params():
    df = normal_df()
    with pytest.raises(ValueError):
        normality_test(df, {})


def test_normality_insufficient_data():
    df = pd.DataFrame({"val": [1, 2, 3]})
    with pytest.raises(ValueError, match="至少需要 8 个"):
        normality_test(df, {"column": "val"})


def test_normality_non_normal():
    np.random.seed(42)
    df = pd.DataFrame({"val": np.random.exponential(2, 100)})
    result = normality_test(df, {"column": "val"})
    assert result["is_normal"] is False


# ── 异常值检测 ──


def test_outlier_iqr():
    data = list(range(1, 21)) + [100, -50]
    df = pd.DataFrame({"val": data})
    result = outlier_detection(df, {"column": "val", "method": "iqr"})
    assert result["method"] == "iqr"
    assert result["n_outliers"] > 0
    assert result["n_total"] == 22
    assert result["bounds"]["lower"] is not None
    assert result["bounds"]["upper"] is not None
    assert "stats" in result


def test_outlier_zscore():
    data = list(range(1, 21)) + [100]
    df = pd.DataFrame({"val": data})
    result = outlier_detection(df, {"column": "val", "method": "zscore"})
    assert result["method"] == "zscore"
    assert result["n_outliers"] >= 1
    assert result["bounds"]["z_threshold"] == 3.0


def test_outlier_via_router():
    data = list(range(1, 21)) + [100]
    df = pd.DataFrame({"val": data})
    result = run_analysis(df, "outliers", {"column": "val"})
    assert "n_outliers" in result


def test_outlier_custom_threshold():
    data = list(range(1, 21)) + [100, -50]
    df = pd.DataFrame({"val": data})
    result = outlier_detection(df, {"column": "val", "method": "zscore", "threshold": 2.0})
    assert result["bounds"]["z_threshold"] == 2.0


def test_outlier_missing_params():
    df = pd.DataFrame({"val": [1, 2, 3, 4]})
    with pytest.raises(ValueError):
        outlier_detection(df, {})


def test_outlier_insufficient_data():
    df = pd.DataFrame({"val": [1, 2]})
    with pytest.raises(ValueError, match="至少需要 4 个"):
        outlier_detection(df, {"column": "val"})


def test_outlier_unknown_method():
    df = pd.DataFrame({"val": [1, 2, 3, 4, 5]})
    with pytest.raises(ValueError, match="未知检测方法"):
        outlier_detection(df, {"column": "val", "method": "unknown"})


def test_outlier_no_outliers():
    df = pd.DataFrame({"val": list(range(1, 11))})
    result = outlier_detection(df, {"column": "val", "method": "iqr"})
    assert result["n_outliers"] == 0
    assert result["outlier_ratio"] == 0.0
