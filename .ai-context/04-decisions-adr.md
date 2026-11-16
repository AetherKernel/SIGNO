# 4. Decisions (ADRs)

## ADR-001: Repository separated from Google Drive

- **Date:** 2026-11-14
- **Status:** Accepted

**Context.** Workspace projects usually live in `J:\Mi unidad\03 Proyectos IA`, which Google Drive syncs. For SIGNO
the owner wants to understand every step that is applied, and Drive syncing a `.git` folder can corrupt the
repository (file locks, conflict copies). The team already created `github.com/AetherKernel/SIGNO`.

**Decision.** The repository is cloned at `C:\Users\DiNiCHi\dev\SIGNO`, outside Drive, and holds the code and
`.ai-context/`. The Drive folder `03 Proyectos IA/SIGNO` keeps only team documents. The repo is registered in the
workspace `projects.toml` as `SIGNO-repo` (a different key from the Drive folder name, so both can coexist in
`--all`), which gives it the same context-sync checks.

**Consequences.** Code changes are shared through GitHub, not Drive. The design-system core stays in the Drive
folder, because the design-system check only runs for folders inside the workspace. The sync is run with the
workspace script's absolute path (see CLAUDE.md).

## ADR-002: Vercel as the publishing platform

- **Date:** 2026-11-14
- **Status:** Accepted (team decision, José)

**Context.** The submission needs a public link that opens without login. The team needs a place to publish the
SIGNO web tool directly from the GitHub repository during a 48-hour hackathon.

**Decision.** SIGNO's public web tool is published on Vercel, connected to `github.com/AetherKernel/SIGNO`.

**Consequences.**

- Every push to `main` triggers a production deploy, and pull requests get preview URLs.
- Vercel serves static sites and front-end frameworks, and runs short serverless functions (Python included). It
  does not host long-running servers: Streamlit apps and long data downloads or processing do not run there. Heavy
  NASA data work has to happen outside Vercel, and the web tool consumes its results. How exactly is part of the
  architecture the team still has to decide (05, P-002).
- Vercel's Deployment Protection can put a login in front of deployments. The production URL used in the submission
  must be checked from a private browser window (05, P-006).
- No Earthdata credentials go to the front end. If a function ever needs them, they live in Vercel environment
  variables, never in the repo.

## ADR-003: Web prototype with React + Vite + TypeScript in `web/`

- **Date:** 2026-11-14
- **Status:** Accepted (José)

**Context.** SIGNO needs a public web prototype on Vercel (ADR-002), built in hours. José already builds React +
TypeScript front ends with Vite (Mi-puestito), so the team spends no time learning a new stack.

**Decision.** The web app lives in `web/`, scaffolded with the official `create-vite` template `react-ts` (React 19,
Vite 8, TypeScript, oxlint). It is a static single-page app: `npm run build` produces `web/dist/`, which Vercel serves.

**Consequences.**

- In Vercel the project's **Root Directory is `web`**; the Vite framework preset sets build and output.
- The app only reads files it ships with, so any analysis results it shows must be exported as static files into
  the app (consistent with option 1 in tab 02, still to be confirmed by the team).
- `web/node_modules/` and `web/dist/` are git-ignored by the template's own `.gitignore`.

## ADR-004: Layered app with a static API v1 and a swappable data source

- **Date:** 2026-11-14
- **Status:** Accepted (José)

**Context.** José asked to turn the placeholder into the production architecture with a strict frontend/backend
separation, clear contracts, and a data layer that Alexis's pipeline can replace without touching the interface.
Vercel runs no long processes and the link must never sleep (ADR-002). The pipeline and method are not ready yet.

**Decision.**

- Three layers in `web/`, enforced by `scripts/checkLayers.ts`:
  - `shared/`: the contract and route map;
  - `server/`: the backend;
  - `src/`: the frontend.
- The backend reads data only through a `DataSource` port. There are two adapters:
  - `mock`: synthetic data, the default;
  - `files`: the pipeline's JSON export.

  `SIGNO_DATA_SOURCE` selects which one is used.
