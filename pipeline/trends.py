# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15, implementing the trend test decided by team AETHER (see docs/plan-tests-tendencia.md). Reviewed by team AETHER.
# AI-generated change, 2026-11-15: Hansen yearly loss is tested over 2011-2025 only because of the 2011 method change; adds validation "hansenConsistency" (Hansen vs INPE PRODES). Reviewed by team AETHER.
# AI-generated change, 2026-11-15 (even later, team decision of Alexis): daytime LST is published to the end of the series; its test years stay 2001-LST_TREND_LAST_YEAR (2020). Reviewed by team AETHER.
# AI-generated change, 2026-11-15 (later the same day, team decision): ONE loss trend (the separate 2001-2010 trend and the V2 fallback were removed); every trend now also publishes the 95 % confidence interval of Sen's slope (slopeCi95, Gilbert 1987). Reviewed by team AETHER.
# AI-generated change, 2026-11-15 (final review): text-only edits of the published method texts (plain words instead of internal codes, drift wording, missing years, zone multiple-test note); no computed number changed.
"""Step 8 · Trend test per 1 degree cell and zone, with its own validation.

    python -m pipeline.trends        (run after export_api, export_cover and validate)

Reads web/server/data/series/<id>.json (monthly values per API cell), cover.json (loss and MODIS tree cover per cell)
and web/public/data/amazon_{monthly,annual}.json (zone series). Writes:
  web/server/data/trends/<id>.json   slopePerDecade, pValue, significant, line (Sen line end points), method (contract in web/shared/contracts.ts)
  web/server/data/cover.json         per cell "trends" for lossKm2 and modisTreeCover, plus "trendMethod"
  web/server/data/zones.json         yearly values, monthly ranges, zone trend and cell summary per zone
  web/server/data/validation.json    new key "trendChecks" (D1 drift check, V1 to V4); the rest is kept

Method (team decisions, spec of 2026-11-15; PRE-REGISTERED rules are applied exactly as written):
  1. Yearly value per cell: mean of the 12 months (sum for rainfall and burned area), only years with all 12 months.
     This removes the seasonal cycle from the test (B2). A cell needs >= 80 % of the variable's years (else not tested).
  2. Mann-Kendall test (pymannkendall) on the yearly values; Sen's slope x 10 = change per decade, published with its
     95 % confidence interval (slopeCi95, see sen_slope_ci: Gilbert 1987, built on the variance of the test used).
     Sen's slope is computed here with the real year differences, so a missing year does not shift the time axis
     (pymannkendall assumes equal spacing); it equals pymannkendall's slope when no year is missing.
  3. PRE-REGISTERED: lag-1 autocorrelation of the residuals around the Sen line; if more than 20 % of the tested cells of
     a variable have |r1| > 1.96/sqrt(n), the Hamed-Rao modified test is used for that variable, else the original test.
  4. Benjamini-Hochberg FDR (statsmodels fdr_bh) over all tested cells of one variable; significant = q < 0.05.
  5. Hansen tree cover is not tested (it cannot rise by construction): Hansen yearly loss km2 and MODIS tree cover
     (2000-2024, 2025 excluded as suspect) are tested instead. Hansen loss has ONE trend, over 2011-2025 ("lossKm2"), the
     years Hansen processed with one consistent method; 2001-2010 stay published but are not tested (config.
     HANSEN_LOSS_TREND_YEARS and validation.json trendChecks.hansenConsistency, which keeps the evidence for the choice).
  6. D1 (PRE-REGISTERED): Pearson r between the yearly Terra overpass time and the NDVI/EVI anomaly, 2015-2025; if
     |r| >= 0.5 that variable's test ends in 2020.
  7. Validation (V1 shuffled years, V2 injected trend, V3 known places, V4 zones) goes to validation.json "trendChecks".
"""
import json
from datetime import datetime, timezone

import numpy as np
import pymannkendall as pmk
from scipy.stats import pearsonr
from statsmodels.stats.multitest import multipletests

from .export_api import TREND_YEARS
from .config import (AI_DISCLOSURE, ANALYSIS_START, HANSEN_LOSS_TREND_YEARS, HANSEN_METHOD_CHANGE_YEAR, HANSEN_NOTES_QUOTES,
                     HANSEN_NOTES_URL, LST_TREND_LAST_YEAR, OUTPUT, PRODES_AMAZON_KM2, PRODES_SOURCE, ROOT,
                     TREND_AC_SHARE_THRESHOLD, TREND_ALPHA, TREND_CI_LEVEL, TREND_CI_Z, TREND_DRIFT_R, TREND_MIN_COMPLETE_SHARE, TREND_PERMUTATIONS,
                     TREND_SEED, TREND_YEARS_PER_DECADE)

SERVER = ROOT / "web" / "server" / "data"
START_YEAR = int(ANALYSIS_START[:4])

# variable -> yearly aggregation, first and last year tested, units of the yearly value (cell level), zone units
MONTHLY = {
    "ndvi": {"agg": "mean", "years": (2001, 2025), "units": "unitless", "zoneUnits": "unitless", "name": "NDVI"},
    "evi": {"agg": "mean", "years": (2001, 2025), "units": "unitless", "zoneUnits": "unitless", "name": "EVI"},
    "lst_day": {"agg": "mean", "years": (2001, LST_TREND_LAST_YEAR), "units": "°C", "zoneUnits": "°C",
                "name": "daytime land surface temperature"},
    "precip": {"agg": "sum", "years": (2001, 2024), "units": "mm per year", "zoneUnits": "mm per year", "name": "rainfall"},
    "burned_area": {"agg": "sum", "years": (2001, 2025), "units": "% of cell per year", "zoneUnits": "km² per year",
                    "name": "burned area"},
}
# Cover variables read from cover.json: first and last year tested (MODIS 2025 excluded, rule D2).
COVER = {
    "lossKm2": {"first": HANSEN_LOSS_TREND_YEARS[0], "last": HANSEN_LOSS_TREND_YEARS[1],
                "units": "km² per year", "name": "Hansen tree cover loss (2011-2025)"},
    "modisTreeCover": {"first": 2000, "last": 2024, "units": "% of cell", "name": "MODIS tree cover"},
}
# Zone series: variable -> (file, source key, statistic, years displayed, zone units)
ZONE_COVER = {"lossKm2": ("annual", "hansen_loss_area", "total"), "modisTreeCover": ("annual", "tree_cover", "mean"),
              "hansenTreeCover": ("annual", "hansen_tree_cover", "mean")}
