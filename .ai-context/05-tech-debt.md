# 5. Pending (tech debt)

| ID | Priority | Item | Why | Approach |
|---|---|---|---|---|
| P-002 | Done (15 Nov) | Decide method and final variables | Problem and region decided (01); web stack decided (ADR-003) | Decided 15 Nov: Mann-Kendall on yearly values, seven measures, periods and rules in ADR-006 and 01 (*Method*). Applied by `pipeline/trends.py` (step 8). Confirmation by José and Kiara: P-028 |
| P-008 | High | Define the exact boundary of "the Amazon" | The map, the data clipping and the results depend on it | Choose the hydrological basin or the forest biome; take the boundary from a published source (e.g. HydroSHEDS for the basin, RAISG for the biome), check its license and cite it. Sources checked on 2026-11-14 are in `data/README.md`. Measured: the basin covers 5.93 M km² and practically leaves out Suriname, French Guiana and Guyana; the RAISG biome covers 6.98 M km² and all nine countries (per-country table in `data/README.md`). HydroSHEDS v1, RAISG and Eva & Huber files cannot be committed; BasinATLAS and RESOLVE Ecoregions are CC BY 4.0. The pipeline uses `raisg_biome` provisionally; switching is one setting (`AMAZON_BOUNDARY` in `pipeline/config.py`). Clip box already widened to lat −21..10.5, lon −80..−43. Also open: an outline to draw on the web map needs a license that allows redistribution (RAISG's does not). Note (2026-11-15): for that license reason the web maps are not cut to the polygon; the zone values in the JSON files are |
| P-020 | High | Quality rule for NDVI/EVI and cloud handling (still open) | In March 2020 only 42% of Amazon cells are "good" (82% in August); daytime LST rests on ~7 clear days in March | Team decides `MOD13C2_ACCEPTED_RELIABILITY` (now 0 and 1) and how to treat cloudy months; diagnostics are already in the JSON. Also decide whether to mask physically implausible values that are inside the product's valid range (e.g. night LST of −85.5 °C in 2000-04, likely cloud contamination); the pipeline only counts them (`n_outside_plausible_range`) |
| P-018 | High | Record Colab as the processing environment | The notebook `notebooks/signo_pipeline_colab.ipynb` is written (16 sections, including `export_cover`) but not run end to end. José proposed Colab on 14 Nov as an ADR, but ADR-003 is already the web stack | If the team adopts it, record it as **ADR-007** (ADR-004 to ADR-006 are taken) and update tab 02. The notebook must also gain the `trends` (step 8) and `export_borders` (step 9) cells before it is run |
| P-019 | High | Data limits that affect the variables, still open: IMERG end date (decided items: C1, B1, D1, see *Done*) | Found while checking sources (2026-11-14, see `data/README.md`); the measured numbers are in `pipeline/README.md`, *Validation* | Still open: IMERG V07 ends 2025-09 (V08 not yet released), so the precipitation series ends earlier than the others. Already in the pipeline: LST to 2020-12 (Terra orbit drift), GLDAS ET as context only, February 2000 left out. Not used: Aqua `MYD11C3` (its overpass also drifts) and the observation-based ET product `MOD16A2GF`. MOD13C2 and MOD11C3 cannot be clipped on NASA's side (~30 GB and ~24 GB of global files), so the pipeline clips them after download. Also flagged on 15 Nov: the MOD44B 2025 anomaly and other limits (`pipeline/README.md`, *Known limits*); the team decides how to show them |
| P-003 | High | Earthdata Login for every member | Required to download NASA data | Each member signs up at urs.earthdata.nasa.gov |
| P-004 | Medium | Cite every dataset and reference in README | Space Apps rule; needed for global awards | Add each source as it is used |
| P-005 | Medium | Final AI-usage statement | Space Apps AI rule | Update README "Use of AI" before submission |
| P-007 | Done for V1–V4 (15 Nov) | Validation plan for the trend test | Judges reward validated methods (2025 "Best Use of Data" winner); Validity criterion | V1 (shuffled years) and V2 (made-up trend) show that the method does not invent trends and finds a typical one; V3 checks the hotspots and La Pampa; V4 checks the zones. All in `validation.json` (`trendChecks`), results in `pipeline/README.md` (*Trend test*), rules in ADR-006. Open: the comparison with NASA Giovanni (C3), see P-029 |
| P-012 | High | Period comparison values in the area file | The redesign shades a second period in the series, but the mean of each period and their difference must not be computed in the browser | Done in the backend (`web/server/periods.ts`) and shown in the area file of 15 Nov (`SemesterComparison.tsx`): same-half comparison, absolute difference, incomplete halves greyed. The area viewer redesign later replaced that comparison with the A-to-B year comparison (`CellChanges.tsx`); the six-month values are still computed by the backend. Team to confirm that the six-month comparison may leave the UI. The older "Period comparison" block (`CellDetails.tsx`) was removed with the redesign. Temperature is compared as an absolute difference, never as a percentage |
| P-013 | Medium | Land cover context in the area file (MapBiomas Amazonía) | José wants Global Forest Watch-style data for the selected area; MapBiomas is 30 m, annual 1985–2023, CC BY-SA, not NASA data | Partly covered (15 Nov): the area file shows Hansen tree cover and loss, MOD44B tree cover and MCD64A1 burned area. MapBiomas is not added: still a data decision with Alexis. If it is added, cite it as complementary and respect share-alike |
| P-014 | High | Crop the map to the real Amazon boundary | Today the crop follows the approximate bounding box (ADR-005) | After P-008, add the boundary geometry to the contract and use it for the crop and the edge |
| P-015 | Low | Self-host the fonts | The UI loads Source Serif 4, Source Sans 3 and JetBrains Mono from Google Fonts (SIL OFL); a venue without internet or privacy rules would fall back to system fonts | Put the woff2 files and their licence in `web/public/fonts` |
| P-016 | Low | Place names over the map (borders drawn since 15 Nov) | GIBS `Reference_Labels_15m` answered HTTP 500 and painted the map black, so it was removed | Retry another reference layer or a vector boundary once P-008 is decided |
| P-017 | Medium | Fill the Drive design-system core with the decided tokens | Hybrid route chosen by José: 01 essence, 04 colour, 05 type in `tokens.json`, with `css_producto` pointing at `web/src/index.css` | Run `ds-generar` and `ds-validar` in Estudio-Contenido |
| P-024 | High | Show cover, validation and six-month periods in the interface | Mostly done (15 Nov): the tree cover map and the area viewer (`CellViewer.tsx`), and the Cross-checks view (`ValidationPanel.tsx`) use the API. The six-month comparison is no longer in the area viewer (see P-012). The UI shows backend values and computes nothing itself | Still open: raster overlays (fire blocks and 0.05° detail from the PNGs; `rasters.json` is served, but no view reads it yet). Owner: Alexis (raster data side); José (UI). Browser check: P-025 |
| P-025 | High | Browser check of the interface | The interface of 15 Nov (map with filters, area viewer, Trends view with its trust checks, Cross-checks, Method & sources) and the trend map have not been checked in a real browser at 375 px, in dark mode, with the keyboard or in the console | Owner: José (UI and browser QA). Open the local build (`npm run dev:real`, or `npm run build:real` then `npx vite preview`) on a desktop and at phone width; follow `web/README.md`; record the result in *Done* |
| P-026 | High | UX/UI restructuring plan, partly implemented | Built: the four views, the map with filters, the area viewer, the Trends view with its trust checks, and the zone file (phases 1a, 1b and 2 of `docs/plan-ux-ui.md`, section 10). Partly: phase 1d (the exact-values table still shows p-values and α) and phase 1e (browser check, P-025). Not built: the 0.05° raster layer (phase 1c), and the forest-context charts and small multiples of the Trends view. The 17 questions of section 1 are still open | Read `docs/plan-ux-ui.md`, sections 1 and 10; the team answers the questions there, then the remaining phases are approved one by one. Owners: José (front design), Alexis (data semantics) |
| P-027 | Done (15 Nov) | Trend test decisions, answered by the team | The trend test is the solution itself: under the Space Apps AI rule only the team may choose it (P-002) | Answers recorded in `docs/plan-tests-tendencia.md` (section 2) and implemented as ADR-006. Questions the answers do not cover are open in P-029 |
| P-028 | High | Team confirmation of ADR-006 | Alexis recorded the decision on 15 Nov. José and Kiara have not yet confirmed it | Each of them confirms ADR-006, including the parameters delegated to Claude (listed there). Then ADR-006 is confirmed by the whole team |
| P-029 | High | Gaps in the trend test before submission | Not in the answers or in V1–V4: the comparison with NASA Giovanni (P-007, C3); a confidence interval for the slope (the team kit asks to show uncertainty; only p-values and V1–V2 are shown); the grid answer (A3: 1° is used, not recorded) | The team decides. Giovanni needs the Giovanni web tool. Not started |
| P-030 | High | Frontend: the area summary hides significant trends | `buildSummary` in `web/src/lib/cellView.ts` keeps only the first 3 significant trends (`.slice(0, 3)`), then counts only the "no clear trend" ones. In square r12c16 it drops the temperature rise (+0.58 °C per decade) and says "3 other measures show no clear trend", so 1 of the 7 tested measures disappears from the summary. Found in the data review of 15 Nov | José's direction: name every significant trend; if there is no room, the summary names the first ones and an "Others" dropdown lets the reader choose which measures to see. Keep the order (falling first) and count the hidden ones ("and 1 more clear trend"). Owner: José (front) |
| P-031 | Medium | Frontend: map legend at phone width and dark mode | At 375 px the legend under the map ends 8 px below the screen (its numbers are cut) and the Leaflet credit covers its title. In dark mode the "no significant trend" squares use `var(--surface)`, which is dark there, so they weigh more than the coloured squares | Give the legend bar room under the credit (or move the credit) at phone width; use a light neutral for the dotted squares in both themes, or a token decided by José. Check in light and dark at 375 px |
| P-032 | Medium | Frontend: wording that does not match what the app does | Cross-checks says a place opens "in the tree cover view", but it opens the tree cover loss map. The Method view prints the pipeline text "in unitless per decade" for NDVI and EVI. The area viewer subtracts NDVI and EVI between 2001 and 2025 although 2021–2025 are satellite drift years (labelled, but used in the difference) | Fix the Cross-checks sentence in `ValidationPanel.tsx`. Ask Alexis to change the method text in the pipeline (`trends.py`), or format it in the UI. The team decides whether drift years count in the A-to-B difference or are left out like suspect years |

## Done

- 2026-11-15: the trend legend shows when its ends are clipped. The colour scale ends at the 90th percentile of the
  significant slopes, so stronger squares took the end colour without saying so (rainfall: scale ±428.03, a square at
  −524.19; NDVI: ±0.016 against −0.052). `MapLegend.tsx` now marks a clipped end with "≤" or "≥" and, under the bar,
  gives the real range of the coloured squares; `makeTrendPaint` (`trendMap.ts`) passes that range. Approved by José.
  Verified on `build:real` (102 tests, layers, lint) for six of the seven trend measures (all but EVI) against the
  JSON files, in light and dark, at 375 px.

- 2026-11-15: blank page when the map mounts with no size. If the map container measured 0 px (page or pane hidden
  while loading) or less than the frame padding (48 × 96 px), Leaflet computed a NaN zoom and threw `Invalid LatLng
  (NaN, NaN)`; the error was not caught, so React unmounted the whole app.
  - **Fix**, approved by José (option A): `TrendMap.tsx` fits the region only when the container has room. Until then
    it sets a provisional view, and the existing `ResizeObserver` fits the region once the container has a size.
  - **Verified** on the real-data build (`build:real`, 102 tests, layers, lint):
    - the app renders in a 0 × 0 and a 40 × 40 iframe, with no console errors;
    - growing the iframe from 0 to 900 × 650 frames the region;
    - 375 px in light and dark: region framed, no horizontal scroll.
  - **Not covered:** no error boundary around the map. Another map failure would still blank the app (option B, not
    applied).
- 2026-11-15: trend test applied (ADR-006, `pipeline/trends.py`, step 8). Mann-Kendall on yearly values per 1° cell and
  per zone, Sen's slope, Benjamini-Hochberg FDR per variable, α = 0.05. D1 drift check: r = 0.85 for NDVI and EVI, so
  both end in 2020. Results and V1–V4 in `pipeline/README.md` (*Trend test*). Written: `web/server/data/trends/`,
  `cover.json` (trends), `zones.json` and `validation.json` (`trendChecks`). Interface: Trend map, Trends view with its
  trust checks, area viewer. Tests: 102 backend, 7 pipeline. Also `borders.json` (Natural Earth, step 9).
- 2026-11-15: P-027 answered; P-002 and P-007 done for V1–V4; P-026 partly implemented (see the table).
- 2026-11-15: interface redesign.
  - **Map:** one working screen with a GIBS map cropped to the region (ADR-005).
  - **Panels:** a case file panel, an area file panel, and a method and sources drawer.
  - **Design tokens:** José's decisions of 2026-11-14.
  - **Verified:** build, lint, keyboard access, light and dark mode, 375 px, and no console errors. This refers to José's redesign on mock data. The new cover and cross-check UI still needs a browser check (P-025).
- 2026-11-14: repository cloned outside Drive and documented (ADR-001).
- 2026-11-14: P-001, repository made public (Space Apps links must open without login).
- 2026-11-14: layered architecture with static API v1 and swappable data source (ADR-004). Verified in production
  (commit `21a3659`): without cookies, `/`, `manifest.json`, both `trends/*.json` and sample `series/*/*.json` answer
  200 with JSON, an unknown variable answers 404, API headers match `web/vercel.json`, the deployed bundle is the new
  one, and a deep link (`?variable=ndvi&cell=r04c05`) renders the map, selection and series with no console errors.
- 2026-11-14: P-011, unused Vite template files removed with José's approval (App.css, src/assets/, public/icons.svg).
- 2026-11-14: P-010, 26 backend unit tests (`npm test`), run in every build.
- 2026-11-14: P-006, Vercel project deployed by José at <https://signo-chi-pink.vercel.app/>; checked without
  cookies (HTTP 200, no login redirect), no console errors, no horizontal scroll at 375 px.
- 2026-11-14: data pipeline (`pipeline/`) built and validated on March and August 2020: clip, cleaning, zone masks
  (areas within 0.2% of the published polygons), JSON export; IMERG and GLDAS rainfall agree (226 vs 213 mm, Mar).
- 2026-11-14: P-021, full run 2000–2026: 1,270 monthly files (MOD13C2 321, MOD11C3 321, GLDAS 319, IMERG 309), none
  missing; `amazon_monthly.json` 221 KB; validated (seasonal cycle, IMERG vs GLDAS r = 0.991, droughts 2005, 2010,
  2015, 2023, 2024 visible); results and problems in `pipeline/README.md`, *Validation*.
- 2026-11-15: team decisions recorded in `pipeline/config.py`: C1 (analysis from 2001-01, February 2000 left out), B1
  (day and night LST only to 2020-12; Aqua not used), D1 (GLDAS ET as climate context only) and six-month semesters
  H1 = January–June, H2 = July–December. P-019 and P-020 updated; the NDVI reliability rule and the masking of
  implausible values stay open (P-020).
- 2026-11-15: MOD44B, MCD64A1, Hansen and GRACE added to the pipeline (`tiles.py`, `hansen.py`, `grace.py`), and the
  output steps `export_maps.py` and `validate.py` written. GRACE done; the other three downloads in progress.
- 2026-11-15: 2020 validation sample files deleted (448 MB); their months are kept in `data/interim/`.
- 2026-11-15: P-022, MOD44B (26 years), MCD64A1 (311 months), Hansen v1.13 (16 tiles, canopy-weighted loss) and GRACE processed; exports, 129 map layers and validation written. MOD44B vs Hansen r = 0.88 (2000), change r = -0.72; 56 % of Amazon loss in burned cells; La Pampa detected without fire. Results in `pipeline/README.md`, *Cross-validation*.
- 2026-11-15: merge of `origin/main` (layered app, static API, GIBS map, interface redesign) with the data pipeline. Pending items renumbered: P-018 Colab, P-019 data limits, P-020 quality rule; P-021 (full monthly run) and P-022 (export and validation) are done.
- 2026-11-15: P-009 and P-023 closed.
  - **Commit:** the pipeline export (`web/server/data/`, 16 files; `web/public/data/`, 135 files) is in git
    (commit `4683512`).
  - **Vercel switch:** `web/vercel.json` now builds with `npm run build:real` (José's go-ahead, 2026-11-15).
  - **Effect:** production serves `dataStatus: real` and the "Sample data" notice is gone.
  - **Method:** the trend test (ADR-006) still awaits José and Kiara's confirmation (P-028).
- 2026-11-15: P-009, export part: `export_api.py` writes the 1° API source (566 cells, five variables) to `web/server/data/`; `export_cover.py` writes `cover.json`; `validate.py` writes `validation.json` for the API. (The Vercel switch followed the same day; see above.)
- 2026-11-15: web contract and server extended, additively (API v1 compatible): six-month periods (`periods.ts`), `cover.json`, `validation.json`, `rasters.json` and the manifest `extras`. The server rejects p-values and significance fields in the validation report. 70 backend tests.
- 2026-11-15: real build checked locally with the pipeline data: the build passes and the site serves (manifest `dataStatus` "real").
- 2026-11-15: `web/package-lock.json` regenerated (it lacked two `@emnapi` packages, so `npm ci` failed). `npm ci` works now.
- 2026-11-15: `.gitignore` anchored to the repo root (`/data/raw/`, `/data/interim/`, `*.zip`), so `web/server/data/` can be versioned.
- 2026-11-15: Colab notebook `notebooks/signo_pipeline_colab.ipynb` written (16 sections, including `export_cover`). Not yet run end to end.
- 2026-11-15: data review (Opus). Its limits are in `pipeline/README.md`, *Known limits*, and in `data/README.md`.
- 2026-11-15: documentation updated for the above (README, `data/`, `pipeline/`, `notebooks/`, `web/server/data/`, `.ai-context/`).
