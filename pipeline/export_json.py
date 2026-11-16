# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14/15. Reviewed by team AETHER.
# AI-generated change, 2026-11-15 (team decision of Alexis): daytime LST is published through the last month available; only nighttime LST is still cut at config.LST_LAST_MONTH. Adds driftFromYear per variable and lst_trend_last_year / drift_from_year to meta.
"""Step 3 · Zone time series for the web: monthly, six-monthly and yearly JSON files.

    python -m pipeline.export_json

Reads data/interim/ and writes, in web/public/data/:
  amazon_monthly.json    monthly zone values (greenness, LST, rain, soil, ET, burned area, water storage)
  amazon_semester.json   the same aggregated to six-month periods (config.SEMESTERS)
  amazon_annual.json     yearly tree cover (MOD44B), Hansen tree cover loss, burned area

Zone values are area-weighted (cos latitude) over the zone cells that have a value. Team rules applied here:
analysis from config.ANALYSIS_START, night LST only until config.LST_LAST_MONTH (daytime LST to the end of the series, years from
config.DRIFT_FROM_YEAR flagged by driftFromYear), MOD13C2 reliability filter.
Descriptive only: no trend or significance test is applied (the method is the team's, see tab 01).
"""
import json
from datetime import datetime, timezone

import numpy as np
import xarray as xr

from .config import (AI_DISCLOSURE, AMAZON_BOUNDARY, ANALYSIS_START, BBOX, DRIFT_FROM_YEAR, EXTRA_SOURCES, INTERIM,
                     LST_LAST_MONTH, LST_TREND_LAST_YEAR, MOD13C2_ACCEPTED_RELIABILITY, OUTPUT, PRODUCTS, SEMESTERS, ZONES)
from .zones import zone_masks

DOI = {**{p: v["doi"] for p, v in PRODUCTS.items()}, **{p: v["doi"] for p, v in EXTRA_SOURCES.items()}}

# variable id -> (source, source variable, units, description, kind, zone statistic, semester aggregation)
#   kind: data (main variable) · context (climate context, not a forest indicator) · diag (quality diagnostic)
#   zone statistic: mean (area-weighted mean) · area (sum of share x cell area, km2)
VARIABLES = {
    "ndvi": ("MOD13C2", "ndvi", "1", "Normalized Difference Vegetation Index", "data", "mean", "mean"),
    "evi": ("MOD13C2", "evi", "1", "Enhanced Vegetation Index", "data", "mean", "mean"),
    "ndvi_good_share": ("MOD13C2", None, "fraction", "Share of zone cells with pixel reliability 0 (good)", "diag", "mean", "mean"),
    "lst_day": ("MOD11C3", "lst_day", "degC", "Daytime land surface temperature", "data", "mean", "mean"),
    "lst_night": ("MOD11C3", "lst_night", "degC", "Nighttime land surface temperature (to 2020, orbit drift after)", "data", "mean", "mean"),
    "lst_clear_days": ("MOD11C3", "clear_days", "days", "Mean clear-sky days behind the monthly daytime LST", "diag", "mean", "mean"),
    "lst_day_local_time": ("MOD11C3", "day_local_time", "h", "Mean daytime overpass time (local solar)", "diag", "mean", "mean"),
    "et": ("GLDAS_NOAH025_M", "et", "mm/month", "Evapotranspiration, GLDAS Noah model (climate context only)", "context", "mean", "sum"),
    "soil_moisture_0_10cm": ("GLDAS_NOAH025_M", "soil_moisture_0_10cm", "mm", "Soil moisture 0-10 cm (GLDAS)", "context", "mean", "mean"),
    "rain_gldas": ("GLDAS_NOAH025_M", "rain_gldas", "mm/month", "GLDAS rainfall forcing (cross-check)", "diag", "mean", "sum"),
    "precip": ("GPM_3IMERGM", "precip", "mm/month", "Precipitation (GPM IMERG Final)", "context", "mean", "sum"),
    "burned_area": ("MCD64A1", "burned_share", "km2", "Burned area (MODIS MCD64A1)", "data", "area", "sum"),
    "water_storage": ("GRACE", "tws", "cm", "Terrestrial water storage anomaly (GRACE/GRACE-FO)", "context", "mean", "mean"),
}
LST_VARS = {"lst_day", "lst_night"}
LST_CUT_VARS = {"lst_night"}   # still published only to config.LST_LAST_MONTH (rule D4); daytime LST goes to the end of the series
DRIFT_VARS = {"ndvi", "evi", "lst_day"}   # Terra orbit drift from config.DRIFT_FROM_YEAR (r = 0.85 for NDVI/EVI, B1 for LST)


def iter_months(source):
    """Yield (YYYY-MM, xarray.Dataset with 2-D variables) for one source, oldest first."""
    if source == "GRACE":
        f = INTERIM / "GRACE" / "tws.nc"
        if f.exists():
            with xr.open_dataset(f) as ds:
                ds = ds.load()
            for i in range(ds.time.size):
                yield str(ds.time.values[i])[:7], ds.isel(time=i)
        return
    for f in sorted((INTERIM / source).glob("*.nc")):
        with xr.open_dataset(f) as ds:
            ds = ds.load()
        if "time" in ds.dims:
            yield str(ds.time.values[0])[:7], ds.isel(time=0)
        else:
            yield f.stem, ds


