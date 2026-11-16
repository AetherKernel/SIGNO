# AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
# AI-generated change, 2026-11-15 (team decision of Alexis): daytime LST is published through the last month available (its trend test stays 2001-2020, LST_TREND_LAST_YEAR); variables.json gets driftFromYear for ndvi, evi and lst_day.
"""Step 5 · Export the real data in the web app's contract (API v1 source files) to web/server/data/.

    python -m pipeline.export_api

Writes, as specified in web/server/data/README.md and web/shared/contracts.ts:
  region.json                 Region
  variables.json              Variable[] (monthly variables only, as the contract requires)
  trends/<variableId>.json    SourceTrendLayer: one entry per API cell
  series/<variableId>.json    SourceSeries: monthly values of every API cell

API cells are config.API_CELL_DEG squares on the clip box (row 0 = south edge, column 0 = west edge). A cell is
included when at least half of its 0.05 degree sub-cells lie inside the Amazon polygon. Its monthly value is the
cos-latitude weighted mean of the source grid cells that are inside both the API cell and the Amazon polygon.

No trend test is applied: slopePerDecade and pValue are null and significant is false in every cell, because the
statistical method is the team's decision (P-002). The web app then shows the real series with no trend verdict.
Then build the site with SIGNO_DATA_SOURCE=files (see web/server/data/README.md).
"""
import json
import shutil

import numpy as np
import pandas as pd
import xarray as xr

from .config import (AI_DISCLOSURE, AMAZON_BOUNDARY, ANALYSIS_START, API_CELL_DEG, API_VARIABLES, BBOX, DRIFT_FROM_YEAR,
                     INTERIM, LST_TREND_LAST_YEAR, MOD13C2_ACCEPTED_RELIABILITY, ROOT)
from .export_json import iter_months
from .tiles import LAT as LAT05, LON as LON05
from .zones import zone_masks

OUT = ROOT / "web" / "server" / "data"

# id -> (source, source variable, display name, plain-language description, units, product, last month or None)
SPECS = {
    "ndvi": ("MOD13C2", "ndvi", "Vegetation greenness (NDVI)",
             "How green and dense the vegetation looks from space, from -1 to 1. Dense Amazon forest stays near 0.8; "
             "the index saturates over closed canopy, so a drop signals strong change.", "unitless",
             {"shortName": "MOD13C2", "version": "061", "provider": "LP DAAC", "doi": "10.5067/MODIS/MOD13C2.061", "kind": "satellite"}, None),
    "evi": ("MOD13C2", "evi", "Vegetation greenness (EVI)",
            "Like NDVI but less saturated over dense forest, so it shows more detail where the canopy is closed.",
            "unitless",
            {"shortName": "MOD13C2", "version": "061", "provider": "LP DAAC", "doi": "10.5067/MODIS/MOD13C2.061", "kind": "satellite"}, None),
    "lst_day": ("MOD11C3", "lst_day", "Daytime land surface temperature",
                "How hot the ground surface is in the morning overpass, measured from space. Forest keeps the surface "
                "cooler than cleared land. From 2021 the satellite's orbit drift biases it (shown with a ?; the trend test uses 2001-2020 only).", "°C",
                {"shortName": "MOD11C3", "version": "061", "provider": "LP DAAC", "doi": "10.5067/MODIS/MOD11C3.061", "kind": "satellite"}, None),
    "precip": ("GPM_3IMERGM", "precip", "Rainfall",
               "Monthly rain from NASA's satellite constellation, calibrated with rain gauges. Helps tell a drought "
               "from forest loss.", "mm/month",
               {"shortName": "GPM_3IMERGM", "version": "07", "provider": "GES DISC", "doi": "10.5067/GPM/IMERG/3B-MONTH/07", "kind": "satellite"}, None),
    "burned_area": ("MCD64A1", "burned_share", "Burned area",
                    "Share of the cell that burned that month, mapped from MODIS at 500 m. Fire and tree cover loss often occur "
                    "in the same places; that alone does not show which caused which.", "% of cell",
                    {"shortName": "MCD64A1", "version": "061", "provider": "LP DAAC", "doi": "10.5067/MODIS/MCD64A1.061", "kind": "satellite"}, None),
}
# How a six-month period combines the monthly values: totals add up (rain, burned area), the rest are averaged.
SEMESTER_AGGREGATION = {"precip": "sum", "burned_area": "sum"}  # every other variable: "mean"
# Units of the trend slope (the test runs on yearly values, so they differ from the monthly units above).
SLOPE_UNITS = {"ndvi": "unitless per decade", "evi": "unitless per decade", "lst_day": "°C per decade",
               "precip": "mm per year, per decade", "burned_area": "% of cell per year, per decade"}
