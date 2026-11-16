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
| 2026-11-15 | **Hansen loss:** tested as one trend, 2011–2025, never across 2011 (ADR-009); one tree cover (Hansen) in the interface; MODIS 2025 left out of the cross-check change (ADR-009) | Team (Alexis, 2026-11-15); José and Kiara to confirm (05, P-028) |
| 2026-11-15 (evening) | **One answer per measure (amends ADR-009):** one Hansen loss trend, 2011–2025, with all years 2001–2025 shown (2001–2010 greyed, not used); a 95 % confidence interval for every slope (P-029); daytime LST published to 2026-10, its trend still to 2020 (B1); a "?" mark where a known limit affects a value | Team (Alexis, 2026-11-15); José to review the interface rules |

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
  values 0 and 1 only), daytime LST (MOD11C3), rainfall (GPM IMERG), burned area (MCD64A1), and the cover measures
  (Hansen tree cover loss in km², 2011–2025 for the trend; MODIS tree cover MOD44B, computed but not shown).
- One value per calendar year: the mean of its 12 months (NDVI, EVI, LST) or the total (rainfall, burned area). A year
  counts only when all 12 months have a value.
- Seasonality is not modelled. For display, each zone and year shows the lowest and highest month and the month where
  they occur.
- Hansen tree cover is not tested: it cannot rise by construction.

**Periods (per variable).**

| Variable | Years tested | Reason |
|---|---|---|
| NDVI, EVI | 2001–2020 | Satellite drift (rule D1: r = 0.85 between the Terra overpass time and the anomaly) |
| Daytime LST | 2001–2020 | Terra orbit drift (team rule B1); published to 2026-10, 2021 onward shown with "?" and not tested |
| Rainfall | 2001–2024 | 2025 ends in September |
| Burned area | 2001–2025 | Complete years |
| Hansen tree cover loss (km²) | 2011–2025 | Hansen changed its method in 2011; 2001–2010 is shown, not tested (ADR-009) |
| MODIS tree cover (computed, not shown) | 2000–2024 | 2025 excluded (rule D2) |

**Test and slope.**

- Mann-Kendall test (`pymannkendall.original_test`) on the yearly values, per cell and per zone.
- Trend size: Sen's slope (the median of all pairwise slopes, computed with the real year gaps) × 10, per decade, in the
  variable's yearly units.
- Confidence interval of the slope (`slopeCi95`, 95 %, Gilbert 1987): the variance comes from the same Mann–Kendall
  test (the Hamed–Rao variance when that test is used), and the pairwise slopes honour the real year gaps. Published for
  cells, zones, known places and zone checks.
- Autocorrelation (pre-registered): a cell has residual autocorrelation when the lag-1 autocorrelation of its residuals
  around the Sen line exceeds 1.96/√n in absolute value. If more than 20 % of the tested cells of a variable have it,
  that variable uses the Hamed–Rao modified test. Otherwise the original test is kept. The shares are published per
  variable (`method` and `trendChecks`). Largest share: 17 % (NDVI). The Hamed–Rao variant was also run for every
  variable as a check: no direction or zone verdict changes, and it flags more cells than the original test in every
  variable except NDVI, so the original test stays.
- A missing year does not bias Mann–Kendall (it uses only the order of the yearly values, one value less). Sen's slope
  uses the real years. Seven burned-area cells lack 2001 or 2002.

**Multiple testing and significance.**

- Benjamini–Hochberg false discovery rate (`statsmodels`, `fdr_bh`) over all tested cells of one variable. The Hansen loss trend is its own family. The two cover
  measures are corrected separately.
- Significance level α = 0.05. A cell is significant when its adjusted q-value is below α.
- The published `pValue` is the raw p-value. `significant` is decided after the correction.
- Zone results are not corrected for multiple tests: 18 are shown (3 zones × 6 measures; Brazil and Peru are parts of the
  whole Amazon). With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in
  Brazil (q 0.059) and in Peru (q 0.086) would not. Both are borderline and not robust to leaving one year out. Whole-Amazon
  loss stays clear (q 0.017). Applying the correction to the zones is a team decision for after the deadline.