def field(ds, vid, src):
    if vid == "ndvi_good_share":
        return (ds["reliability"].values == 0).astype("float64")
    v = ds[src].values.astype("float64")
    if src in ("ndvi", "evi"):
        v[~np.isin(ds["reliability"].values, MOD13C2_ACCEPTED_RELIABILITY)] = np.nan
    return v


class Grid:
    """Zone masks, cos-latitude weights and cell areas for one grid, computed once."""
    def __init__(self, lat, lon):
        self.masks = {z: m.values for z, m in zone_masks(lat, lon).items()}
        step = abs(float(lat[1] - lat[0]))
        self.w = np.broadcast_to(np.cos(np.deg2rad(lat))[:, None], (lat.size, lon.size))
        self.km2 = (step * 111.32) ** 2 * self.w

    def stat(self, v, zone, how):
        m = self.masks[zone]
        ok = np.isfinite(v) & m
        if how == "area":
            return float((v[ok] * self.km2[ok]).sum()), ok.sum() / m.sum()
        tot = self.w[ok].sum()
        return (float((v[ok] * self.w[ok]).sum() / tot) if tot > 0 else np.nan), ok.sum() / m.sum()


def rnd(a, n=4):
    return [None if x is None or not np.isfinite(x) else round(float(x), n) for x in a]


def monthly():
    series = {z: {} for z in ZONES}
    sources = sorted({spec[0] for spec in VARIABLES.values()})
    for source in sources:
        vids = {k: v for k, v in VARIABLES.items() if v[0] == source}
        acc = {(z, k): ([], [], []) for z in ZONES for k in vids}
        grid = None
        n = 0
        for month, ds in iter_months(source):
            if month < ANALYSIS_START:
                continue
            if grid is None:
                grid = Grid(ds.lat.values, ds.lon.values)
            for k, (_, src, *_r, how, _sem) in vids.items():
                if k in LST_CUT_VARS and month > LST_LAST_MONTH:
                    continue
                v = field(ds, k, src)
                for z in ZONES:
                    val, share = grid.stat(v, z, how)
                    t, m_, s = acc[(z, k)]
                    t.append(month); m_.append(val); s.append(share)
            n += 1
        print(f"  {source}: {n} months", flush=True)
        for k, spec in vids.items():
            for z in ZONES:
                t, m_, s = acc[(z, k)]
                entry = {"t": t, "mean" if spec[5] == "mean" else "total": rnd(m_, 4 if spec[5] == "mean" else 1)}
                if spec[4] in ("data", "context"):
                    entry["valid_share"] = rnd(s, 3)
                series[z][k] = entry
    return series


def semester_of(month):
    y, m = int(month[:4]), int(month[5:7])
    return f"{y}-{next(h for h, (a, b) in SEMESTERS.items() if a <= m <= b)}"


def semesters(mseries):
    out = {z: {} for z in ZONES}
    for z, vs in mseries.items():
        for k, s in vs.items():
            values = s.get("mean", s.get("total"))
            groups = {}
            for t, v in zip(s["t"], values):
                groups.setdefault(semester_of(t), []).append(v)
            agg = VARIABLES[k][6]
            t_out, v_out, n_out = [], [], []
            for sem, vals in groups.items():
                vals = [v for v in vals if v is not None]
                t_out.append(sem); n_out.append(len(vals))
                v_out.append((sum(vals) if agg == "sum" else sum(vals) / len(vals)) if vals else None)
            out[z][k] = {"t": t_out, "value": rnd(v_out, 4), "n_months": n_out, "aggregation": agg}
    return out


def annual():
    out = {z: {} for z in ZONES}
    # MOD44B yearly tree cover (product year runs from early March to early March)
    files = sorted((INTERIM / "MOD44B").glob("*.nc"))
    if files:
        grid = None
        acc = {(z, k): [] for z in ZONES for k in ("tree_cover", "tree_cover_sd", "nontree_veg", "nonvegetated")}
        years = []
        for f in files:
            with xr.open_dataset(f) as ds:
                ds = ds.load()
            grid = grid or Grid(ds.lat.values, ds.lon.values)
            years.append(int(f.stem))
            for k in ("tree_cover", "tree_cover_sd", "nontree_veg", "nonvegetated"):
                for z in ZONES:
                    acc[(z, k)].append(grid.stat(ds[k].values.astype("float64"), z, "mean")[0])
        for z in ZONES:
            for k in ("tree_cover", "tree_cover_sd", "nontree_veg", "nonvegetated"):
                out[z][k] = {"t": years, "mean": rnd(acc[(z, k)], 3)}
    # Hansen: tree cover in 2000 and yearly loss area
    hf = INTERIM / "HANSEN" / "gfc_v1.13.nc"
    if hf.exists():
        with xr.open_dataset(hf) as h:
            h = h.load()
        grid = Grid(h.lat.values, h.lon.values)
        for z in ZONES:
            out[z]["hansen_treecover2000"] = {"t": [2000], "mean": rnd([grid.stat(h.treecover2000.values.astype("float64"), z, "mean")[0]], 3)}
            out[z]["hansen_loss_area"] = {"t": [int(y) for y in h.year.values],
                                          "total": rnd([grid.stat(h.loss_share.values[i].astype("float64"), z, "area")[0]
                                                        for i in range(h.year.size)], 1)}
            if "tree_cover" in h:
                out[z]["hansen_tree_cover"] = {"t": [2000] + [int(y) for y in h.year.values],
                                               "mean": rnd([grid.stat(h.treecover2000.values.astype("float64"), z, "mean")[0]] +
                                                           [grid.stat(h.tree_cover.values[i].astype("float64"), z, "mean")[0]
                                                            for i in range(h.year.size)], 3)}
    return out


