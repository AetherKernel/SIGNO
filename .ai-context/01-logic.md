# 1. Logic

## Goal

Challenge *Be An Earth System Trend Detective!* (NASA Space Apps 2026): find long-term trends in Earth system
variables from NASA data, and separate real change from noise. One-off events are out of scope.

## Team decisions

| Date | Decision | Decided by |
|---|---|---|
| 2026-11-14 | **Problem:** where the Amazon forest is losing greenness and warming in a sustained way, and whether that change is statistically significant or just noise | Team (José, Alexis, Kiara) |
| 2026-11-14 | **Region:** the Amazon as one natural region, defined by geography and not by countries or administrative regions | Team |
| 2026-11-15 | **Trend test:** Mann-Kendall on yearly values, Sen's slope, Benjamini-Hochberg FDR per variable, α = 0.05, and the validation plan V1–V4 (ADR-006). Parameters from the team kit were delegated to Claude | Team (Alexis, 2026-11-15); José and Kiara to confirm (05, P-028) |

**Context.** The Amazon spans nine countries and faces deforestation, degradation, fires and recent extreme
droughts. Treating it as one region shows the change wherever it happens, across borders.

**Limits to state openly.** A downward trend in greenness shows *where to look*. It does not prove deforestation,
and it does not establish a cause.

**Candidate variables** (to be confirmed by the data exploration):

- Vegetation greenness: NDVI and EVI (`MOD13C2`).
- Land surface temperature (`MOD11C3`).
- Evapotranspiration and soil moisture (GLDAS).
- Precipitation (GPM IMERG).

## Method

Decided on 2026-11-15 (ADR-006). The team chose the test family, the variables, the periods, the pre-registered rules
and the validation plan (`docs/plan-tests-tendencia.md`, section 2). The parameters the team left open come from the
team kit and were delegated to Claude. The method is a pattern test on measurements. It does not establish a cause.

**Preprocessing.**

- Monthly values per 1° cell come from the API series (`web/server/data/series/`): NDVI and EVI (MOD13C2, reliability
  values 0 and 1 only), daytime LST (MOD11C3), rainfall (GPM IMERG), burned area (MCD64A1), and the two cover measures
  (Hansen tree cover loss in km², MODIS tree cover MOD44B).
- One value per calendar year: the mean of its 12 months (NDVI, EVI, LST) or the total (rainfall, burned area). A year
  counts only when all 12 months have a value.
- Seasonality is not modelled. For display, each zone and year shows the lowest and highest month and the month where
  they occur.
- Hansen tree cover is not tested: it cannot rise by construction.

**Periods (per variable).**

| Variable | Years tested | Reason |
|---|---|---|
| NDVI, EVI | 2001–2020 | Satellite drift (rule D1: r = 0.85 between the Terra overpass time and the anomaly) |
| Daytime LST | 2001–2020 | Terra orbit drift (team rule B1) |
| Rainfall | 2001–2024 | 2025 ends in September |
| Burned area | 2001–2025 | Complete years |
| Hansen tree cover loss (km²) | 2001–2025 | Complete years |
| MODIS tree cover | 2000–2024 | 2025 flagged suspect (rule D2) |

**Test and slope.**

- Mann-Kendall test (`pymannkendall.original_test`) on the yearly values, per cell and per zone.
- Trend size: Sen's slope (the median of all pairwise slopes, computed with the real year gaps) × 10, per decade, in the
  variable's yearly units.
- Autocorrelation (pre-registered): a cell has residual autocorrelation when the lag-1 autocorrelation of its residuals
  around the Sen line exceeds 1.96/√n in absolute value. If more than 20 % of the tested cells of a variable have it,
  that variable uses the Hamed–Rao modified test. Otherwise the original test is kept. The shares are published per
  variable (`method` and `trendChecks`).

**Multiple testing and significance.**

- Benjamini–Hochberg false discovery rate (`statsmodels`, `fdr_bh`) over all tested cells of one variable. The two cover
  measures are corrected separately.
- Significance level α = 0.05. A cell is significant when its adjusted q-value is below α.
- The published `pValue` is the raw p-value. `significant` is decided after the correction.
- Zone-level tests (whole Amazon, Brazil, Peru) are not corrected for multiple tests, because there are three zones.

**Minimum data.** A cell is tested only when at least 80 % of its variable's years are complete (for 20 years, 16). A
cell below that has `slopePerDecade` and `pValue` null, `significant` false, and `validMonths` still reported.

**Pre-registered data rules.** Written down in the specification before the first run (ADR-006):

- D1 (satellite drift): if |r| ≥ 0.5 between the yearly Terra overpass time and the NDVI/EVI anomaly (2015–2025, zone
  level), that variable's test ends in 2020. Measured: r = 0.85 for both, so NDVI and EVI end in 2020.
- D2: MODIS tree cover 2025 is excluded (suspect).
- D3: the NDVI/EVI reliability rule (values 0 and 1) is kept as exported.
- D4: night LST is not exported.

**Validation (V1–V4, own code; written to `validation.json`, `trendChecks`).**

- V1, false positives: the years of every cell are shuffled (fixed seed, 20 repetitions) and the whole procedure runs
  again. The expected share of significant cells is near zero.
- V2, detection power: a linear trend of the median size of the significant cells is added to the shuffled series. The
  share of cells where the procedure finds it is reported.
- V3, known places: the cross-check hotspots and the La Pampa cell (r08c09). The loss trend and the MODIS cover trend
  are reported with their direction, p-value and significance. Expected: loss up, cover down. Reported as they come out.
- V4, zones: the zone-level tests, with no correction.
- Not yet done: the comparison with NASA Giovanni (P-007, C3).

**Invariants the code must keep.**

- Only complete years enter a test. A cell below the 80 % rule has null slope and p-value and `significant` false.
- Hansen tree cover is never tested.
- Significance is decided in the pipeline (`pipeline/trends.py`). The browser shows the verdict and never tests, fits or
  averages. The only arithmetic in the browser is the difference of two backend values (B minus A).
- `trends` is the last step that writes trend results. Re-running `export_api`, `export_cover` or `validate` removes them.
- Slopes are per decade, in the variable's yearly units. Differences in the interface are absolute, never percentages.
- Satellite drift years (NDVI and EVI after 2020, LST after 2020) are shown greyed, not used.
- No page states a cause. A trend is a pattern in the measurements.