ZONE_COVER_UNITS = {"lossKm2": "km² per year", "modisTreeCover": "%", "hansenTreeCover": "%"}
ZONES_OUT = ["amazon", "amazon_brazil", "amazon_peru"]


# ---------------------------------------------------------------- the test ----
def pairwise_slopes(x, t):
    """Slopes (per year) between every pair of years with both values present, using the real year differences."""
    ok = np.isfinite(x)
    x, t = x[ok], np.asarray(t)[ok].astype(float)
    i, j = np.triu_indices(len(x), 1)
    return (x[j] - x[i]) / (t[j] - t[i])


def sen_slope(x, t):
    """Sen's slope (median of pairwise slopes, per year) and intercept of the Kendall-Theil line; NaNs are skipped."""
    ok = np.isfinite(x)
    x, t = x[ok], t[ok].astype(float)
    slope = float(np.median(pairwise_slopes(x, t)))
    return slope, float(np.median(x - slope * t))


def sen_slope_ci(x, t, var_s):
    """95 % confidence interval of Sen's slope (per year), the standard Mann-Kendall/Sen procedure (Gilbert 1987,
    "Statistical Methods for Environmental Pollution Monitoring"; also the US EPA MAKESENS tool). With N' pairwise
    slopes and var_s the variance of the Mann-Kendall statistic S of the test used (the Hamed-Rao corrected one when that
    test is used): C = z * sqrt(var_s), M1 = (N' - C) / 2, M2 = (N' + C) / 2; the limits are the M1-th and the
    (M2 + 1)-th smallest pairwise slopes (linear interpolation between neighbours for a non-integer rank, ranks kept
    within 1..N'). It is built on the same pairwise slopes as the Sen slope, so it always contains it.
    Returns (lower, upper) or None when there is no valid variance."""
    slopes = np.sort(pairwise_slopes(x, t))
    n_pairs = len(slopes)
    if n_pairs == 0 or var_s is None or not np.isfinite(var_s) or var_s < 0:
        return None
    c = TREND_CI_Z * np.sqrt(var_s)

    def at(rank):  # 1-based rank, linear interpolation between the two neighbouring sorted slopes
        r = min(max(rank, 1.0), float(n_pairs)) - 1.0
        lo = int(np.floor(r))
        hi = min(lo + 1, n_pairs - 1)
        return float(slopes[lo] + (r - lo) * (slopes[hi] - slopes[lo]))

    return at((n_pairs - c) / 2.0), at((n_pairs + c) / 2.0 + 1.0)


def ci_per_decade(ci):
    """CI (per year) -> [low, high] per decade with the same significant digits as the slope; None when missing."""
    if ci is None:
        return None
    lo, hi = sig_digits(ci[0] * TREND_YEARS_PER_DECADE), sig_digits(ci[1] * TREND_YEARS_PER_DECADE)
    return None if lo is None or hi is None else [lo, hi]


def sen_line_ends(x, t, slope, first, last):
    """End points of the Sen line over the tested years first..last, as pymannkendall places it:
    intercept = median(x) - median(t) * slope (pymannkendall uses the index; with real years the line is the same)."""
    ok = np.isfinite(x)
    b = float(np.median(x[ok]) - np.median(np.asarray(t, float)[ok]) * slope)
    return {"start": {"year": int(first), "value": sig_digits(b + slope * first)},
            "end": {"year": int(last), "value": sig_digits(b + slope * last)}}


def lag1_residual_r(x, t, slope, intercept):
    """Lag-1 autocorrelation of the residuals around the Sen line (consecutive years only)."""
    ok = np.isfinite(x)
    xs, ts = x[ok], t[ok].astype(float)
    e = xs - (slope * ts + intercept)
    e = e - e.mean()
    den = float(np.sum(e * e))
    if den == 0.0:
        return 0.0
    consecutive = np.diff(ts) == 1
    return float(np.sum(e[:-1][consecutive] * e[1:][consecutive]) / den)


def mk_test(x, test):
    """(two-sided p-value, variance of S) of the Mann-Kendall test (original or Hamed-Rao) on the non-missing values,
    in order. The variance is the one the p-value comes from (the corrected one for Hamed-Rao)."""
    xv = x[np.isfinite(x)]
    r = pmk.original_test(xv, alpha=TREND_ALPHA)
    p, var_s = float(r.p), float(r.var_s)
    if test == "hamed_rao":
        r2 = pmk.hamed_rao_modification_test(xv, alpha=TREND_ALPHA)
        # a constant series or a negative corrected variance gives no p-value: fall back to the original test
        if np.isfinite(r2.p):
            p, var_s = float(r2.p), float(r2.var_s)
    return p, var_s


def mk_p(x, test):
    """Two-sided p-value of the Mann-Kendall test (original or Hamed-Rao) on the non-missing values, in order."""
    return mk_test(x, test)[0]


def min_years(n_years):
    return int(np.ceil(TREND_MIN_COMPLETE_SHARE * n_years - 1e-9))


def fdr(p, tested):
    """Benjamini-Hochberg adjusted p (q) for the tested cells; NaN elsewhere."""
    q = np.full(p.shape, np.nan)
    if tested.sum():
        q[tested] = multipletests(p[tested], alpha=TREND_ALPHA, method="fdr_bh")[1]
    return q


