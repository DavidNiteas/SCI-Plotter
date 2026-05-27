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
