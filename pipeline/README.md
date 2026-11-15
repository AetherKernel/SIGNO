<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and extended on 2026-11-15; reviewed by the team. -->

# Data pipeline

Turns NASA's and Hansen's files into light files for the web: zone values by month, six-month period and year (JSON),
0.05° map layers (PNG), a 1° API source (JSON), tree cover and loss per 1° cell (JSON), cross-checks and the trend test (JSON). Runs
locally or in Google Colab. Step 8 applies the team's trend test (ADR-006, see `.ai-context/01-logic.md`, *Method*), and
step 9 writes the country borders for the map.

```
NASA Earthdata and Hansen/UMD (global files and tiles)
   │  1.  download.py     the four monthly products: earthaccess search + download, one month at a time, up to 3 tries
   │  1b. tiles.py        MOD44B (yearly) and MCD64A1 (monthly) tiles → 0.05° cells; tiles deleted after each period
   │  1c. hansen.py       Hansen tree cover 2000 and loss per year, per 10° tile → 0.05° cells (no login)
   │  1d. grace.py        GRACE/GRACE-FO water storage: one global file → clipped to the box (0.5°)
   ▼
data/raw/                  files as downloaded; each is deleted after its step unless --keep-raw    (git-ignored)
   │  2. clip_clean.py    (inside step 1) clip to the Amazon box, scale, fill → NaN, physical units, checks
   ▼
data/interim/              one file per product and month or year, masks, logs   (git-ignored)
   │  3. export_json.py   zone masks + area-weighted monthly, six-monthly and yearly values
   │  4. export_maps.py   0.05° map layers as 8-bit PNG data images
   │  5. export_api.py    1° API cells inside the Amazon: monthly series, trends (no test applied), region, variables
   │  6. export_cover.py  per 1° cell: tree cover (Hansen, MOD44B), Hansen loss km², burned km² (after step 5)
   │  7. validate.py      cross-validation of tree cover, fire co-location, hotspots, one documented case (descriptive)
   │  8. trends.py        trend test per 1° cell and zone (Mann-Kendall, Sen slope, FDR) and its checks V1–V4; run last
   │  9. export_borders.py country borders (Natural Earth); writes one file, independent of the others
   ▼
web/public/data/           amazon_monthly.json · amazon_semester.json · amazon_annual.json · validation.json · borders.json · maps/   (versioned)
web/server/data/           region.json · variables.json · trends/ · series/ · cover.json · zones.json · validation.json   (API source; commit pending, P-023)
```

Order of the steps: 1 → 1b → 1c → 1d → 3 → 4 → 5 → 6 → 7 → 8. Step 2 runs inside step 1 for each month. The export steps
read what the earlier steps wrote; they do not check that every source is complete. `export_cover` reads the cell ids
of `web/server/data/trends/ndvi.json`, so `export_api` must run first. `validate` does not need the other exports.

**Run `trends` last (step 8).** `export_api`, `export_cover` and `validate` each rewrite files that `trends` fills
(`trends/`, `cover.json`, `validation.json`), so re-running any of them after `trends` removes the trend results. Each of
those three scripts prints this reminder. Re-run `trends` after them. Step 9 (`export_borders`) writes only
`web/public/data/borders.json`, so it can run at any time after the boundary files are in `data/raw/boundaries/`. `export_json` prints the number of months it found per source, so check that count before you publish.

## Run it

```bash
py -m venv .venv
.venv/Scripts/python -m pip install -r pipeline/requirements.txt   # Linux/Colab: .venv/bin/python

python -m pipeline.download --dry-run                       # what NASA has, nothing downloaded
python -m pipeline.download --start 2000-01 --end 2026-10   # four monthly products (needs Earthdata Login)
python -m pipeline.clip_clean                               # only for files you downloaded by hand
python -m pipeline.tiles --product MOD44B --start 2000 --end 2025         # tree cover (Earthdata Login)
python -m pipeline.tiles --product MCD64A1 --start 2000-11 --end 2026-10  # burned area (Earthdata Login)
python -m pipeline.hansen                                   # Hansen tree cover and loss (no login)
python -m pipeline.grace                                    # GRACE water storage (Earthdata Login)
python -m pipeline.export_json                              # web/public/data/*.json
python -m pipeline.export_maps                              # web/public/data/maps/*.png and index.json
python -m pipeline.export_api                               # web/server/data/ (region, variables, trends, series)
python -m pipeline.export_cover                             # web/server/data/cover.json (run after export_api)
python -m pipeline.validate                                 # validation.json in web/public/data/ and web/server/data/
python -m pipeline.trends                                   # step 8: trend test (run last; writes trends/, cover.json, zones.json, validation.json trendChecks)
python -m pipeline.export_borders                           # step 9: web/public/data/borders.json
python -m pipeline.test_trends                              # 7 checks of the trend test on synthetic series
```

Run commands from the repository root. Boundary zips (RAISG, HydroBASINS) go by hand into `data/raw/boundaries/`,
with their original file names (links in `data/README.md`). The pipeline finds them by name anywhere under `data/raw/`.
Natural Earth countries is downloaded into the same folder automatically when it is missing.

**Login.** Locally, a netrc file with your Earthdata credentials, or the interactive prompt. The netrc file
is `~/.netrc` on Linux and `C:\Users\<user>\_netrc` on Windows, with one line:
`machine urs.earthdata.nasa.gov login USER password PASS`. On Windows, Notepad often saves it as `_netrc.txt`,
which does not work: check the file name. Keep the file outside the repository. In Colab, Secrets `EARTHDATA_TOKEN` (or `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`) copied to
environment variables (see `notebooks/README.md`). Never write credentials in code or commit them.
Hansen tiles are plain HTTPS downloads and need no login. `tiles.py` and `grace.py` use the same login as `download.py`.