def run_procedure(Y, years, test):
    """Full procedure on a matrix cells x years (NaN = missing year): test, Sen slope, autocorrelation, FDR.

    Returns a dict: tested, slope (per year), p, q, significant, ac (residual autocorrelation flag), n, line (Sen line
    end points) and ci (95 % CI of the slope per year, one (low, high) per cell).
    """
    years = np.asarray(years)
    n_cells = Y.shape[0]
    n = np.isfinite(Y).sum(axis=1)
    tested = n >= min_years(len(years))
    slope = np.full(n_cells, np.nan)
    p = np.full(n_cells, np.nan)
    ac = np.zeros(n_cells, bool)
    line = [None] * n_cells
    ci = [None] * n_cells      # 95 % CI of the slope per year, (low, high)
    for k in np.flatnonzero(tested):
        s, b = sen_slope(Y[k], years)
        slope[k] = s
        p[k], var_s = mk_test(Y[k], test)
        ci[k] = sen_slope_ci(Y[k], years, var_s)
        ac[k] = abs(lag1_residual_r(Y[k], years, s, b)) > 1.96 / np.sqrt(n[k])
        line[k] = sen_line_ends(Y[k], years, s, years[0], years[-1])
    q = fdr(p, tested)
    sig = tested & (q < TREND_ALPHA)
    return {"tested": tested, "slope": slope, "p": p, "q": q, "significant": sig, "ac": ac, "n": n, "line": line, "ci": ci}


def choose_and_run(Y, years):
    """PRE-REGISTERED autocorrelation rule: original test unless > 20 % of the tested cells have autocorrelation."""
    res = run_procedure(Y, years, "original")
    share = float(res["ac"][res["tested"]].mean()) if res["tested"].any() else 0.0
    test = "hamed_rao" if share > TREND_AC_SHARE_THRESHOLD else "original"
    if test == "hamed_rao":
        res = run_procedure(Y, years, "hamed_rao")
    return test, share, res


# ---------------------------------------------------------------- data in ----
def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def yearly_from_monthly(M, first_year, years, agg):
    """M: (..., months) from first_year-01. Yearly value only where all 12 months exist (else NaN)."""
    out = np.full(M.shape[:-1] + (len(years),), np.nan)
    for j, y in enumerate(years):
        a = (y - first_year) * 12
        if a < 0 or a + 12 > M.shape[-1]:
            continue
        blk = M[..., a:a + 12]
        full = np.isfinite(blk).all(axis=-1)
        val = blk.sum(axis=-1) if agg == "sum" else blk.mean(axis=-1)
        val = np.round(val, 6)  # keep real ties as ties (float noise would break the tie-sensitive tests)
        out[..., j] = np.where(full, val, np.nan)
    return out


def zone_monthly(zm, zone, key, stat):
    """Monthly zone series as (first year, array from January of the first year; NaN for missing months)."""
    s = zm["series"][zone][key]
    months = s["t"]
    y0 = int(months[0][:4])
    arr = np.full((int(months[-1][:4]) - y0 + 1) * 12, np.nan)
    for m, v in zip(months, s[stat]):
        arr[(int(m[:4]) - y0) * 12 + int(m[5:7]) - 1] = np.nan if v is None else v
    return y0, arr


def drift_check(zm):
    """D1: Pearson r, 2015-2025, between the yearly Terra overpass time and the NDVI/EVI anomaly (Amazon zone)."""
    y0, tm = zone_monthly(zm, "amazon", "lst_day_local_time", "mean")
    years = list(range(2015, 2026))
    tm_y = yearly_from_monthly(tm, y0, years, "mean")
    out = {"years": [2015, 2025], "overpassHoursFirstYear": round(float(tm_y[0]), 3),
           "overpassHoursLastYear": round(float(tm_y[-1]), 3), "variables": {}}
    for vid in ("ndvi", "evi"):
        y1, arr = zone_monthly(zm, "amazon", vid, "mean")
        allyears = list(range(2001, 2026))
        yearly = yearly_from_monthly(arr, y1, allyears, "mean")
        anomaly = yearly - np.nanmean(yearly)
        sel = np.array([y in years for y in allyears])
        r, p = pearsonr(tm_y, anomaly[sel])
        out["variables"][vid] = {"r": round(float(r), 3), "pValue": round(float(p), 4), "n": len(years),
                                 "endsIn2020": bool(abs(r) >= TREND_DRIFT_R)}
    out["rule"] = (f"If |r| >= {TREND_DRIFT_R} for a variable, its test ends in 2020 (like land surface temperature); "
                   "otherwise it keeps 2001-2025 and 2021-2025 are flagged as satellite drift years.")
    return out


def cover_matrix(cover, vid, years):
    """Cells x years matrix of a cover.json column (NaN = missing); lossKm2 is indexed by lossYears, the rest by years."""
    src_years = cover["lossYears"] if vid == "lossKm2" else cover["years"]
    idx = [src_years.index(y) for y in years]
    return np.array([[np.nan if c[vid][i] is None else c[vid][i] for i in idx] for c in cover["cells"]], float)


def load_cell_matrices(drift):
    """Yearly matrices for the five monthly variables and the two cover variables."""
    data = {}
    for vid, s in MONTHLY.items():
        layer = read_json(SERVER / "trends" / f"{vid}.json")
        series = read_json(SERVER / "series" / f"{vid}.json")
        first, last = s["years"]
        if vid in drift["variables"] and drift["variables"][vid]["endsIn2020"]:
            last = 2020
        years = list(range(first, last + 1))
        ids = [c["cellId"] for c in layer["cells"]]
        n_months = len(series[ids[0]])
        M = np.full((len(ids), n_months), np.nan)
        for k, cid in enumerate(ids):
            M[k] = [np.nan if p["value"] is None else p["value"] for p in series[cid]]
        assert series[ids[0]][0]["month"] == ANALYSIS_START
        data[vid] = {"layer": layer, "ids": ids, "years": years, "units": s["units"],
                     "Y": yearly_from_monthly(M, START_YEAR, years, s["agg"])}
    cover = read_json(SERVER / "cover.json")
    ids = [c["cellId"] for c in cover["cells"]]
    for vid, s in COVER.items():
        years = list(range(s["first"], s["last"] + 1))
        data[vid] = {"cover": cover, "ids": ids, "years": years, "units": s["units"], "Y": cover_matrix(cover, vid, years)}
    return data


