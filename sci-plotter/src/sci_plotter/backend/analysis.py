"""数据分析后端 — pandas + scipy"""

import numpy as np
import pandas as pd


def run_analysis(df: pd.DataFrame, method: str, params: dict):
    """路由到具体分析方法"""
    handlers = {
        "describe": describe_statistics,
        "ttest": t_test,
        "correlation": correlation_matrix,
        "regression": linear_regression,
        "anova": anova_one_way,
        "chi_square": chi_square_test,
        "mann_whitney": mann_whitney_u,
        "wilcoxon": wilcoxon_signed_rank,
        "kruskal": kruskal_wallis,
        "multi_regression": multiple_regression,
        "normality": normality_test,
        "outliers": outlier_detection,
    }
    handler = handlers.get(method)
    if not handler:
        raise ValueError(f"未知分析方法: {method}")
    return handler(df, params)


def describe_statistics(df: pd.DataFrame, params: dict):
    """描述性统计"""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {"error": "没有数值列"}
    desc = numeric_df.describe()
    return {
        "columns": list(desc.columns),
        "stats": {col: desc[col].to_dict() for col in desc.columns},
        "count": int(len(df)),
    }


def t_test(df: pd.DataFrame, params: dict):
    """独立样本 t 检验"""
    from scipy import stats

    group_col = params.get("group_column")
    value_col = params.get("value_column")
    if not group_col or not value_col:
        raise ValueError("需要指定 group_column 和 value_column")

    groups = df.groupby(group_col)[value_col].apply(list).to_dict()
    if len(groups) != 2:
        raise ValueError(f"t 检验需要恰好 2 个组，当前有 {len(groups)} 个")

    g1, g2 = list(groups.values())
    t_stat, p_value = stats.ttest_ind(g1, g2)

    return {
        "t_statistic": float(t_stat),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "group1_mean": float(np.mean(g1)),
        "group2_mean": float(np.mean(g2)),
        "group1_n": len(g1),
        "group2_n": len(g2),
    }


def correlation_matrix(df: pd.DataFrame, params: dict):
    """相关性矩阵"""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {"error": "没有数值列"}
    corr = numeric_df.corr()
    return {
        "columns": list(corr.columns),
        "matrix": corr.values.tolist(),
    }


def linear_regression(df: pd.DataFrame, params: dict):
    """线性回归"""
    from scipy import stats

    x_col = params.get("x_column")
    y_col = params.get("y_column")
    if not x_col or not y_col:
        raise ValueError("需要指定 x_column 和 y_column")

    x = pd.to_numeric(df[x_col], errors="coerce").dropna()
    y = pd.to_numeric(df[y_col], errors="coerce").dropna()

    common_idx = x.index.intersection(y.index)
    x = x.loc[common_idx].astype(float)
    y = y.loc[common_idx].astype(float)

    if len(x) < 2:
        raise ValueError("有效数据点不足（至少需要 2 个）")

    slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

    return {
        "slope": float(slope),
        "intercept": float(intercept),
        "r_squared": float(r_value ** 2),
        "p_value": float(p_value),
        "std_error": float(std_err),
        "equation": f"y = {slope:.4f}x + {intercept:.4f}",
        "n": int(len(x)),
    }


def anova_one_way(df: pd.DataFrame, params: dict):
    """单因素方差分析（One-Way ANOVA）

    用于比较 3 个或更多独立组的均值是否存在显著差异。
    需要指定分组列（group_column）和数值列（value_column）。
    """
    from scipy import stats

    group_col = params.get("group_column")
    value_col = params.get("value_column")
    if not group_col or not value_col:
        raise ValueError("需要指定 group_column 和 value_column")

    groups = df.groupby(group_col)[value_col].apply(
        lambda x: x.dropna().tolist()
    ).to_dict()

    group_names = list(groups.keys())
    group_values = list(groups.values())

    if len(group_values) < 2:
        raise ValueError(f"ANOVA 至少需要 2 个组，当前有 {len(group_values)} 个")

    for name, vals in zip(group_names, group_values):
        if len(vals) < 2:
            raise ValueError(f"组 '{name}' 的有效数据不足（至少需要 2 个）")

    f_stat, p_value = stats.f_oneway(*group_values)

    group_stats = {}
    for name, vals in zip(group_names, group_values):
        group_stats[str(name)] = {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals, ddof=1)),
            "n": len(vals),
        }

    return {
        "f_statistic": float(f_stat),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "df_between": len(group_values) - 1,
        "df_within": sum(len(v) for v in group_values) - len(group_values),
        "groups": group_stats,
        "n_groups": len(group_values),
        "n_total": sum(len(v) for v in group_values),
    }


