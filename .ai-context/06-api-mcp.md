# 6. API & MCP

## API v1 (read-only, static JSON)

Published by `web/server/buildApi.ts` on every `npm run dev` / `npm run build` (and `dev:real` / `build:real`, which use
the pipeline export), served by Vite locally and by Vercel in production (ADR-004). Route map:
`web/shared/apiPaths.ts`. Types: `web/shared/contracts.ts`. Every response carries `apiVersion: "v1"`; the frontend
rejects other versions.

Base URL: `/api/v1` (production: `https://signo-chi-pink.vercel.app/api/v1`). The frontend can be pointed at
another API with the build variable `VITE_API_BASE_URL`.

| Method | Path | Response type | Contents |
|---|---|---|---|
| GET | `/api/v1/manifest.json` | `Manifest` | API version, generation time, `dataStatus`, the region, the list of variables with their NASA product, `semesterAggregation`, `slopeUnits` and `trendYears`, and `extras` (which optional files exist: `cover`, `validation`, `rasters`, `zones`, `borders`) |
| GET | `/api/v1/trends/{variableId}.json` | `TrendLayer` | Per cell: `slopePerDecade`, `pValue` (raw), `significant` (after the Benjamini–Hochberg correction), `validMonths` and `line` (the Sen line over the tested years). Plus the method (`method.name`, `description`, `alpha`) and the summary counts. Null and false until `trends.py` (step 8) has run |
| GET | `/api/v1/series/{variableId}/{cellId}.json` | `CellSeries` | Monthly values behind one cell's trend, its six-month periods (`semesters`) and its calendar years (`annual`, with `complete` = all 12 months). Both computed by the backend |
| GET (optional) | `/api/v1/cover.json` | `CoverLayer` | Yearly tree cover (Hansen, MOD44B), Hansen loss and burned area per cell, with definitions and flags. Each cell may carry `trends` (`lossKm2`, `modisTreeCover`: slope, raw p, significance, `line`) and the layer `trendMethod` text. Present when `extras.cover` is true |
| GET (optional) | `/api/v1/validation.json` | `ValidationReport` | Descriptive cross-checks per zone and the documented cases, with no p-values there. The `trendChecks` part holds the trend test's checks (D1 drift, V1 false positives, V2 detection, V3 known places, V4 zones). Present when `extras.validation` is true |
| GET (optional) | `/api/v1/zones.json` | `ZonesReport` | Per zone (`amazon`, `amazon_brazil`, `amazon_peru`) and variable: yearly values with `complete`, the lowest and highest month per year (monthly variables), the zone test (`zoneTrend`, with no multiple-testing correction) and the cell counts (`cellSummary`). Hansen tree cover is shown, never tested. Present when `extras.zones` is true |
| GET (optional) | `/api/v1/rasters.json` | `RasterIndex` | Where the 0.05° map PNGs are, per layer and frame. The PNGs are served under `/data/maps/`. Present when `extras.rasters` is true |

**Static file (not API).** `/data/borders.json` is the country borders (GeoJSON FeatureCollection, Natural Earth, public
domain), read from `web/public/data/`. The build checks that it parses; `manifest.extras.borders` reports that it exists.

The optional files and the new fields (`semesters`, `semesterAggregation`, `extras`, and on 15 Nov the trend fields,
`annual`, `zones.json`, `slopeUnits`, `trendYears`) were added without changing the existing ones, so v1 readers keep working. Trend fields are
optional in the contract, so an export from before the trend test still validates.

Errors are plain HTTP status codes (404 for an unknown variable or cell). Responses have
`Cache-Control: public, max-age=0, must-revalidate` and `Access-Control-Allow-Origin: *` (`web/vercel.json`), so
judges and other tools can read the data directly.

## MCP

N/A: the project exposes no MCP tools.
