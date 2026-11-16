<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and updated on 2026-11-15; reviewed by the team. -->

# Pipeline export folder (API source)

The pipeline writes the files that the web backend reads from this folder. The site is built from them with
`SIGNO_DATA_SOURCE=files` (or `npm run dev:real` / `npm run build:real`). The live site is built from them:
Vercel runs `npm run build:real` (`web/vercel.json`). `npm run dev` and `npm run build` use synthetic mock data
(`server/sources/mockSource.ts`) for development.

The types live in [`shared/contracts.ts`](../../shared/contracts.ts) (`Region`, `Variable`, `CellTrend`,
`MethodInfo`, `SeriesPoint`, `SemesterValue`, `CoverLayer`, `ValidationReport`, `RasterIndex`) and in
[`server/sources/types.ts`](../sources/types.ts) (`SourceTrendLayer`, `SourceSeries`, `SourceCover`,
`SourceValidation`, `SourceRasterIndex`). The build validates every file (`server/validate.ts`) and stops with a clear
message if something breaks the contract.

## Layout

```
server/data/
├── region.json                 # Region                                     (export_api.py)
├── variables.json              # Variable[], with semesterAggregation       (export_api.py)
├── trends/<variableId>.json    # SourceTrendLayer: cells[], method, period  (export_api.py)
├── series/<variableId>.json    # SourceSeries: { "<cellId>": [{ "month": "YYYY-MM", "value": number|null }, ...] }  (export_api.py)
├── cover.json                  # optional: SourceCover, per cell; cells may carry trends{} and trendMethod (export_cover.py, trends.py)
├── validation.json             # optional: SourceValidation, camelCase; trendChecks holds the trend-method checks (validate.py, trends.py)
└── zones.json                  # optional: SourceZones, yearly values and trends per zone (trends.py)
```

The map PNGs and their `index.json` are in `public/data/maps/` (`export_maps.py`). Override the folder with
`SIGNO_MAPS_DIR`.

The pipeline export has 566 cells on a 1° grid inside the Amazon, and five monthly variables: `ndvi`, `evi`,
`lst_day`, `precip` and `burned_area`. `export_api.py` rewrites only `region.json`, `variables.json`, `trends/` and
`series/`.

## Rules

- Ids use lowercase letters, digits, `_` and `-` (e.g. `ndvi`, `r03c07`).
- Months are `"YYYY-MM"`, in increasing order. Missing months (clouds) are `null`, never `NaN` or `-9999`.
- Coordinates are WGS84 degrees; each cell's `lat`/`lon` is its centre.
- `slopePerDecade` is in the variable's units per decade. `export_api.py` writes `null` in every cell; `trends.py` (step 8)
  fills the tested cells (ADR-006). A cell with fewer than 80 % of its years complete stays `null`.
- `significant` is decided by the team's method (including any multiple-testing correction), using `method.alpha`. The
  frontend only displays it. `export_api.py` writes `false`; `trends.py` sets it after the Benjamini–Hochberg correction.
- Every `cellId` in `series/` must exist in `trends/`.
- `variables.json` needs `semesterAggregation` per variable: `"sum"` for rain and burned area, `"mean"` otherwise.
  The backend computes the six-month periods (`semesters`) of every series from it.
- `cover.json` cells must use the same `cellId`, `lat` and `lon` as `trends/`. Hansen tree cover can never increase
  and stays within 0–100.
- `validation.json` is descriptive. Outside its `trendChecks` subtree it must not contain a p-value or a field whose name
  includes "signific" (the build rejects it; `trendChecks` is exempt, because it is the trend test's own check).
  Its `apiCellId` values must be cells of the grid.
- `cover.json` follows the same rule with `trends` (per cell) and `trendMethod` as the exempt fields.
- `variables.json` may carry `slopeUnits` (ends in "per decade") and `trendYears` `{start, end}` (the tested years). Run
  `pipeline/trends.py` after `export_api.py`: the export writes empty trend results and `trends.py` fills them.
- `zones.json` is keyed by zone id; every variable has `units` and chronological `annual` values, and the tested ones a
  `zoneTrend` and a `cellSummary` (never Hansen tree cover; LST never after 2020). The backend publishes it at
  `/api/v1/zones.json` (`manifest.extras.zones`).
- The backend adds `annual` (calendar years, 12 valid months = complete, sums null unless complete) to every published
  series file, with the variable's `semesterAggregation`.
- Country borders are not part of the API: the UI loads `public/data/borders.json` (GeoJSON, Natural Earth) at
  `/data/borders.json`. The build only checks that it parses as a FeatureCollection and reports `manifest.extras.borders`.
- The map PNGs and their `index.json` live in `public/data/maps/`; the build checks that every file exists, is a PNG and
  has the size of the grid.

## Example (Python)

This example shows the shape of one file. `export_api.py` writes the real files.

```python
import json, pathlib
out = pathlib.Path("web/server/data")
(out / "trends").mkdir(parents=True, exist_ok=True)
layer = {
    "variableId": "ndvi", "regionId": "amazon",
    "period": {"start": "2001-01", "end": "2024-12"}, "cellSizeDeg": 1.0,
    "method": {"name": "No trend test applied yet", "description": "<what the file holds>", "alpha": 0.05},
    "cells": [{"cellId": "r03c07", "lat": -17.5, "lon": -72.5, "slopePerDecade": None,
               "pValue": None, "significant": False, "validMonths": 271}],
}
(out / "trends" / "ndvi.json").write_text(json.dumps(layer))
```

## Build with the pipeline data

```bash
cd web
npm run build:real   # or npm run dev:real; same on bash, PowerShell and cmd
```

(`SIGNO_DATA_SOURCE=files npm run build` still works on bash; `--source=files` is the cross-platform form.)

## Vercel

Vercel uses the build command `npm run build:real` (`web/vercel.json`). The files are versioned in this folder.