- The backend validates the data against the contract, computes the business aggregates and publishes a
  versioned, read-only **static API v1** (`/api/v1/...json`) at build time. The frontend reaches it only over HTTP,
  through `src/services`.
- The backend is TypeScript run directly by Node (type stripping, Node 22.18 or later). It needs no compile step
  and no extra dependencies.

**Consequences.**

- Option 1 of tab 02 is adopted. The site never sleeps, has no cold starts and holds no credentials.
- New data requires a rebuild: a push, or a redeploy in Vercel.
- Switching to real data means three steps:
  1. export the files;
  2. set `SIGNO_DATA_SOURCE=files`;
  3. rebuild.

  The frontend does not change. Contract errors stop the build.
- A runtime API can be added later behind the same paths. `VITE_API_BASE_URL` already lets the frontend point
  elsewhere.
- Vercel must use Node 22.x (`package.json` engines) so the build can run the TypeScript backend.
- The production build runs the contract validation, the layer check and the unit tests. If any of them fails,
  the deploy fails and the previous version stays live.

## ADR-005: Leaflet map with NASA GIBS imagery, cropped to the study region

- **Date:** 2026-11-15
- **Status:** Accepted (José)

**Context.** José chose NASA Worldview as the reference for the map, with scroll zoom and SIGNO's own interface on
top. Worldview's embed mode cannot be customised and is disabled for non-NASA sites unless Earthdata enables it.
Worldview draws its imagery from NASA GIBS, which serves WMTS tiles without credentials. This was checked on
2026-11-14 against GetCapabilities. José also asked that the map show only the Amazon.

**Decision.**

- The map uses **Leaflet 1.9** (`leaflet`, plus `@types/leaflet` for development). José approved it as the only new
  dependency. Leaflet was chosen over OpenLayers and MapLibre GL because it is light and simple.
- Base maps are GIBS layers, configured in `web/src/lib/basemaps.ts`:
  - Blue Marble Next Generation (default);
  - MODIS Terra true colour, two days ago;
  - MODIS Terra NDVI, monthly;
  - none.

  Each layer's deepest level is the map's zoom limit, and the UI says so.
- The trend grid is an SVG overlay rendered by React in Web Mercator units, so it lines up with the imagery.
- **Crop to the region.**
  - Outside the region box the imagery stays visible under a translucent veil in the page colour, so the continent
    gives context without blank space; the region edge is drawn. A solid cover was tried first and José preferred
    the veil (2026-11-15).
  - The map cannot be panned or zoomed out beyond the region.
  - The box is the API's `region.bbox` until the team picks the boundary (P-008).

**Consequences.**

- About 140 kB more JavaScript (Leaflet). The page loads images from `gibs.earthdata.nasa.gov`; if GIBS fails, the
  trend cells still work and the map says so.
- Imagery is context only: the analysed data still comes from the API. GIBS is credited on the map and in the
  README.
- The GIBS borders and labels overlay was tried and dropped: `Reference_Labels_15m` answered HTTP 500 for several
  tiles, and the failed tiles painted the map black (05, P-016).
- When P-008 is decided, the crop must follow the real boundary. That needs the geometry in the contract (05, P-014).

## ADR-006: Trend test: Mann-Kendall on yearly values

- **Date:** 2026-11-15
- **Status:** Accepted (team decision, Alexis, 2026-11-15). Confirmed by José and Kiara on 2026-11-15, including the parameters delegated to Claude (05, P-028)

**Context.** The trend test is the core of SIGNO: it decides which change is real and which is noise (01). Under the
Space Apps AI rule the team chooses the method, and the AI assistant only implements what the team decided. The team
answered the questions of `docs/plan-tests-tendencia.md` (section 2) on 2026-11-15. Where an answer left a parameter
open, the value comes from the team kit (*Tools* and *Technical Points Judges Will Check*) and was delegated to Claude.

**Decision.**