**Volume of a full run (2000–2026).** For the four monthly products, downloads are about 56 GB for the two MODIS
products and a few GB for GLDAS and IMERG, but only one global file is on disk at any time. The kept clips take 1.6 GB.
`export_json` reads them one month at a time and took about 10 minutes for the full series (before the sources added
on 2026-11-15). The sources added on 2026-11-15: MOD44B about 33 GB (one year, ~1.3 GB, on disk at a time), MCD64A1 about
16 GB (one month, ~51 MB at a time), Hansen about 8.6 GB (16 tiles, two layers, each tile's files deleted after
aggregating), and GRACE one 44 MB file. On 2026-11-15 these took about 1 h 10 min in parallel; `data/interim/` grew
to 1.9 GB. The export steps `export_json` + `export_maps` + `validate` take about 15 minutes. The run time of `export_api` and
`export_cover` is not recorded yet.
An interrupted run resumes: months already in `data/interim/` are skipped (see *Full run* below).

## Full run (2000–2026): retries, parallel runs, logs

Status: **complete** (2026-11-14). Every month found by CMR is in `data/interim/`, none missing:

| Product | Months | Period |
|---|---|---|
| `MOD13C2` | 321 | 2000-02 → 2026-10 |
| `MOD11C3` | 321 | 2000-02 → 2026-10 |
| `GLDAS_NOAH025_M` | 319 | 2000-01 → 2026-07 |
| `GPM_3IMERGM` | 309 | 2000-01 → 2025-09 |

Status (15 Nov 2026) of the sources added that day:

| Source | Status |
|---|---|
| `MOD44B` v061, yearly 2000–2025 (`tiles.py`) | done: 26 years |
| `MCD64A1` v061, monthly 2000-11 → 2026-09 (`tiles.py`) | done: 311 months (2026-10 not yet published by NASA) |
| Hansen GFC v1.13, 16 tiles (`hansen.py`) | done: 16 tiles |
| `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` (`grace.py`) | done: 259 months, 2002-04 → 2026-09, 35 missing |

The export steps (`export_json`, `export_maps`, `export_api`, `export_cover`, `validate`) have been run on these results.

**Retries and resuming.** Each month is tried up to 3 times, with waits of 15 s, 30 s and 45 s. Months that still
fail are printed at the end as `<PRODUCT>: finished. N processed, M failed: [...]`. To retry them, run the same
command again: months already in `data/interim/` are skipped, so only the months still missing are processed.
`tiles.py` works the same way per period (one year for MOD44B, one month for MCD64A1): up to 3 tries per period, with
waits of 15 s, 30 s and 45 s, and finished periods are skipped. `hansen.py` tries each 10° tile up to 3 times, and a
finished tile is skipped on the next run (`data/interim/HANSEN/tiles/`). `grace.py` has no retry loop: run it again if
it fails.

**Parallel runs and logs.** The four products can run at the same time, one process each, with a log per product.
This is how the full run was started (from the repository root; on Linux or Colab use `.venv/bin/python`):

```bash
.venv/Scripts/python.exe -u -m pipeline.download --products MOD13C2 --start 2000-01 --end 2026-10 > data/interim/logs/MOD13C2.log 2>&1
```

Repeat with `MOD11C3`, `GLDAS_NOAH025_M` and `GPM_3IMERGM`. The sources added on 2026-11-15 follow the same pattern, for
example `python -u -m pipeline.tiles --product MOD44B --start 2000 --end 2025 > data/interim/logs/MOD44B.log 2>&1`, with
the log named after the source (`MCD64A1.log`, `HANSEN.log`, `GRACE.log`). Create `data/interim/logs/` first if it does not exist.
`-u` writes the output at once, so the log can be followed while the run is going.

**Test month (2000-02).** A one-month end-to-end run (download, clip, checks, global file deleted) passed for all four
products. Clip sizes: MOD13C2 2.6 MB, MOD11C3 1.4 MB, GLDAS 0.2 MB, IMERG 0.6 MB. Example command for one month:
`python -m pipeline.download --start 2000-02 --end 2000-02`.

## Files

| File | Does |
|---|---|
| `config.py` | Every setting: paths, clip box, Amazon boundary, zones, quality rule, products, extra sources, periods and semesters, API cells and variables, documented cases. **Team decisions are here** (C1, B1, D1, semesters: see *Team rules applied at export*), and the trend test settings (`TREND_*`, ADR-006) |
| `readers.py` | One reader per monthly product: global file → clipped, cleaned `xarray.Dataset` |
| `zones.py` | Zone polygons → cell masks per grid, cached in `data/interim/masks/` |
| `tiles.py` | MOD44B and MCD64A1: sinusoidal tiles over the box → 0.05° cells. Each fine pixel goes to the cell that contains its centre; nothing is thresholded. Writes `data/interim/MOD44B/<YYYY>.nc` and `data/interim/MCD64A1/<YYYY-MM>.nc`; resumable |
| `hansen.py` | Hansen/UMD GFC v1.13: `treecover2000` and `lossyear` per 10° tile, aggregated per 0.05° cell (200 × 200 Landsat pixels). Writes `data/interim/HANSEN/gfc_v1.13.nc`; resumable per tile |
| `grace.py` | GRACE/GRACE-FO RL06.3 v04 CRI: one global file, clipped to the box on the 0.5° grid, one entry per calendar month → `data/interim/GRACE/tws.nc` |
| `clip_clean.py` | Step 2, with automatic checks. A wrong grid step or clip size rejects the month. Values outside physical plausibility ranges (e.g. night LST below −50 °C) are counted, printed as `WARNING` and stored in the variable attribute `n_outside_plausible_range`, but kept: filtering them is a team decision (P-020). First full run: night LST of −85.5 °C found in 2000-04 |
| `download.py` | Step 1 + step 2 per month; up to 3 tries per month; `--products` runs one product per process |
| `export_json.py` | Step 3: `amazon_monthly.json`, `amazon_semester.json`, `amazon_annual.json` |
| `export_maps.py` | Step 4: PNG map layers and `maps/index.json` |
| `export_api.py` | Step 5: API source in `web/server/data/`: `region.json`, `variables.json`, `trends/<id>.json`, `series/<id>.json`, for 1° cells (`API_CELL_DEG`). Rewrites only these files |
| `export_cover.py` | Step 6: `web/server/data/cover.json`: tree cover (Hansen, MOD44B), Hansen loss and burned area per 1° cell. Needs `export_api` first |
| `validate.py` | Step 7: `validation.json` in `web/public/data/` (snake_case) and `web/server/data/` (camelCase, for the API): agreement with Hansen, change against loss, fire co-location, hotspots, one documented case |
| `trends.py` | Step 8: the trend test of ADR-006 per 1° cell and per zone, with its checks V1–V4. Writes `web/server/data/trends/<id>.json`, the trend fields of `cover.json`, `zones.json` and `trendChecks` in `validation.json`. Settings in `config.py` (`TREND_*`). Run it last |
| `test_trends.py` | 7 checks of the test on synthetic series: a linear trend is found with its sign, white noise is mostly not significant after the correction, Hamed–Rao runs, annual sums and means, the 80 % rule, and the Sen slope with missing years |
| `export_borders.py` | Step 9: `web/public/data/borders.json`, Natural Earth countries clipped to the box and simplified (about 0.02°). Public domain |

