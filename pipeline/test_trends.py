# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15, implementing the trend test decided by team AETHER (see docs/plan-tests-tendencia.md). Reviewed by team AETHER.
"""Checks of pipeline/trends.py on synthetic series.   python -m pipeline.test_trends"""
import numpy as np

from .config import TREND_ALPHA
from .trends import min_years, run_procedure, sen_slope, yearly_from_monthly

YEARS = list(range(2001, 2026))


def test_linear_trend_is_detected_with_the_right_sign():
    rng = np.random.default_rng(1)
    t = np.arange(len(YEARS))
    up = 0.05 * t + rng.normal(0, 0.05, (30, len(YEARS)))      # +0.5 per decade, small noise
    down = -0.05 * t + rng.normal(0, 0.05, (30, len(YEARS)))
    res = run_procedure(np.vstack([up, down]), YEARS, "original")
    assert res["tested"].all()
    assert res["significant"].all()
    assert (res["slope"][:30] > 0).all() and (res["slope"][30:] < 0).all()
    assert abs(np.median(res["slope"][:30]) * 10 - 0.5) < 0.05   # Sen slope per decade close to the truth
    assert res["p"].min() >= 0 and res["p"].max() <= 1


def test_white_noise_is_mostly_not_significant_after_fdr():
    rng = np.random.default_rng(2)
    res = run_procedure(rng.normal(0, 1, (400, len(YEARS))), YEARS, "original")
    share = res["significant"].sum() / res["tested"].sum()
    assert share < 0.02, share                                    # raw p < 0.05 would flag ~5 %
    assert (res["p"] < TREND_ALPHA).mean() > share                # FDR is stricter than the raw p-value


def test_hamed_rao_runs_and_keeps_the_slope():
    rng = np.random.default_rng(3)
    t = np.arange(len(YEARS))
    Y = 0.1 * t + rng.normal(0, 0.3, (20, len(YEARS)))
    a, b = run_procedure(Y, YEARS, "original"), run_procedure(Y, YEARS, "hamed_rao")
    assert np.allclose(a["slope"], b["slope"])
    assert np.isfinite(b["p"][b["tested"]]).all()


def test_annual_aggregation_needs_twelve_months():
    m = np.arange(1, 37, dtype=float)[None, :]                    # 3 years of months 1..36
    assert np.allclose(yearly_from_monthly(m, 2001, [2001, 2002, 2003], "sum")[0], [78, 222, 366])
    m2 = m.copy()
    m2[0, 5] = np.nan                                             # one missing month in 2001
    out = yearly_from_monthly(m2, 2001, [2001, 2002, 2003], "mean")[0]
    assert np.isnan(out[0]) and np.allclose(out[1:], [18.5, 30.5])
    short = yearly_from_monthly(m[:, :30], 2001, [2001, 2002, 2003], "mean")[0]   # 2003 has only 6 months
    assert np.isfinite(short[:2]).all() and np.isnan(short[2])


def test_sum_versus_mean():
    m = np.full((1, 24), 2.0)
    assert yearly_from_monthly(m, 2001, [2001, 2002], "mean")[0, 0] == 2.0
    assert yearly_from_monthly(m, 2001, [2001, 2002], "sum")[0, 0] == 24.0


def test_minimum_years_rule_gives_nulls():
    assert min_years(25) == 20 and min_years(20) == 16
    rng = np.random.default_rng(4)
    t = np.arange(len(YEARS))
    Y = 0.1 * t + rng.normal(0, 0.01, (3, len(YEARS)))
    Y[1, :6] = np.nan                                             # 19 of 25 years: below 80 %
    Y[2, :5] = np.nan                                             # 20 of 25 years: exactly 80 %
    res = run_procedure(Y, YEARS, "original")
    assert list(res["tested"]) == [True, False, True]
    assert np.isnan(res["p"][1]) and np.isnan(res["slope"][1]) and not res["significant"][1]


def test_sen_slope_uses_the_real_year_gaps():
    t = np.array(YEARS)
    x = 2.0 * (t - 2001).astype(float)
    x[10:13] = np.nan                                             # three missing years do not change the slope
    assert abs(sen_slope(x, t)[0] - 2.0) < 1e-9


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print("ok", fn.__name__)
    print(f"{len(tests)} tests passed")
