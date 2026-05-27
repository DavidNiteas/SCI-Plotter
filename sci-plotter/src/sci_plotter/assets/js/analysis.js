/**
 * SCI-Plotter 前端统计分析引擎
 * 纯 JavaScript 实现，覆盖后端 analysis.py 的全部 12 种分析方法
 * 包含数学基础函数、概率分布、假设检验、回归、异常值检测
 */

(function() {
    const EPS = 1e-12;
    const MAX_ITER = 200;
    const SQRT2PI = Math.sqrt(2 * Math.PI);

    // ==================== 数学基础函数 ====================

    function gammaLn(x) {
        const c = [
            76.18009172947146, -86.50532032941677, 24.01409824083091,
            -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
        ];
        let y = x;
        let tmp = x + 5.5;
        tmp -= (x + 0.5) * Math.log(tmp);
        let ser = 1.000000000190015;
        for (let j = 0; j < 6; j++) {
            y += 1;
            ser += c[j] / y;
        }
        return -tmp + Math.log(2.5066282746310005 * ser / x);
    }

    function gamma(x) {
        if (x < 0.5) {
            return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
        }
        return Math.exp(gammaLn(x));
    }

    function beta(a, b) {
        return Math.exp(gammaLn(a) + gammaLn(b) - gammaLn(a + b));
    }

    function erf(x) {
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        const t = 1.0 / (1.0 + 0.3275911 * x);
        const y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return sign * y;
    }

    function erfInverse(x) {
        if (x <= -1) return -Infinity;
        if (x >= 1) return Infinity;
        const a = 0.147;
        const lnPart = Math.log(1 - x * x);
        const term1 = 2 / (Math.PI * a) + lnPart / 2;
        const sign = x >= 0 ? 1 : -1;
        return sign * Math.sqrt(Math.sqrt(term1 * term1 - lnPart / a) - term1);
    }

    function betaIncompleteCF(x, a, b) {
        const qab = a + b;
        const qap = a + 1;
        const qam = a - 1;
        let c = 1;
        let d = 1 - qab * x / qap;
        if (Math.abs(d) < EPS) d = EPS;
        d = 1 / d;
        let h = d;
        for (let m = 1; m <= MAX_ITER; m++) {
            const m2 = 2 * m;
            let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < EPS) d = EPS;
            c = 1 + aa / c;
            if (Math.abs(c) < EPS) c = EPS;
            d = 1 / d;
            h *= d * c;
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < EPS) d = EPS;
            c = 1 + aa / c;
            if (Math.abs(c) < EPS) c = EPS;
            d = 1 / d;
            const del = d * c;
            h *= del;
            if (Math.abs(del - 1) < EPS) break;
        }
        return h;
    }

    function betaRegularized(x, a, b) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        const bt = Math.exp(
            gammaLn(a + b) - gammaLn(a) - gammaLn(b) +
            a * Math.log(x) + b * Math.log(1 - x)
        );
        if (x < (a + 1) / (a + b + 2)) {
            return bt * betaIncompleteCF(x, a, b) / a;
        }
        return 1 - bt * betaIncompleteCF(1 - x, b, a) / b;
    }

    function gammaIncompleteSeries(a, x) {
        let sum = 1 / a;
        let term = 1 / a;
        for (let n = 1; n <= MAX_ITER; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * EPS) break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
    }

    function gammaIncompleteCF(a, x) {
        let b1 = 1;
        let c = 1 / EPS;
        let d = 1 / (x + 1 - a);
        let h = d;
        for (let i = 1; i <= MAX_ITER; i++) {
            const an = -i * (i - a);
            b1 += 2;
            d = an * d + b1;
            if (Math.abs(d) < EPS) d = EPS;
            c = b1 + an / c;
            if (Math.abs(c) < EPS) c = EPS;
            d = 1 / d;
            const del = d * c;
            h *= del;
            if (Math.abs(del - 1) < EPS) break;
        }
        return Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
    }

    function gammaRegularizedLower(a, x) {
        if (x < 0) return 0;
        if (x === 0) return 0;
        if (x < a + 1) return gammaIncompleteSeries(a, x);
        return 1 - gammaIncompleteCF(a, x);
    }

    function gammaRegularizedUpper(a, x) {
        return 1 - gammaRegularizedLower(a, x);
    }

    // ==================== 概率分布 ====================

    function normalCDF(x) {
        return 0.5 * (1 + erf(x / Math.SQRT2));
    }

    function normalPDF(x) {
        return Math.exp(-0.5 * x * x) / SQRT2PI;
    }

    function normalQuantile(p) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        if (p === 0.5) return 0;
        return Math.SQRT2 * erfInverse(2 * p - 1);
    }

    function tCDF(t, df) {
        if (df <= 0) return NaN;
        const x = df / (df + t * t);
        const p = 0.5 * betaRegularized(x, df / 2, 0.5);
        return t >= 0 ? 1 - p : p;
    }

    function tPValue2(t, df) {
        const x = df / (df + t * t);
        return betaRegularized(x, df / 2, 0.5);
    }

    function fCDF(f, d1, d2) {
        if (f <= 0) return 0;
        const x = d1 * f / (d1 * f + d2);
        return betaRegularized(x, d1 / 2, d2 / 2);
    }

    function chiSquareCDF(x, k) {
        if (x <= 0) return 0;
        return gammaRegularizedLower(k / 2, x / 2);
    }

    function chiSquarePValue(x, k) {
        if (x <= 0) return 1;
        return gammaRegularizedUpper(k / 2, x / 2);
    }

    // ==================== 统计辅助函数 ====================

    function arrMean(arr) {
        if (arr.length === 0) return NaN;
        return arr.reduce((s, v) => s + v, 0) / arr.length;
    }

    function arrVariance(arr, ddof) {
        if (arr.length <= (ddof || 0)) return NaN;
        const m = arrMean(arr);
        const ss = arr.reduce((s, v) => s + (v - m) ** 2, 0);
        return ss / (arr.length - (ddof !== undefined ? ddof : 1));
    }

    function arrStd(arr, ddof) {
        return Math.sqrt(arrVariance(arr, ddof));
    }

    function arrMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function arrPercentile(arr, p) {
        const sorted = [...arr].sort((a, b) => a - b);
        if (sorted.length === 0) return NaN;
        const idx = (p / 100) * (sorted.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }

    function arrSkewness(arr) {
        const n = arr.length;
        if (n < 3) return NaN;
        const m = arrMean(arr);
        const s = arrStd(arr, 1);
        if (s === 0) return 0;
        const sum3 = arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
        return (n / ((n - 1) * (n - 2))) * sum3;
    }

    function arrKurtosis(arr) {
        const n = arr.length;
        if (n < 4) return NaN;
        const m = arrMean(arr);
        const s = arrStd(arr, 1);
        if (s === 0) return 0;
        const sum4 = arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
        const k = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4 -
                  (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
        return k;
    }

    function arrRank(arr) {
        const indexed = arr.map((v, i) => ({ v, i }));
        indexed.sort((a, b) => a.v - b.v);
        const ranks = new Array(arr.length);
        let pos = 0;
        while (pos < indexed.length) {
            let end = pos;
            while (end < indexed.length && indexed[end].v === indexed[pos].v) end++;
            const avgRank = (pos + 1 + end) / 2;
            for (let k = pos; k < end; k++) {
                ranks[indexed[k].i] = avgRank;
            }
            pos = end;
        }
        return ranks;
    }

    // ==================== 数据提取工具 ====================

    function getColumnData(data, colName) {
        const idx = data.headers.indexOf(colName);
        if (idx < 0) return [];
        return data.rows.map(r => r[idx]);
    }

    function getNumericColumn(data, colName) {
        return getColumnData(data, colName)
            .filter(v => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v));
    }

    function getNumericColumnNames(data) {
        return data.headers.filter((h, i) =>
            data.rows.some(r => typeof r[i] === 'number' && !isNaN(r[i]))
        );
    }

    function groupBy(data, groupCol, valueCol) {
        const gIdx = data.headers.indexOf(groupCol);
        const vIdx = data.headers.indexOf(valueCol);
        if (gIdx < 0 || vIdx < 0) return {};
        const groups = {};
        data.rows.forEach(row => {
            const g = row[gIdx];
            const v = row[vIdx];
            if (g === null || g === undefined) return;
            const key = String(g);
            if (!groups[key]) groups[key] = [];
            if (v !== null && v !== undefined && typeof v === 'number' && !isNaN(v)) {
                groups[key].push(v);
            }
        });
        return groups;
    }

    // ==================== 12 种分析方法 ====================

    function describe(data) {
        const numCols = getNumericColumnNames(data);
        if (numCols.length === 0) return { error: '没有数值列' };
        const stats = {};
        for (const col of numCols) {
            const vals = getNumericColumn(data, col);
            if (vals.length === 0) continue;
            const m = arrMean(vals);
            const s = arrStd(vals, 1);
            stats[col] = {
                count: vals.length,
                mean: m,
                std: s,
                min: Math.min(...vals),
                '25%': arrPercentile(vals, 25),
                '50%': arrPercentile(vals, 50),
                '75%': arrPercentile(vals, 75),
                max: Math.max(...vals),
            };
        }
        return { columns: numCols.filter(c => stats[c]), stats, count: data.rows.length };
    }

    function ttest(data, params) {
        const groupCol = params.group_column;
        const valueCol = params.value_column;
        if (!groupCol || !valueCol) throw new Error('需要指定 group_column 和 value_column');

        const groups = groupBy(data, groupCol, valueCol);
        const keys = Object.keys(groups);
        if (keys.length !== 2) throw new Error(`t 检验需要恰好 2 个组，当前有 ${keys.length} 个`);

        const g1 = groups[keys[0]];
        const g2 = groups[keys[1]];
        const n1 = g1.length;
        const n2 = g2.length;
        const m1 = arrMean(g1);
        const m2 = arrMean(g2);
        const v1 = arrVariance(g1, 1);
        const v2 = arrVariance(g2, 1);

        const se = Math.sqrt(v1 / n1 + v2 / n2);
        if (se === 0) throw new Error('标准误为零，无法计算 t 统计量');
        const tStat = (m1 - m2) / se;

        const dfNum = (v1 / n1 + v2 / n2) ** 2;
        const dfDen = ((v1 / n1) ** 2) / (n1 - 1) + ((v2 / n2) ** 2) / (n2 - 1);
        const df = dfNum / dfDen;

        const pValue = tPValue2(tStat, df);

        return {
            t_statistic: tStat,
            p_value: pValue,
            significant: pValue < 0.05,
            group1_mean: m1,
            group2_mean: m2,
            group1_n: n1,
            group2_n: n2,
        };
    }

    function correlation(data) {
        const numCols = getNumericColumnNames(data);
        if (numCols.length === 0) return { error: '没有数值列' };

        const colData = {};
        for (const col of numCols) {
            colData[col] = data.rows.map(r => {
                const idx = data.headers.indexOf(col);
                const v = r[idx];
                return (typeof v === 'number' && !isNaN(v)) ? v : null;
            });
        }

        const n = numCols.length;
        const matrix = [];
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < n; j++) {
                const pairs = [];
                for (let k = 0; k < data.rows.length; k++) {
                    const a = colData[numCols[i]][k];
                    const b = colData[numCols[j]][k];
                    if (a !== null && b !== null) pairs.push([a, b]);
                }
                if (pairs.length < 2) {
                    row.push(i === j ? 1 : NaN);
                    continue;
                }
                const xs = pairs.map(p => p[0]);
                const ys = pairs.map(p => p[1]);
                const mx = arrMean(xs);
                const my = arrMean(ys);
                let sumXY = 0, sumX2 = 0, sumY2 = 0;
                for (let k = 0; k < pairs.length; k++) {
                    const dx = xs[k] - mx;
                    const dy = ys[k] - my;
                    sumXY += dx * dy;
                    sumX2 += dx * dx;
                    sumY2 += dy * dy;
                }
                const denom = Math.sqrt(sumX2 * sumY2);
                row.push(denom === 0 ? 0 : sumXY / denom);
            }
            matrix.push(row);
        }
        return { columns: numCols, matrix };
    }

    function regression(data, params) {
        const xCol = params.x_column;
        const yCol = params.y_column;
        if (!xCol || !yCol) throw new Error('需要指定 x_column 和 y_column');

        const pairs = [];
        const xIdx = data.headers.indexOf(xCol);
        const yIdx = data.headers.indexOf(yCol);
        if (xIdx < 0 || yIdx < 0) throw new Error('指定的列不存在');

        data.rows.forEach(row => {
            const xv = row[xIdx];
            const yv = row[yIdx];
            if (typeof xv === 'number' && !isNaN(xv) &&
                typeof yv === 'number' && !isNaN(yv)) {
                pairs.push([xv, yv]);
            }
        });

        if (pairs.length < 2) throw new Error('有效数据点不足（至少需要 2 个）');

        const xs = pairs.map(p => p[0]);
        const ys = pairs.map(p => p[1]);
        const n = pairs.length;
        const mx = arrMean(xs);
        const my = arrMean(ys);

        let ssXY = 0, ssXX = 0;
        for (let i = 0; i < n; i++) {
            ssXY += (xs[i] - mx) * (ys[i] - my);
            ssXX += (xs[i] - mx) ** 2;
        }

        if (ssXX === 0) throw new Error('自变量方差为零，无法拟合');

        const slope = ssXY / ssXX;
        const intercept = my - slope * mx;

        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            const yPred = slope * xs[i] + intercept;
            ssRes += (ys[i] - yPred) ** 2;
            ssTot += (ys[i] - my) ** 2;
        }

        const rValue = ssTot > 0 ? Math.sqrt(1 - ssRes / ssTot) : 0;
        const rSquared = rValue ** 2;

        const df = n - 2;
        let pValue = 1;
        let stdErr = 0;
        if (df > 0 && ssXX > 0) {
            stdErr = Math.sqrt(ssRes / df / ssXX);
            if (stdErr > 0) {
                const tStat = slope / stdErr;
                pValue = tPValue2(tStat, df);
            }
        }

        return {
            slope,
            intercept,
            r_squared: rSquared,
            p_value: pValue,
            std_error: stdErr,
            equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
            n,
        };
    }

    function anova(data, params) {
        const groupCol = params.group_column;
        const valueCol = params.value_column;
        if (!groupCol || !valueCol) throw new Error('需要指定 group_column 和 value_column');

        const groups = groupBy(data, groupCol, valueCol);
        const groupNames = Object.keys(groups);
        const groupValues = Object.values(groups);

        if (groupValues.length < 2) throw new Error(`ANOVA 至少需要 2 个组，当前有 ${groupValues.length} 个`);

        for (let i = 0; i < groupNames.length; i++) {
            if (groupValues[i].length < 2) {
                throw new Error(`组 '${groupNames[i]}' 的有效数据不足（至少需要 2 个）`);
            }
        }

        const allValues = groupValues.flat();
        const grandMean = arrMean(allValues);
        const k = groupValues.length;
        const N = allValues.length;

        let ssBetween = 0;
        let ssWithin = 0;
        const groupStats = {};

        for (let i = 0; i < k; i++) {
            const vals = groupValues[i];
            const gm = arrMean(vals);
            const gs = arrStd(vals, 1);
            ssBetween += vals.length * (gm - grandMean) ** 2;
            for (const v of vals) {
                ssWithin += (v - gm) ** 2;
            }
            groupStats[groupNames[i]] = { mean: gm, std: gs, n: vals.length };
        }

        const dfBetween = k - 1;
        const dfWithin = N - k;
        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fStat = msWithin > 0 ? msBetween / msWithin : 0;
        const pValue = dfWithin > 0 ? 1 - fCDF(fStat, dfBetween, dfWithin) : 1;

        return {
            f_statistic: fStat,
            p_value: pValue,
            significant: pValue < 0.05,
            df_between: dfBetween,
            df_within: dfWithin,
            groups: groupStats,
            n_groups: k,
            n_total: N,
        };
    }

    function chiSquare(data, params) {
        const colA = params.column_a;
        const colB = params.column_b;
        if (!colA || !colB) throw new Error('需要指定 column_a 和 column_b');

        const aIdx = data.headers.indexOf(colA);
        const bIdx = data.headers.indexOf(colB);
        if (aIdx < 0 || bIdx < 0) throw new Error('指定的列不存在');

        const clean = data.rows.filter(r =>
            r[aIdx] !== null && r[aIdx] !== undefined &&
            r[bIdx] !== null && r[bIdx] !== undefined
        );

        if (clean.length < 5) throw new Error('有效数据不足（至少需要 5 条记录）');

        const rowCats = [...new Set(clean.map(r => String(r[aIdx])))].sort();
        const colCats = [...new Set(clean.map(r => String(r[bIdx])))].sort();

        const contingency = {};
        for (const rc of rowCats) {
            contingency[rc] = {};
            for (const cc of colCats) contingency[rc][cc] = 0;
        }
        clean.forEach(r => {
            contingency[String(r[aIdx])][String(r[bIdx])]++;
        });

        const rowTotals = {};
        const colTotals = {};
        let n = clean.length;
        for (const rc of rowCats) {
            rowTotals[rc] = colCats.reduce((s, cc) => s + contingency[rc][cc], 0);
        }
        for (const cc of colCats) {
            colTotals[cc] = rowCats.reduce((s, rc) => s + contingency[rc][cc], 0);
        }

        let chi2 = 0;
        for (const rc of rowCats) {
            for (const cc of colCats) {
                const expected = (rowTotals[rc] * colTotals[cc]) / n;
                if (expected > 0) {
                    chi2 += (contingency[rc][cc] - expected) ** 2 / expected;
                }
            }
        }

        const dof = (rowCats.length - 1) * (colCats.length - 1);
        const pValue = chiSquarePValue(chi2, dof);
        const k = Math.min(rowCats.length, colCats.length);
        const cramersV = (k > 1 && n > 0) ? Math.sqrt(chi2 / (n * (k - 1))) : 0;

        const ctValues = rowCats.map(rc => colCats.map(cc => contingency[rc][cc]));

        return {
            chi2_statistic: chi2,
            p_value: pValue,
            significant: pValue < 0.05,
            degrees_of_freedom: dof,
            cramers_v: cramersV,
            contingency_table: {
                index: rowCats,
                columns: colCats,
                values: ctValues,
            },
            n,
        };
    }

    function mannWhitney(data, params) {
        const groupCol = params.group_column;
        const valueCol = params.value_column;
        if (!groupCol || !valueCol) throw new Error('需要指定 group_column 和 value_column');

        const groups = groupBy(data, groupCol, valueCol);
        const keys = Object.keys(groups);
        if (keys.length !== 2) throw new Error(`Mann-Whitney U 检验需要恰好 2 个组，当前有 ${keys.length} 个`);

        const g1 = groups[keys[0]];
        const g2 = groups[keys[1]];
        if (g1.length < 1 || g2.length < 1) throw new Error('每组至少需要 1 个有效数据点');

        const combined = [
            ...g1.map(v => ({ v, g: 1 })),
            ...g2.map(v => ({ v, g: 2 })),
        ];
        const ranks = arrRank(combined.map(c => c.v));
        combined.forEach((c, i) => c.rank = ranks[i]);

        const r1 = combined.filter(c => c.g === 1).reduce((s, c) => s + c.rank, 0);
        const n1 = g1.length;
        const n2 = g2.length;
        const u1 = r1 - n1 * (n1 + 1) / 2;
        const u2 = n1 * n2 - u1;
        const uStat = Math.min(u1, u2);

        const mu = n1 * n2 / 2;
        const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
        let pValue = 1;
        if (sigma > 0) {
            const z = (uStat - mu) / sigma;
            pValue = 2 * normalCDF(-Math.abs(z));
        }

        return {
            u_statistic: uStat,
            p_value: pValue,
            significant: pValue < 0.05,
            group1_median: arrMedian(g1),
            group2_median: arrMedian(g2),
            group1_n: n1,
            group2_n: n2,
        };
    }

    function wilcoxon(data, params) {
        const colA = params.column_a;
        const colB = params.column_b;
        if (!colA || !colB) throw new Error('需要指定 column_a 和 column_b');

        const aIdx = data.headers.indexOf(colA);
        const bIdx = data.headers.indexOf(colB);
        if (aIdx < 0 || bIdx < 0) throw new Error('指定的列不存在');

        const pairs = [];
        data.rows.forEach(row => {
            const a = row[aIdx];
            const b = row[bIdx];
            if (typeof a === 'number' && !isNaN(a) &&
                typeof b === 'number' && !isNaN(b)) {
                pairs.push([a, b]);
            }
        });

        if (pairs.length < 6) throw new Error('有效配对数据不足（至少需要 6 对）');

        const diffs = pairs.map(p => p[0] - p[1]);
        const allZero = diffs.every(d => d === 0);

        if (allZero) {
            return {
                w_statistic: 0,
                p_value: 1,
                significant: false,
                median_a: arrMedian(pairs.map(p => p[0])),
                median_b: arrMedian(pairs.map(p => p[1])),
                median_difference: 0,
                n: pairs.length,
            };
        }

        const absDiffs = diffs.map((d, i) => ({ abs: Math.abs(d), sign: d > 0 ? 1 : (d < 0 ? -1 : 0), idx: i }));
        const nonZero = absDiffs.filter(d => d.abs > 0);
        const ranks = arrRank(nonZero.map(d => d.abs));
        nonZero.forEach((d, i) => d.rank = ranks[i]);

        let wPlus = 0, wMinus = 0;
        nonZero.forEach(d => {
            if (d.sign > 0) wPlus += d.rank;
            else if (d.sign < 0) wMinus += d.rank;
        });

        const wStat = Math.min(wPlus, wMinus);
        const n = nonZero.length;
        const expected = n * (n + 1) / 4;
        const stdW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
        let pValue = 1;
        if (stdW > 0) {
            const z = (wStat - expected) / stdW;
            pValue = 2 * normalCDF(-Math.abs(z));
        }

        return {
            w_statistic: wStat,
            p_value: pValue,
            significant: pValue < 0.05,
            median_a: arrMedian(pairs.map(p => p[0])),
            median_b: arrMedian(pairs.map(p => p[1])),
            median_difference: arrMedian(diffs),
            n: pairs.length,
        };
    }

    function kruskalWallis(data, params) {
        const groupCol = params.group_column;
        const valueCol = params.value_column;
        if (!groupCol || !valueCol) throw new Error('需要指定 group_column 和 value_column');

        const groups = groupBy(data, groupCol, valueCol);
        const groupNames = Object.keys(groups);
        const groupValues = Object.values(groups);

        if (groupValues.length < 2) {
            throw new Error(`Kruskal-Wallis 检验至少需要 2 个组，当前有 ${groupValues.length} 个`);
        }

        for (let i = 0; i < groupNames.length; i++) {
            if (groupValues[i].length < 1) {
                throw new Error(`组 '${groupNames[i]}' 没有有效数据`);
            }
        }

        const allValues = groupValues.flat();
        const N = allValues.length;
        const allRanks = arrRank(allValues);

        let offset = 0;
        const groupStats = {};
        for (let i = 0; i < groupValues.length; i++) {
            const n = groupValues[i].length;
            const gRanks = allRanks.slice(offset, offset + n);
            const meanRank = arrMean(gRanks);
            groupStats[groupNames[i]] = {
                median: arrMedian(groupValues[i]),
                mean_rank: meanRank,
                n,
            };
            offset += n;
        }

        let h = 0;
        offset = 0;
        for (let i = 0; i < groupValues.length; i++) {
            const n = groupValues[i].length;
            const gRanks = allRanks.slice(offset, offset + n);
            const ri = gRanks.reduce((s, r) => s + r, 0);
            h += (ri ** 2) / n;
            offset += n;
        }
        h = (12 / (N * (N + 1))) * h - 3 * (N + 1);

        const df = groupValues.length - 1;
        const pValue = chiSquarePValue(h, df);

        return {
            h_statistic: h,
            p_value: pValue,
            significant: pValue < 0.05,
            degrees_of_freedom: df,
            groups: groupStats,
            n_groups: groupValues.length,
            n_total: N,
        };
    }

    function matMul(A, B) {
        const rows = A.length;
        const cols = B[0].length;
        const inner = B.length;
        const C = Array.from({ length: rows }, () => new Array(cols).fill(0));
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                for (let k = 0; k < inner; k++) {
                    C[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return C;
    }

    function matTranspose(A) {
        const rows = A.length;
        const cols = A[0].length;
        const T = Array.from({ length: cols }, () => new Array(rows));
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                T[j][i] = A[i][j];
            }
        }
        return T;
    }

    function matInverse(A) {
        const n = A.length;
        const aug = A.map((row, i) => {
            const newRow = [...row];
            for (let j = 0; j < n; j++) newRow.push(i === j ? 1 : 0);
            return newRow;
        });

        for (let col = 0; col < n; col++) {
            let maxRow = col;
            let maxVal = Math.abs(aug[col][col]);
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(aug[row][col]) > maxVal) {
                    maxVal = Math.abs(aug[row][col]);
                    maxRow = row;
                }
            }
            [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

            const pivot = aug[col][col];
            if (Math.abs(pivot) < EPS) return null;

            for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

            for (let row = 0; row < n; row++) {
                if (row === col) continue;
                const factor = aug[row][col];
                for (let j = 0; j < 2 * n; j++) {
                    aug[row][j] -= factor * aug[col][j];
                }
            }
        }

        return aug.map(row => row.slice(n));
    }

    function multipleRegression(data, params) {
        const xColumns = params.x_columns;
        const yColumn = params.y_column;
        if (!xColumns || !Array.isArray(xColumns) || xColumns.length < 1) {
            throw new Error('x_columns 必须是非空列表');
        }
        if (!yColumn) throw new Error('需要指定 y_column');

        const colIndices = xColumns.map(c => data.headers.indexOf(c));
        const yIdx = data.headers.indexOf(yColumn);
        if (yIdx < 0 || colIndices.some(i => i < 0)) throw new Error('指定的列不存在');

        const cleanRows = data.rows.filter(row => {
            const yv = row[yIdx];
            if (typeof yv !== 'number' || isNaN(yv)) return false;
            return colIndices.every(ci => {
                const v = row[ci];
                return typeof v === 'number' && !isNaN(v);
            });
        });

        const k = xColumns.length + 1;
        if (cleanRows.length < k + 1) {
            throw new Error(`有效数据不足（至少需要 ${k + 1} 条，当前 ${cleanRows.length} 条）`);
        }

        const n = cleanRows.length;
        const X = cleanRows.map(row => [1, ...colIndices.map(ci => row[ci])]);
        const y = cleanRows.map(row => row[yIdx]);

        const Xt = matTranspose(X);
        const XtX = matMul(Xt, X);
        const XtXInv = matInverse(XtX);
        if (!XtXInv) throw new Error('矩阵不可逆，无法求解回归系数');

        const Xty = matMul(Xt, y.map(v => [v]));
        const beta = matMul(XtXInv, Xty).map(r => r[0]);

        const yPred = X.map(row => row.reduce((s, v, j) => s + v * beta[j], 0));
        const yMean = arrMean(y);

        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            ssRes += (y[i] - yPred[i]) ** 2;
            ssTot += (y[i] - yMean) ** 2;
        }

        const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
        const dfModel = k - 1;
        const dfResidual = n - k;

        let fStat = 0, fPValue = 1;
        if (dfResidual > 0 && ssTot > 0 && ssRes > 0) {
            fStat = ((ssTot - ssRes) / dfModel) / (ssRes / dfResidual);
            fPValue = 1 - fCDF(fStat, dfModel, dfResidual);
        }

        const mse = dfResidual > 0 ? ssRes / dfResidual : 0;
        const seBeta = XtXInv.map((row, i) => Math.sqrt(Math.max(0, mse * row[i])));

        const coefficients = {
            intercept: { value: beta[0], std_error: seBeta[0] },
        };

        for (let i = 0; i < xColumns.length; i++) {
            const idx = i + 1;
            const tVal = seBeta[idx] > 0 ? beta[idx] / seBeta[idx] : 0;
            const tP = dfResidual > 0 ? tPValue2(tVal, dfResidual) : 1;
            coefficients[xColumns[i]] = {
                value: beta[idx],
                std_error: seBeta[idx],
                t_statistic: tVal,
                p_value: tP,
            };
        }

        const adjRSquared = (n > k) ? 1 - (1 - rSquared) * (n - 1) / (n - k) : 0;

        return {
            r_squared: rSquared,
            adj_r_squared: adjRSquared,
            f_statistic: fStat,
            f_p_value: fPValue,
            coefficients,
            n,
            n_predictors: xColumns.length,
        };
    }

    function normalityTest(data, params) {
        const column = params.column;
        if (!column) throw new Error('需要指定 column');

        const values = getNumericColumn(data, column);
        if (values.length < 8) throw new Error('有效数据不足（至少需要 8 个数据点）');

        const n = values.length;
        const m = arrMean(values);
        const s = arrStd(values, 1);
        const sk = arrSkewness(values);
        const ku = arrKurtosis(values);

        let stat, pValue, testName;

        if (n > 5000) {
            testName = 'dagostino_pearson';
            const z1 = skewnessZScore(values, n);
            const z2 = kurtosisZScore(values, n);
            stat = z1 * z1 + z2 * z2;
            pValue = chiSquarePValue(stat, 2);
        } else {
            testName = 'shapiro_wilk';
            const result = shapiroWilk(values);
            stat = result.W;
            pValue = result.p;
        }

        return {
            test: testName,
            statistic: stat,
            p_value: pValue,
            is_normal: pValue >= 0.05,
            mean: m,
            std: s,
            skewness: sk,
            kurtosis: ku,
            n,
        };
    }

    function skewnessZScore(values, n) {
        const sk = arrSkewness(values);
        const ses = Math.sqrt(6 * (n - 2) / ((n + 1) * (n + 3)));
        if (ses === 0) return 0;
        const y = sk / ses;
        const beta2 = 3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3) /
                      ((n - 2) * (n + 5) * (n + 7) * (n + 9));
        const w2 = -1 + Math.sqrt(2 * (beta2 - 1));
        if (w2 <= 0) return 0;
        const delta = 1 / Math.sqrt(0.5 * Math.log(w2));
        const alpha = Math.sqrt(2 / (w2 - 1));
        const z = delta * Math.log(y / alpha + Math.sqrt((y / alpha) ** 2 + 1));
        return z;
    }

    function kurtosisZScore(values, n) {
        const ku = arrKurtosis(values);
        const ek = ku;
        const varK = 24 * n * (n - 2) * (n - 3) / ((n + 1) ** 2 * (n + 3) * (n + 5));
        if (varK <= 0) return 0;
        const x = ek / Math.sqrt(varK);
        const beta1 = 6 * (n * n - 5 * n + 2) / ((n + 7) * (n + 9)) *
                      Math.sqrt(6 * (n + 3) * (n + 5) / (n * (n - 2) * (n - 3)));
        const A = 6 + 8 / beta1 * (2 / beta1 + Math.sqrt(1 + 4 / (beta1 ** 2)));
        if (A <= 0) return 0;
        const term1 = 1 - 2 / (9 * A);
        const term2 = (1 - 2 / A) / (1 + x * Math.sqrt(2 / (A - 4)));
        const cubeRoot = Math.cbrt(Math.abs(term2)) * Math.sign(term2);
        const z = (term1 - cubeRoot) / Math.sqrt(2 / (9 * A));
        return z;
    }

    function shapiroWilk(values) {
        const n = values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const mean = arrMean(sorted);

        let ss = 0;
        for (const v of sorted) ss += (v - mean) ** 2;
        if (ss === 0) return { W: 1, p: 1 };

        const m = new Array(n);
        for (let i = 0; i < n; i++) {
            m[i] = normalQuantile((i + 1 - 0.375) / (n + 0.25));
        }

        let mNorm = 0;
        for (let i = 0; i < n; i++) mNorm += m[i] * m[i];
        mNorm = Math.sqrt(mNorm);

        const a = m.map(v => v / mNorm);

        let sumAX = 0;
        for (let i = 0; i < n; i++) sumAX += a[i] * sorted[i];

        const W = (sumAX ** 2) / ss;

        let p;
        if (n <= 11) {
            const gamma = 0.459 * n - 2.273;
            const alpha = -1.0 / (0.110 + 0.0884 * n);
            const w1 = -Math.log(gamma - Math.log(1 - W));
            const mu = -0.0006714 * n ** 3 + 0.025054 * n ** 2 - 0.39978 * n + 0.544;
            const sigma = Math.exp(-0.0020322 * n ** 3 + 0.062767 * n ** 2 - 0.77857 * n + 1.3822);
            const z = (w1 - mu) / sigma;
            p = 1 - normalCDF(z);
        } else {
            const ln1mW = Math.log(1 - W);
            const mu = 0.0038915 * Math.log(n) ** 3 - 0.083751 * Math.log(n) ** 2 - 0.31082 * Math.log(n) - 1.5861;
            const sigma = Math.exp(0.0030302 * Math.log(n) ** 2 - 0.082676 * Math.log(n) - 0.4803);
            const z = (ln1mW - mu) / sigma;
            p = 1 - normalCDF(z);
        }

        p = Math.max(0, Math.min(1, p));
        return { W, p };
    }

    function outlierDetection(data, params) {
        const column = params.column;
        const method = params.method || 'iqr';
        const threshold = params.threshold;

        if (!column) throw new Error('需要指定 column');

        const values = getNumericColumn(data, column);
        if (values.length < 4) throw new Error('有效数据不足（至少需要 4 个数据点）');

        const n = values.length;
        let outlierIndices = [];
        let outlierValues = [];
        let bounds = {};

        if (method === 'zscore') {
            const zThreshold = threshold !== null && threshold !== undefined ? threshold : 3.0;
            const m = arrMean(values);
            const s = arrStd(values, 1);
            if (s === 0) {
                outlierIndices = [];
                outlierValues = [];
            } else {
                values.forEach((v, i) => {
                    if (Math.abs((v - m) / s) > zThreshold) {
                        outlierIndices.push(i);
                        outlierValues.push(v);
                    }
                });
            }
            bounds = { z_threshold: zThreshold };
        } else if (method === 'iqr') {
            const iqrMultiplier = threshold !== null && threshold !== undefined ? threshold : 1.5;
            const q1 = arrPercentile(values, 25);
            const q3 = arrPercentile(values, 75);
            const iqr = q3 - q1;
            const lowerBound = q1 - iqrMultiplier * iqr;
            const upperBound = q3 + iqrMultiplier * iqr;
            values.forEach((v, i) => {
                if (v < lowerBound || v > upperBound) {
                    outlierIndices.push(i);
                    outlierValues.push(v);
                }
            });
            bounds = { lower: lowerBound, upper: upperBound };
        } else {
            throw new Error(`未知检测方法: ${method}，支持 'iqr' 和 'zscore'`);
        }

        return {
            method,
            n_outliers: outlierIndices.length,
            outlier_indices: outlierIndices.slice(0, 100),
            outlier_values: outlierValues.slice(0, 100),
            n_total: n,
            outlier_ratio: outlierIndices.length / n,
            bounds,
            stats: {
                mean: arrMean(values),
                std: arrStd(values, 1),
                min: Math.min(...values),
                max: Math.max(...values),
                q1: arrPercentile(values, 25),
                median: arrMedian(values),
                q3: arrPercentile(values, 75),
            },
        };
    }

    // ==================== 路由入口 ====================

    function run(data, method, params) {
        params = params || {};
        const handlers = {
            describe,
            ttest,
            correlation,
            regression,
            anova,
            chi_square: chiSquare,
            mann_whitney: mannWhitney,
            wilcoxon,
            kruskal: kruskalWallis,
            multi_regression: multipleRegression,
            normality: normalityTest,
            outliers: outlierDetection,
        };
        const handler = handlers[method];
        if (!handler) throw new Error(`未知分析方法: ${method}`);
        return handler(data, params);
    }

    window.StatAnalysis = { run };
})();