# ---------------------------------------------------------------- outputs ----
def sig_digits(x, nd=5):
    return None if x is None or not np.isfinite(x) else float(f"{x:.{nd}g}")


def per_decade(vid, units):
    """Slope units in words. Indices without a physical unit (NDVI, EVI) read "NDVI units per decade" (P-035)."""
    if units == "unitless":
        return f"{MONTHLY.get(vid, {}).get('name', vid)} units per decade"
    return f"{units} per decade"


def trend_description(vid, years, units, share, test, drift_note, n_tested):
    s = MONTHLY[vid]
    first, last = years[0], years[-1]
    need = min_years(len(years))
    agg = "sum of its 12 months" if s["agg"] == "sum" else "mean of its 12 months"
    test_text = ("Hamed-Rao modified Mann-Kendall test, used because more than 20% of the cells show autocorrelation"
                 if test == "hamed_rao" else
                 "original Mann-Kendall test (no autocorrelation correction needed)")
    return (f"Yearly values: each cell's monthly values are combined into one value per year ({agg}), keeping only years "
            f"with all 12 months, so the seasonal cycle does not enter the test. Period tested: {first}-{last}. A cell is "
            f"tested only with at least {need} of {len(years)} complete years ({n_tested} cells tested). The trend is the "
            f"Mann-Kendall test on those yearly values ({test_text}; {share * 100:.0f}% of the tested cells show "
            f"residual autocorrelation) and its size is Sen's slope (median of the slopes between all pairs of years) "
            f"times 10, in {per_decade(vid, units)}; slopeCi95 is its 95% confidence interval (from the Mann-Kendall "
            f"variance, Gilbert 1987), also per decade. Because hundreds of cells are tested at once, the p-values are corrected "
            f"with the Benjamini-Hochberg false discovery rate across all tested cells of this variable; a cell is "
            f"significant when its adjusted q-value is below {TREND_ALPHA}. The pValue shown is the raw p-value of the "
            f"test, not q. Missing years: the Mann-Kendall test uses only the order of the yearly values, so a missing "
            f"year does not bias it (it has one value less). Sen's slope uses the real years. {drift_note} {AI_DISCLOSURE}")


def cell_summary(res, ids, zone_ids):
    sel = np.array([i for i, cid in enumerate(ids) if cid in zone_ids], int)
    t = res["tested"][sel]
    sg = res["significant"][sel]
    sl = res["slope"][sel]
    return {"tested": int(t.sum()), "significantIncreasing": int((sg & (sl > 0)).sum()),
            "significantDecreasing": int((sg & (sl < 0)).sum())}


def zone_cell_membership(ids):
    """Sets of cell ids per zone. A cell belongs to a country zone when most of its in-Amazon 0.05 degree
    sub-cells lie in that country; every cell belongs to the whole-Amazon zone."""
    from .config import API_CELL_DEG, BBOX
    from .tiles import LAT, LON
    from .zones import zone_masks
    masks = zone_masks(LAT, LON)
    nx = int(np.ceil((BBOX["lon_max"] - BBOX["lon_min"]) / API_CELL_DEG))
    iy = np.floor((LAT - BBOX["lat_min"]) / API_CELL_DEG).astype(int)
    ix = np.floor((LON - BBOX["lon_min"]) / API_CELL_DEG).astype(int)
    key = (iy[:, None] * nx + ix[None, :]).ravel()
    n_all = int(key.max()) + 1
    amazon = np.bincount(key, weights=masks["amazon"].values.ravel(), minlength=n_all)
    members = {"amazon": set(ids)}
    for z in ("amazon_brazil", "amazon_peru"):
        inside = np.bincount(key, weights=masks[z].values.ravel(), minlength=n_all)
        share = np.where(amazon > 0, inside / np.maximum(amazon, 1), 0)
        keys = []
        for cid in ids:
            r, c = int(cid[1:3]), int(cid[4:6])
            keys.append(r * nx + c)
        members[z] = {cid for cid, k in zip(ids, keys) if share[k] > 0.5}
    return members


# ---------------------------------------------------------------- validation ----
def v1_v2(Y, years, test, real, rng):
    """V1: shuffle the years of every cell, rerun test + FDR, TREND_PERMUTATIONS times. V2: add a linear trend equal to the
    median |Sen slope| of the cells significant in the real data to the shuffled series and measure how many are found."""
    t0 = years[0]
    sig = real["significant"]
    inject = float(np.median(np.abs(real["slope"][sig]))) if sig.any() else None
    fp, det, det_sign = [], [], []
    for _ in range(TREND_PERMUTATIONS):
        Ys = rng.permuted(Y, axis=1)
        r1 = run_procedure(Ys, years, test)
        fp.append(float(r1["significant"].sum() / max(r1["tested"].sum(), 1)))
        if inject is not None:
            Yt = Ys + inject * (np.asarray(years) - t0)[None, :]
            r2 = run_procedure(Yt, years, test)
            nt = max(r2["tested"].sum(), 1)
            det.append(float(r2["significant"].sum() / nt))
            det_sign.append(float((r2["significant"] & (r2["slope"] > 0)).sum() / nt))
    v1 = {"permutations": TREND_PERMUTATIONS, "meanShareSignificant": round(float(np.mean(fp)), 5),
          "maxShareSignificant": round(float(np.max(fp)), 5)}
    v2 = {"injectedSlopePerDecade": sig_digits(inject * TREND_YEARS_PER_DECADE) if inject is not None else None,
          "meanShareDetected": round(float(np.mean(det)), 4) if det else None,
          "minShareDetected": round(float(np.min(det)), 4) if det else None,
          "meanShareDetectedIncreasing": round(float(np.mean(det_sign)), 4) if det_sign else None}
    return v1, v2


def direction(slope):
    return None if slope is None else ("increasing" if slope > 0 else "decreasing" if slope < 0 else "flat")


