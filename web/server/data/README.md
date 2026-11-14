# Pipeline export folder (for Alexis)

When the data pipeline is ready, it writes its results here and the site is built with
`SIGNO_DATA_SOURCE=files`. Until then the site uses synthetic mock data (`server/sources/mockSource.ts`).

The types live in [`shared/contracts.ts`](../../shared/contracts.ts) (`Region`, `Variable`, `CellTrend`,
`MethodInfo`, `SeriesPoint`) and [`server/sources/types.ts`](../sources/types.ts) (`SourceTrendLayer`,
`SourceSeries`). The build validates every file (`server/validate.ts`) and stops with a clear message if something
breaks the contract.

## Layout

```
server/data/
├── region.json              # Region
├── variables.json           # Variable[]
├── trends/<variableId>.json # SourceTrendLayer: variableId, regionId, period, cellSizeDeg, method, cells[]
└── series/<variableId>.json # SourceSeries: { "<cellId>": [{ "month": "YYYY-MM", "value": number|null }, ...] }
```

## Rules

- Ids use lowercase letters, digits, `_` and `-` (e.g. `ndvi`, `r03c07`).
- Months are `"YYYY-MM"`, in increasing order. Missing months (clouds) are `null`, never `NaN` or `-9999`.
- Coordinates are WGS84 degrees; each cell's `lat`/`lon` is its centre.
- `slopePerDecade` is in the variable's units per decade.
- `significant` is decided by the team's method (including any multiple-testing correction), using
  `method.alpha`. The frontend only displays it.
- Every `cellId` in `series/` must exist in `trends/`.

## Example (Python)

```python
import json, pathlib
out = pathlib.Path("web/server/data")
(out / "trends").mkdir(parents=True, exist_ok=True)
layer = {
    "variableId": "ndvi", "regionId": "amazon",
    "period": {"start": "2001-01", "end": "2024-12"}, "cellSizeDeg": 0.5,
    "method": {"name": "<team method>", "description": "<how it works>", "alpha": 0.05},
    "cells": [{"cellId": "r000c000", "lat": -3.25, "lon": -60.25, "slopePerDecade": -0.012,
               "pValue": 0.003, "significant": True, "validMonths": 271}],
}
(out / "trends" / "ndvi.json").write_text(json.dumps(layer))
```

## Build with the pipeline data

```bash
cd web
SIGNO_DATA_SOURCE=files npm run build
```

In Vercel, set the environment variable `SIGNO_DATA_SOURCE=files` (Project Settings → Environment Variables) and
redeploy. No frontend change is needed.