| Parameter | Value | Source |
|---|---|---|
| Variables | All that add information: NDVI, EVI, daytime LST, rainfall, burned area, Hansen tree cover loss (km²), MODIS tree cover (MOD44B) | Team (A1) |
| Time step | Yearly | Team (A4) |
| Yearly value | Mean of the 12 months (NDVI, EVI, LST) or total (rainfall, burned area). A year counts only when all 12 months have a value | Team (B2 and the kit) |
| Seasonality | Not modelled. Per zone and year, the lowest and highest month are published as information | Team (B2) |
| Test | Mann-Kendall, `pymannkendall.original_test`, per 1° cell and per zone | Team (B1) |
| Trend size | Sen's slope × 10, per decade, in the variable's yearly units | Team kit (delegated) |
| Uncertainty | 95 % confidence interval of the slope (Gilbert 1987); variance from the same Mann-Kendall test (Hamed–Rao variance when used); pairwise slopes use the real year gaps. Published 15 Nov (evening) | Team kit (delegated; P-029) |
| Autocorrelation | Original test, unless more than 20 % of a variable's tested cells have lag-1 residual autocorrelation (see pre-registered rules); then Hamed–Rao | Team (B3); rule written in the specification |
| Multiple testing | Benjamini–Hochberg false discovery rate (`statsmodels`, `fdr_bh`) over all tested cells of one variable. The two cover measures are corrected separately | Team kit (delegated) |
| Significance level | α = 0.05. A cell is significant when its adjusted q is below α; the published `pValue` is the raw p | Team kit (delegated) |
| Minimum data | At least 80 % of the variable's years complete; otherwise `pValue` and slope are null and `significant` is false | Team kit (delegated) |
| Grid | 1° cells (566 in the Amazon) | Implementation; answer A3 is not recorded (see docs/plan-tests-tendencia.md) |

Periods:

- NDVI and EVI: 2001–2020 (rule D1, below).
- Daytime LST: 2001–2020 (team rule B1, Terra orbit drift). The LST is published to 2026-10; from 2021 the years are shown with a "?" mark and are not tested.
- Rainfall: 2001–2024 (2025 ends in September).
- Burned area: 2001–2025.
- Hansen tree cover loss (km²): 2001–2025 in the first run. From 15 Nov 2026 the loss is tested as one trend, 2011–2025 (ADR-009; all years 2001–2025 are shown).
- MODIS tree cover: 2000–2024 (2025 excluded, rule D2).

Hansen tree cover itself is **not tested**: it cannot rise by construction (regrowth is not counted), so a test on it would be biased.

**Pre-registered rules.** Written down in the team's specification before the first run. File times on 15 Nov 2026
(local): specification 04:40, configuration 04:42, first run 05:36:

- **Autocorrelation.** Lag-1 autocorrelation of each cell's residuals around the Sen line; a cell has it when its absolute
  value exceeds 1.96/√n. If more than 20 % of the tested cells of a variable have it, that variable uses the Hamed–Rao
  modified test. The Hamed–Rao variant was also run for every variable as a check: no direction or zone verdict changes,
  and it flags more cells than the original test in every variable except NDVI, so the original test is kept (largest
  share 17 %, NDVI).
- **D1, satellite drift.** Pearson r between the yearly Terra overpass time and the NDVI/EVI anomaly, 2015–2025, at zone
  level. If |r| ≥ 0.5, that variable's test ends in 2020. Measured: r = 0.85 for NDVI and for EVI (n = 11), so both end in 2020. The r rests on the five years 2021–2025, which include the 2023–2024 drought: a coincidence in time, not proof of cause. Stopping the tests in 2020 is the safe choice.
- **D2.** MODIS tree cover 2025 is excluded (flagged suspect).
- **D3.** The NDVI/EVI reliability values 0 and 1 are kept as exported.
- **D4.** Night LST is not in the web API (`web/server/data`); it is in `amazon_monthly.json` up to 2020-12. No action.

**Zone level.** Mann-Kendall and Sen on the yearly series of the whole Amazon, Brazil and Peru, with no multiple-testing
correction. Zone results are not corrected for multiple tests: 18 are shown (3 zones × 6 measures; Brazil and Peru are parts
of the whole Amazon). With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in
Brazil (q 0.059) and in Peru (q 0.086) would not. Both are borderline and not robust to leaving one year out. Whole-Amazon
loss stays clear (q 0.017). Applying the correction to the zones is a team decision for after the deadline. The UI and the README say so.