## What "cleaning" does, per product

| Product | Kept variables | Cleaning |
|---|---|---|
| MOD13C2 | `ndvi`, `evi`, `reliability`, `n_1km_obs` | value ÷ 10000; fill −3000 and values outside −2000..10000 → NaN |
| MOD11C3 | `lst_day`, `lst_night`, `clear_days`, `clear_nights`, `day_local_time`, `land_percent` | value × 0.02 K → °C; fill 0 → NaN; clear-sky bit fields → number of days; observation time UTC → local solar time |
| GLDAS_NOAH025_M | `et`, `soil_moisture_0_10cm`, `rain_gldas` | kg m⁻² s⁻¹ × seconds in month → mm/month; fill → NaN |
| GPM_3IMERGM | `precip`, `precip_quality` | (time, lon, lat) → (lat, lon); mm/hr × hours in month → mm/month; fill → NaN |
| MOD44B (`tiles.py`) | `tree_cover`, `tree_cover_sd`, `nontree_veg`, `nonvegetated`, `n_250m_land`, `water_share` | Land pixels only (values 0–100); water (200) and fill (253) excluded. Cell value = mean of the land pixels whose centre is in the cell (about 570 per 0.05° cell). SD layer × 0.01 |
| MCD64A1 (`tiles.py`) | `burned_share`, `burn_day_mean`, `n_500m_mapped` | Mapped pixels = Burn Date ≥ 0 (unburned and burned land; unmapped −1 and water −2 left out). `burned_share` = burned ÷ mapped pixels, per cell and month |
| Hansen GFC (`hansen.py`) | `treecover2000` (%), `loss_share` per year 2001–2025, `canopy_loss` and `tree_cover` (% per year) | Mean of the 200 × 200 Landsat pixels of each 0.05° cell. Loss share = share of the cell's pixels with stand-replacing loss in that year (`lossyear` = year − 2000). `canopy_loss` (percentage points) weights each lost pixel by its 2000 canopy cover; `tree_cover` = 2000 cover minus cumulative `canopy_loss` (gain and regrowth not counted) |
| GRACE mascons (`grace.py`) | `tws` (= `lwe_thickness`, cm), `tws_uncertainty` | Clipped to the box on the 0.5° grid. One solution per calendar month (the first one if there are two). Land scale factors not applied |

All grids end with latitude and longitude ascending. Nothing is dropped for quality in step 2; the quality layers
travel with the data.

## Zones and quality rule (step 3)

- **Zones:** `amazon` (the chosen Amazon polygon), `amazon_brazil` and `amazon_peru` (Amazon polygon AND the
  country polygon from Natural Earth). A cell belongs to a zone when its center is inside.
- **Amazon polygon:** `AMAZON_BOUNDARY` in `config.py`, `raisg_biome` for now (team decision P-008 pending).
- **NDVI/EVI quality:** cells with `reliability` in `MOD13C2_ACCEPTED_RELIABILITY` (now 0 and 1). The share of
  "good" cells is exported as `ndvi_good_share` so the effect of this rule is visible.
- **Average:** weighted by cos(latitude), because 0.05° cells are smaller away from the equator.
- **Burned area** is not a mean: per zone and month it is the sum of cell areas times burned share (km²), weighted
  by cos(latitude) through the cell area.

## Team rules applied at export (2026-11-15)

Decisions of the team, recorded in `pipeline/config.py` (see `.ai-context/05-tech-debt.md`, *Done*):

| Rule | Decision | Setting | Effect in the outputs |
|---|---|---|---|
| C1 | Analyse full years from January 2001 | `ANALYSIS_START = "2001-01"` | Every series starts in 2001-01. February 2000 is dropped: it is a partial first month of Terra (see *Validation*, problem 2) |
| B1 | Daytime and night LST only up to 2020-12 | `LST_LAST_MONTH = "2020-12"` | `lst_day` and `lst_night` end in 2020-12. After that Terra's overpass drifts (10:32 → 08:56 local time by 2026) and night LST is biased warm. Aqua is not used. The diagnostics `lst_clear_days` and `lst_day_local_time` are still exported for all months |
| D1 | GLDAS evapotranspiration is climate context only | `kind: "context"` | `et` is marked as context, not as a forest indicator. GLDAS keeps static land cover, so it cannot show deforestation |
| — | Six-month periods: H1 = January–June (mostly wet season), H2 = July–December (dry and fire season) | `SEMESTERS` | `amazon_semester.json` and the burned-area maps use `YYYY-H1` and `YYYY-H2` |

The team's stated priorities behind these choices: the most precise percentage of tree cover per pixel, independent
validation (credibility), and showing causes of tree loss (for example fire). The minimum comparison window is six
months.

Still open (P-020, `.ai-context/05-tech-debt.md`): the MOD13C2 reliability rule (now 0 and 1), and whether to mask
physically implausible values that are inside the product's valid range (for example night LST of −85.5 °C in 2000-04).

## Outputs: `web/public/data/`

Full description of each file and of the map encodings: [`web/README.md`](../web/README.md) (*Data contract*) and
`.ai-context/03-database.md`. This section lists what the export writes.

