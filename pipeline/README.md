<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and extended on 2026-11-15; reviewed by the team. -->

# Data pipeline

Turns NASA's and Hansen's files into light files for the web: zone values by month, six-month period and year (JSON),
0.05° map layers (PNG), a 1° API source (JSON), tree cover and loss per 1° cell (JSON), cross-checks and the trend test (JSON). Runs
locally. Step 8 applies the team's trend test (ADR-006, see `.ai-context/01-logic.md`, *Method*), and
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
web/server/data/           region.json · variables.json · trends/ · series/ · cover.json · zones.json · validation.json   (API source; versioned)
```

Order of the steps: 1 → 1b → 1c → 1d → 3 → 4 → 5 → 6 → 7 → 8. Step 2 runs inside step 1 for each month. The export steps
read what the earlier steps wrote; they do not check that every source is complete. `export_cover` reads the cell ids
of `web/server/data/trends/ndvi.json`, so `export_api` must run first. `validate` does not need the other exports.

**Run `trends` last (step 8).** `export_api`, `export_cover` and `validate` each rewrite files that `trends` fills
(`trends/`, `cover.json`, `validation.json`), so re-running any of them after `trends` removes the trend results. Each of
those three scripts prints this reminder. Re-run `trends` after them. Step 9 (`export_borders`) writes only
`web/public/data/borders.json`, so it can run at any time after the boundary files are in `data/raw/boundaries/`. `export_json` prints the number of months it found per source, so check that count before you publish.

## Run it

Python 3.12 or later is required. The pinned versions in `pipeline/requirements.txt` have no wheels for Python 3.10 or
3.11 (numpy 2.5.4 does not install on them). Run every command from the repository root, with the virtual environment active.

### One command (recommended)

```bash
python -m pipeline.run_all
```

It runs the whole pipeline in five stages:

1. **Checks before anything is downloaded:** Python 3.12 or later; Earthdata credentials (it only checks that they exist: the environment variables `EARTHDATA_TOKEN` or `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`, or a netrc file; it never reads or prints them); the RAISG zip `Biomas_2025.zip` under `data/raw/`; free disk space (warns under 20 GB). If something is missing, it stops before downloading.
2. **Downloads** the 8 sources in parallel, at most four at a time, longest first: MOD13C2, MCD64A1, Hansen, MOD11C3, MOD44B, GLDAS_NOAH025_M, GPM_3IMERGM, GRACE. One log per source in `data/interim/logs/<SOURCE>.log`; progress is printed every 2 minutes.
3. **Checks the logs:** if a month or tile failed, it stops before the exports. Run the same command again to resume: finished months and tiles are skipped.
4. **Runs the steps in order:** `export_json`, `export_maps`, `export_api`, `export_cover`, `validate`, `test_trends`, `trends`, `export_borders`.
5. **Verifies the results** with `pipeline.verify` (report: `data/interim/logs/verify_report.json`), and prints the time of every step (also saved to `data/interim/logs/run_summary.json`).

| Option | What it does |
|---|---|
| `--only downloads` | runs the downloads only (stages 2 and 3) |
| `--only exports` | runs stage 4 and the verify step from an existing `data/interim/` (exports, trend test and verify) |
| `--dry-run` | checks and plan only; nothing is downloaded |
| `--latest` | downloads up to the last complete month instead of the published dates; `verify` then shows longer monthly lists |
| `--jobs N` | the most sources downloaded at the same time (the measured runs used 4) |
| `--every` | how often progress is printed (default: every 2 minutes) |

**Default end dates** are those of the published run of 15 Nov 2026: MOD13C2 and MOD11C3 to 2026-10, GLDAS to 2026-07,
IMERG to 2025-09, MCD64A1 to 2026-09, MOD44B to 2025. Hansen and GRACE have no dates: GRACE always fetches NASA's current
file (on 15 Nov 2026 it held 259 months, 2002-04 to 2026-09).

### Step by step

The same steps one at a time:

```bash
py -m venv .venv
source .venv/Scripts/activate                                        # Windows (Git Bash). Linux/macOS: source .venv/bin/activate
.venv/Scripts/python -m pip install -r pipeline/requirements.txt   # Linux/macOS: .venv/bin/python