**Validation (own code, team answer C).** Results go to `web/server/data/validation.json` under `trendChecks`.

- V1, false positives: the years of every cell are shuffled (fixed seed, 20 repetitions), and the whole procedure runs again.
- V2, detection: a linear trend of the median size of the significant cells is added to the shuffled series.
- V3, known places: the cross-check hotspots and the La Pampa cell r08c09 (loss expected to rise, MODIS cover to fall).
- V4, zones: the zone tests, with no correction.

The comparison with NASA Giovanni (P-007, C3) is not part of V1–V4 (05, P-007).

**Display.** The map keeps the slope colours (PuOr) and marks non-significant cells with dots (team answer E1).

**Implementation.** `pipeline/trends.py` (step 8), `pipeline/test_trends.py` (13 tests on synthetic series, including the Sen slope against `scipy.stats.theilslopes`), settings
`TREND_*` in `pipeline/config.py`. Outputs: `web/server/data/trends/`, `cover.json` (`trends`), `zones.json` and
`validation.json` (`trendChecks`). API fields: 03 and 06.

**Consequences.**

- The app shows trend results: the Trend type of the map, the Trends view and the area viewer. The browser shows the
  pipeline's verdicts and never tests, fits or averages.
- A trend is a pattern in the measurements. No page names a cause. Loss includes fire, logging, mining and clearing.
- A result that is not significant is not proof of no change: V2 finds a simulated trend in 53–92 % of the cells on
  average, depending on the variable.
- Known limits of the method: neighbouring cells are not independent (they share weather years: mean pairwise r of the LST
  residuals +0.42, so the 566 cells behave like about 5 independent patterns for LST and NDVI). A spatially coherent
  shuffle (same permutation for all cells, 10,000 runs) rarely reaches the real counts (field p ≤ 0.0006): the counts are
  not chance, but the headline is the zone result with its interval. The 95 % confidence intervals of the slopes are
  published and cross-checked against SciPy, but they are not corrected for the many cells: 496 cells that are not clear
  after the correction have an interval that excludes 0 (see 05, P-029). Hansen loss rises as a level shift from 2016, not a
  steady climb (about 17,900 km² per year in 2011–2015, 34,000 in 2016–2025; no trend inside 2016–2025, p 0.86; no jump at
  Landsat 8 or 9; PRODES rises in the same years). Starting in 2013 would not be robust; 2011 stays as the documented
  reprocessing year, not chosen after seeing the data.
- `trends` runs last. Re-running `export_api`, `export_cover` or `validate` removes its results (`pipeline/README.md`).
- The notebook route of ADR-008 was withdrawn on 15 Nov 2026 (night). The supported way to run this step is `python -m pipeline.trends`, then `python -m pipeline.verify`.
- The first run's numbers are in `pipeline/README.md` (*Trend test*). The numbers can change on a re-run, so the validation file is the source.

**AI rule.** The team chose the test family, the variables, the periods, the pre-registered rules and the validation plan.
The AI did not choose the method. The parameters the team left open are the team kit's values, listed above as
delegated. Claude wrote `pipeline/trends.py`, `pipeline/test_trends.py` and `pipeline/export_borders.py` (each with a
header comment) and Claude Opus 5.5 reviewed them. The README (*Use of AI*) declares this.

## ADR-007: Interface in English by default, Spanish on request; Tabler Icons

- **Date:** 2026-11-15
- **Status:** Accepted (José)

**Context.** José wants a Spanish version of the interface. The Space Apps submission must be in English, and the
judges must see English by default. Before choosing, Claude listed the risks of choosing the language by location.

- **Location is not language.** Someone in Lima may prefer English, and the Amazon includes Brazil, where people speak
  Portuguese.
- **Permissions and privacy.** Geolocation needs a permission prompt. Detecting by IP sends the visitor's IP to a third
  party, which may be slow or down during the pitch.
- **Default language.** A judge with a Spanish browser would land in Spanish.
- **Work and deadline.** The API texts are English, and two languages double the browser checks before the deadline.