def chi_square_test(df: pd.DataFrame, params: dict):
    """卡方独立性检验

    用于检验两个分类变量之间是否存在显著关联。
    需要指定两个分类列（column_a 和 column_b）。
    """
    from scipy import stats

    col_a = params.get("column_a")
    col_b = params.get("column_b")
    if not col_a or not col_b:
        raise ValueError("需要指定 column_a 和 column_b")

    clean = df[[col_a, col_b]].dropna()
    if len(clean) < 5:
        raise ValueError("有效数据不足（至少需要 5 条记录）")

    contingency = pd.crosstab(clean[col_a], clean[col_b])
    chi2, p_value, dof, expected = stats.chi2_contingency(contingency)

    n = len(clean)
    k = min(contingency.shape[0], contingency.shape[1])
    cramers_v = float(np.sqrt(chi2 / (n * (k - 1)))) if k > 1 and n > 0 else 0.0

    return {
        "chi2_statistic": float(chi2),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "degrees_of_freedom": int(dof),
        "cramers_v": cramers_v,
        "contingency_table": {
            "index": [str(i) for i in contingency.index.tolist()],
            "columns": [str(c) for c in contingency.columns.tolist()],
            "values": contingency.values.tolist(),
        },
        "n": int(n),
    }


def mann_whitney_u(df: pd.DataFrame, params: dict):
    """Mann-Whitney U 检验（非参数两独立样本比较）

    当数据不满足正态分布假设时，作为独立样本 t 检验的非参数替代方法。
    """
    from scipy import stats

    group_col = params.get("group_column")
    value_col = params.get("value_column")
    if not group_col or not value_col:
        raise ValueError("需要指定 group_column 和 value_column")

    groups = df.groupby(group_col)[value_col].apply(
        lambda x: x.dropna().tolist()
    ).to_dict()

    if len(groups) != 2:
        raise ValueError(f"Mann-Whitney U 检验需要恰好 2 个组，当前有 {len(groups)} 个")

    g1, g2 = list(groups.values())
    if len(g1) < 1 or len(g2) < 1:
        raise ValueError("每组至少需要 1 个有效数据点")

    u_stat, p_value = stats.mannwhitneyu(g1, g2, alternative="two-sided")

    return {
        "u_statistic": float(u_stat),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "group1_median": float(np.median(g1)),
        "group2_median": float(np.median(g2)),
        "group1_n": len(g1),
        "group2_n": len(g2),
    }


def wilcoxon_signed_rank(df: pd.DataFrame, params: dict):
    """Wilcoxon 符号秩检验（配对样本非参数检验）

    用于比较两个相关/配对样本的差异，是配对 t 检验的非参数替代方法。
    需要指定两个数值列（column_a 和 column_b）代表配对数据。
    """
    from scipy import stats

    col_a = params.get("column_a")
    col_b = params.get("column_b")
    if not col_a or not col_b:
        raise ValueError("需要指定 column_a 和 column_b")

    clean = df[[col_a, col_b]].apply(pd.to_numeric, errors="coerce").dropna()
    if len(clean) < 6:
        raise ValueError("有效配对数据不足（至少需要 6 对）")

    x = clean[col_a].values
    y = clean[col_b].values

    differences = x - y
    if np.all(differences == 0):
        return {
            "w_statistic": 0.0,
            "p_value": 1.0,
            "significant": False,
            "median_a": float(np.median(x)),
            "median_b": float(np.median(y)),
            "median_difference": 0.0,
            "n": int(len(clean)),
        }

    w_stat, p_value = stats.wilcoxon(x, y)

    return {
        "w_statistic": float(w_stat),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "median_a": float(np.median(x)),
        "median_b": float(np.median(y)),
        "median_difference": float(np.median(differences)),
        "n": int(len(clean)),
    }