| File | Written by | Content |
|---|---|---|
| `amazon_monthly.json` | `export_json.py` | Monthly values per zone (below) |
| `amazon_semester.json` | `export_json.py` | The same values per six-month period (`2001-H1`, `2001-H2`, …) |
| `amazon_annual.json` | `export_json.py` | Yearly tree cover (MOD44B), Hansen cover 2000 and loss area, burned area per complete year |
| `validation.json` | `validate.py` | Cross-validation sections (see *Cross-validation and fire attribution*) |
| `maps/index.json`, `maps/**/*.png` | `export_maps.py` | 0.05° map layers (see *Outputs for the web*) |
| `borders.json` | `export_borders.py` | Country borders (GeoJSON), for orientation on the map |

### `amazon_monthly.json`

```jsonc
{
  "meta": { "amazon_boundary": "raisg_biome", "analysis_start": "2001-01", "lst_last_month": "2020-12",
            "clip_box": {...}, "semesters": {...}, "method": "...", ... },
  "zones": { "amazon": { "label": "Amazon (whole region)", "cells_0.05deg": 227151, "area_km2": 6981204 }, ... },
  "variables": { "ndvi": { "source": "MOD13C2", "doi": "...", "units": "1", "description": "...", "kind": "data",
                           "zone_statistic": "mean", "semester_aggregation": "mean" }, ... },
  "series": {
    "amazon": {
      "ndvi": { "t": ["2020-03", "2020-08"], "mean": [0.8001, 0.7921], "valid_share": [0.997, 0.999] }, ...
    }, ...
  }
}
```

The variables and their `kind`:

| Kind | Variables |
|---|---|
| `data` | `ndvi`, `evi`, `lst_day`, `lst_night`, `burned_area` |
| `context` | `et` (GLDAS, climate context only), `soil_moisture_0_10cm`, `precip`, `water_storage` (GRACE) |
| `diag` | `ndvi_good_share`, `lst_clear_days`, `lst_day_local_time`, `rain_gldas` |

`data` and `context` variables carry `valid_share` (fraction of zone cells with a value that month). `diag` variables
are quality diagnostics. `burned_area` has `total` (km²) instead of `mean`. Missing GRACE months are absent from `t`,
not null.

**Size and series length.** After the 15 Nov extension: `amazon_monthly.json` 242 KB, `amazon_semester.json` 44 KB,
`amazon_annual.json` 9 KB, `validation.json` 42 KB, `maps/` 129 PNG layers, 17.4 MB (Vercel serves JSON compressed).
Each series has its own `t` array, because the series end at different months: LST day and night 2020-12, IMERG
2025-09, GLDAS 2026-07, MODIS NDVI and EVI 2026-10, and water storage 2026-09 with 35 months missing. A front end must
not assume that all variables share the same months. `mean` (or `total`) is null when no zone cell had a valid value.

### `amazon_semester.json` and `amazon_annual.json`

- **Semester:** the same zones, variables and `meta`. `series.<zone>.<variable>` has `t` (`"2010-H2"` style), `value`,
  `n_months` (valid months in the period) and `aggregation` (`mean`, or `sum` for precipitation, ET, rain forcing and
  burned area, which becomes km² per period). `value` is null when no month in the period is valid.
- **Annual:** `t` holds years as numbers. `tree_cover`, `tree_cover_sd`, `nontree_veg` and `nonvegetated` (MOD44B, %) and
  `hansen_treecover2000` (%) use `mean`. `hansen_loss_area` (km², years 2001–2025) and `burned_area` (km², complete years
  only) use `total`. MOD44B year Y covers early March Y to early March Y+1.

## Outputs for the web app: the API source (`web/server/data/`)

Written by `export_api.py`, `export_cover.py` and `validate.py`. The web backend reads these files when it is built with
`SIGNO_DATA_SOURCE=files` (or `npm run build:real`). Contract: `web/shared/contracts.ts`. Layout and rules:
`web/server/data/README.md`.

**Cells.** Squares of `API_CELL_DEG` (1.0, in `config.py`) on the clip box. A cell is kept when at least half of its
0.05° sub-cells lie inside the Amazon polygon: **566 cells**. Ids are `r<row><col>`, for example `r03c07`; row 0 is the
south edge and column 0 the west edge. A monthly value is the cos-latitude weighted mean of the 0.05° cells that lie
inside both the API cell and the Amazon polygon.

**Variables.** Five monthly variables go to the API. The others (`lst_night`, `et`, soil moisture, water storage and the
diagnostics) are in `amazon_monthly.json` only.

| Variable | Source | Period | Six-month value | Notes |
|---|---|---|---|---|
| `ndvi` | MOD13C2 | 2001-01 → 2026-10 | mean | Only reliability values 0 and 1 are used |
| `evi` | MOD13C2 | 2001-01 → 2026-10 | mean | Same reliability rule |
| `lst_day` | MOD11C3 | 2001-01 → 2020-12 | mean | Stops in 2020-12 (team rule B1) |
| `precip` | GPM_3IMERGM | 2001-01 → 2025-09 | sum | mm per month |
| `burned_area` | MCD64A1 | 2001-01 → 2026-09 | sum | % of the cell burned in the month |

**Files.**

- `region.json`: the region `amazon`, its bounding box and its boundary source (provisional, P-008).
- `variables.json`: one entry per variable, with `semesterAggregation` (`sum` for `precip` and `burned_area`, `mean`
  otherwise).
- `trends/<id>.json`: one entry per cell, with `validMonths`. `export_api` writes every slope and p-value as `null` and
  `significant` as `false`. `trends.py` (step 8) fills them for the tested cells, with the Sen line (`line`) and the
  `method` block (see *Trend test*).
- `series/<id>.json`: monthly values per cell, `null` where no source cell had a valid value. A cell without any valid
  month is left out.
- `export_api.py` rewrites only `region.json`, `variables.json`, `trends/` and `series/`. `cover.json` and
  `validation.json` are kept. The five series files total about 28 MB; each trends file is about 67 KB.

**`cover.json`** (`export_cover.py`, run after `export_api` because it reads the cell ids of `trends/ndvi.json`). The
same 566 cells. Per cell:

