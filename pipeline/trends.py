# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15, implementing the trend test decided by team AETHER (see docs/plan-tests-tendencia.md). Reviewed by team AETHER.
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
  2. Mann-Kendall test (pymannkendall) on the yearly values; Sen's slope x 10 = change per decade.
     Sen's slope is computed here with the real year differences, so a missing year does not shift the time axis
     (pymannkendall assumes equal spacing); it equals pymannkendall's slope when no year is missing.
  3. PRE-REGISTERED: lag-1 autocorrelation of the residuals around the Sen line; if more than 20 % of the tested cells of
     a variable have |r1| > 1.96/sqrt(n), the Hamed-Rao modified test is used for that variable, else the original test.
  4. Benjamini-Hochberg FDR (statsmodels fdr_bh) over all tested cells of one variable; significant = q < 0.05.
  5. Hansen tree cover is not tested (it cannot rise by construction): Hansen yearly loss km2 and MODIS tree cover
     (2000-2024, 2025 excluded as suspect) are tested instead.
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
from .config import (AI_DISCLOSURE, ANALYSIS_START, LST_LAST_MONTH, OUTPUT, ROOT, TREND_AC_SHARE_THRESHOLD, TREND_ALPHA,
                     TREND_DRIFT_R, TREND_MIN_COMPLETE_SHARE, TREND_PERMUTATIONS, TREND_SEED, TREND_YEARS_PER_DECADE)

SERVER = ROOT / "web" / "server" / "data"
START_YEAR = int(ANALYSIS_START[:4])

# variable -> yearly aggregation, first and last year tested, units of the yearly value (cell level), zone units
MONTHLY = {
    "ndvi": {"agg": "mean", "years": (2001, 2025), "units": "unitless", "zoneUnits": "unitless", "name": "NDVI"},
    "evi": {"agg": "mean", "years": (2001, 2025), "units": "unitless", "zoneUnits": "unitless", "name": "EVI"},
    "lst_day": {"agg": "mean", "years": (2001, int(LST_LAST_MONTH[:4])), "units": "°C", "zoneUnits": "°C",
                "name": "daytime land surface temperature"},
    "precip": {"agg": "sum", "years": (2001, 2024), "units": "mm per year", "zoneUnits": "mm per year", "name": "rainfall"},
    "burned_area": {"agg": "sum", "years": (2001, 2025), "units": "% of cell per year", "zoneUnits": "km² per year",
                    "name": "burned area"},
}
# Cover variables read from cover.json: first and last year tested (MODIS 2025 excluded, rule D2).
COVER = {
    "lossKm2": {"first": 2001, "last": 2025, "units": "km² per year", "name": "Hansen tree cover loss"},
    "modisTreeCover": {"first": 2000, "last": 2024, "units": "% of cell", "name": "MODIS tree cover"},
}
# Zone series: variable -> (file, source key, statistic, years displayed, zone units)
ZONE_COVER = {"lossKm2": ("annual", "hansen_loss_area", "total"), "modisTreeCover": ("annual", "tree_cover", "mean"),
              "hansenTreeCover": ("annual", "hansen_tree_cover", "mean")}
ZONE_COVER_UNITS = {"lossKm2": "km² per year", "modisTreeCover": "%", "hansenTreeCover": "%"}
ZONES_OUT = ["amazon", "amazon_brazil", "amazon_peru"]


# ---------------------------------------------------------------- the test ----
def sen_slope(x, t):
    """Sen's slope (median of pairwise slopes, per year) and intercept of the Kendall-Theil line; NaNs are skipped."""
    ok = np.isfinite(x)
    x, t = x[ok], t[ok].astype(float)
    i, j = np.triu_indices(len(x), 1)
    slope = float(np.median((x[j] - x[i]) / (t[j] - t[i])))
    return slope, float(np.median(x - slope * t))


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