def kruskal_wallis(df: pd.DataFrame, params: dict):
    """Kruskal-Wallis H 检验（非参数多组比较）

    当数据不满足 ANOVA 的正态性假设时使用，是单因素 ANOVA 的非参数替代方法。
    """
    from scipy import stats

    group_col = params.get("group_column")
    value_col = params.get("value_column")
    if not group_col or not value_col:
        raise ValueError("需要指定 group_column 和 value_column")

    groups = df.groupby(group_col)[value_col].apply(
        lambda x: x.dropna().tolist()
    ).to_dict()

    group_names = list(groups.keys())
    group_values = list(groups.values())

    if len(group_values) < 2:
        raise ValueError(f"Kruskal-Wallis 检验至少需要 2 个组，当前有 {len(group_values)} 个")

    for name, vals in zip(group_names, group_values):
        if len(vals) < 1:
            raise ValueError(f"组 '{name}' 没有有效数据")

    h_stat, p_value = stats.kruskal(*group_values)

    group_stats = {}
    for name, vals in zip(group_names, group_values):
        group_stats[str(name)] = {
            "median": float(np.median(vals)),
            "mean_rank": float(np.mean(stats.rankdata(
                np.concatenate([np.array(v) for v in group_values])
            )[:len(vals)])) if len(vals) > 0 else 0.0,
            "n": len(vals),
        }

    return {
        "h_statistic": float(h_stat),
        "p_value": float(p_value),
        "significant": bool(p_value < 0.05),
        "degrees_of_freedom": len(group_values) - 1,
        "groups": group_stats,
        "n_groups": len(group_values),
        "n_total": sum(len(v) for v in group_values),
    }


def multiple_regression(df: pd.DataFrame, params: dict):
    """多元线性回归

    使用多个自变量预测一个因变量，返回回归系数、R²、F 统计量等。
    需要指定自变量列列表（x_columns）和因变量列（y_column）。
    """
    from scipy import stats

    x_columns = params.get("x_columns")
    y_column = params.get("y_column")
    if x_columns is None or not y_column:
        raise ValueError("需要指定 x_columns（列表）和 y_column")

    if not isinstance(x_columns, list) or len(x_columns) < 1:
        raise ValueError("x_columns 必须是非空列表")

    cols = x_columns + [y_column]
    clean = df[cols].apply(pd.to_numeric, errors="coerce").dropna()

    if len(clean) < len(x_columns) + 2:
        raise ValueError(
            f"有效数据不足（至少需要 {len(x_columns) + 2} 条，当前 {len(clean)} 条）"
        )

    x_data = clean[x_columns].values.astype(float)
    y_data = clean[y_column].values.astype(float)

    x_with_intercept = np.column_stack([np.ones(len(x_data)), x_data])
    n = len(y_data)
    k = x_with_intercept.shape[1]

    beta, residuals_sum, rank, sv = np.linalg.lstsq(x_with_intercept, y_data, rcond=None)
    y_pred = x_with_intercept @ beta

    ss_res = np.sum((y_data - y_pred) ** 2)
    ss_tot = np.sum((y_data - np.mean(y_data)) ** 2)
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    df_model = k - 1
    df_residual = n - k
    if df_residual > 0 and ss_tot > 0:
        f_stat = (ss_tot - ss_res) / df_model / (ss_res / df_residual)
        f_p_value = float(stats.f.sf(f_stat, df_model, df_residual))
    else:
        f_stat = 0.0
        f_p_value = 1.0

    mse = ss_res / df_residual if df_residual > 0 else 0.0
    se_beta = np.sqrt(np.diag(mse * np.linalg.inv(x_with_intercept.T @ x_with_intercept)))

    coefficients = {
        "intercept": {
            "value": float(beta[0]),
            "std_error": float(se_beta[0]),
        }
    }
    for i, col_name in enumerate(x_columns):
        idx = i + 1
        t_val = beta[idx] / se_beta[idx] if se_beta[idx] > 0 else 0.0
        t_p = float(2 * stats.t.sf(abs(t_val), df_residual)) if df_residual > 0 else 1.0
        coefficients[col_name] = {
            "value": float(beta[idx]),
            "std_error": float(se_beta[idx]),
            "t_statistic": float(t_val),
            "p_value": t_p,
        }

    adj_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - k) if n > k else 0.0

    return {
        "r_squared": float(r_squared),
        "adj_r_squared": float(adj_r_squared),
        "f_statistic": float(f_stat),
        "f_p_value": f_p_value,
        "coefficients": coefficients,
        "n": int(n),
        "n_predictors": len(x_columns),
    }