**Minimum data.** A cell is tested only when at least 80 % of its variable's years are complete (for 20 years, 16). A
cell below that has `slopePerDecade` and `pValue` null, `significant` false, and `validMonths` still reported.

**Pre-registered data rules.** Written down in the specification before the first run (ADR-006):

- D1 (satellite drift): if |r| ≥ 0.5 between the yearly Terra overpass time and the NDVI/EVI anomaly (2015–2025, zone
  level), that variable's test ends in 2020. Measured: r = 0.85 for both, so NDVI and EVI end in 2020. The r rests on the five years 2021–2025, which include the 2023–2024 drought: a coincidence in time, not proof of cause. Stopping the tests in 2020 stays the safe choice.
- D2: MODIS tree cover 2025 is excluded (suspect).
- D3: the NDVI/EVI reliability rule (values 0 and 1) is kept as exported.
- D4: night LST is not in the web API (`web/server/data`). It is in `amazon_monthly.json` up to 2020-12.

**Validation (V1–V4, own code; written to `validation.json`, `trendChecks`).**

- V1, false positives: the years of every cell are shuffled (fixed seed, 20 repetitions) and the whole procedure runs
  again. The expected share of significant cells is near zero.
- V2, detection power: a linear trend of the median size of the significant cells is added to the shuffled series. The
  share of cells where the procedure finds it is reported.
- V3, known places: the cross-check hotspots and the La Pampa cell (r08c09). The loss trend and the MODIS cover trend
  are reported with their direction, p-value and significance. Expected: loss up, cover down. Reported as they come out. The loss trend is 2011–2025; after the correction none of the 14 hotspots is clear, and La Pampa is.
- V4, zones: the zone-level tests, with no correction.
- Confidence intervals (P-029): published for every slope and cross-checked against SciPy (`theilslopes`). The slopes
  are identical; the bounds differ by a median of 0.3 % of the interval width in the 21 zone tests (largest 2.3 %). The
  interval excludes 0 in exactly the 12 clear zone tests (21 computed; 18 shown). For cells, the intervals are not
  corrected: 496 cells that are not clear after the correction have an interval that excludes 0.
- Not yet done: the comparison with NASA Giovanni (P-007, C3).

**Known limits (review of 15 Nov).**

- Hansen loss rises as a level shift, not a steady climb: about 17,900 km² per year in 2011–2015 against 34,000 in
  2016–2025. Inside 2016–2025 there is no trend (p 0.86). There is no jump at Landsat 8 (2013) or Landsat 9 (2022), and
  PRODES rises in the same years. Starting the test in 2013 would not be robust. 2011 stays because it is the documented
  reprocessing year, not a year chosen after seeing the data.
- Cells are not independent. Neighbours share weather years (mean pairwise r of the LST residuals +0.42), so the 566
  cells behave like about 5 independent patterns for LST and NDVI. A spatially coherent shuffle (the same permutation for
  all cells, 10,000 runs) rarely reaches the real counts (field p ≤ 0.0006). The counts are not chance, but the headline
  is the zone result with its interval; the counts show where.

**Invariants the code must keep.**

- Only complete years enter a test. A cell below the 80 % rule has null slope and p-value and `significant` false.
- Hansen tree cover is never tested.
- Hansen loss is tested only from 2011 (2011–2025). The years 2001–2010 are shown, not tested, and no test crosses 2011 (ADR-009).
- Significance is decided in the pipeline (`pipeline/trends.py`). The browser shows the verdict and never tests, fits or
  averages. The only arithmetic in the browser is the difference of two backend values (B minus A).
- `trends` is the last step that writes trend results. Re-running `export_api`, `export_cover` or `validate` removes them.
- Slopes are per decade, in the variable's yearly units. Differences in the interface are absolute, never percentages.
- Satellite drift years (NDVI, EVI and daytime LST from 2021) are shown greyed and not used. A change that involves them gets a "?" mark.
- No page states a cause. A trend is a pattern in the measurements.
