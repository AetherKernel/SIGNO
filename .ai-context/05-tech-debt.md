# 5. Pending (tech debt)

| ID | Priority | Item | Why | Approach |
|---|---|---|---|---|
| P-002 | Done (15 Nov) | Decide method and final variables | Problem and region decided (01); web stack decided (ADR-003) | Decided 15 Nov: Mann-Kendall on yearly values, seven measures (Hansen loss as one trend from 2011, ADR-009), periods and rules in ADR-006 and 01 (*Method*). Applied by `pipeline/trends.py` (step 8). Confirmed by the whole team on 15 Nov (P-028) |
| P-008 | High | Define the exact boundary of "the Amazon" | The map, the data clipping and the results depend on it | Choose the hydrological basin or the forest biome; take the boundary from a published source (e.g. HydroSHEDS for the basin, RAISG for the biome), check its license and cite it. Sources checked on 2026-11-14 are in `data/README.md`. Measured: the basin covers 5.93 M km² and practically leaves out Suriname, French Guiana and Guyana; the RAISG biome covers 6.98 M km² and all nine countries (per-country table in `data/README.md`). HydroSHEDS v1, RAISG and Eva & Huber files cannot be committed; BasinATLAS and RESOLVE Ecoregions are CC BY 4.0. The pipeline uses `raisg_biome` provisionally; switching is one setting (`AMAZON_BOUNDARY` in `pipeline/config.py`). Clip box already widened to lat −21..10.5, lon −80..−43. Also open: an outline to draw on the web map needs a license that allows redistribution (RAISG's does not). Note (2026-11-15): for that license reason the web maps are not cut to the polygon; the zone values in the JSON files are |
| P-020 | High | Quality rule for NDVI/EVI and cloud handling (still open) | In March 2020 only 42% of Amazon cells are "good" (82% in August); daytime LST rests on ~7 clear days in March | Team decides `MOD13C2_ACCEPTED_RELIABILITY` (now 0 and 1) and how to treat cloudy months; diagnostics are already in the JSON. Also decide whether to mask physically implausible values that are inside the product's valid range (e.g. night LST of −85.5 °C in 2000-04, likely cloud contamination); the pipeline only counts them (`n_outside_plausible_range`) |
| P-019 | High | Data limits that affect the variables, still open: IMERG end date (decided items: C1, B1, D1, see *Done*) | Found while checking sources (2026-11-14, see `data/README.md`); the measured numbers are in `pipeline/README.md`, *Validation* | Still open: IMERG V07 ends 2025-09 (V08 not yet released), so the precipitation series ends earlier than the others. Already in the pipeline: LST trend to 2020 (Terra orbit drift; day LST published to 2026-10 since the evening of 15 Nov), GLDAS ET as context only, February 2000 left out. Not used: Aqua `MYD11C3` (its overpass also drifts) and the observation-based ET product `MOD16A2GF`. MOD13C2 and MOD11C3 cannot be clipped on NASA's side (~30 GB and ~24 GB of global files), so the pipeline clips them after download. Also flagged on 15 Nov: the MOD44B 2025 anomaly and other limits (`pipeline/README.md`, *Known limits*); the team decides how to show them |
| P-003 | High | Earthdata Login for every member | Required to download NASA data | Each member signs up at urs.earthdata.nasa.gov |
| P-004 | Medium | Cite every dataset and reference in README | Space Apps rule; needed for global awards | Add each source as it is used |
| P-005 | Medium | Final AI-usage statement | Space Apps AI rule | Update README "Use of AI" before submission |
| P-007 | Done for V1–V4 (15 Nov) | Validation plan for the trend test | Judges reward validated methods (2025 "Best Use of Data" winner); Validity criterion | V1 (shuffled years) and V2 (simulated trend) show that the method does not invent trends and finds a typical one; V3 checks the hotspots and La Pampa; V4 checks the zones. All in `validation.json` (`trendChecks`), results in `pipeline/README.md` (*Trend test*), rules in ADR-006. Open: the comparison with NASA Giovanni (C3). The confidence intervals are in P-029 (done 15 Nov, evening) |
| P-012 | High | Period comparison values in the area file | The redesign shades a second period in the series, but the mean of each period and their difference must not be computed in the browser | Done in the backend (`web/server/periods.ts`) and shown in the area file of 15 Nov (`SemesterComparison.tsx`): same-half comparison, absolute difference, incomplete halves greyed. The area viewer redesign later replaced that comparison with the A-to-B year comparison (`CellChanges.tsx`); the six-month values are still computed by the backend. Team to confirm that the six-month comparison may leave the UI. The older "Period comparison" block (`CellDetails.tsx`) was removed with the redesign. Temperature is compared as an absolute difference, never as a percentage |
| P-013 | Medium | Land cover context in the area file (MapBiomas Amazonía) | José wants Global Forest Watch-style data for the selected area; MapBiomas is 30 m, annual 1985–2023, CC BY-SA, not NASA data | Partly covered (15 Nov): the area file shows Hansen tree cover and loss, MOD44B tree cover and MCD64A1 burned area. MapBiomas is not added: still a data decision with Alexis. If it is added, cite it as complementary and respect share-alike |
| P-014 | High | Crop the map to the real Amazon boundary | Today the crop follows the approximate bounding box (ADR-005) | After P-008, add the boundary geometry to the contract and use it for the crop and the edge. Post-deadline option: an outline from a redistributable boundary, e.g. RESOLVE Ecoregions or BasinATLAS (CC BY 4.0) |
| P-016 | Low | Place names over the map (borders drawn since 15 Nov) | GIBS `Reference_Labels_15m` answered HTTP 500 and painted the map black, so it was removed | Retry another reference layer or a vector boundary once P-008 is decided. Post-deadline option: Natural Earth place names (public domain); depends on P-008 |
| P-030 | Low | Close the Drive design-system core | Cards 01, 02, 04 and 05 are accepted (2026-11-15). Card 03: logo chosen (proposal 02 "Hoja Cartografica", generated with Gemini, approved by the team) and on the site since 2026-11-15 (see *Done*). Card 07 (imagery) is owned by Kiara. Card 06 (icons) is accepted: Tabler Icons (ADR-007). No dark theme file yet (`tokens/oscuro.json`): the validator reads `[data-theme="dark"]` blocks, the web uses `prefers-color-scheme` | Kiara delivers the symbol and closes 07; then the dark theme and the hub layer |
| P-037 | Low | Choose the language by region, with confirmation | Kept as future work by José (ADR-007): detect the region, show a pop-up that names the detected region and offers to switch, and a language selector in the footer; or follow the browser language | Needs a privacy-safe detection (no third-party IP lookup) and English kept for judges; discuss as part of the project's roadmap |
| P-038 | Medium | Spanish texts published by the API | In the Spanish interface, variable names, method descriptions and data notes stay in English because they come from the pipeline (ADR-007) | Agree with Alexis a contract change (for example `nameEs`, `descriptionEs`) or a frontend table keyed by variable id |
| P-040 | Medium (after the deadline) | Statistical follow-ups from the review of 15 Nov (evening) | Found in the statistical review of 15 Nov (evening). The zone tests are not corrected for multiple testing (Brazil and Peru Hansen loss are borderline), and the cell counts are not independent | Publish `qValue` per cell; publish the spatially coherent shuffle as a check (same permutation for all cells, 10,000 runs); team decision on applying Benjamini–Hochberg to the zone tests; add a Hamed–Rao sensitivity table to `pipeline/README.md`. The Giovanni comparison stays P-007 (C3) |
| P-024 | High | Show cover, validation and six-month periods in the interface | Mostly done (15 Nov): the tree cover map and the area viewer (`CellViewer.tsx`), and the Cross-checks view (`ValidationPanel.tsx`) use the API. The six-month comparison is no longer in the area viewer (see P-012). The UI shows backend values and computes nothing itself | Still open: raster overlays (fire blocks and 0.05° detail from the PNGs; `rasters.json` is served since the 18:00 freeze of 15 Nov, but no view reads it yet). Owner: Alexis (raster data side); José (UI). Browser check: P-025 |
| P-025 | High | Browser check of the interface | The interface of 15 Nov (map with filters, area viewer, Trends view with its trust checks, Cross-checks, Method & sources) and the trend map have not been checked in a real browser at 375 px, in dark mode, with the keyboard or in the console | Owner: José (UI and browser QA). Open the local build (`npm run dev:real`, or `npm run build:real` then `npx vite preview`) on a desktop and at phone width; follow `web/README.md`; record the result in *Done* |
| P-026 | High | UX/UI restructuring plan, partly implemented | Built: the four views, the map with filters, the area viewer, the Trends view with its trust checks, and the zone file (phases 1a, 1b and 2 of `docs/plan-ux-ui.md`, section 10). Phase 1d resolved on the evening of 15 Nov ("Fase 1d": the p-value and α stay in the area viewer's Exact values, with a tooltip, plus a 95 % CI column). Partly: phase 1e (browser check, P-025). Not built in the view: the 0.05° raster layer (phase 1c; `rasters.json` is served, no view reads it yet), and the forest-context charts and small multiples of the Trends view. The 17 questions of section 1 are still open | Read `docs/plan-ux-ui.md`, sections 1 and 10; the team answers the questions there, then the remaining phases are approved one by one. Owners: José (front design), Alexis (data semantics) |
| P-027 | Done (15 Nov) | Trend test decisions, answered by the team | The trend test is the solution itself: under the Space Apps AI rule only the team may choose it (P-002) | Answers recorded in `docs/plan-tests-tendencia.md` (section 2) and implemented as ADR-006. Questions the answers do not cover were open in P-029 (the confidence intervals are now done; the grid answer A3 is still open) |
| P-029 | Done (15 Nov, evening) | Gaps in the trend test before submission | 95 % confidence interval for every slope: done (`slopeCi95`, Gilbert 1987; cells, zones, known places, zone checks). Still open from this item: the grid answer (A3: 1° is used, not recorded). The comparison with NASA Giovanni is in P-007 (C3) | The CI is in `trends.py`, `validation.json` (`trendChecks.design`: `ciMethod`, `ciLevel` 0.95) and the pipeline tests. The cross-check against SciPy is done (statistical review, 15 Nov evening; see *Done*). Still open from this item: recording the grid answer A3 (1° cells), and the Giovanni comparison (P-007, C3) |
| P-033 | Done (15 Nov) | Frontend: the area summary hides significant trends | `buildSummary` in `web/src/lib/cellView.ts` keeps only the first 3 significant trends (`.slice(0, 3)`), then counts only the "no clear trend" ones. In square r12c16 it drops the temperature rise (+0.58 °C per decade) and says "3 other measures show no clear trend", so 1 of the 7 tested measures disappears from the summary. The limit of 3 is hard-coded; it should follow the measures the area actually has. Found in the data review of 15 Nov | José's direction: name every significant trend; if there is no room, the summary names the first ones and an "Others" dropdown lets the reader choose which measures to see. Keep the order (falling first) and count the hidden ones ("and 1 more clear trend"). Owner: José (front). **Done:** the summary names the first 3 clear trends (falling first), says "And N more clear trends" and lists them under "Other clear trends" (`buildSummary` returns `{ sentences, others }`) |
| P-034 | Medium | Frontend: map legend at phone width and dark mode | At 375 px the legend under the map ends 8 px below the screen (its numbers are cut) and the Leaflet credit covers its title. In dark mode the "no significant trend" squares use `var(--surface)`, which is dark there, so they weigh more than the coloured squares | Give the legend bar room under the credit (or move the credit) at phone width; use a light neutral for the dotted squares in both themes, or a token decided by José. Check in light and dark at 375 px |
| P-035 | Done (15 Nov, evening) | Frontend: wording that does not match what the app does | Two parts fixed on 15 Nov: Cross-checks now says a place opens on the tree cover loss map, and "unitless per decade" is shown as plain words in the Method view (`plainMethodText`) and the legend title (`slopeUnitsLabel`: "no units"). Resolved on the evening of 15 Nov: the area viewer's A-to-B difference of NDVI and EVI used 2021–2025, which are satellite drift years. Those years now carry a "?" mark and the NASA note, and an A-to-B change that involves them gets "?". The pipeline part is also done (15 Nov): `trends.py` now writes "NDVI units per decade" and "EVI units per decade" in the method text (`pipeline.verify`: numbers unchanged) | Decided on the evening of 15 Nov: drift years are shown with the "?" mark and the NASA note (see *Done*). |
| P-036 | Medium | Alexis: what the site publishes but no view reads | The deployed site holds about 54 MB of API files and 18 MB of `web/public/data/`: the 129 map PNGs (17.4 MB), `amazon_monthly.json`, `amazon_semester.json`, `amazon_annual.json` and a second `validation.json`. No view downloads them (only `maps/index.json` feeds `rasters.json`, and `borders.json` is used). They do not slow visitors down, but they make each deploy larger | **Decided by Alexis (2026-11-15): keep every file where it is.** The build depends on them (`maps/index.json` → `rasters.json`, and `validate.ts` checks each PNG exists), and `trends.py` reads `amazon_monthly.json` and `amazon_annual.json` as inputs. Team rule of the same day: time ranges are **yearly, not six-monthly**; the semester outputs (`amazon_semester.json`, `burned/<year>-H1/H2.png`, `semesters` in the API) stay as generated but no view uses them. Revisit only if P-024 is built or dropped |

## Done

- 2026-11-15 (night): corrections from the pre-publication review of everything the team publishes (five reviewers; each finding re-checked by a second agent).
  - **Web texts** (`web/src/`): the Method view no longer says that MODIS tree cover is "not tested" (the API files carry that test; the site does not show it), says "higher than" PRODES instead of "several times", says that MODIS reads about 22 points lower "on average" (not "over dense forest"), and shows the build time with its time zone ("site built … UTC"). `TrendMethod.tsx`: the drift r uses the yearly values of 2015–2025, and the overpass time only changes in the last five years. `HansenConsistencyCard.tsx`: the 2001–2010 block is labelled "comparison only, earlier method; not a published trend". `lib/hansen.ts`: the ratio 1.15 is no longer printed as 1.1. `lib/guide.ts`: "at most" now uses the worst single run (`maxShareSignificant`), the same number as the Trends view and the slides (0.18 %). `CellViewer.tsx`: Spanish thousands separator.
  - **Headers and comments:** `web/src/main.tsx`, `web/vite.config.ts` and `web/index.html` now carry the AI header; the comment of `web/public/favicon.svg` no longer says "Pending approval".
  - **READMEs:** NASA Harmony removed from the tools (never used); the 95 % confidence interval added to the delegated details; "first run" and the 10:36 UTC stamp corrected; the false-alarm sentence names MODIS tree cover; *Next steps* lists the same four goals as the project page; stale notes about mock data on the live site and about P-023 and P-028 corrected (`README.md`, `pipeline/README.md`, `data/README.md`, `web/README.md`, `web/server/data/README.md`, `docs/plan-tests-tendencia.md`).
  - **Not changed, by decision of the team (José, 15 Nov):** the logo stays without a visible AI label in the web app (it is declared in the README, the slides and the video). **Left for later:** the texts generated by the pipeline (the "provisional, P-008" boundary name in `region.json`; the drift sentence inside `trends/*.json`) need a pipeline re-run.
- 2026-11-15 (night): the Colab route is withdrawn (ADR-008; decided by José). The notebook was not finished as a shared route and was not used for the published results, so its mentions were removed from `README.md`, `notebooks/README.md`, `pipeline/README.md`, `data/README.md`, `web/README.md`, the messages of `pipeline/download.py`, `pipeline/run_all.py` and `pipeline/verify.py`, and the Method view of the web app (`web/src/components/MethodView.tsx`: the *Code and reproduction* block no longer has a Colab link). The draft notebook was removed from the repository the same night (decided by José); it remains in the git history. P-039 (reproduction routes in Colab, and where to publish `data/interim/`) is dropped with it; publishing the intermediate data can come back as a new item. The older entries below that mention Colab are history, not a supported route.
- 2026-11-15 (evening): P-028 done. José and Kiara confirmed ADR-006 (trend test, including the parameters delegated to Claude) and ADR-009 (Hansen loss as one trend, 2011–2025; one tree cover). Both are now confirmed by the whole team.
- 2026-11-15 (evening): one answer per measure, confidence intervals (P-029), daytime LST shown to 2026, the "?" rule, and José's commits integrated.
  - **One Hansen loss trend (amends ADR-009).** Alexis asked for one answer per measure. The loss is tested as one trend, 2011–2025 (`HANSEN_LOSS_TREND_YEARS` = 2011–2025, `HANSEN_METHOD_CHANGE_YEAR` = 2011). All years 2001–2025 are shown; 2001–2010 are greyed with an info tooltip and not used. Every Hansen chart marks 2011 with a dashed line and a tooltip. Result 2011–2025: 566 cells tested, 45 rising, 2 falling. Zones: Amazon +12,040 km² per year per decade (p 0.0075, 95 % CI +5,145 to +19,582); Brazilian Amazon +8,709 (p 0.029); Peruvian Amazon +456 (p 0.048). La Pampa r08c09: +43.5 (p 0.00025, 95 % CI +27.8 to +53.3). `trendChecks.hansenConsistency` keeps the evidence (Hansen vs INPE PRODES: 2001–2010 r 0.85, ratio 1.15; 2011–2025 r 0.20, ratio 2.70; one test across 2011 would rise while PRODES falls).
  - **Uncertainty (closes P-029).** Every trend has `slopeCi95`: the 95 % confidence interval of Sen's slope per decade (Gilbert 1987; variance from the same Mann-Kendall test, Hamed–Rao variance when used; pairwise slopes honour the real year gaps). Published for cells (`trends/*.json`, `cover.json`), zones (`zones.json`), known places (v3) and zone checks (v4). `trendChecks.design` has `ciMethod` and `ciLevel` 0.95. Checks: the CI contains the Sen slope in every tested cell; for significant cells the CI excludes 0 in all but 2 burned-area cells (tie-heavy series); non-significant cells may have a CI that excludes 0, because the CI is not FDR-corrected. Example: Amazon daytime temperature +0.33 °C per decade, CI +0.17 to +0.55. Cross-checked against SciPy in the statistical review of 15 Nov (evening); see the entry below.
  - **Daytime LST published to 2026-10 (real NASA data).** Its trend still uses 2001–2020 (rule B1, Terra orbit drift): `LST_TREND_LAST_YEAR` = 2020, `DRIFT_FROM_YEAR` = 2021. `variables.json` has `driftFromYear: 2021` for ndvi, evi and lst_day. Amazon yearly daytime LST: 2020 28.0 °C; 2021–2025 27.4, 27.4, 27.7, 27.6, 26.1 °C. The 2025 drop of about 2 °C goes the wrong way for a drought (2023–2024 were record drought and heat years), which points to the overpass-time effect rather than real cooling; it is not proof. The drift years are shown but not tested. `LST_LAST_MONTH` is kept only for night LST (not in the web API, rule D4; it is in `amazon_monthly.json`).
  - **Interface rules (for José's review, web/).** One row or answer per measure; all values visible. A value or change affected by a known limit gets a "?" mark and a short tooltip: an unclear trend shows its value, "?", its p-value and its CI; drift years (NDVI, EVI, daytime LST from 2021) are greyed, and an A-to-B change that involves them gets "?" and the NASA note ("Real NASA data (Terra, MODIS); since 2021 the satellite passes earlier… part of this change may come from the overpass time"). A clear trend shows "(95 % CI a to b)". The p-value and α stay in the area viewer's Exact values, with a tooltip (José's "Fase 1d" item: resolved), plus a 95 % CI column. "Months used" is renamed "Months with data (whole series)". Burned area is shown once (km²). The Cross-checks PRODES card leads with what agrees and explains "Why the trend starts in 2011". Method view: "Code and reproduction" block (repository, Colab link, `python -m pipeline.trends` and `python -m pipeline.verify`), GLDAS rainfall check r = 0.991, region "Amazon biome (RAISG 2025)" with a tooltip (outline not drawn: RAISG terms). Map legend tooltip with the false-positive and detection rates. Internal codes (D1, B1, V1, V2, P-008) removed from the UI. José's guide texts updated.
  - **Code.** New `web/src/lib/trendWords.ts`; `InfoTip` "?" variant; contract fields `slopeCi95`, `driftFromYear`, `lossTrendYears`; `validate.ts` checks low ≤ slope ≤ high. Pipeline tests: 12 (new: the loss trend years start at the method-change year; the CI contains the Sen slope and the true slope; the CI of noise contains 0; the LST trend years end at `LST_TREND_LAST_YEAR`). Web tests: 112. Pipeline tests later 13: the Sen slope is also checked against `scipy.stats.theilslopes` (statistical review, 15 Nov evening).
  - **Integration.** José's 12 commits of the afternoon of 15 Nov (guide tour, logo, phone layout, P-033 summary, translation guard) are integrated with our work; no conflicts left.
  - **Post-deadline (after José's 18:00 freeze), recorded here.** Raster overlays (P-024 / "Fase 1c"): `rasters.json` is served, but no view uses it yet. P-014 outline: needs a redistributable boundary (e.g. RESOLVE Ecoregions or BasinATLAS, CC BY 4.0). P-016 place names: Natural Earth (public domain). P-014 and P-016 both depend on P-008.
- 2026-11-15 (evening), statistical review (numbers recomputed with the pipeline's functions):
  - **SciPy cross-check (P-029).** Our `slopeCi95` against `scipy.stats.theilslopes` (SciPy 1.18.1): slopes identical. The bounds differ by a median of 0.3 % of the interval width in the 21 zone tests (max 2.3 %), because SciPy rounds the ranks and we interpolate (Gilbert). The interval excludes 0 in exactly the 12 clear zone tests (21 computed, 18 shown). At cell level, 496 cells that are not clear after FDR have an interval that excludes 0 (not corrected). `scipy==1.18.1` is pinned in `pipeline/requirements.txt`; a unit test compares with `theilslopes` (pipeline tests: 13).
  - **Zone tests and multiple testing.** 18 zone tests are shown (3 zones × 6 measures). Zone results are not corrected for multiple tests: 18 are shown (3 zones × 6 measures). With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in Brazil (p 0.029, q 0.059) and in Peru (p 0.048, q 0.086) would not. Whole-Amazon loss stays clear (p 0.0075, q 0.017), and it stays clear when any year is left out (worst p 0.0215). Not applied: a team decision after the deadline (P-040). The "three zones, so no correction" justification is replaced in the docs.
  - **Hansen loss level shift (known limit).** The 2011–2025 rise is a higher level from 2016 (about 17,900 km² per year in 2011–2015, 34,000 in 2016–2025), not a steady climb. Inside 2016–2025 there is no trend (p 0.86). No jump at Landsat 8 (2013) or Landsat 9 (2022); PRODES rises in the same years. Starting the test in 2013 would not be robust; 2011 stays because it is the documented reprocessing year, not chosen after seeing the data.
  - **Squares are not independent.** LST residuals have a mean pairwise r of +0.42; the 566 cells behave like about 5 independent patterns for LST and NDVI. A spatially coherent shuffle (same permutation for all cells, 10,000 runs) rarely reaches the real counts (field p ≤ 0.0006): the counts are not chance, but the headline is the zone result with its interval, and the counts show where.
  - **Hamed–Rao for every measure.** No direction or zone verdict changes. It flags more cells than the original test in every measure except NDVI, so the original test stays (largest autocorrelation share 17 %, below the 20 % rule).
  - **Drift rule wording.** The r = 0.85 rests on five years (2021–2025), which include the 2023–2024 drought: a coincidence in time, not proof of cause. Stopping the tests in 2020 stays the safe choice. The 2025 LST drop of about 2 °C, in the wrong direction for a drought, supports the overpass effect. Causal wording in the docs is softened.
  - **Missing years.** Mann–Kendall uses only the order of the yearly values, so a missing year does not bias it; Sen's slope uses the real years; seven burned-area squares lack 2001 or 2002. Removed from the limits lists.
  - **Burned area clear squares: 48** = 27 rising + 20 falling + 1 clear with a zero slope (r24c13, CI [0, 0], 20 zero years of 25). Listed in `README.md` and `pipeline/README.md`.
  - **Interface texts added (web).** Borderline tip on Brazil and Peru loss; level-shift tip on whole-Amazon loss; "squares are not independent" in the squares tip; drift years described as a coincidence in time; V1/V2 wording (memoryless noise; the same test trend in every square); interval-not-corrected note in Exact values; one info icon per card.
- 2026-11-15: Hansen [VERIFY] resolved: loss tested in two segments (ADR-009; amended the same evening to one trend, 2011–2025), one tree cover, MODIS 2025 out of the change check. Decision recorded by Alexis; José and Kiara to confirm together with ADR-006 (P-028).
  - **A. Hansen year consistency.** The Hansen/UMD v1.13 user notes say the loss was reprocessed from 2011 onward and not for 2001–2010 ("users will notice inconsistencies as a result"). Landsat 8 is used from 2013 and Landsat 9 from 2022. "care must be taken when comparing change across any interval"; the data are "a relative indicator of spatiotemporal trends", and "definitive area estimation should not be made using pixel counts" (<https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>). The old "about 2013" (Global Forest Watch) is replaced everywhere.
  - **B. Validation against INPE PRODES.** Source: INPE, "Série Histórica Taxas Prodes Amazônia", Apresentação Coletiva Prodes 2026, 16 Oct 2026, p. 4 (<https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/brasil-alcanca-menores-taxas-de-desmatamento-da-serie-historica-na-amazonia-e-no-cerrado>). Brazilian Amazon: 2001–2010 r = 0.85, Hansen/PRODES 1.15; 2011–2025 r = 0.20, ratio 2.70. One Mann-Kendall test over 2001–2025 gives a rising Amazon trend (p = 0.047) while PRODES falls (p = 0.014): an artefact of the 2011 change, not used. MODIS confirms where Hansen sees loss: r = −0.79 (2001–2010) and −0.47 (2011–2025) across the 566 cells.
  - **C. Decision (ADR-009, first version, superseded the same evening).** Loss tested in two segments. 2011–2025: 566 tested, 45 rising, 2 falling (before: 318 and 20). Zones 2011–2025: Amazon rising (p 0.0075; +12,040 km² per year per decade), Brazilian Amazon rising (p 0.029; +8,709), Peruvian Amazon rising (p 0.048; +456). La Pampa still clearly rising (p 0.00025). None of the 14 hotspots is clear after the correction (before: 5).
  - **D. One tree cover.** Only Hansen is shown ("Tree cover"). MODIS (MOD44B) is removed from the map, the area viewer and the Trends view; it stays in Cross-checks and Method. Reason: the two measure different things (2024 area-weighted mean: Hansen 78.6 %, MODIS 62.4 %), MODIS is noisy (±1.5 points a year), and MODIS 2025 is anomalous (in 127 cells with almost no Hansen loss it falls 3.94 points, 2.5 standard deviations below its 2001–2024 yearly changes). The MODIS trend is still computed in `validation.json`, not shown.
  - **E. MODIS 2025 out of the change check** (`pipeline/validate.py`): MODIS change = mean(2023, 2024) − mean(2001, 2002), against Hansen loss 2001–2024. r: Amazon −0.729 (was −0.719), Brazilian Amazon −0.786 (was −0.781), Peruvian Amazon −0.578 (was −0.603). Hotspots use the same definition. Nothing else in `validation.json` changed (agreement, fire co-location, cases). V1 and V2 share one random stream, so the MODIS V1 mean moved from 0 to 0.009 % (a share of 0.00009); the MODIS test itself is identical.
  - **F. Interface** (`web/`, changes made 15 Nov at Alexis's request; José to review): `InfoTip` replaces inline secondary notes and badges such as "suspect"; a dashed 2011 marker, with an InfoTip, on every yearly Hansen loss and tree cover chart; loss trend shown per segment in the area viewer and the Trends view (replaced the same evening by one trend); map loss trend = 2011–2025; solid Sen line = clear trend, dashed = not clear (also in the area viewer); new Cross-checks card "Hansen loss vs official deforestation (INPE PRODES)"; trend-method texts reworded: V1 "Does it mark trends where there are none?", V2 "Does it find a real change?", explained as a power analysis on simulated data on a separate copy of the series, never on published results (the word "invented" removed).
- 2026-11-15: P-018 closed: the Colab route is tested end to end and reproduces the results (ADR-008).
  - **Verify result (Colab, free tier, 15 Nov 2026):** 147 IDENTICAL, 3 TEXT, 0 ROUNDING, 0 DIFFERENT, of 150 files. The
    3 TEXT files (`trends/ndvi.json`, `trends/evi.json`, `validation.json`) differ only in the P-035 wording ("NDVI units per
    decade", "EVI units per decade"). All their 11,738 numbers and every significance flag are identical. The 129 PNG map
    layers are identical pixel by pixel.
  - **Times:** total **1 h 22 min 10 s**. Downloads with four sources at a time took 1 h 13 min 56 s; one after another
    they would take about 3 h 50 min. The slowest source, MCD64A1, took 1 h 13 min 51 s; MOD44B took 45 min. The steps after
    the downloads: export_json 1:32, export_maps 0:26, export_api 1:08, export_cover 0:12, validate 0:12, test_trends 0:04,
    trends 4:31, export_borders 0:03, verify 0:06.
  - **What made it short:** (1) `pipeline.run_all` downloads four sources at a time, longest first; this is the main gain.
    (2) The intermediate files stay on the Colab disk, not on Google Drive (decided by Alexis, 15 Nov). (3) On Windows only,
    `HDF5_PLUGIN_PRELOAD="::"` in `pipeline/__init__.py` cut the exports from 44 min to 10 min, with all 150 output files
    identical. In Colab the exports were already fast (about 4 min before trends) without it.
  - **Colab notes:** (1) pip's red "dependency resolver" lines about Colab's own packages are expected and harmless. (2) The
    optional HydroBASINS download can answer HTTP 403; the notebook cell now warns and continues.
  - **Upload:** the run used the notebook and the new files `run_all.py`, `verify.py` and `trends.py`, uploaded by hand,
    because `main` did not have them yet. After the next push they come with the clone.
  - **Hansen loss change (ADR-009):** the 15 Nov Colab run reproduced the results published before the Hansen change. Only the `trends` step (and validate's change check) changed after it, with the same inputs, so a new Colab run reproduces the new results.
- 2026-11-15: one-command run `pipeline/run_all.py` and Colab fixes.
  - **What run_all does:** `python -m pipeline.run_all` runs the whole pipeline. It checks first (Python 3.12 or later,
    Earthdata credentials present, `Biomas_2025.zip` under `data/raw/`, free disk space with a warning under 20 GB) and
    stops before downloading if something is missing. It downloads the 8 sources, four at a time, and stops before the
    exports if a month or tile failed; running it again resumes. Then it runs the exports, the trend test and
    `pipeline.verify`, and prints and saves (`data/interim/logs/run_summary.json`) the time of each step. Options:
    `--only downloads`, `--only exports`, `--dry-run`, `--latest`, `--jobs N`.
  - **Level 2 measured (Windows, 15 Nov 2026):** `run_all --only exports` from the existing `data/interim/` took 44 min 10 s
    (export_json 13:42, export_maps 2:23, export_api 14:51, export_cover 2:27, validate 3:23, test_trends 0:06, trends 7:06,
    export_borders 0:03, verify 0:10). Result: 147 IDENTICAL, 3 TEXT (the P-035 wording), 0 DIFFERENT. The exports
    reproduce the published results (level 2).
  - **Launcher test:** `run_all --only downloads` with everything already downloaded ran the 8 jobs in parallel and
    skipped every finished month in 40 s. This tests the launcher, not the download speed.
  - **Notebook:** new section 4b "Run everything with one command (recommended)" runs `!python -m pipeline.run_all` with
    `%%time`. Sections 5 to 14c are optional step cells guarded by `STEP_BY_STEP = False`, so "Run all" does not run
    anything twice; set it to True to retry one step. The step cells use the published end dates (GLDAS 2026-07, IMERG
    2025-09, MCD64A1 2026-09). Section 15b writes `data/interim/logs/verify_report.json`; section 16 also downloads
    `run_summary.json` and `verify_report.json`.
  - **Python version:** the pinned versions in `pipeline/requirements.txt` need Python 3.12 or later (numpy 2.5.4 has no
    wheel for 3.10 or 3.11). The README said "3.10+"; corrected in `README.md`.
  - **Colab notes from the first Colab run:** (1) pip prints red "ERROR: pip's dependency resolver..." lines about Colab's
    own packages (google-colab, tensorflow, gradio, numba, datasets, gcsfs). Expected and harmless; no restart needed.
    (2) The optional HydroBASINS download answered HTTP 403 in Colab. HydroBASINS is optional (only for
    `AMAZON_BOUNDARY = "hydrobasins_basin"`); the notebook cell is being changed to warn and continue.
- 2026-11-15: reproducibility check `pipeline/verify.py` (P-018) and P-035 pipeline text.
  - **What verify does:** compares every JSON and PNG file in `web/server/data/` and `web/public/data/` (150 files) with
    the version committed in git HEAD (extracted with `git archive`; the working tree is not touched). Each file gets
    one result: IDENTICAL, ROUNDING (only numbers differ, within the tolerance; expected between Windows and Linux),
    TEXT (numbers and yes/no values match, only texts differ) or DIFFERENT (a number beyond the tolerance, a yes/no value
    that flips, a missing value, a list of another length, or a missing file). Exit code 1 if any file is DIFFERENT.
    Options: `--ref <path>`, `--report file.json`, `--rtol` (default 0.001 = 0.1 %).
  - **Tests:** an unchanged tree gives 150 IDENTICAL. A copy with planted changes is caught: a flipped significance, a
    changed slope, an edited text, one changed PNG pixel and a missing file.
  - **Level 1 result:** `python -m pipeline.trends` re-run from the committed files gives the same results: all 11,738
    numbers of the changed files and every significance flag identical; only the expected texts changed (147
    IDENTICAL, 3 TEXT). No download needed.
  - **Notebook:** new section 15b runs `pipeline.verify --report verify_report.json`; the notebook has 43 cells.
  - **Colab storage (Alexis, 2026-11-15):** section 3 keeps `data/interim/` (1,629 files, 1.9 GB) on the Colab disk
    instead of Google Drive: faster writes and reads during the exports, no Drive access. Trade-off: a stopped session
    loses the intermediate files and restarts from section 1. Every pipeline cell starts with `%%time`, so a Colab run
    records how long each step takes (recorded under P-018). The downloads from NASA (about 80 GB) never went to Drive,
    so this change does not shorten them.
  - **Trend method text (P-035):** `trends.py` writes "NDVI units per decade" and "EVI units per decade" in the method
    text (`trends/ndvi.json`, `trends/evi.json`) and in `validation.json` `trendChecks`. `variables.json` keeps
    "unitless per decade" because the frontend formats it.

- 2026-11-15: phones, trend legend title hidden under the map (José, screenshot at about 516 px). The bar under the
  map had a fixed 48 px; the trend legend (three rows) only just fit, and with a slightly larger font it overflowed
  upwards and the map covered its title. The loss legend at 320 px overflowed too (61 px). The bar now has
  `min-height: 48px` and grows with its legend. Checked at 320, 516 and 767 px, with the normal font and at 125 %,
  on the trend and loss maps: the legend stays inside the bar, no sideways scroll; desktop has no such bar.
- 2026-11-15: phones, map credits crowding the Filters bar (José). The credits took two or more full-width lines right
  above the Filters bar. Now they take one compact line (cut with "…") that opens in full on a tap. Checked at 360 × 640
  and 320 × 568 (one 18 px line, clear of the readout and the bar, no sideways scroll) and on desktop (unchanged), on
  `build:real` (105 tests at the time; 112 web tests now); lint and types clean. This also covers the "credit over the legend title" part of P-034.
- 2026-11-15: phones, opening a square (José). The first tap showed the readout and only a second tap opened the file,
  which was hard to discover. The readout now has an "Open this area's file" button (44 px tall); the second tap still
  works. Checked at 375 px with a touch tap (readout, button reachable, the file opens and the button goes away) on
  `build:real` (105 tests at the time; 112 web tests now); lint and types clean. Mouse and keyboard are unchanged.
- 2026-11-15: P-033 and two parts of P-035 fixed (José).
  - **P-033:** the area summary no longer drops clear trends. It names the first three (falling first), counts the rest
    and lists them under "Other clear trends". Checked on r12c16 (the temperature rise, +0.58 °C per decade, now
    shows) and r11c16 (6 clear trends: 3 named, 3 listed).
  - **P-035:** the Cross-checks sentence says "tree cover loss map"; "unitless per decade" no longer appears (Method
    text and legend title: "no units"). The drift-years question stays open for the team.
  - **Verified** on `build:real` (105 tests at the time; 112 web tests now), lint and types clean, English and Spanish, 375 px in dark mode, keyboard
    (the "Other clear trends" list opens with Enter).
- 2026-11-15: first-visit guide (design B, José), for the challenge's "simple definitions" and "demo examples".
  - **What:** a four-step tour over the real interface plus three demo cases that open the map already set up; English
    by default, Spanish with ES. Numbers from `validation.json`, none computed in the browser (`check:layers` passes).
  - **Verified** on `build:real` (105 tests pass at the time; 112 web tests now), lint and types clean: desktop 1440 and 1280 px (light), 375 px
    (dark, Spanish), keyboard (focus on each step, Tab wraps, Escape closes), first visit opens once and not again on
    reload, the Guide button reopens it, La Pampa opens square r08c09 on the loss trend. No console errors.
  - **Not touched:** `cellView.ts` (P-033), `ValidationPanel.tsx` and the legend (P-034, P-035).
- 2026-11-15: the team logo in the top bar and as the favicon (Kiara, approved by José).
  - **What:** the pixel-art leaf logo (proposal 02 "Hoja Cartografica", generated with Gemini; source and every
    version in Drive, `docs/design-system/marca/logo/`) replaces the text "SIGNO". `SignoLogo.tsx` draws it as inline
    SVG at 122×32 px (2× its 61×16 grid); its colours are in `index.css` (`.signo-logo`, with a dark set). The Vite
    favicon is replaced by the 8×8 leaf, which switches colours with `prefers-color-scheme`.
  - **AI rule:** declared in the README (*Use of AI*) and in each file's header. The team decided the logo, as SVG code,
    carries no watermark.
- 2026-11-15: texts stuck on "loading…" and a blank map under a page translator.
  - **Problem:** José saw "Rainfall: loading…" next to a loaded verdict in the area viewer. Rendering, not data: every
    API file loaded (200). With a page translator active, React updated text nodes the translator had replaced, so the
    old text stayed on screen. On the map view the translator also made React crash (blank page).
  - **Fix:** `lib/translationGuard.ts` (no crash), and every text that changes is the only child of its own element:
    area trends, legend title and ends, opacity, yearly-values line, Trends chart title and source, zone readout, method
    findings and rules, alpha in Method, in the area values and in the Trends lead.
  - **Verified** on `build:real` with a simulated translator (every text node wrapped in `<font>` as it appears),
    compared with a clean copy: map, area, trend map, loss map, Trends (two zones), Cross-checks, Method, in English and
    Spanish, on load and after changing years, variable and opacity. No stale text and no errors. Lint and types pass.
- 2026-11-15: one layout rule for Trends, Cross-checks and Method & sources (José). They had different widths (1200,
  1040 and 760 px), so the margins jumped between tabs. Now all three share the 1200 px container and the same margins;
  text uses the full width. Checked at 1440, 1024 and 375 px, with no horizontal scroll. The Map view stays full width.
  - **Line-length caps removed (José).** A first version capped paragraphs at 75 characters; José removed it. The same
    kind of cap was also removed everywhere else: Trends header, lead, findings and footnote (62, 68 and 80 characters)
    and the area viewer's summary and case text (70 characters). No `max-width` in `ch` is left in the CSS.
- 2026-11-15: a tab opened across a deploy no longer goes blank.
  - **Problem:** opening Trends, Cross-checks or Method after a deploy asked for a file of the previous build (404), and
    the page went blank. Seen in production.
  - **Fix:** `lib/lazyView.ts` reloads once; on a second failure `ViewLoadError` shows a message with a reload button.
  - **Verified** on `build:real` with the Method file removed: one reload, then the message (no loop); with the file
    back, the reload button opens the view. No console errors.
- 2026-11-15: Spanish interface (ADR-007).
  - **Default and switch:** English by default; ES in the top bar (`?lang=es`).
  - **What was checked:** every view and the area viewer, in Spanish and in English.
    - In Spanish, no interface text in English is left; only API texts are (P-038).
    - In English, no Spanish appears.
  - **Verified:** the build with real data, lint, keyboard, dark mode, 375 px, and no console errors.
  - **Ids:** PR #2 moved the frontend items of PR #1 to P-033–P-035, so the design-system item keeps P-030. The
    language items are P-037 and P-038.
- 2026-11-15: "Present" (presentation mode) button removed at José's request; for the pitch the team uses the browser zoom.
- 2026-11-15: lighter site and fewer requests (approved by José).
  - **One file per square for the area viewer:** `cells/{cellId}.json` (`CellBundle`) holds each variable's yearly values
    and the square's trend row. Opening a square was 5 series files plus the 5 whole trend layers (about 55 kB compressed,
    to read one row of each); now it is one file of about 1 kB compressed (9 kB raw). The monthly points stay in
    `series/{variable}/{cell}.json` and load only on "Show monthly values". Built by `web/server/cellBundle.ts` (3 tests).
  - **Cache:** `/assets/` (hashed names, fonts included) 1 year and immutable; `/api/` 1 hour plus a day of
    stale-while-revalidate; `/data/` 1 day. After a deploy a returning visitor can see the previous data for up to an hour.
  - **Fonts (P-015):** served by the site from the Fontsource packages (SIL OFL 1.1), no Google Fonts request.
  - **Not done:** rounding `cover.json`. Its values already have 1–2 decimals; rounding saves about 2 %. Splitting it by
    measure would save about 100 kB on the first map load but changes the contract for every view; José decides.
  - Pending ids P-030 to P-032 of the data review collided with the design-system P-030 and were renumbered P-033 to P-035.

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
  (LST trend to 2020; day LST published to 2026-10 on the evening of 15 Nov; night LST still cut at 2020-12; Aqua not used), D1 (GLDAS ET as climate context only) and six-month semesters
  H1 = January–June, H2 = July–December. P-019 and P-020 updated; the NDVI reliability rule and the masking of
  implausible values stay open (P-020).
- 2026-11-15: MOD44B, MCD64A1, Hansen and GRACE added to the pipeline (`tiles.py`, `hansen.py`, `grace.py`), and the
  output steps `export_maps.py` and `validate.py` written. GRACE done; the other three downloads in progress.
- 2026-11-15: 2020 validation sample files deleted (448 MB); their months are kept in `data/interim/`.
- 2026-11-15: P-022, MOD44B (26 years), MCD64A1 (311 months), Hansen v1.13 (16 tiles, canopy-weighted loss) and GRACE processed; exports, 129 map layers and validation written. MOD44B vs Hansen r = 0.88 (2000), change r = -0.72; 56 % of Amazon loss in burned cells; La Pampa detected without fire. Results in `pipeline/README.md`, *Cross-validation*.
- 2026-11-15: merge of `origin/main` (layered app, static API, GIBS map, interface redesign) with the data pipeline. Pending items renumbered: P-018 Colab, P-019 data limits, P-020 quality rule; P-021 (full monthly run) and P-022 (export and validation) are done.
- 2026-11-15: P-017. The Drive design-system core (`03 Proyectos IA/SIGNO/docs/design-system`) is filled.
  - `tokens.json` holds the decided values, with aliases to `web/src/index.css`.
  - Cards 01, 04 and 05 are accepted; cards 02, 03, 06 and 07 are drafts (P-030).
  - `ds-validar`: 0 errors and 0 warnings.
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
- 2026-11-15: Colab notebook written (16 sections, including `export_cover`). Not yet run end to end. The file was removed from the repository on 15 Nov, night.
- 2026-11-15: data review (Opus). Its limits are in `pipeline/README.md`, *Known limits*, and in `data/README.md`.
- 2026-11-15: documentation updated for the above (README, `data/`, `pipeline/`, `notebooks/`, `web/server/data/`, `.ai-context/`).