# Variables whose values from DRIFT_FROM_YEAR on are affected by Terra's orbit drift (the web app greys and "?"-marks them).
DRIFT_VARS = {"ndvi", "evi", "lst_day"}
# Years that enter the trend test of each variable, as pipeline/trends.py applies them (hardcoded here, keep in sync):
# LST ends in config.LST_TREND_LAST_YEAR (2020) (team rule B1, Terra orbit drift); NDVI and EVI also end in 2020 because the pre-registered rule D1
# found |r| >= 0.5 between the overpass time and their anomaly (r = 0.85); rainfall ends in 2024 (2025 stops in
# September); burned area uses 2001-2025. pipeline/trends.py must run after this script (it fills the trend results).
TREND_YEARS = {"ndvi": (2001, 2020), "evi": (2001, 2020), "lst_day": (2001, LST_TREND_LAST_YEAR), "precip": (2001, 2024),
               "burned_area": (2001, 2025)}
SCALE = {"burned_area": 100.0}  # share -> percent of cell
DECIMALS = {"ndvi": 4, "evi": 4, "lst_day": 2, "precip": 1, "burned_area": 3}


def api_grid():
    """API cell index of every 0.05 sub-cell, and which API cells are inside the Amazon (>= half of sub-cells)."""
    ny = int(np.ceil((BBOX["lat_max"] - BBOX["lat_min"]) / API_CELL_DEG))
    nx = int(np.ceil((BBOX["lon_max"] - BBOX["lon_min"]) / API_CELL_DEG))
    amazon05 = zone_masks(LAT05, LON05)["amazon"].values
    iy = np.floor((LAT05 - BBOX["lat_min"]) / API_CELL_DEG).astype(int)
    ix = np.floor((LON05 - BBOX["lon_min"]) / API_CELL_DEG).astype(int)
    key = iy[:, None] * nx + ix[None, :]
    inside = np.bincount(key.ravel(), weights=amazon05.ravel(), minlength=ny * nx)
    total = np.bincount(key.ravel(), minlength=ny * nx)
    keep = inside >= 0.5 * np.maximum(total, 1)
    cells = []
    for k in np.flatnonzero(keep):
        r, c = divmod(int(k), nx)
        cells.append({"cellId": f"r{r:02d}c{c:02d}", "key": int(k),
                      "lat": round(BBOX["lat_min"] + (r + 0.5) * API_CELL_DEG, 4),
                      "lon": round(BBOX["lon_min"] + (c + 0.5) * API_CELL_DEG, 4)})
    return ny, nx, cells


class Aggregator:
    """Maps one source grid to API cells (only source cells inside the Amazon polygon)."""
    def __init__(self, lat, lon, nx, ny):
        amazon = zone_masks(lat, lon)["amazon"].values
        iy = np.floor((lat - BBOX["lat_min"]) / API_CELL_DEG).astype(int)
        ix = np.floor((lon - BBOX["lon_min"]) / API_CELL_DEG).astype(int)
        key = iy[:, None] * nx + ix[None, :]
        self.key = np.where(amazon, key, -1)
        self.w = np.cos(np.deg2rad(lat))[:, None] * np.ones((1, lon.size))
        self.n = ny * nx

    def mean(self, v):
        ok = (self.key >= 0) & np.isfinite(v)
        s = np.bincount(self.key[ok], weights=(v * self.w)[ok], minlength=self.n)
        w = np.bincount(self.key[ok], weights=self.w[ok], minlength=self.n)
        return np.where(w > 0, s / np.where(w > 0, w, 1), np.nan)

    def total(self, v):
        """Plain sum of the finite source cells inside each API cell (NaN where there is none)."""
        ok = (self.key >= 0) & np.isfinite(v)
        s = np.bincount(self.key[ok], weights=v[ok], minlength=self.n)
        n = np.bincount(self.key[ok], minlength=self.n)
        return np.where(n > 0, s, np.nan)