def normality_test(df: pd.DataFrame, params: dict):
    """Shapiro-Wilk 正态性检验

    用于检验数据是否服从正态分布。当样本量 > 5000 时使用 D'Agostino-Pearson 检验。
    """
    from scipy import stats

    column = params.get("column")
    if not column:
        raise ValueError("需要指定 column")

    values = pd.to_numeric(df[column], errors="coerce").dropna().values.astype(float)

    if len(values) < 8:
        raise ValueError("有效数据不足（至少需要 8 个数据点）")

    if len(values) > 5000:
        stat, p_value = stats.normaltest(values)
        test_name = "dagostino_pearson"
    else:
        stat, p_value = stats.shapiro(values)
        test_name = "shapiro_wilk"

    return {
        "test": test_name,
        "statistic": float(stat),
        "p_value": float(p_value),
        "is_normal": bool(p_value >= 0.05),
        "mean": float(np.mean(values)),
        "std": float(np.std(values, ddof=1)),
        "skewness": float(stats.skew(values)),
        "kurtosis": float(stats.kurtosis(values)),
        "n": int(len(values)),
    }


def outlier_detection(df: pd.DataFrame, params: dict):
    """异常值检测

    支持 IQR 法和 Z-score 法。返回异常值索引、数量和统计信息。
    """
    from scipy import stats

    column = params.get("column")
    method = params.get("method", "iqr")
    threshold = params.get("threshold", None)

    if not column:
        raise ValueError("需要指定 column")

    values = pd.to_numeric(df[column], errors="coerce").dropna()
    if len(values) < 4:
        raise ValueError("有效数据不足（至少需要 4 个数据点）")

    arr = values.values.astype(float)

    if method == "zscore":
        z_threshold = float(threshold) if threshold is not None else 3.0
        z_scores = np.abs(stats.zscore(arr))
        outlier_mask = z_scores > z_threshold
        outlier_indices = np.where(outlier_mask)[0].tolist()
        outlier_values = arr[outlier_mask].tolist()
    elif method == "iqr":
        iqr_multiplier = float(threshold) if threshold is not None else 1.5
        q1 = float(np.percentile(arr, 25))
        q3 = float(np.percentile(arr, 75))
        iqr = q3 - q1
        lower_bound = q1 - iqr_multiplier * iqr
        upper_bound = q3 + iqr_multiplier * iqr
        outlier_mask = (arr < lower_bound) | (arr > upper_bound)
        outlier_indices = np.where(outlier_mask)[0].tolist()
        outlier_values = arr[outlier_mask].tolist()
    else:
        raise ValueError(f"未知检测方法: {method}，支持 'iqr' 和 'zscore'")

    return {
        "method": method,
        "n_outliers": int(len(outlier_indices)),
        "outlier_indices": outlier_indices[:100],
        "outlier_values": [float(v) for v in outlier_values[:100]],
        "n_total": int(len(arr)),
        "outlier_ratio": float(len(outlier_indices) / len(arr)),
        "bounds": {
            "lower": float(lower_bound) if method == "iqr" else None,
            "upper": float(upper_bound) if method == "iqr" else None,
            "z_threshold": float(z_threshold) if method == "zscore" else None,
        },
        "stats": {
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr, ddof=1)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr)),
            "q1": float(np.percentile(arr, 25)),
            "median": float(np.median(arr)),
            "q3": float(np.percentile(arr, 75)),
        },
    }