| Field | Years | Meaning |
|---|---|---|
| `hansenTreeCover` (%) | 2000–2025 (26 values) | Hansen canopy cover in 2000, then the cover at the end of each year, computed from the canopy-weighted loss. It cannot increase |
| `modisTreeCover` (%) | 2000–2025 | MOD44B yearly estimate (its product year runs March to March) |
| `lossKm2` | 2001–2025 | Hansen stand-replacing loss area per year (km²) |
| `burnedKm2` | 2001–2025 | Burned area per calendar year (km²), summed over its 12 months |

`definitions` explains each field in plain language. `flags` records the suspect MOD44B 2025 year (see *Known limits*).
The file is about 361 KB before the trend results. Step 8 adds `trends` to each cell (`lossKm2` and `modisTreeCover`:
slope per decade, raw p-value, significance after the correction, Sen line) and the layer's `trendMethod` text. With them
the file is about 540 KB.

**`validation.json`** (`validate.py`): the camelCase copy for the API has the zone sections (agreement, change against
loss, loss with fire, hotspots with `apiCellId`) and `cases`. Outside `trendChecks` it holds no p-values and no
significance fields; the server rejects them (`web/server/validate.ts`). `trendChecks` is written by `trends.py`.

**`zones.json`** (`trends.py`): for `amazon`, `amazon_brazil` and `amazon_peru`, every variable with its `units`, its
complete years (`annual`, value null when a year is incomplete), the lowest and highest month of each complete year
(`monthlyRange`, monthly variables only, information only), the zone test (`zoneTrend`: Sen slope per decade, raw p, the
test used, years, and `line`), and the counts of the squares that the cell tests found (`cellSummary`). Hansen tree cover
is shown but never tested. Served at `/api/v1/zones.json`.

**`borders.json`** (`export_borders.py`): the country borders as GeoJSON (Natural Earth 10m admin-0, public domain). Static
file, not part of the API; the map draws it for orientation.

**Checks (15 Nov 2026).**

- The 566 cover cell ids are the same as the ids of `trends/ndvi.json`. Hansen cover stays within 0–100 and never
  increases (the server checks this at every build).
- The sum of `lossKm2` over the 1° cells is 631,287 km², against 656,618 km² for the whole Amazon zone (−3.9 %). The
  gap comes from border cells that are not in the 1° grid (cells with less than half of their area in the Amazon).
- Burned area over 2001–2025 totals about 1.89 million km² in the zone.

## Outputs for the web: map layers (`maps/`)

`export_maps.py` writes one PNG per layer and year (or half-year), on the 0.05° grid, plus `maps/index.json` with the
grid, the encodings and the file list. The run of 15 Nov 2026 wrote 129 PNG files, 17.4 MB in total.

| Layer | Files | Value in the PNG | How to decode |
|---|---|---|---|
| Tree cover (MOD44B) | `maps/tree_cover/<YEAR>.png`, 2000–2025 | Percent, whole number (rounded) | value = percent (0–100) |
| Canopy cover 2000 (Hansen) | `maps/hansen/treecover2000.png` | Percent, whole number (rounded) | value = percent (0–100) |
| Tree cover at year end (Hansen) | `maps/hansen/tree_cover_<YEAR>.png`, 2001–2025 | Percent, whole number (rounded) | value = percent (0–100); 2000 cover minus cumulative canopy loss |
| Forest loss (Hansen) | `maps/hansen/loss_<YEAR>.png`, 2001–2025 | `round(100 × √share)` | share = (value ÷ 100)² |
| Burned area (MCD64A1) | `maps/burned/<YYYY>-<H1 or H2>.png` | `round(100 × √share)`; sum of monthly shares, capped at 1 (re-burns count twice) | share = (value ÷ 100)² |

- Value **255 = no data**. Row 0 is the north edge, column 0 the west edge; each pixel is one 0.05° cell.
- The square root keeps small shares visible: 0.01 % of a cell is stored as 1.
- The maps cover the whole clip box and are **not cut to the Amazon polygon**: the RAISG boundary may not be
  redistributed (see `data/README.md`). The zone numbers in the JSON files do use the polygon.
- Tree cover and canopy cover are stored as whole percent. The JSON zone values keep three decimals.
- Hansen layers have no data in the strip 10.0–10.5° N (see *Known caveats* in `data/README.md`).
- The last half-year of the burned-area layer is partial if the run ends in October 2026 (the `n_months` count in
  `maps/index.json` shows it).

## Checks on the new products (2026-11-15)

Sanity checks run on single years or months, before the full run. They are not validation results.

- **MOD44B, year 2000, whole Amazon:** mean tree cover 64.0 %. Dense forest saturates near 79–85 %, not 100 %.
- **MCD64A1, August 2010, inside the Amazon polygon:** about 52,000 km² burned.
- **GRACE:** 259 monthly solutions from 2002-04 to 2026-09; 35 months missing (battery gaps and the 2017-07 to 2018-05
  gap between the missions).