def v3_places(results, ids_by_var, validation):
    """V3: loss and MODIS cover trends in the hotspot cells of validation.json and in the La Pampa cell."""
    places = []
    seen = {}
    for z in validation["zones"]:
        for h in z.get("hotspots", []):
            zones = seen.setdefault(h["apiCellId"], {"cellId": h["apiCellId"], "kind": "hotspot", "zones": []})["zones"]
            if z["zoneId"] not in zones:
                zones.append(z["zoneId"])
    for c in validation["cases"]:
        seen.setdefault(c["apiCellId"], {"cellId": c["apiCellId"], "kind": "case", "zones": []})
        seen[c["apiCellId"]].update({"kind": "case", "caseId": c["id"], "label": c["label"]})
    for cid, place in seen.items():
        out = dict(place)
        for vid, expected in (("lossKm2", "increasing"), ("modisTreeCover", "decreasing")):
            ids = ids_by_var[vid]
            res = results[vid]
            if cid not in ids or not res["tested"][ids.index(cid)]:
                out[vid] = None
                continue
            k = ids.index(cid)
            sl = float(res["slope"][k]) * TREND_YEARS_PER_DECADE
            out[vid] = {"slopePerDecade": sig_digits(sl), "slopeCi95": ci_per_decade(res["ci"][k]),
                        "pValue": sig_digits(float(res["p"][k])),
                        "qValue": sig_digits(float(res["q"][k])), "significant": bool(res["significant"][k]),
                        "direction": direction(sl), "expectedDirection": expected,
                        "directionAsExpected": direction(sl) == expected}
        places.append(out)
    return places


def zone_series(za, zm, zone, vid):
    """(years list, yearly values with NaN for incomplete years, aggregation) of a zone for any variable."""
    if vid in MONTHLY:
        y0, arr = zone_monthly(zm, zone, vid, "total" if vid == "burned_area" else "mean")
        n_years = int(np.ceil(len(arr) / 12))
        years = list(range(y0, y0 + n_years))
        return years, yearly_from_monthly(arr, y0, years, MONTHLY[vid]["agg"])
    _, key, stat = ZONE_COVER[vid]
    s = za["series"][zone][key]
    return list(s["t"]), np.round(np.array([np.nan if v is None else v for v in s[stat]], float), 6)


def monthly_ranges(zm, zone, vid):
    y0, arr = zone_monthly(zm, zone, vid, "total" if vid == "burned_area" else "mean")
    out = []
    for y in range(y0, y0 + int(np.ceil(len(arr) / 12))):
        a = (y - y0) * 12
        blk = arr[a:a + 12]
        if len(blk) < 12 or not np.isfinite(blk).all():
            continue
        out.append({"year": y, "min": round(float(blk.min()), 4), "minMonth": int(blk.argmin()) + 1,
                    "max": round(float(blk.max()), 4), "maxMonth": int(blk.argmax()) + 1})
    return out


def zone_trend(years, yearly, test_years, test):
    """Mann-Kendall + Sen on a zone yearly series restricted to test_years. Not corrected for multiple tests."""
    sel = [i for i, y in enumerate(years) if test_years[0] <= y <= test_years[1]]
    x = np.array([yearly[i] for i in sel], float)
    t = np.array([years[i] for i in sel])
    n = int(np.isfinite(x).sum())
    if n < min_years(test_years[1] - test_years[0] + 1):
        return {"slopePerDecade": None, "slopeCi95": None, "pValue": None, "significant": False,
                "years": list(test_years), "n": n}
    s, _ = sen_slope(x, t)
    p, var_s = mk_test(x, test)
    return {"slopePerDecade": sig_digits(s * TREND_YEARS_PER_DECADE), "slopeCi95": ci_per_decade(sen_slope_ci(x, t, var_s)),
            "pValue": sig_digits(p),
            "significant": bool(p < TREND_ALPHA), "years": list(test_years), "n": n,
            "line": sen_line_ends(x, t, s, test_years[0], test_years[1])}


def zone_trend_summary(years, yearly, period):
    """zone_trend-style dict with a direction word ("increasing", "decreasing", "none" when not significant)."""
    z = zone_trend(years, yearly, period, "original")
    sl = z["slopePerDecade"]
    z["trend"] = "none" if sl is None or not z["significant"] else ("increasing" if sl > 0 else "decreasing")
    z.pop("line", None)
    z.pop("years", None)
    z.pop("slopeCi95", None)   # the consistency evidence keeps its original fields
    return z


def hansen_modis_check(data, period, base_start, last3_end):
    """Across cells: Hansen loss summed over the period as % of the cell area vs the MODIS tree cover change
    (mean of the 3 years ending last3_end minus mean of the 3 years starting base_start). Returns Pearson r."""
    cover = data["lossKm2"]["cover"]
    cells = cover["cells"]
    area = np.array([111.32 ** 2 * np.cos(np.radians(c["lat"])) for c in cells])
    li = [cover["lossYears"].index(y) for y in range(period[0], period[1] + 1)]
    loss = np.array([[np.nan if c["lossKm2"][i] is None else c["lossKm2"][i] for i in li] for c in cells], float)
    loss_pct = np.nansum(loss, axis=1) / area * 100
    yi = cover["years"].index
    mod = np.array([[np.nan if v is None else v for v in c["modisTreeCover"]] for c in cells], float)
    late = np.nanmean(mod[:, [yi(y) for y in range(last3_end - 2, last3_end + 1)]], axis=1)
    base = np.nanmean(mod[:, [yi(y) for y in range(base_start, base_start + 3)]], axis=1)
    ok = np.isfinite(loss_pct) & np.isfinite(late) & np.isfinite(base)
    return round(float(pearsonr(loss_pct[ok], (late - base)[ok])[0]), 2)


