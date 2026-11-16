# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15, implementing the trend test decided by team AETHER (see docs/plan-tests-tendencia.md). Reviewed by team AETHER.
# AI-generated change, 2026-11-15: test that the Hansen loss trend years start at the method-change year and never include an earlier year.
# AI-generated change, 2026-11-15 (even later): test that the daytime LST trend years end at LST_TREND_LAST_YEAR although LST is published to the end of the series.
# AI-generated change, 2026-11-15 (later the same day): tests of the 95 % confidence interval of Sen's slope (sen_slope_ci).
# AI-generated change, 2026-11-15 (final review): cross-check of sen_slope_ci against scipy.stats.theilslopes.
"""Checks of pipeline/trends.py on synthetic series.   python -m pipeline.test_trends"""
import numpy as np

from .config import TREND_ALPHA
from .config import HANSEN_LOSS_TREND_YEARS, HANSEN_METHOD_CHANGE_YEAR, LST_TREND_LAST_YEAR
from .export_api import TREND_YEARS
from .trends import (COVER, MONTHLY, ci_per_decade, min_years, mk_test, run_procedure, sen_slope, sen_slope_ci, yearly_from_monthly)

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


def test_hansen_loss_trend_starts_at_the_method_change_and_never_includes_an_earlier_year():
    first, last = HANSEN_LOSS_TREND_YEARS
    assert first == HANSEN_METHOD_CHANGE_YEAR and last >= first
    assert (COVER["lossKm2"]["first"], COVER["lossKm2"]["last"]) == (first, last)
    assert "lossKm2Early" not in COVER                              # one trend per measure


def test_lst_day_trend_years_end_at_lst_trend_last_year():
    assert LST_TREND_LAST_YEAR == 2020
    assert MONTHLY["lst_day"]["years"] == (2001, LST_TREND_LAST_YEAR)
    assert tuple(TREND_YEARS["lst_day"]) == (2001, LST_TREND_LAST_YEAR)   # export_api and trends agree
    m = np.arange(1, 12 * 26 + 1, dtype=float)[None, :]                   # 26 years of months (2001-2026) of a published series
    y = list(range(2001, LST_TREND_LAST_YEAR + 1))
    assert yearly_from_monthly(m, 2001, y, "mean").shape == (1, len(y))   # later months never enter the tested yearly values


def test_ci_contains_the_sen_slope_and_the_true_slope_of_a_noisy_line():
    rng = np.random.default_rng(5)
    t = np.array(YEARS)
    true = 0.05                                                    # per year
    Y = true * (t - 2001) + rng.normal(0, 0.3, (200, len(YEARS)))
    inside_true, inside_sen = 0, 0
    for x in Y:
        s, _ = sen_slope(x, t)
        _, var_s = mk_test(x, "original")
        lo, hi = sen_slope_ci(x, t, var_s)
        inside_sen += lo <= s <= hi
        inside_true += lo <= true <= hi
    assert inside_sen == len(Y)                                    # the CI always contains the Sen slope
    assert inside_true / len(Y) >= 0.9, inside_true               # nominal level 95 %
    # a perfectly linear series has all pairwise slopes equal: a CI of zero width on the true slope
    x = true * (t - 2001).astype(float)
    lo, hi = sen_slope_ci(x, t, mk_test(x, "original")[1])
    assert abs(lo - true) < 1e-9 and abs(hi - true) < 1e-9


def test_ci_of_pure_noise_contains_zero_in_most_cells_and_the_sen_slope_always():
    rng = np.random.default_rng(6)
    t = np.array(YEARS)
    Y = rng.normal(0, 1, (200, len(YEARS)))
    Y[:50, 3:6] = np.nan                                           # missing years are honoured (real year gaps)
    res = run_procedure(Y, YEARS, "original")
    lo = np.array([c[0] for c in res["ci"]])
    hi = np.array([c[1] for c in res["ci"]])
    assert (lo <= res["slope"]).all() and (res["slope"] <= hi).all()
    assert ((lo <= 0) & (0 <= hi)).mean() >= 0.9
    res2 = run_procedure(Y, YEARS, "hamed_rao")                    # the Hamed-Rao variance gives a CI around the same slope
    assert all(c is not None and c[0] <= s <= c[1] for c, s in zip(res2["ci"], res2["slope"]))


def test_ci_is_published_per_decade_and_none_when_not_tested():
    assert ci_per_decade((0.01, 0.03)) == [0.1, 0.3] and ci_per_decade(None) is None
    Y = np.full((1, len(YEARS)), np.nan)
    assert run_procedure(Y, YEARS, "original")["ci"] == [None]


def test_sen_slope_ci_agrees_with_scipy_theilslopes():
    from scipy.stats import theilslopes
    rng = np.random.default_rng(11)
    t = np.array(YEARS)
    width_ok = 0
    for k, (slope, sd, missing) in enumerate([(0.05, 0.3, []), (-0.02, 0.2, [5]), (0.0, 0.5, [3, 12, 20]), (0.1, 0.8, [0, 24])]):
        x = slope * (t - 2001) + rng.normal(0, sd, len(t))
        x[missing] = np.nan
        ok = np.isfinite(x)
        s, _ = sen_slope(x, t)
        lo, hi = sen_slope_ci(x, t, mk_test(x, "original")[1])
        ref = theilslopes(x[ok], t[ok], alpha=0.95)    # (slope, intercept, low, high)
        assert abs(s - ref[0]) < 1e-9, (k, s, ref[0])
        tol = 0.05 * (ref[3] - ref[2])                 # we interpolate between ranks; SciPy rounds them
        assert abs(lo - ref[2]) <= tol and abs(hi - ref[3]) <= tol, (k, lo, hi, ref[2], ref[3])
        width_ok += 1
    assert width_ok == 4


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print("ok", fn.__name__)
    print(f"{len(tests)} tests passed")