José also chose Tabler Icons as the icon set (brand card 06).

**Decision.**

- **Default and switch.** English by default. Spanish only when the user picks it in the top bar (EN / ES), and the
  choice lives in the URL (`?lang=es`).
- **No detection for now.** No detection by browser, IP or location. Region detection with a confirmation pop-up and a
  footer selector are kept as future work (05).
- **Translation code.** Translation is a small in-house dictionary in `web/src/lib/i18n.ts`, with no i18n library:
  - a React context;
  - `t(english, spanish)` at each sentence;
  - a `t` parameter, English by default, in the lib functions that build sentences.
- **Numbers.** They keep the decimal point in both languages.
- **API texts.** Texts that come from the API are shown as published (English).
- **Icons.** `@tabler/icons-react` 3.50.0 (MIT) is the icon set. It is a new dependency, approved by José.

**Consequences.**

- **Missing translations show in English.** A sentence added without its Spanish version still shows in English, never
  broken. Reviewers check `t(` pairs.
- **API texts stay in English.** Variable names, method descriptions and data notes appear in English in the Spanish
  interface until the pipeline publishes Spanish fields (05).
- **Icons.** Icons are tree-shaken, so only the icons used add weight.

## ADR-008: Google Colab as the reproducible route for the data (without the web app)

- **Date:** 2026-11-15
- **Status:** Withdrawn (José, 2026-11-15, night). It had been accepted by Alexis earlier that day and proposed by José on 2026-11-14.

**Withdrawal (15 Nov, night).** The notebook route was not finished as a shared route and was not used for the published results. The team removed it from the READMEs, from the pipeline messages and from the Method view of the web app. The draft notebook was removed from the repository the same night (decided by José); it remains in the git history. The supported way to reproduce the results is the pipeline on a local machine (`python -m pipeline.run_all`, then `python -m pipeline.verify`; see `pipeline/README.md`). The text below is the decision as it was written. It is kept as a record and no longer describes a supported route.

**Context.** Some people want the explored data but not the web app. They need a route that runs on any machine, not only
on the team's Windows PC. The repository holds the generated files, but a reader cannot check them without running the
pipeline.

**Decision.**

- The notebook `notebooks/signo_pipeline_colab.ipynb`, section 4b, runs the whole pipeline with `python -m pipeline.run_all`
  (downloads, exports, trend test).
- The same run ends with `pipeline.verify` (section 15b). It compares every output file with the committed version.

**Consequences.**

- **Time.** On the free Colab tier the whole run took 1 h 22 min on 15 Nov 2026. The downloads took 1 h 14 min with four
  sources at a time (`notebooks/README.md`, *Times measured on 15 Nov 2026*).
- **Needs.** An Earthdata Login, and the RAISG zip `Biomas_2025.zip`, which is downloaded by hand and may not be
  redistributed.