def hansen_consistency(zones_out, data, results):
    """Evidence for the Hansen loss choice: Hansen yearly loss vs the official INPE PRODES series before (2001-2010) and
    after (2011-2025) the 2011 method change, and across the break. Only the 2011-2025 trend is published as a trend;
    the 2001-2010 numbers here are evidence only (they are computed here, nothing else uses them)."""
    prodes_years = sorted(PRODES_AMAZON_KM2)
    prodes = np.array([PRODES_AMAZON_KM2[y] for y in prodes_years], float)
    brazil = {a["year"]: a["value"] for a in zones_out["amazon_brazil"]["variables"]["lossKm2"]["annual"]}

    def zone_trends(period):
        out = {}
        for zone in ZONES_OUT:
            ann = zones_out[zone]["variables"]["lossKm2"]["annual"]
            out[zone] = zone_trend_summary([a["year"] for a in ann],
                                           [np.nan if a["value"] is None else a["value"] for a in ann], period)
        out["prodes"] = zone_trend_summary(prodes_years, prodes, period)
        return out

    area_def = ("Across the 566 cells: Hansen loss summed over the segment as % of the cell area (cell area = "
                "111.32**2 * cos(lat) km²) vs the change in MODIS tree cover (mean of the last 3 years of the segment minus "
                "mean of the 3 years starting the year before the segment; the late segment ends in 2024 because MODIS 2025 "
                "is flagged). A negative r means MODIS confirms where Hansen sees loss.")
    segments = []
    # MODIS base = the 3 years starting the year before the segment (2000-2002 for 2001-2010, 2010-2012 for 2011-2025)
    early = (2001, HANSEN_METHOD_CHANGE_YEAR - 1)   # (2001, 2010): not tested for a trend, evidence only
    cover = data["lossKm2"]["cover"]
    early_res = choose_and_run(cover_matrix(cover, "lossKm2", list(range(early[0], early[1] + 1))),
                               list(range(early[0], early[1] + 1)))[2]
    for (a, b), base_start, last3, res in ((early, 2000, 2010, early_res),
                                           (HANSEN_LOSS_TREND_YEARS, 2010, 2024, results["lossKm2"])):
        h = np.array([brazil[y] for y in range(a, b + 1)], float)
        pr = np.array([PRODES_AMAZON_KM2[y] for y in range(a, b + 1)], float)
        sl = res["slope"]
        segments.append({
            "years": [a, b],
            "hansenBrazilVsProdes": {"r": round(float(pearsonr(h, pr)[0]), 2), "ratio": round(float(h.sum() / pr.sum()), 2)},
            "zoneTrends": zone_trends((a, b)),
            "modisCheck": {"r": hansen_modis_check(data, (a, b), base_start, last3), "definition": area_def},
            "cells": {"tested": int(res["tested"].sum()),
                      "significantIncreasing": int((res["significant"] & (sl > 0)).sum()),
                      "significantDecreasing": int((res["significant"] & (sl < 0)).sum())}})
    across = zone_trends((2001, 2025))
    e, l = segments

    def word(t):   # trend word of zone_trend_summary in a sentence
        return "no clear trend" if t == "none" else f"an {t} trend" if t == "increasing" else f"a {t} trend"
    text = (f"Hansen loss in the Brazilian Amazon tracks the official INPE PRODES series in 2001-2010 "
            f"(r = {e['hansenBrazilVsProdes']['r']}, Hansen/PRODES ratio {e['hansenBrazilVsProdes']['ratio']}) but not in "
            f"2011-2025 (r = {l['hansenBrazilVsProdes']['r']}, ratio {l['hansenBrazilVsProdes']['ratio']}), after Hansen "
            f"reprocessed its data from 2011. Testing 2001-2025 in one piece gives {word(across['amazon']['trend'])} for the Amazon "
            f"(p = {across['amazon']['pValue']}) while PRODES shows {word(across['prodes']['trend'])} "
            f"(p = {across['prodes']['pValue']}): a result of the 2011 method change. So the published loss trend uses only "
            f"2011-2025, the years Hansen processed with one consistent method; all loss years 2001-2025 are shown, and "
            f"2001-2010 are real Hansen data from the earlier method that are not tested for a trend. In 2011-2025 the "
            f"whole-Amazon Hansen series shows {word(l['zoneTrends']['amazon']['trend'])} (p = {l['zoneTrends']['amazon']['pValue']}) "
            f"and PRODES shows {word(l['zoneTrends']['prodes']['trend'])} (p = {l['zoneTrends']['prodes']['pValue']}); for "
            f"comparison, 2001-2010 gives {word(e['zoneTrends']['amazon']['trend'])} for Hansen (p = {e['zoneTrends']['amazon']['pValue']}) "
            f"and {word(e['zoneTrends']['prodes']['trend'])} for PRODES (p = {e['zoneTrends']['prodes']['pValue']}). Where "
            f"Hansen sees more loss, MODIS tree cover falls more (r = {e['modisCheck']['r']} in 2001-2010, "
            f"{l['modisCheck']['r']} in 2011-2025).")
    return {"methodChangeYear": HANSEN_METHOD_CHANGE_YEAR,
            "hansenNotes": {"title": "Hansen/UMD Global Forest Change v1.13 user notes", "url": HANSEN_NOTES_URL,
                            "quotes": HANSEN_NOTES_QUOTES},
            "prodes": {**PRODES_SOURCE, "years": prodes_years, "km2": [PRODES_AMAZON_KM2[y] for y in prodes_years]},
            "segments": segments,
            "acrossBreak": {"years": [2001, 2025], "zoneTrends": across,
                            "note": "Not used: one test across the 2011 method change gives a rising Amazon trend while "
                                    "the official PRODES series falls."},
            "text": text}