- **Hansen:** the tile grid covers 10° N to 21° S; the strip 10.0–10.5° N of the box has no data (1.6 % of the box).
  Full aggregation checked: no negative tree cover; Peru loss 2001–2025 about 46,000 km² (~1,850 km² per year, the
  order of Peru's official yearly figures); Amazon-wide loss peaks in 2016 and 2024, both record fire years.
- **MCD64A1:** 311 months, 2000-11 to 2026-09 (2026-10 not yet published by NASA).

## Checks done on 2026-11-14 (sample months 2020-03 and 2020-08)

- Zone areas match the published areas: whole Amazon 6,981,204 km² vs 6,966,291 km² in the RAISG polygon
  (+0.2%); the HydroBASINS basin mask gives 5,926,323 km² vs 5,912,923 km² (+0.2%).
- Two independent rainfall estimates agree: IMERG 226 / 100 mm and GLDAS forcing 213 / 98 mm (Mar / Aug).
- Terra daytime overpass is 10:32 local solar time in 2020, as expected for a 10:30 orbit.
- Clouds: in March only 42% of Amazon cells are "good" in MOD13C2 (82% in August), daytime LST rests on
  6.7 clear days on average (16.0 in August), and nighttime LST covers 83% of the zone (99% in August).

## Validation of the full series (2026-11-14)

Descriptive checks on `amazon_monthly.json` (zone `amazon` unless said otherwise). Anomaly = value minus the
mean of the same calendar month over the whole record. No trend or significance test was run.
These checks ran on the 14 Nov output, before the team rules of 15 Nov (they include February 2000 and LST after
2020-12). They are kept as they were.

**Completeness.** 1,270 monthly files, none missing; no `null` in any series. After the plausibility check was
relaxed (see `clip_clean.py`), the months it had rejected were reprocessed from the files already on disk. Only
two cells in the whole record are implausible: night LST of −85.5 °C (2000-04) and −108.3 °C (2005-06), both in
the Colombian Andes, outside the Amazon polygon.

**Seasonal cycle (physically consistent).**

| Month | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rain, mm (IMERG) | 240 | 241 | 268 | 249 | 224 | 167 | 140 | 112 | 115 | 150 | 176 | 222 |
| Soil moisture 0–10 cm, mm | 33.4 | 34.0 | 34.7 | 35.1 | 34.7 | 33.1 | 30.6 | 28.3 | 28.0 | 29.2 | 30.9 | 32.3 |
| Day LST, °C | 26.9 | 27.0 | 27.1 | 26.8 | 26.0 | 25.9 | 26.4 | 27.8 | 28.8 | 29.1 | 28.5 | 27.4 |
| EVI | 0.52 | 0.51 | 0.51 | 0.50 | 0.48 | 0.48 | 0.47 | 0.48 | 0.50 | 0.53 | 0.53 | 0.52 |
| Share of "good" NDVI cells | 0.43 | 0.42 | 0.37 | 0.40 | 0.51 | 0.63 | 0.74 | 0.81 | 0.72 | 0.62 | 0.49 | 0.42 |
| Clear-sky days behind LST | 6.4 | 4.4 | 5.0 | 6.3 | 9.1 | 12.5 | 15.3 | 15.9 | 13.7 | 10.1 | 7.6 | 6.4 |

Rain peaks in March and bottoms in August; soil moisture follows one or two months later; the surface is hottest at
the end of the dry season (Sep–Oct). EVI rises in the late dry season, as reported by Huete et al. (2006, doi:10.1029/2005GL025583);
whether that rise is real or a sun-sensor geometry artifact is debated (Morton et al. 2014, doi:10.1038/nature13006).
NDVI barely moves (0.76–0.82 over 26 years): it saturates over dense canopy.

**Cross-checks between variables (monthly anomalies, 2000–2025).**

| Pair | r | Reading |
|---|---|---|
| IMERG rain vs GLDAS rain forcing (raw values) | +0.991 | Two independent products agree; mean difference 2.1 mm/month (1.2 in 2000–07, 4.8 in 2020–25) |
| Rain vs soil moisture | +0.71 | Wetter months, wetter soil |
| Soil moisture vs day LST | −0.58 | Dry soil, hotter surface; still −0.44 with LST one month later |
| Rain vs day LST | −0.49 | Dry months are hotter |
| Rain vs EVI / NDVI | ≈ 0.00 | At whole-Amazon monthly scale, greenness does not follow rainfall |
| Rain vs GLDAS ET | −0.06 | GLDAS ET does not respond to drought (static land cover in the model; P-019) |

**Documented droughts are visible.** Rank of the July–September rain anomaly among 26 years (1 = driest):

| Year | Amazon | Brazilian Amazon | Peruvian Amazon | Literature |
|---|---|---|---|---|
| 2005 | 3 | 4 | 5 | SW Amazon drought |
| 2010 | 8 | 7 | **3** | Drought centred in the SW Amazon |
| 2015 | 4 | 3 | 22 | El Niño drought, NE and central Amazon |
| 2023 | 2 | 2 | 6 | Record low Rio Negro at Manaus (Oct 2023) |
| 2024 | **1** | **1** | **1** | Record low Rio Negro (Oct 2024); NASA: about double 2015–16 |

In the July–November mean, 2023 is both the driest (rain) and the hottest (day LST) year of the record, and
soil moisture is at its lowest in 2023–2024.

**Problems found (for the team).**

1. **Terra orbit drift biases daytime LST (and maybe NDVI/EVI) after 2021.** Mean overpass time, local solar:
   10.54 h through 2020, 10.49 (2021), 10.34 (2022), 10.12 (2023), 9.82 (2024), 9.41 (2025), 8.94 (2026):
   about 1 h 40 min earlier. Daytime LST in 2026 averages 25.3 °C vs 27.2 °C in 2001–2005, and from 2015 on the
   overpass time and the day-LST anomaly correlate at r = 0.81. In 2024, a record drought year, day LST ranks
   only 14th hottest. Recent daytime LST cannot be compared with earlier years as it is (P-019).
2. **February 2000 is partial.** Terra data start at the end of that month: only 70% of cells have NDVI and 58%
   have day LST (26% night LST), against more than 87% in any other month.
3. **Nighttime LST coverage** falls to about 52% of the zone in some wet-season months (e.g. 2022-03, 2011-02).
4. **GLDAS ET** shows its largest single-month jump in 2025-06, the month GLDAS-2.1 changed its meteorological
   forcing (GALWEM). The ET anomaly averages +13.3 mm/month in 2024-06…2025-05 (a drought period) and +2.0 after;
   not conclusive, but consistent with GLDAS ET reflecting model forcing rather than the forest.

### Cross-validation and fire attribution (`validate.py`)

`validate.py` writes `web/public/data/validation.json` and `web/server/data/validation.json`. Per zone it has: agreement
of MOD44B with Hansen in 2000 (r, bias, RMSE, by Hansen class); change of MOD44B against Hansen loss by loss decile;
the share of Hansen loss area in cells that burned in the same or the previous year, per year; the ten cells with the
largest Hansen loss; and yearly zone means of MOD44B vs Hansen-derived tree cover (public file only). It also checks
one documented place (La Pampa, from `config.CASES`). Burned area has one rule everywhere: a cell counts as burned in
a year when its MCD64A1 burned share is above 0 in at least one month of that year. Only complete calendar years,
2001–2025, are used. Descriptive only: no significance test is applied to these sections, and the server rejects any p-value or
significance field in the report outside `trendChecks`. Results of the 2026-11-15 run:

**1. Two independent sensors agree on where the trees are (year 2000).**

| Zone | r (cells) | Mean bias MOD44B − Hansen | RMSE |
|---|---|---|---|
| Amazon | 0.882 (227,000) | −22.5 pp | 25.3 pp |
| Brazilian Amazon | 0.901 | −21.9 pp | 24.4 pp |
| Peruvian Amazon | 0.666 | −27.1 pp | 29.4 pp |

MOD44B saturates over dense forest: where Hansen sees 98 % canopy, MOD44B reports 72.5 %. Below 30 % cover the two
agree within a few points. So MOD44B tracks *where* and *how much it changes*, Hansen gives the more exact level.

**2. They agree on where trees were lost.** Correlation between MOD44B change (2024–25 vs 2001–02) and Hansen loss
2001–2025: r = −0.72 (Amazon), −0.78 (Brazil), −0.60 (Peru). In the 10 % of cells with the most Hansen loss
(54 % of the cell lost on average) MOD44B drops 22.6 points; where Hansen sees no loss MOD44B stays within ±1–3
points. In Peru, MOD44B rises 2–3 points in cells without loss: noise of the product, not new forest.

**3. Tree cover per year (zone means, %).**

| Year | Amazon MOD44B | Amazon Hansen | Brazil Hansen | Peru Hansen |
|---|---|---|---|---|
| 2001 | 63.1 | 86.2 | 85.8 | 94.0 |
| 2010 | 64.0 | 83.4 | 82.0 | 92.7 |
| 2020 | 62.8 | 80.1 | 77.8 | 90.0 |
| 2025 | 59.2 | 77.9 | 75.3 | 88.5 |

Hansen-derived cover cannot rise (regrowth is not counted); MOD44B can, and is noisier year to year.

**4. Fire explains a large part of the loss, but not all of it.** Share of Hansen loss area in cells that burned
(MCD64A1) the same or the previous year:

| Zone | Loss in burned cells, 2001–2025 | Average share of zone cells burned per year | Highest year |
|---|---|---|---|
| Amazon | 56 % | 13 % | 2024: 72 % |
| Brazilian Amazon | 61 % | 14 % | 2003: 81 % |
| Peruvian Amazon | 19 % | 3 % | 2005: 30 % |

Loss is concentrated where there was fire (4–7 times more than the share of burned cells), but co-location is not
causation: in the Amazon, forest is often cleared first and then burned. In Peru most loss happens without fire.

**5. Hotspots match documented cases.**

- **La Pampa, Madre de Dios (gold mining):** cell −12.975, −70.025 ranks 24th of 25,648 Peruvian cells (77 % of the
  cell lost). Small losses start in 2012 (3.8 % and 3.9 % of the cell in 2012 and 2013),
  the big jump is in 2014 (24 % that year), loss continues to 2019, nearly stops in 2020–2021 after Operación
  Mercurio (Feb 2019) and resumes in 2023, the timeline reported by MAAP. **No burned area from January 2001 to September 2026**: loss
  without fire. MOD44B tree cover 79.6 % (2001) → 5.4 % (2025); Hansen 99.6 % → 23.0 %.
- **Ucayali (Pucallpa area):** Peru's top hotspot, cell −8.525, −74.525, 94 % of the cell lost, peak in 2024, fire
  in most years since 2005.
- **San Martín–Loreto border (near Yurimaguas):** cells near −6.1, −76.2, peak loss 2007, fire only 2006–2008.
  (Place names here are approximate, from the coordinates; check them on a map before quoting.)
- **Brazil:** the top cells (99 % lost) are in northern Mato Grosso and southern Pará, along the arc of
  deforestation, e.g. −11.175, −54.875 (peak 2020) and −5.925, −53.525 (peak 2018), all with repeated fire.

Full lists (10 per zone, with coordinates, peak year and burned years) are in `validation.json`.

## Trend test (step 8)

Decided by the team on 15 Nov 2026 (ADR-006; the decision and its parameters are in `.ai-context/01-logic.md`,
*Method*) and applied by `pipeline/trends.py`. It writes the trend results in four places: `web/server/data/trends/<id>.json`
(per cell: `slopePerDecade`, `pValue`, `significant`, `line`, `method`), `cover.json` (per cell `trends` for Hansen loss and
MODIS tree cover, and `trendMethod`), `zones.json` (per zone), and `validation.json` (`trendChecks`: the drift check D1 and
the checks V1–V4).

**The test.** For each 1° cell (566) and each measure:

1. One value per calendar year: the mean of the 12 months (NDVI, EVI, daytime LST) or the total (rainfall, burned area).
   Only years with all 12 months count, so the seasonal cycle does not enter the test.
2. A cell is tested with at least 80 % of its years complete. Otherwise its slope and p-value are null.
3. Mann–Kendall test (`pymannkendall`, the original test) on the yearly values. The change per decade is Sen's slope
   (median of all pairwise slopes, using the real year gaps) × 10, in the measure's yearly units.
4. Autocorrelation rule (pre-registered): lag-1 autocorrelation of the residuals around the Sen line, beyond
   1.96/√n, in more than 20 % of the tested cells of a measure would switch that measure to the Hamed–Rao test. It did not
   happen in any measure (shares below).
5. Benjamini–Hochberg false discovery rate (`statsmodels`, `fdr_bh`) across all tested cells of one measure (the two cover
   measures separately). A cell is significant when its q-value is below α = 0.05. The `pValue` in the file is the raw p.

**Periods and data rules** (first run):

| Measure | Years tested | Why |
|---|---|---|
| NDVI, EVI | 2001–2020 | Satellite drift (rule D1): the yearly anomaly correlates with the Terra overpass time, r = 0.85 (2015–2025, n = 11, p = 0.0009), above the rule's 0.5 |
| Daytime LST | 2001–2020 | Team rule B1 (orbit drift) |
| Rainfall | 2001–2024 | 2025 ends in September |
| Burned area | 2001–2025 | Complete years |
| Hansen tree cover loss (km²) | 2001–2025 | Hansen tree cover itself is not tested (it cannot rise) |
| MODIS tree cover | 2000–2024 | 2025 flagged suspect (rule D2) |

Overpass time (Amazon, yearly mean): 10.54 h in 2015 and 9.41 h in 2025. Share of tested cells with residual
autocorrelation: NDVI 17 %, EVI 3 %, daytime LST 5 %, rainfall 9 %, burned area 7 %, Hansen loss 16 %, MODIS 10 %. None
above 20 %, so the original test is used for every measure.

**Results of the first run (15 Nov 2026).** Cells with a clear rise and fall after the correction (566 cells tested for
every measure):

| Measure | Years | Clear rise | Clear fall |
|---|---|---|---|
| Daytime LST | 2001–2020 | 429 | 0 |
| NDVI | 2001–2020 | 158 | 48 |
| EVI | 2001–2020 | 68 | 3 |
| Rainfall | 2001–2024 | 0 | 69 |
| Burned area | 2001–2025 | 27 | 20 |
| Hansen tree cover loss | 2001–2025 | 318 | 20 |
| MODIS tree cover | 2000–2024 | 27 | 135 |

Zone tests (one test per zone and measure, **not corrected** for multiple tests; slope per decade, raw p; "clear" = p below 0.05):

| Zone | NDVI | EVI | Daytime LST (°C) | Rainfall (mm per year) | Hansen loss (km² per year) | MODIS tree cover (%) |
|---|---|---|---|---|---|---|
| Whole Amazon | +0.0010, p 0.50 | +0.0054, p < 0.001 (clear) | +0.33, p < 0.001 (clear) | −37, p 0.33 | +4,768, p 0.047 (clear) | −0.86, p 0.003 (clear) |
| Brazilian Amazon | −0.0003, p 0.92 | +0.0050, p < 0.001 (clear) | +0.38, p < 0.001 (clear) | −78, p 0.13 | +1,619, p 0.41 | −1.25, p < 0.001 (clear) |
| Peruvian Amazon | +0.0039, p 0.005 (clear) | +0.0075, p 0.006 (clear) | +0.31, p < 0.001 (clear) | −114, p 0.10 | +831, p < 0.001 (clear) | +0.58, p 0.06 |

Burned area: no zone is clear (p 0.3 or more). Across the 566 cells, the median slope of daytime LST is +0.33 °C per decade.

**Checks V1–V4** (`validation.json`, `trendChecks`; own code, a fixed random seed):

| Check | What it does | First-run result |
|---|---|---|
| V1 false positives | Shuffles the years of every cell, 20 times, and runs the whole procedure | Mean share of cells flagged: 0 for every measure, except burned area (0.009 %). Worst run: 0.18 % (burned area) |
| V2 detection | Adds to the shuffled series a linear trend of the median size of the significant cells, and counts how many are found | Mean (weakest run): NDVI 57 % (54 %), EVI 73 % (67 %), daytime LST 53 % (46 %), rainfall 92 % (89 %), burned area 77 % (75 %), Hansen loss 55 % (52 %), MODIS tree cover 85 % (81 %) |
| V3 known places | The 14 cross-check hotspots and the La Pampa cell (r08c09): loss expected to rise, MODIS cover to fall | Loss clearly rising in 5 of the 14 hotspots (and in La Pampa, +37 km² per year per decade, p < 0.001). MODIS cover clearly falling in 9 of the 14 (and in La Pampa, −2.0 % per decade, p < 0.001). The other hotspots are not clear |
| V4 zones | The zone tests above | Descriptive: three zones, no correction |

How to read them. V1 says the procedure does not invent trends from noise. V2 says it finds a typical real trend only in
about half to nine tenths of the cells, so a cell that is not clear is not proof that nothing changed. V3 says that the
known place agrees with the expected direction, but the 1° cell averages a much larger area, so a documented change looks
smaller than at 0.05°. Neither V3 nor V4 is a causal test.

Not done yet: the comparison with NASA Giovanni (P-007, C3) and a confidence interval for the slope (P-029).

## Known limits (review of 15 Nov 2026)

Found while reviewing the outputs. Each item limits what the data can say. The team decides how to show them.

- **MOD44B 2025 is anomalous.** The Amazon mean falls from 62.2 % to 59.2 % in one year, while Hansen falls by 0.4
  points in the same year. In cells without Hansen loss, MOD44B falls by 2.6 points. The flag is in `cover.json`:
  treat 2025 as suspect.
- **MOD44B cannot give the amount of loss.** From 2001 to 2024 the Amazon mean falls 0.9 points in MOD44B and 7.9 points
  in Hansen. Its year-to-year noise is 1–2 points. MOD44B confirms *where* loss happened, not *how much*.
- **Hansen loss is stand-replacing loss,** not only deforestation: fire, logging, mining and clearing all count. For
  Brazil it may be about 1.5–2 times the INPE PRODES clear-cut figure. This is an order of magnitude only; check it
  against PRODES before quoting it.
- **Loss years before and after about 2013 are not strictly comparable.** Global Forest Watch cautions about this for
  Hansen data; check its documentation before quoting.
- **Fire co-location is partly circular.** Canopy killed by fire counts as loss, so part of the overlap is built in.
  Co-location is not causation.
- **Hansen-derived cover has no regrowth.** It can only fall, so it understates recovery.
- **Partial half-years are not comparable.** A half-year with missing months, such as 2026-H2 at the end of the run, is
  marked incomplete by the backend and must not be compared with a full one.
- **Agreement and change r values are descriptive.** They carry no p-value, and neighbouring cells are not independent
  (spatial autocorrelation), so they cannot be read as tests.
- **The trend results are first-run numbers.** They come from the run of 15 Nov 2026 (validation file written 10:36 UTC).
  `trends.py` was changed afterwards (rounding of tied values), so a re-run can change the numbers slightly. The
  `trendChecks` in `validation.json` are the source.
- **Missing years.** The Mann–Kendall test uses the years that exist, in order, and ignores a gap. Sen's slope uses the real
  years. Only 7 burned-area cells have a missing year in the first run.
- **Missing checks.** No confidence interval is published for the slope, although the team kit asks to show uncertainty.
  The comparison with NASA Giovanni (P-007, C3) is not done. Both are open (`.ai-context/05-tech-debt.md`, P-029).
- **Zone tests are not corrected** for multiple tests (three zones); the square counts are.