def mk_p(x, test):
    """Two-sided p-value of the Mann-Kendall test (original or Hamed-Rao) on the non-missing values, in order."""
    xv = x[np.isfinite(x)]
    p = pmk.original_test(xv, alpha=TREND_ALPHA).p
    if test == "hamed_rao":
        p2 = pmk.hamed_rao_modification_test(xv, alpha=TREND_ALPHA).p
        # a constant series or a negative corrected variance gives no p-value: fall back to the original test
        p = p2 if np.isfinite(p2) else p
    return float(p)


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

    Returns a dict of arrays: tested, slope (per year), p, q, significant, ac (residual autocorrelation flag), n.
    """
    years = np.asarray(years)
    n_cells = Y.shape[0]
    n = np.isfinite(Y).sum(axis=1)
    tested = n >= min_years(len(years))
    slope = np.full(n_cells, np.nan)
    p = np.full(n_cells, np.nan)
    ac = np.zeros(n_cells, bool)
    line = [None] * n_cells
    for k in np.flatnonzero(tested):
        s, b = sen_slope(Y[k], years)
        slope[k] = s
        p[k] = mk_p(Y[k], test)
        ac[k] = abs(lag1_residual_r(Y[k], years, s, b)) > 1.96 / np.sqrt(n[k])
        line[k] = sen_line_ends(Y[k], years, s, years[0], years[-1])
    q = fdr(p, tested)
    sig = tested & (q < TREND_ALPHA)
    return {"tested": tested, "slope": slope, "p": p, "q": q, "significant": sig, "ac": ac, "n": n, "line": line}


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
        src_years = cover["lossYears"] if vid == "lossKm2" else cover["years"]
        years = list(range(s["first"], s["last"] + 1))
        idx = [src_years.index(y) for y in years]
        Y = np.array([[np.nan if c[vid][i] is None else c[vid][i] for i in idx] for c in cover["cells"]], float)
        data[vid] = {"cover": cover, "ids": ids, "years": years, "units": s["units"], "Y": Y}
    return data


# ---------------------------------------------------------------- outputs ----
def sig_digits(x, nd=5):
    return None if x is None or not np.isfinite(x) else float(f"{x:.{nd}g}")


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
            f"times 10, in {units} per decade. Because hundreds of cells are tested at once, the p-values are corrected "
            f"with the Benjamini-Hochberg false discovery rate across all tested cells of this variable; a cell is "
            f"significant when its adjusted q-value is below {TREND_ALPHA}. The pValue shown is the raw p-value of the "
            f"test, not q. {drift_note} {AI_DISCLOSURE}")


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
            out[vid] = {"slopePerDecade": sig_digits(sl), "pValue": sig_digits(float(res["p"][k])),
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
        return {"slopePerDecade": None, "pValue": None, "significant": False, "years": list(test_years), "n": n}
    s, _ = sen_slope(x, t)
    p = mk_p(x, test)
    return {"slopePerDecade": sig_digits(s * TREND_YEARS_PER_DECADE), "pValue": sig_digits(p),
            "significant": bool(p < TREND_ALPHA), "years": list(test_years), "n": n,
            "line": sen_line_ends(x, t, s, test_years[0], test_years[1])}


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
            "units": d["units"] + " per decade", "cellsTotal": len(d["ids"]), "cellsTested": int(t.sum()),
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
                dnote = (f"Satellite drift check: the yearly {s['name']} anomaly correlates with the Terra overpass time "
                         f"(r = {r}, 2015-2025), so the test ends in 2020.")
            else:
                dnote = (f"Satellite drift check: the yearly {s['name']} anomaly vs the Terra overpass time gives r = {r} "
                         f"(2015-2025), below 0.5 in absolute value, so the test keeps 2001-2025; treat 2021-2025 as "
                         f"satellite drift years.")
        elif vid == "lst_day":
            dnote = "The test ends in 2020 because Terra's orbit drift biases later years (team rule B1)."
        layer["method"] = {
            "name": ("Hamed-Rao modified Mann-Kendall trend test on yearly values" if tests[vid] == "hamed_rao"
                     else "Mann-Kendall trend test on yearly values"),
            "description": trend_description(vid, d["years"], d["units"], shares[vid], tests[vid], dnote, int(res["tested"].sum())),
            "alpha": TREND_ALPHA}
        for k, c in enumerate(layer["cells"]):
            if res["tested"][k]:
                c["slopePerDecade"] = sig_digits(float(res["slope"][k]) * TREND_YEARS_PER_DECADE)
                c["pValue"] = min(1.0, max(0.0, sig_digits(float(res["p"][k]))))
                c["significant"] = bool(res["significant"][k])
                c["line"] = res["line"][k]
            else:
                c["slopePerDecade"], c["pValue"], c["significant"] = None, None, False
        (SERVER / "trends" / f"{vid}.json").write_text(json.dumps(layer, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- cover.json
    cover = data["lossKm2"]["cover"]
    cover_text = (f"Trends of Hansen yearly tree cover loss (2001-2025) and MODIS tree cover (2000-2024; 2025 excluded as "
                  f"suspect). Hansen tree cover itself is not tested because it can only go down by construction. Each "
                  f"cell: Mann-Kendall test on the yearly values (original test; autocorrelation shares "
                  f"{shares['lossKm2'] * 100:.0f}% and {shares['modisTreeCover'] * 100:.0f}%), Sen's slope times 10 per decade "
                  f"(km² per year, and % of cell), and Benjamini-Hochberg false discovery rate across all tested cells "
                  f"with q < {TREND_ALPHA} (significant). pValue is the raw p-value. {AI_DISCLOSURE}")
    if "hamed_rao" in (tests["lossKm2"], tests["modisTreeCover"]):
        cover_text = cover_text.replace("(original test;", "(Hamed-Rao or original test per variable, see trendChecks;")
    cover["trendMethod"] = cover_text
    for k, c in enumerate(cover["cells"]):
        c["trends"] = {}
        for vid in COVER:
            res = results[vid]
            if res["tested"][k]:
                c["trends"][vid] = {"slopePerDecade": sig_digits(float(res["slope"][k]) * TREND_YEARS_PER_DECADE),
                                    "pValue": sig_digits(float(res["p"][k])), "significant": bool(res["significant"][k]),
                                    "line": res["line"][k]}
            else:
                c["trends"][vid] = {"slopePerDecade": None, "pValue": None, "significant": False}
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
            zvars[vid] = entry
        zones_out[zone] = {"label": zlabel, "variables": zvars}
    zones_json = {
        "note": ("Yearly values per zone from the area-weighted zone series (amazon_monthly.json and amazon_annual.json). "
                 "Monthly variables: mean of the 12 months (sum for rainfall; burned area is the zone total in km²), only "
                 "complete years (value null otherwise). monthlyRange gives, per complete year, the lowest and highest "
                 "monthly value and the month (1-12) they occur in, to show the seasonal cycle that the yearly test removes. "
                 "zoneTrend is Mann-Kendall + Sen's slope on the yearly zone values over the tested years, with no correction "
                 "for multiple tests (only 3 zones). cellSummary counts the 1° cells of the zone (a cell belongs to a country "
                 "zone when most of its in-Amazon area is in that country) from the cell tests. Hansen tree cover is shown "
                 "but not tested (it cannot rise by construction); MODIS 2025 is flagged (complete: false) and excluded."),
        "alpha": TREND_ALPHA, "generatedUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "aiDisclosure": AI_DISCLOSURE, "zones": zones_out}
    (SERVER / "zones.json").write_text(json.dumps(zones_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"zones.json {(SERVER / 'zones.json').stat().st_size / 1024:.0f} KB", flush=True)

    # ---- validation.json "trendChecks"
    validation["trendChecks"] = {
        "generatedUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "design": {"alpha": TREND_ALPHA, "minCompleteShare": TREND_MIN_COMPLETE_SHARE,
                   "autocorrelationRuleThreshold": TREND_AC_SHARE_THRESHOLD, "permutations": TREND_PERMUTATIONS,
                   "seed": TREND_SEED,
                   "text": ("Mann-Kendall test on yearly values with Sen's slope, Benjamini-Hochberg FDR across the tested "
                            "cells of each variable. Pre-registered rules (autocorrelation, satellite drift) applied as "
                            "written. V1 shuffles the years of every cell and reruns the whole procedure; V2 adds to the "
                            "shuffled series a linear trend equal to the median |Sen slope| of the real significant cells.")},
        "variables": [d["stats"] for d in data.values()],
        "d1Drift": drift,
        "v1FalsePositives": v1, "v2Detection": v2, "v3KnownPlaces": v3, "v4ZoneTrends": v4}
    (SERVER / "validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote trends/, cover.json, zones.json, validation.json", flush=True)


if __name__ == "__main__":
    main()