python -m pipeline.download --dry-run                       # what NASA has, nothing downloaded
python -m pipeline.download --products MOD13C2 MOD11C3 --start 2000-01 --end 2026-10   # monthly MODIS (needs Earthdata Login)
python -m pipeline.download --products GLDAS_NOAH025_M --start 2000-01 --end 2026-07    # end dates = the published run (run_all uses the same)
python -m pipeline.download --products GPM_3IMERGM --start 2000-01 --end 2025-09
python -m pipeline.clip_clean                               # only for files you downloaded by hand
python -m pipeline.tiles --product MOD44B --start 2000 --end 2025         # tree cover (Earthdata Login)
python -m pipeline.tiles --product MCD64A1 --start 2000-11 --end 2026-09  # burned area (Earthdata Login)
python -m pipeline.hansen                                   # Hansen tree cover and loss (no login)
python -m pipeline.grace                                    # GRACE water storage (Earthdata Login)
python -m pipeline.export_json                              # web/public/data/*.json
python -m pipeline.export_maps                              # web/public/data/maps/*.png and index.json
python -m pipeline.export_api                               # web/server/data/ (region, variables, trends, series)
python -m pipeline.export_cover                             # web/server/data/cover.json (run after export_api)
python -m pipeline.validate                                 # validation.json in web/public/data/ and web/server/data/
python -m pipeline.trends                                   # step 8: trend test (run last; writes trends/, cover.json, zones.json, validation.json trendChecks)
python -m pipeline.export_borders                           # step 9: web/public/data/borders.json
python -m pipeline.test_trends                              # 13 checks of the trend test on synthetic series
```

Run commands from the repository root. Boundary zips (RAISG, HydroBASINS) go by hand into `data/raw/boundaries/`,
with their original file names (links in `data/README.md`). The pipeline finds them by name anywhere under `data/raw/`.
Natural Earth countries is downloaded into the same folder automatically when it is missing.

**Login.** Locally, a netrc file with your Earthdata credentials, or the interactive prompt. The netrc file
is `~/.netrc` on Linux and `C:\Users\<user>\_netrc` on Windows, with one line:
`machine urs.earthdata.nasa.gov login USER password PASS`. On Windows, Notepad often saves it as `_netrc.txt`,
which does not work: check the file name. Keep the file outside the repository. The pipeline also reads the environment variables `EARTHDATA_TOKEN` (or `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`).
Never write credentials in code or commit them.
Hansen tiles are plain HTTPS downloads and need no login. `tiles.py` and `grace.py` use the same login as `download.py`.

**Volume of a full run (2000–2026).** For the four monthly products, downloads are about 56 GB for the two MODIS
products and a few GB for GLDAS and IMERG, but only one global file is on disk at any time. The kept clips take 1.6 GB.
`export_json` reads them one month at a time and took about 10 minutes for the full series (before the sources added
on 2026-11-15). The sources added on 2026-11-15: MOD44B about 33 GB (one year, ~1.3 GB, on disk at a time), MCD64A1 about
16 GB (one month, ~51 MB at a time), Hansen about 8.6 GB (16 tiles, two layers, each tile's files deleted after
aggregating), and GRACE one 44 MB file. On 2026-11-15 these took about 1 h 10 min in parallel; `data/interim/` grew
to 1.9 GB. The export steps `export_json` + `export_maps` + `validate` take about 15 minutes. The run time of `export_api` and
`export_cover` times of 15 Nov 2026 are in *Reproduce and verify*.
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
This is how the full run was started (from the repository root; on Linux or macOS use `.venv/bin/python`):

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
| `__init__.py` | Sets `HDF5_PLUGIN_PRELOAD="::"` before any netCDF or HDF5 file is opened, so HDF5 stops searching for compression plugins for every variable. On Windows this cut the exports from 44 min to 10 min (15 Nov 2026), with all 150 output files identical. A variable set beforehand is kept |
| `config.py` | Every setting: paths, clip box, Amazon boundary, zones, quality rule, products, extra sources, periods and semesters, API cells and variables, documented cases. **Team decisions are here** (C1, B1, D1, semesters: see *Team rules applied at export*), the trend test settings (`TREND_*`, ADR-006), the Hansen 2011 change (`HANSEN_LOSS_TREND_YEARS = (2011, 2025)`, `HANSEN_METHOD_CHANGE_YEAR = 2011`) and the PRODES series (`HANSEN_*`, `PRODES_*`, ADR-009), and the LST trend years (`LST_TREND_LAST_YEAR = 2020`, `DRIFT_FROM_YEAR = 2021`) |
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
| `validate.py` | Step 7: `validation.json` in `web/public/data/` (snake_case) and `web/server/data/` (camelCase, for the API): agreement with Hansen, change against loss (MODIS change 2023–2024 vs 2001–2002, against Hansen loss 2001–2024), fire co-location, hotspots, one documented case |
| `trends.py` | Step 8: the trend test of ADR-006 per 1° cell and per zone, with its checks V1–V4. Writes `web/server/data/trends/<id>.json`, the trend fields of `cover.json`, `zones.json` and `trendChecks` in `validation.json`. Settings in `config.py` (`TREND_*`). Each slope has a 95 % confidence interval (`slopeCi95`). Run it last |
| `test_trends.py` | 13 checks of the test on synthetic series: a linear trend is found with its sign, white noise is mostly not significant after the correction, Hamed–Rao runs, annual sums and means, the 80 % rule, the Sen slope with missing years, the Hansen loss trend starting at the method-change year, the confidence interval containing the Sen slope and the true slope, the interval of noise containing 0, the Sen slope against `scipy.stats.theilslopes`, and the LST trend ending at `LST_TREND_LAST_YEAR` |
| `export_borders.py` | Step 9: `web/public/data/borders.json`, Natural Earth countries clipped to the box and simplified (about 0.02°). Public domain |
| `verify.py` | Reproducibility check, not a pipeline step: compares every JSON and PNG file in `web/server/data/` and `web/public/data/` with the version committed in git HEAD. See *Reproduce and verify* |
| `run_all.py` | One command, `python -m pipeline.run_all`: checks, downloads (four sources at a time, resumable), exports, trend test, verify, and the time of each step. See *Run it* |

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
| B1 | Daytime LST is published to 2026-10; its trend ends in 2020 | `LST_TREND_LAST_YEAR = 2020`, `DRIFT_FROM_YEAR = 2021` | `lst_day` is published to 2026-10 (real NASA data). The trend uses 2001–2020. After 2020 Terra's overpass drifts (10:32 → 08:56 local time by 2026), so 2021 onward is shown with a "?" mark and is not tested. Night LST is still cut at 2020-12 and not exported (`LST_LAST_MONTH`, rule D4). Aqua is not used. The diagnostics `lst_clear_days` and `lst_day_local_time` are still exported for all months |
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

`lst_last_month` (2020-12) applies only to night LST: night LST is in this file up to 2020-12. Day LST is published to
2026-10 and its meta carries `lst_trend_last_year: 2020` and `drift_from_year: 2021` instead.

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
Each series has its own `t` array, because the series end at different months: LST day 2026-10 and night 2020-12, IMERG
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
| `lst_day` | MOD11C3 | 2001-01 → 2026-10 | mean | Published to 2026-10; the trend uses 2001–2020 (team rule B1) |
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

`definitions` explains each field in plain language. `flags` records the MOD44B 2025 anomaly (see *Known limits*). `methodChangeYear` (2011), `lossTrendYears` (2011–2025) and `hansenNote`
explain the Hansen method change.
The file is about 361 KB before the trend results. Step 8 adds `trends` to each cell: `lossKm2` (2011–2025),
and `modisTreeCover`, each with its `period`, slope per decade, its 95 % CI (`slopeCi95`), raw p-value, significance after
the correction, and Sen line. It also adds the layer's `trendMethod` text. With them the file is about 540 KB.

**`validation.json`** (`validate.py`): the camelCase copy for the API has the zone sections (agreement, change against
loss, loss with fire, hotspots with `apiCellId`) and `cases`. Outside `trendChecks` it holds no p-values and no
significance fields; the server rejects them (`web/server/validate.ts`). `trendChecks` is written by `trends.py`.

**`zones.json`** (`trends.py`): for `amazon`, `amazon_brazil` and `amazon_peru`, every variable with its `units`, its
complete years (`annual`, value null when a year is incomplete), the lowest and highest month of each complete year
(`monthlyRange`, monthly variables only, information only), the zone test (`zoneTrend`: Sen slope per decade, its 95 % CI (`slopeCi95`), raw p, the
test used, years, and `line`), and the counts of the squares that the cell tests found (`cellSummary`). For Hansen loss, `zoneTrend` covers 2011–2025 only, with its counts in `cellSummary`; `methodChangeYear` is 2011. Hansen tree cover
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

1. **Terra orbit drift may bias daytime LST (and maybe NDVI/EVI) after 2021.** Mean overpass time, local solar:
   10.54 h through 2020, 10.49 (2021), 10.34 (2022), 10.12 (2023), 9.82 (2024), 9.41 (2025), 8.94 (2026):
   about 1 h 40 min earlier. Daytime LST in 2026 averages 25.3 °C vs 27.2 °C in 2001–2005, and from 2015 on the
   overpass time and the day-LST anomaly correlate at r = 0.81. In 2024, a record drought year, day LST ranks
   only 14th hottest. This is most likely the overpass-time effect: Terra passes earlier from 2021, when the surface is
   cooler. It is also why 2021 onward is shown with a "?" and not tested. Recent daytime LST cannot be compared with earlier years as it is (P-019). Amazon yearly daytime LST: 2020 28.0 °C; 2021–2025 27.4, 27.4, 27.7, 27.6 and 26.1 °C. The 2025 drop of about 2 °C goes the wrong way for a drought (2023–2024 were record drought and heat years), which points to the overpass-time effect rather than real cooling; it is not proof. The drift years are shown but not tested.
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

**2. They agree on where trees were lost.** Correlation between MOD44B change (mean of 2023–2024 minus mean of
2001–2002) and Hansen loss 2001–2024. 2025 is left out of both, because the MOD44B 2025 drop is anomalous (15 Nov change):
r = −0.73 (Amazon), −0.79 (Brazil), −0.58 (Peru). The decile values, recomputed with this definition, are in
`validation.json` (`by_hansen_loss_decile`).

MODIS change against Hansen loss, by decile of Hansen loss (percentage points; mean(2023, 2024) − mean(2001, 2002); decile 1 = least loss, 10 = most loss):

| Zone | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Amazon | 2.09 | 2.08 | 1.72 | 1.44 | 1.66 | 1.57 | 1.21 | −0.03 | −4.58 | −20.50 |
| Brazilian Amazon | 2.53 | 2.50 | 1.88 | 1.49 | 1.60 | 1.30 | 0.73 | −2.00 | −8.70 | −25.12 |
| Peruvian Amazon | 2.07 | 2.20 | 2.46 | 2.61 | 3.24 | 3.33 | 2.82 | 2.38 | −0.18 | −9.50 |

In plain words: cells with little or no Hansen loss gain about 1 to 2.5 MODIS points in the Amazon and Brazil, and about 2 to 3.3 points in Peru. The decile with the most loss drops about 20.5 points (Amazon), 25 (Brazil) and 9.5 (Peru).

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
*Method*) and applied by `pipeline/trends.py`. Hansen loss is tested as one trend, 2011–2025, with all years shown
(ADR-009; see *Hansen loss: one trend from 2011* below). It writes the trend results in four places: `web/server/data/trends/<id>.json`
(per cell: `slopePerDecade`, `pValue`, `significant`, `line`, `method`), `cover.json` (per cell `trends` for Hansen loss (`lossKm2`, 2011–2025) and
MODIS tree cover, and `trendMethod`), `zones.json` (per zone), and `validation.json` (`trendChecks`: the drift check D1 and
the checks V1–V4).

**The test.** For each 1° cell (566) and each measure:

1. One value per calendar year: the mean of the 12 months (NDVI, EVI, daytime LST) or the total (rainfall, burned area).
   Only years with all 12 months count, so the seasonal cycle does not enter the test.
2. A cell is tested with at least 80 % of its years complete. Otherwise its slope and p-value are null.
3. Mann–Kendall test (`pymannkendall`, the original test) on the yearly values. The change per decade is Sen's slope
   (median of all pairwise slopes, using the real year gaps) × 10, in the measure's yearly units. The test uses only the order of the yearly values, so a missing year does not bias it (it has one value less). Seven burned-area cells lack 2001 or 2002.
4. Autocorrelation rule (pre-registered): lag-1 autocorrelation of the residuals around the Sen line, beyond
   1.96/√n, in more than 20 % of the tested cells of a measure would switch that measure to the Hamed–Rao test. It did not
   happen in any measure (shares below).
5. Benjamini–Hochberg false discovery rate (`statsmodels`, `fdr_bh`) across all tested cells of one measure (the two cover
   measures separately, and the Hansen loss trend is its own family). A cell is significant when its q-value is below α = 0.05. The `pValue` in the file is the raw p.

**Confidence intervals (published 15 Nov 2026).** Each slope has a 95 % confidence interval (`slopeCi95`), by the method of Gilbert (1987). Its variance comes from the same Mann–Kendall test (the Hamed–Rao variance when that test is used), and the pairwise slopes use the real year gaps. The intervals are published for the cells (`trends/*.json`, `cover.json`), the zones (`zones.json`), the known places and the zone checks. `trendChecks.design` records `ciMethod` and `ciLevel` = 0.95. Checks: the interval contains the Sen slope in every tested cell. For the significant cells, the interval excludes 0 in all but 2 burned-area cells (tie-heavy series). A cell that is not significant can have an interval that excludes 0, because the intervals are not corrected for the many cells. Example: the Amazon's daytime temperature rises +0.33 °C per decade, 95 % CI +0.17 to +0.55. Cross-check against SciPy 1.18.1 (`scipy.stats.theilslopes`; pinned in `requirements.txt`; unit test in `test_trends.py`): the slopes are identical. The bounds differ by a median of 0.3 % of the interval width in the 21 zone tests (largest 2.3 %), because SciPy rounds the ranks and this code interpolates (Gilbert 1987). The interval excludes 0 in exactly the 12 clear zone tests (21 computed; 18 shown). At cell level, 496 cells that are not clear after the correction have an interval that excludes 0; the cell intervals are not corrected.

### Hansen loss: one trend from 2011 (2011 method change)

Hansen's team reprocessed its loss data from 2011 onward, not for 2001–2010. The Hansen/UMD GFC v1.13 user notes say
that "users will notice inconsistencies as a result"; that Landsat 8 is used from 2013 and Landsat 9 from 2022; that
"care must be taken when comparing change across any interval"; that the data are "a relative indicator of
spatiotemporal trends"; and that "definitive area estimation should not be made using pixel counts"
(<https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>).

So the loss trend is one trend, 2011–2025, and is never tested across 2011 (ADR-009). It has its own Benjamini–Hochberg
family, with the same test as the other measures. The yearly values of all 25 years stay published and visible. The years
2001–2010 are real Hansen data from the earlier method: they are greyed in the charts, with an info tooltip, and are not used in the trend.

**Check against the official INPE PRODES series.** Brazilian Legal Amazon; the PRODES year runs August to July, and it
counts clear-cut of primary forest of at least 6.25 ha. Source: INPE, "Série Histórica Taxas Prodes Amazônia",
Apresentação Coletiva Prodes 2026, 16 Oct 2026, p. 4
(<https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/brasil-alcanca-menores-taxas-de-desmatamento-da-serie-historica-na-amazonia-e-no-cerrado>).
In the Brazilian Amazon zone of this study:

| Segment | Correlation with PRODES (yearly) | Hansen / PRODES ratio |
|---|---|---|
| 2001–2010 | r = 0.85 | 1.15 |
| 2011–2025 | r = 0.20 | 2.70 |

From 2011 Hansen also counts fire-killed and degraded canopy (its peaks in 2016–2017 and 2024), and it uses the
reprocessed method. One Mann–Kendall test over 2001–2025 gives a rising Amazon trend (p = 0.047) while PRODES falls
(p = 0.014). That is an artefact of the 2011 change, so it is not used. MODIS, an independent sensor, confirms *where*
Hansen sees loss: across the 566 cells, r = −0.79 (2001–2010) and −0.47 (2011–2025) between Hansen loss and MODIS
cover change.

**Results of the Hansen loss trend (15 Nov 2026).**

- Cells 2011–2025 (the trend): 566 tested, 45 rising, 2 falling. The first run's 2001–2025 test (318 rising, 20 falling) is
  superseded. The years 2001–2010 are not tested.
- Zone tests (not corrected; slope per decade, raw p):

| Zone | Hansen loss 2011–2025 (the trend) |
|---|---|
| Whole Amazon | clear rise (p 0.0075; +12,040 km² per year; 95 % CI +5,145 to +19,582) |
| Brazilian Amazon | clear rise (p 0.029; +8,709 km² per year) |
| Peruvian Amazon | clear rise (p 0.048; +456 km² per year) |
| PRODES, Brazilian Legal Amazon | clear rise (p 0.048) |

- Known places: La Pampa (r08c09) is still clearly rising in 2011–2025 (+43.5 km² per year per decade, 95 % CI +27.8 to +53.3, p 0.00025, q 0.019; its loss starts in 2012). None of the
  14 cross-check hotspots is clear after the correction (before: 5). The hotspots were chosen for their loss *peaks*
  (single events such as fire years), not for steady trends.

**Periods and data rules** (first run):

| Measure | Years tested | Why |
|---|---|---|
| NDVI, EVI | 2001–2020 | Satellite drift (rule D1): the yearly anomaly correlates with the Terra overpass time, r = 0.85 (2015–2025, n = 11, p = 0.0009), above the rule's 0.5. It rests on the five years 2021–2025, which include the 2023–2024 drought: a coincidence in time, not proof of cause |
| Daytime LST | 2001–2020 | Team rule B1 (orbit drift); published to 2026-10, and 2021 onward is shown with a "?" mark and not tested |
| Rainfall | 2001–2024 | 2025 ends in September |
| Burned area | 2001–2025 | Complete years |
| Hansen tree cover loss (km²) | 2011–2025 | Reprocessed method from 2011 (ADR-009); 2001–2010 is shown, not tested. Hansen tree cover itself is not tested (it cannot rise) |
| MODIS tree cover (computed, not shown in the interface) | 2000–2024 | 2025 excluded (rule D2) |

Overpass time (Amazon, yearly mean): 10.54 h in 2015 and 9.41 h in 2025. Share of tested cells with residual
autocorrelation: NDVI 17.0 %, EVI 3.0 %, daytime LST 4.6 %, rainfall 9.0 %, burned area 6.9 %, Hansen loss 2011–2025 7.1 %, MODIS 10.1 % (final, 15 Nov). None
above 20 %, so the original test is used for every measure. As a check, the Hamed–Rao variant was run for every measure: no direction or zone verdict changes. It flags more cells than the original test in every measure except NDVI, so the original test stays the more cautious choice.

**Results of the first run (15 Nov 2026).** Cells with a clear rise and fall after the correction (566 cells tested for
every measure):

| Measure | Years | Clear rise | Clear fall |
|---|---|---|---|
| Daytime LST | 2001–2020 | 429 | 0 |
| NDVI | 2001–2020 | 158 | 48 |
| EVI | 2001–2020 | 68 | 3 |
| Rainfall | 2001–2024 | 0 | 69 |
| Burned area | 2001–2025 | 27 | 20 |
| Hansen tree cover loss | 2011–2025 | 45 | 2 |
| MODIS tree cover | 2000–2024 | 27 | 135 |

Burned area has 48 clear cells in all: the 27 rising and 20 falling above, plus one cell (r24c13) that is clear with a zero slope (CI [0, 0]; 20 of its 25 years are zero).

Hansen loss: the first run's 2001–2025 test (318 rising, 20 falling) is replaced by the 2011–2025 trend above (ADR-009).

Zone tests (one test per zone and measure, **not corrected** for multiple tests; slope per decade, raw p; "clear" = p below 0.05):

| Zone | NDVI | EVI | Daytime LST (°C) | Rainfall (mm per year) | Hansen loss 2011–2025 (km² per year) | MODIS tree cover (%) |
|---|---|---|---|---|---|---|
| Whole Amazon | +0.0010, p 0.50 | +0.0054, p < 0.001 (clear) | +0.33, p < 0.001 (clear) | −37, p 0.33 | +12,040, p 0.0075 (clear) | −0.86, p 0.003 (clear) |
| Brazilian Amazon | −0.0003, p 0.92 | +0.0050, p < 0.001 (clear) | +0.38, p < 0.001 (clear) | −78, p 0.13 | +8,709, p 0.029 (clear) | −1.25, p < 0.001 (clear) |
| Peruvian Amazon | +0.0039, p 0.005 (clear) | +0.0075, p 0.006 (clear) | +0.31, p < 0.001 (clear) | −114, p 0.10 | +456, p 0.048 (clear) | +0.58, p 0.06 |

95 % confidence intervals of two zone slopes: whole Amazon daytime LST +0.17 to +0.55 °C per decade; whole Amazon Hansen loss 2011–2025 +5,145 to +19,582 km² per year.

Multiple tests (not applied; a team decision for after the deadline). Zone results are not corrected for multiple tests: 18 are shown (3 zones × 6 measures; Brazil and Peru are parts of the whole Amazon). With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in Brazil (p 0.029, q 0.059) and in Peru (p 0.048, q 0.086) would not. Both are borderline and not robust to leaving one year out. Whole-Amazon loss stays clear (p 0.0075, q 0.017), and it stays clear when any year is left out (worst p 0.0215).

Burned area: no zone is clear (p 0.3 or more). Across the 566 cells, the median slope of daytime LST is +0.33 °C per decade.

The 2011–2025 values are in the table of the subsection *Hansen loss: one trend from 2011*. The years 2001–2010 are not tested.

**Checks V1–V4** (`validation.json`, `trendChecks`; own code, a fixed random seed):

| Check | What it does | First-run result |
|---|---|---|
| V1 false positives | Shuffles the years of every cell, 20 times, and runs the whole procedure | Mean share of cells flagged: 0 % for every measure, except burned area (0.009 %) and MODIS tree cover (0.009 %; the share is 0.00009 in `validation.json`). Largest single run: 0.18 % for burned area and for MODIS tree cover (one cell in one round). Every other variable is 0. V1 and V2 share one random stream since the 15 Nov change; the MODIS test itself is identical |
| V2 detection | Adds to the shuffled series a linear trend of the median size of the significant cells, and counts how many are found | Mean (weakest run): NDVI 57 % (54 %), EVI 73 % (67 %), daytime LST 53 % (46 %), rainfall 92 % (89 %), burned area 77 % (75 %), Hansen loss 2011–2025: 74 % (72 %); MODIS tree cover 85 % (83 %) |
| V3 known places | The 14 cross-check hotspots and the La Pampa cell (r08c09): loss expected to rise, MODIS cover to fall | Loss (2011–2025) clearly rising in none of the 14 hotspots after the correction (before: 5). La Pampa is still clearly rising (p 0.00025; loss from 2012). MODIS cover clearly falling in 9 of the 14 (and in La Pampa, −2.0 % per decade, p < 0.001). The other hotspots are not clear |
| V4 zones | The zone tests above | Descriptive: 18 zone tests (three zones × six measures), no correction; see the multiple-tests note above |

How to read them. V1 says the procedure does not report trends in shuffled data (noise). V2 says it finds a typical simulated trend only in
about half to nine tenths of the cells, so a cell that is not clear is not proof that nothing changed. V3 says that La Pampa
agrees with the expected direction. The 14 hotspots are not clear after the 2011 correction: they were picked for single loss peaks, not steady trends. The 1° cell averages a much larger area, so a documented change looks
smaller than at 0.05°. Neither V3 nor V4 is a causal test.

Not done yet: the comparison with NASA Giovanni (P-007, C3). The confidence intervals are published and cross-checked against SciPy (P-029, done 15 Nov).

## Reproduce and verify

`python -m pipeline.verify` compares every JSON and PNG file in `web/server/data/` and `web/public/data/` (150 files)
with the version committed in git HEAD. It reads HEAD with `git archive`, so the working tree is not touched.

| Option | What it does |
|---|---|
| `--ref <path>` | compares with another copy of the repository instead of HEAD |
| `--report file.json` | saves the result of every file |
| `--rtol <value>` | relative tolerance for numbers (default 0.001 = 0.1 %) |

Run timestamps (`generatedUtc`, `generated_utc`, `generatedAt`) are ignored.

Each file gets one of four results:

- **IDENTICAL:** the same content.
- **ROUNDING:** only numbers differ, within the tolerance. Expected between Windows and Linux.
- **TEXT:** numbers and yes/no values match; only texts differ.
- **DIFFERENT:** a number beyond the tolerance, a yes/no value that flips (for example a cell that becomes significant), a missing value, a list of another length, or a missing file.

The command exits with code 1 if any file is DIFFERENT.

Tested on 15 Nov 2026: an unchanged tree gives 150 IDENTICAL. A copy with planted changes is caught: a flipped significance,
a changed slope, an edited text, one changed PNG pixel and a missing file.

**Three levels of reproducibility:**

| Level | What you re-run | What you need | Time and size |
|---|---|---|---|
| 1. Trend test only | `python -m pipeline.trends`, then `python -m pipeline.verify` | the repository | minutes; no download |
| 2. Exports from the intermediate data | steps `export_json` → `export_maps` → `export_api` → `export_cover` → `validate` → `trends` → `export_borders`, then `verify` | `data/interim/` from a previous run | `data/interim/` about 1.9 GB; 44 min 10 s on the team's PC (Windows, 15 Nov 2026, before the HDF5 fix; about 10 min after it; per step below) |
| 3. Full run from NASA | the whole pipeline (`python -m pipeline.run_all`), then `verify` | an Earthdata Login | About 80 GB transferred; about 1.9 GB kept in `data/interim/`. The four sources added on 15 Nov took about 1 h 10 min in parallel on the team's PC |

**Level 1 result (15 Nov 2026, Windows).** `python -m pipeline.trends` re-run from the committed files gave the same
results: all 11,738 numbers of the changed files and every significance flag were identical. Only the expected texts
changed: 147 files IDENTICAL and 3 TEXT. No download was needed.

**Level 2 result (15 Nov 2026, Windows).** `python -m pipeline.run_all --only exports`, run from the existing `data/interim/`,
took 44 min 10 s: export_json 13:42, export_maps 2:23, export_api 14:51, export_cover 2:27, validate 3:23, test_trends 0:06,
trends 7:06, export_borders 0:03, verify 0:10 (minutes:seconds). Of the 150 files, 147 are IDENTICAL, 3 are TEXT (the P-035
wording) and 0 are DIFFERENT: the exports reproduce the published results (level 2).

**HDF5 fix (`pipeline/__init__.py`, 15 Nov 2026).** On Windows, the exports took 44 min. The file sets
`HDF5_PLUGIN_PRELOAD="::"`, so HDF5 stops searching for compression plugins each time it opens a variable. With the fix the
exports took 10 min, and all 150 output files were identical.

These results are from before the Hansen loss change and the confidence intervals of 15 Nov (ADR-009). Only the `trends` step (and validate's change check) changed after it, with the same inputs.

**Expected differences (not errors):**

- If NASA published a month after 15 Nov 2026 inside the requested date range (for example burned area for 2026-10),
  the monthly lists get one more item. The monthly files are then DIFFERENT by list length.
- Trend results use complete years only, so their numbers should still match.
- Platform rounding shows as ROUNDING.

## Known limits (review of 15 Nov 2026)

Found while reviewing the outputs. Each item limits what the data can say. The team decides how to show them.

- **MOD44B 2025 is anomalous.** The Amazon mean falls from 62.2 % to 59.2 % in one year, while Hansen falls by 0.4
  points in the same year. In 127 cells with almost no Hansen loss, MOD44B falls by 3.94 points, 2.5 standard deviations
  below its 2001–2024 yearly changes. The flag is in `cover.json`. MODIS 2025 is left out of the change check and is
  not shown in the interface.
- **MOD44B cannot give the amount of loss.** From 2001 to 2024 the Amazon mean falls 0.9 points in MOD44B and 7.9 points
  in Hansen. Its year-to-year noise is 1–2 points. MOD44B confirms *where* loss happened, not *how much*.
- **Hansen loss is stand-replacing loss,** not only deforestation: fire, logging, mining and clearing all count. For
  Brazil, the Hansen/PRODES ratio is 1.15 in 2001–2010 and 2.70 in 2011–2025 (Brazilian Amazon zone; see *Trend test*,
  *Hansen loss: one trend from 2011*). From 2011 Hansen also counts fire-killed and degraded canopy, so do not quote its loss as
  deforestation.
- **Loss years before and after 2011 are not comparable.** Hansen reprocessed its loss from 2011 onward and not for
  2001–2010; its user notes say "users will notice inconsistencies as a result"
  (<https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>). Only 2011–2025 is
  tested (ADR-009).
- **Fire co-location is partly circular.** Canopy killed by fire counts as loss, so part of the overlap is built in.
  Co-location is not causation.
- **Hansen-derived cover has no regrowth.** It can only fall, so it understates recovery.
- **Partial half-years are not comparable.** A half-year with missing months, such as 2026-H2 at the end of the run, is
  marked incomplete by the backend and must not be compared with a full one.
- **Agreement and change r values are descriptive.** They carry no p-value, and neighbouring cells are not independent
  (spatial autocorrelation), so they cannot be read as tests.
- **The trend results are first-run numbers (Hansen loss: the one trend from 2011, of 15 Nov).** They come from the run of 15 Nov 2026 (trend checks written 2026-11-16 00:07 UTC, which is 15 Nov 19:07 in Lima).
  `trends.py` was changed afterwards (rounding of tied values), so a re-run can change the numbers slightly. The
  `trendChecks` in `validation.json` are the source.
- **Hansen loss rises as a level shift, not a steady climb.** From 2016 on the level is higher: about 17,900 km² per year in
  2011–2015 against 34,000 in 2016–2025. Inside 2016–2025 there is no trend (p 0.86). There is no jump at the Landsat 8
  (2013) or Landsat 9 (2022) dates, and PRODES rises in the same years. Starting the test in 2013 would not be robust. 2011
  stays because it is the documented reprocessing year, not a year chosen after seeing the data.
- **Cells are not independent.** Neighbouring cells share weather years (mean pairwise correlation of the LST residuals
  +0.42), so the 566 cells behave like about 5 independent patterns for LST and NDVI. A spatially coherent shuffle (the same
  permutation for all cells, 10,000 runs) rarely reaches the real counts (field p ≤ 0.0006): the counts are not chance,
  but the headline is the zone result with its interval, and the counts show where.
- **Missing checks.** The 95 % confidence intervals of the slopes are published and cross-checked against SciPy, but they
  are not corrected for the many cells: 496 cells that are not clear after the correction have an interval that excludes 0.
  The comparison with NASA Giovanni (P-007, C3) is not done (`.ai-context/05-tech-debt.md`).
- **Zone tests are not corrected** for multiple tests: 18 are shown (three zones × six measures; Brazil and Peru are parts
  of the whole Amazon). The cell counts are corrected. Applying the correction to the zones is a team decision for after the deadline.