- **Session.** The Colab disk is wiped when the session stops, so the tab must stay open.
- **Results reproduce exactly.** 147 files IDENTICAL, 3 with only reworded text (P-035), 0 DIFFERENT, of 150. Evidence in
  `pipeline/README.md`, *Reproduce and verify*. The 15 Nov Colab run reproduced the results published before the Hansen loss change of ADR-009. Only the `trends` step (and validate's change check) changed after it, with the same inputs, so a new Colab run reproduces the new results.
- **Files.** The notebook and the new files `run_all.py`, `verify.py` and `trends.py` were uploaded by hand for the 15 Nov
  run, because `main` did not have them yet. After the next push they come with the clone.

## ADR-009: Hansen loss tested as one trend from 2011 and one tree cover in the interface

- **Date:** 2026-11-15
- **Status:** Accepted (Alexis, 2026-11-15). Confirmed by José and Kiara on 2026-11-15, together with ADR-006 (05, P-028)

**Context.** Hansen's Global Forest Change v1.13 reprocessed its loss data from 2011 onward, not for 2001–2010. The user
notes say "users will notice inconsistencies as a result" and that "care must be taken when comparing change across any
interval" (<https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>). The first run tested
the loss over 2001–2025 as one series, and our documents said "about 2013", citing Global Forest Watch. The check against
the official INPE PRODES series (Brazilian Amazon) shows the break: Hansen and PRODES correlate at r = 0.85 for 2001–2010
and r = 0.20 for 2011–2025, and the Hansen/PRODES ratio goes from 1.15 to 2.70. One test over 2001–2025 gives a rising
Amazon trend (p = 0.047) while PRODES falls (p = 0.014), an artefact of the change. MODIS also differs from Hansen in
level and noise: in 2024 the area-weighted mean is 78.6 % for Hansen and 62.4 % for MODIS, MODIS moves about ±1.5 points
a year, and MODIS 2025 is anomalous.

**Decision.**

- Hansen yearly loss is tested in two separate segments, 2001–2010 and 2011–2025, never across 2011 (superseded on the evening of 15 Nov: one trend, 2011–2025; see the Amendment below). Each segment is its
  own Benjamini–Hochberg family, with the test of ADR-006. The yearly values of all 25 years stay published and visible.
- Only one tree cover is shown in the interface: Hansen. MODIS (MOD44B) leaves the map, the area viewer and the Trends
  view. It stays in the Cross-checks and the Method view as the independent satellite check of where loss happened.
- MODIS 2025 is left out of the cross-check "change against Hansen loss" (`pipeline/validate.py`). The MODIS change is now
  the mean of 2023 and 2024 minus the mean of 2001 and 2002, compared with Hansen loss 2001–2024.
- The Hansen–PRODES check is published as `trendChecks.hansenConsistency` in `validation.json`, with the quotes of
  Hansen's user notes.

**Results (15 Nov 2026).**

- Years 2001–2010 are not tested (10 years only); they are shown greyed.
- Cells 2011–2025: 566 tested, 45 rising, 2 falling (with 2001–2025 as one series: 318 rising, 20 falling).
- Zones 2001–2010 are not used (the years are shown only).
- Zones 2011–2025: Amazon rising (p 0.0075; +12,040 km² per year per decade; 95 % CI +5,145 to +19,582); Brazilian Amazon rising (p 0.029; +8,709 km² per year per decade); Peruvian Amazon rising (+456 km² per year per decade,
  p 0.048). PRODES rising (p 0.048).
- Known places: La Pampa (r08c09) is still clearly rising in 2011–2025 (+43.5 km² per year per decade, 95 % CI +27.8 to +53.3, p 0.00025, q 0.019; loss from 2012). None of the 14
  cross-check hotspots is clear after the correction (before: 5). The hotspots were chosen for their loss peaks (single
  events such as fire years), not for steady trends.
- MODIS check after the 2025 change: r = −0.73 (Amazon), −0.79 (Brazil), −0.58 (Peru) against Hansen loss (before:
  −0.72, −0.78, −0.60).

**Consequences.**

- The years 2001–2010 are not tested (10 years, low power), so they say nothing either way about change before 2011.
- The map, the area viewer and the Trends view show the loss trend of 2011–2025 (the years 2001–2010 are shown greyed, not used).
- A new run of the pipeline reproduces these results, because the inputs are the same.
- Confirmed by the whole team with ADR-006 on 2026-11-15 (P-028).

**Amendment (15 Nov, evening).** Alexis asked for one answer per measure. Hansen loss is therefore one trend, 2011–2025 (`HANSEN_LOSS_TREND_YEARS = (2011, 2025)`, `HANSEN_METHOD_CHANGE_YEAR = 2011`). All years 2001–2025 are published and shown. The years 2001–2010 are real Hansen data from the earlier method: they are greyed in the charts, with an info tooltip, and are not used in the trend. Every Hansen chart marks 2011 with a dashed line and a tooltip. This amendment supersedes the two-segment presentation above. The evidence stays in `trendChecks.hansenConsistency` (2001–2010: r 0.85, ratio 1.15; 2011–2025: r 0.20, ratio 2.70; one test across 2011 would rise while PRODES falls). Result 2011–2025: 566 cells tested, 45 rising and 2 falling. The `cover.json` fields are `lossTrendYears`, `methodChangeYear` and `hansenNote`.