def months_between(a, b):
    return [str(p) for p in pd.period_range(a, b, freq="M")]


def main():
    ny, nx, cells = api_grid()
    print(f"API grid {API_CELL_DEG} deg: {len(cells)} cells inside the Amazon", flush=True)
    # Rebuild only what this module writes; other exports (cover.json, validation.json, README.md) are kept.
    for name in ("region.json", "variables.json"):
        (OUT / name).unlink(missing_ok=True)
    for name in ("trends", "series"):
        shutil.rmtree(OUT / name, ignore_errors=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "trends").mkdir(parents=True, exist_ok=True)
    (OUT / "series").mkdir(parents=True, exist_ok=True)

    region = {"id": "amazon",
              "name": "Amazon (RAISG biome, provisional)" if AMAZON_BOUNDARY == "raisg_biome" else "Amazon (HydroBASINS basin, provisional)",
              "boundarySource": ("RAISG (2025), Biomas 2025, record 'Amazonía' (provisional, P-008)" if AMAZON_BOUNDARY == "raisg_biome"
                                 else "HydroBASINS v1c level 3, PFAF_ID 622, Lehner & Grill 2013 (provisional, P-008)"),
              "bbox": [BBOX["lon_min"], BBOX["lat_min"], BBOX["lon_max"], BBOX["lat_max"]]}
    variables = []
    for vid in API_VARIABLES:
        source, src, name, desc, units, product, last = SPECS[vid]
        agg = None
        values = {}
        for month, ds in iter_months(source):
            if month < ANALYSIS_START or (last and month > last):
                continue
            if agg is None:
                agg = Aggregator(ds.lat.values, ds.lon.values, nx, ny)
            v = ds[src].values.astype("float64")
            if src in ("ndvi", "evi"):
                v[~np.isin(ds["reliability"].values, MOD13C2_ACCEPTED_RELIABILITY)] = np.nan
            values[month] = agg.mean(v) * SCALE.get(vid, 1.0)
        months = months_between(ANALYSIS_START, max(values))
        series, trend_cells = {}, []
        for c in cells:
            pts = []
            for m in months:
                x = values.get(m)
                val = None if x is None or not np.isfinite(x[c["key"]]) else round(float(x[c["key"]]), DECIMALS[vid])
                pts.append({"month": m, "value": val})
            n_valid = sum(p["value"] is not None for p in pts)
            if n_valid == 0:
                continue
            series[c["cellId"]] = pts
            trend_cells.append({"cellId": c["cellId"], "lat": c["lat"], "lon": c["lon"], "slopePerDecade": None,
                                "pValue": None, "significant": False, "validMonths": n_valid})
        period = {"start": months[0], "end": months[-1]}
        variables.append({"id": vid, "name": name, "description": desc, "units": units,
                          "temporalResolution": "monthly", "period": period, "product": product,
                          "semesterAggregation": SEMESTER_AGGREGATION.get(vid, "mean"),
                          "slopeUnits": SLOPE_UNITS[vid],
                          "trendYears": {"start": TREND_YEARS[vid][0], "end": TREND_YEARS[vid][1]},
                          **({"driftFromYear": DRIFT_FROM_YEAR} if vid in DRIFT_VARS else {})})
        layer = {"variableId": vid, "regionId": "amazon", "period": period, "cellSizeDeg": API_CELL_DEG,
                 "method": {"name": "No trend test applied yet",
                            "description": "Real NASA data, monthly mean of each cell. The statistical trend test is "
                                           "the team's decision (P-002) and has not been applied, so every slope and "
                                           "p-value is null. " + AI_DISCLOSURE,
                            "alpha": 0.05},
                 "cells": trend_cells}
        (OUT / "trends" / f"{vid}.json").write_text(json.dumps(layer, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (OUT / "series" / f"{vid}.json").write_text(json.dumps(series, separators=(",", ":")), encoding="utf-8")
        size = (OUT / "series" / f"{vid}.json").stat().st_size / 1e6
        print(f"  {vid}: {len(trend_cells)} cells, {period['start']}..{period['end']}, series {size:.1f} MB", flush=True)
    (OUT / "region.json").write_text(json.dumps(region, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "variables.json").write_text(json.dumps(variables, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}", flush=True)
    print("Next: run `python -m pipeline.trends` (this step removed or rewrote the trend results)", flush=True)


if __name__ == "__main__":
    main()