# ---------------------------------------------------------------- main ----
def main():
    zm = read_json(OUTPUT / "amazon_monthly.json")
    za = read_json(OUTPUT / "amazon_annual.json")
    validation = read_json(SERVER / "validation.json")
    drift = drift_check(zm)
    for vid, d in drift["variables"].items():
        print(f"D1 {vid}: r = {d['r']} (p = {d['pValue']}, n = {d['n']}) -> {'test ends in 2020' if d['endsIn2020'] else 'keep 2001-2025'}")
    data = load_cell_matrices(drift)
    for vid, d in data.items():  # D1 must agree with the years published by export_api
        if vid in TREND_YEARS and (d["years"][0], d["years"][-1]) != tuple(TREND_YEARS[vid]):
            raise AssertionError(f"{vid}: tested years {d['years'][0]}-{d['years'][-1]} differ from export_api.TREND_YEARS "
                                 f"{TREND_YEARS[vid]}; D1 changed, update TREND_YEARS in pipeline/export_api.py and rerun it")

    results, tests, shares = {}, {}, {}
    for vid, d in data.items():
        test, share, res = choose_and_run(d["Y"], d["years"])
        results[vid], tests[vid], shares[vid] = res, test, share
        t = res["tested"]
        sl = res["slope"][t] * TREND_YEARS_PER_DECADE
        d["stats"] = {
            "variableId": vid, "testUsed": "Hamed-Rao modified Mann-Kendall" if test == "hamed_rao" else "Mann-Kendall (original)",
            "autocorrelationShare": round(share, 4), "period": [d["years"][0], d["years"][-1]],
            "units": per_decade(vid, d["units"]), "cellsTotal": len(d["ids"]), "cellsTested": int(t.sum()),
            "significantIncreasing": int((res["significant"] & (res["slope"] > 0)).sum()),
            "significantDecreasing": int((res["significant"] & (res["slope"] < 0)).sum()),
            "medianSlopePerDecade": sig_digits(float(np.median(sl))),
            "medianSlopePerDecadeSignificant": sig_digits(float(np.median(res["slope"][res["significant"]] * TREND_YEARS_PER_DECADE))) if res["significant"].any() else None,
            "cellsWithMissingYear": int((t & (res["n"] < len(d["years"]))).sum())}
        print(f"{vid}: {d['stats']}", flush=True)

    # ---- trends/<id>.json
    for vid, s in MONTHLY.items():
        d, res = data[vid], results[vid]
        layer = d["layer"]
        dnote = ""
        if vid in drift["variables"]:
            r = drift["variables"][vid]["r"]
            if drift["variables"][vid]["endsIn2020"]:
                dnote = (f"Satellite drift check: the Terra overpass time and the yearly {s['name']} anomaly change in the same years "
                         f"(r = {r}, 2015-2025). This is a coincidence in time rather than proof of cause (only five years, "
                         f"including the 2023-2024 drought), but to be safe the test stops in 2020.")
            else:
                dnote = (f"Satellite drift check: the Terra overpass time and the yearly {s['name']} anomaly give r = {r} "
                         f"(2015-2025), below 0.5 in absolute value, so the test keeps 2001-2025; treat 2021-2025 as "
                         f"satellite drift years. This is a coincidence in time rather than proof of cause.")
        elif vid == "lst_day":
            dnote = "The test ends in 2020 because Terra's orbit drift biases later years (satellite drift rule)."
        layer["method"] = {
            "name": ("Hamed-Rao modified Mann-Kendall trend test on yearly values" if tests[vid] == "hamed_rao"
                     else "Mann-Kendall trend test on yearly values"),
            "description": trend_description(vid, d["years"], d["units"], shares[vid], tests[vid], dnote, int(res["tested"].sum())),
            "alpha": TREND_ALPHA}
        for k, c in enumerate(layer["cells"]):
            if res["tested"][k]:
                c["slopePerDecade"] = sig_digits(float(res["slope"][k]) * TREND_YEARS_PER_DECADE)
                c["slopeCi95"] = ci_per_decade(res["ci"][k])
                c["pValue"] = min(1.0, max(0.0, sig_digits(float(res["p"][k]))))
                c["significant"] = bool(res["significant"][k])
                c["line"] = res["line"][k]
            else:
                c["slopePerDecade"], c["slopeCi95"], c["pValue"], c["significant"] = None, None, None, False
        (SERVER / "trends" / f"{vid}.json").write_text(json.dumps(layer, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- cover.json
    cover = data["lossKm2"]["cover"]
    cover_text = (f"Trends of Hansen yearly tree cover loss (one trend over 2011-2025, the years Hansen processed with one "
                  f"consistent method; all loss years 2001-2025 are shown, but 2001-2010 are not part of the trend) and of "
                  f"MODIS tree cover (2000-2024; 2025 excluded as suspect). Hansen tree cover itself is not tested because "
                  f"it can only go down by construction. Each cell: Mann-Kendall test on the yearly values (original test; "
                  f"autocorrelation shares {shares['lossKm2'] * 100:.0f}% for loss, "
                  f"{shares['modisTreeCover'] * 100:.0f}% for MODIS), Sen's slope times 10 per decade "
                  f"(km² per year, and % of cell) with its 95% confidence interval (slopeCi95, from the Mann-Kendall variance, "
                  f"Gilbert 1987), and Benjamini-Hochberg false discovery rate across all tested cells "
                  f"with q < {TREND_ALPHA} (significant). pValue is the raw p-value. {AI_DISCLOSURE}")
    if "hamed_rao" in (tests["lossKm2"], tests["modisTreeCover"]):
        cover_text = cover_text.replace("(original test;", "(Hamed-Rao or original test per variable, see trendChecks;")
    cover["trendMethod"] = cover_text
    cover["methodChangeYear"] = HANSEN_METHOD_CHANGE_YEAR
    cover.pop("lossSegments", None)   # replaced by lossTrendYears (one loss trend)
    cover["lossTrendYears"] = list(HANSEN_LOSS_TREND_YEARS)
    cover["hansenNote"] = (
        "All Hansen tree cover loss years 2001-2025 are published. The trend uses 2011-2025 because Hansen reprocessed loss "
        "from 2011 onward (not 2001-2010) and added Landsat 8 (2013) and Landsat 9 (2022) imagery, so the years before and "
        "after 2011 are not measured the same way; the 2001-2010 values are real Hansen/UMD data from the earlier method and "
        "should be compared with care. From 2011 Hansen counts about 2.7 times the official INPE PRODES deforestation in the "
        "Brazilian Amazon because it also counts fire-killed and degraded canopy. "
        "Sources: Hansen/UMD GFC v1.13 user notes; INPE PRODES.")
    for k, c in enumerate(cover["cells"]):
        c["trends"] = {}
        for vid in COVER:
            res = results[vid]
            if res["tested"][k]:
                c["trends"][vid] = {"slopePerDecade": sig_digits(float(res["slope"][k]) * TREND_YEARS_PER_DECADE),
                                    "slopeCi95": ci_per_decade(res["ci"][k]),
                                    "pValue": sig_digits(float(res["p"][k])), "significant": bool(res["significant"][k]),
                                    "line": res["line"][k]}
            else:
                c["trends"][vid] = {"slopePerDecade": None, "slopeCi95": None, "pValue": None, "significant": False}
            if vid == "lossKm2":
                c["trends"][vid]["period"] = [data[vid]["years"][0], data[vid]["years"][-1]]
    (SERVER / "cover.json").write_text(json.dumps(cover, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- validation V1, V2
    rng = np.random.default_rng(TREND_SEED)
    v1, v2 = {}, {}
    for vid, d in data.items():
        v1[vid], v2[vid] = v1_v2(d["Y"], d["years"], tests[vid], results[vid], rng)
        print(f"V1 {vid}: {v1[vid]}  V2: {v2[vid]}", flush=True)

    # ---- V3, V4 and zones.json
    ids_by_var = {vid: d["ids"] for vid, d in data.items()}
    v3 = v3_places(results, ids_by_var, validation)
    members = zone_cell_membership(data["lossKm2"]["ids"])
    zones_out, v4 = {}, {}
    for zone in ZONES_OUT:
        zlabel = zm["zones"][zone]["label"]
        zvars, v4[zone] = {}, {}
        for vid in list(MONTHLY) + ["hansenTreeCover", "modisTreeCover", "lossKm2"]:
            years, yearly = zone_series(za, zm, zone, vid)
            units = MONTHLY[vid]["zoneUnits"] if vid in MONTHLY else ZONE_COVER_UNITS[vid]
            entry = {"units": units,
                     "annual": [{"year": int(y), "value": None if not np.isfinite(v) else round(float(v), 4),
                                 "complete": bool(np.isfinite(v)) and not (vid == "modisTreeCover" and y == 2025)}
                                for y, v in zip(years, yearly)]}
            if vid in MONTHLY:
                entry["monthlyRange"] = monthly_ranges(zm, zone, vid)
            if vid != "hansenTreeCover":
                test_years = (data[vid]["years"][0], data[vid]["years"][-1])
                entry["zoneTrend"] = zone_trend(years, yearly, test_years, tests[vid])
                entry["zoneTrend"]["test"] = tests[vid]
                if vid in data:
                    entry["cellSummary"] = cell_summary(results[vid], data[vid]["ids"], members[zone])
                v4[zone][vid] = entry["zoneTrend"]
                if vid == "lossKm2":
                    entry["methodChangeYear"] = HANSEN_METHOD_CHANGE_YEAR
            zvars[vid] = entry
        zones_out[zone] = {"label": zlabel, "variables": zvars}
    zones_json = {
        "note": ("Yearly values per zone from the area-weighted zone series (amazon_monthly.json and amazon_annual.json). "
                 "Monthly variables: mean of the 12 months (sum for rainfall; burned area is the zone total in km²), only "
                 "complete years (value null otherwise). monthlyRange gives, per complete year, the lowest and highest "
                 "monthly value and the month (1-12) they occur in, to show the seasonal cycle that the yearly test removes. "
                 "Zone tests are not corrected for multiple tests: 18 are shown (3 zones × 6 measures; Brazil and Peru are parts of the whole Amazon). "
                 "With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in Brazil and in Peru would not. "
                 "zoneTrend is Mann-Kendall + Sen's slope on the yearly zone values over the tested years; "
                 "slopeCi95 is the 95% confidence interval of Sen's slope per decade (from the "
                 "Mann-Kendall variance, Gilbert 1987). Hansen loss has one trend, over 2011-2025, the years Hansen processed "
                 "with one consistent method (methodChangeYear = 2011): zoneTrend and cellSummary of lossKm2 cover 2011-2025; "
                 "annual keeps all years 2001-2025. cellSummary counts the 1° cells of the zone (a cell belongs to a country "
                 "zone when most of its in-Amazon area is in that country) from the cell tests. Hansen tree cover is shown "
                 "but not tested (it cannot rise by construction); MODIS 2025 is flagged (complete: false) and excluded."),
        "alpha": TREND_ALPHA, "generatedUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "aiDisclosure": AI_DISCLOSURE, "zones": zones_out}
    (SERVER / "zones.json").write_text(json.dumps(zones_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"zones.json {(SERVER / 'zones.json').stat().st_size / 1024:.0f} KB", flush=True)

    # ---- validation.json "trendChecks"
    validation["trendChecks"] = {
        "generatedUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "design": {"alpha": TREND_ALPHA, "ciLevel": TREND_CI_LEVEL,
                   "ciMethod": "95 % confidence interval of Sen's slope from the Mann-Kendall variance (Gilbert 1987)",
                   "minCompleteShare": TREND_MIN_COMPLETE_SHARE,
                   "autocorrelationRuleThreshold": TREND_AC_SHARE_THRESHOLD, "permutations": TREND_PERMUTATIONS,
                   "seed": TREND_SEED,
                   "text": ("Hansen loss has one trend, over 2011-2025 (the years Hansen processed with one consistent method), "
                            "never across the 2011 method change; 2001-2010 are shown but not tested. Mann-Kendall test on yearly values with Sen's slope, Benjamini-Hochberg FDR across the tested "
                            "cells of each variable. Rules fixed before seeing the results (autocorrelation, satellite drift) applied as "
                            "written. The shuffled-years check shuffles the years of every cell and reruns the whole procedure; shuffling each square "
                            "on its own checks against memoryless noise that is independent between squares. The simulated-trend check adds to the "
                            "shuffled series a linear trend equal to the median |Sen slope| of the real significant cells; the same test trend is "
                            "added to every square, and the detection rate is an average over squares with very different noise.")},
        "variables": [d["stats"] for d in data.values()],
        "hansenConsistency": hansen_consistency(zones_out, data, results),
        "d1Drift": drift,
        "v1FalsePositives": v1, "v2Detection": v2, "v3KnownPlaces": v3, "v4ZoneTrends": v4}
    (SERVER / "validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote trends/, cover.json, zones.json, validation.json", flush=True)


if __name__ == "__main__":
    main()