def main():
    meta = {
        "project": "SIGNO, team AETHER, NASA Space Apps Challenge 2026",
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "amazon_boundary": AMAZON_BOUNDARY,
        "clip_box": BBOX,
        "analysis_start": ANALYSIS_START,
        "lst_last_month": LST_LAST_MONTH,
        "lst_trend_last_year": LST_TREND_LAST_YEAR,
        "drift_from_year": DRIFT_FROM_YEAR,
        "mod13c2_accepted_reliability": list(MOD13C2_ACCEPTED_RELIABILITY),
        "semesters": {k: list(v) for k, v in SEMESTERS.items()},
        "method": "Area-weighted (cos latitude) zone statistics over cells with a value. Descriptive only: "
                  "no trend or significance test applied.",
        "sources": "See README.md (Data sources) and data/README.md",
        "ai_disclosure": AI_DISCLOSURE,
    }
    variables = {k: {"source": v[0], "doi": DOI.get(v[0]), "units": v[2], "description": v[3], "kind": v[4],
                     "zone_statistic": v[5], "semester_aggregation": v[6],
                     **({"driftFromYear": DRIFT_FROM_YEAR} if k in DRIFT_VARS else {})} for k, v in VARIABLES.items()}
    zones = {}
    mods = sorted((INTERIM / "MOD13C2").glob("*.nc"))
    if mods:
        with xr.open_dataset(mods[0]) as ds:
            g = Grid(ds.lat.values, ds.lon.values)
        zones = {z: {"label": ZONES[z]["label"], "cells_0.05deg": int(g.masks[z].sum()),
                     "area_km2": round(float((g.km2 * g.masks[z]).sum()))} for z in ZONES}

    mseries = monthly()
    yearly = annual()
    for z in ZONES:  # yearly burned area = sum of the 12 monthly totals (complete years only)
        s = mseries[z].get("burned_area")
        if s:
            by_year = {}
            for t, v in zip(s["t"], s["total"]):
                by_year.setdefault(int(t[:4]), []).append(v)
            yrs = [y for y, v in by_year.items() if len(v) == 12 and None not in v]
            yearly[z]["burned_area"] = {"t": yrs, "total": rnd([sum(by_year[y]) for y in yrs], 1)}
    files = {
        "amazon_monthly.json": {"meta": meta, "zones": zones, "variables": variables, "series": mseries},
        "amazon_semester.json": {"meta": meta, "zones": zones, "variables": variables, "series": semesters(mseries)},
        "amazon_annual.json": {"meta": {**meta, "note": "MOD44B year Y covers early March Y to early March Y+1. "
                                        "Hansen loss year Y is the calendar year of stand-replacing loss."},
                               "zones": zones,
                               "variables": {
                                   "tree_cover": {"source": "MOD44B", "doi": DOI["MOD44B"], "units": "%"},
                                   "tree_cover_sd": {"source": "MOD44B", "doi": DOI["MOD44B"], "units": "%"},
                                   "nontree_veg": {"source": "MOD44B", "doi": DOI["MOD44B"], "units": "%"},
                                   "nonvegetated": {"source": "MOD44B", "doi": DOI["MOD44B"], "units": "%"},
                                   "hansen_treecover2000": {"source": "HANSEN", "doi": DOI["HANSEN"], "units": "%"},
                                   "hansen_loss_area": {"source": "HANSEN", "doi": DOI["HANSEN"], "units": "km2"},
                                   "hansen_tree_cover": {"source": "HANSEN", "doi": DOI["HANSEN"], "units": "%",
                                                         "description": "treecover2000 minus cumulative canopy loss "
                                                                        "(30 m, each lost pixel weighted by its 2000 "
                                                                        "cover); regrowth not counted"},
                                   "burned_area": {"source": "MCD64A1", "doi": DOI["MCD64A1"], "units": "km2"}},
                               "series": yearly},
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        p = OUTPUT / name
        p.write_text(json.dumps(content, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {p.relative_to(OUTPUT.parents[2])} ({p.stat().st_size / 1024:.1f} KB)", flush=True)


if __name__ == "__main__":
    main()
