<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and extended on 2026-11-15 (interface, trend views); reviewed by the team. -->

# SIGNO web app

Static web app built with React 19, Vite 8 and TypeScript, deployed on Vercel. The stack is decided in ADR-003
([`.ai-context/04-decisions-adr.md`](../.ai-context/04-decisions-adr.md)). The browser reads only a read-only, versioned
API (`/api/v1/…`) and one static file (the country borders). It never runs the data pipeline.

## Status (15 Nov 2026)

| Area | State |
|---|---|
| Interface | Four views: the map (filters, squares, area viewer), Trends, Cross-checks, and Method & sources. The trend test is applied (ADR-006), with Hansen loss tested as one trend, 2011–2025, with all years shown, and one tree cover (Hansen) in the interface (ADR-009). The interface follows one rule set (one answer per measure; a "?" mark where a known limit affects a value): the Trend type of the map, the zone trends and the trust checks are published with the pipeline data, and every trend has a 95 % confidence interval |
| Checks | 112 backend unit tests, lint, layer check, type check, mock and real builds, and a local serve of `/`, the manifest and the optional files |
| Live site | Real data: Vercel builds with `npm run build:real` (pipeline export) since 2026-11-15 |
| Not built | Raster overlays (P-024): `rasters.json` is served, but no view reads it yet; the forest-context charts and the small multiples of the Trends view (P-026) |
| Not done yet | Browser check at 375 px, in dark mode, with the keyboard and in the console (P-025) |

## Commands

Run them inside `web/`. Node.js 22.18 or newer (`package.json` says `22.x`; Node 24 works and prints an npm engine
warning).

| Command | Data | What it does |
|---|---|---|
| `npm ci` | none | Installs the exact versions in `package-lock.json` |
| `npm run dev` | sample (mock) | Publishes the API from the sample source, then starts Vite on http://localhost:5173 |
| `npm run dev:real` | pipeline export | Same, from `web/server/data/` and `web/public/data/maps/` |
| `npm run build` | sample | Publishes the API, checks layers, runs tests and type check, builds the site |
| `npm run build:real` | pipeline export | Same as `build`, with the pipeline export |
| `npx vite preview` | last build | Serves the production build on http://localhost:4173 |
| `npm test` | none | 112 backend unit tests in seven files |
| `npm run lint` | none | oxlint |

Each run replaces `web/public/api/v1/` (git-ignored), so the last command decides which data the local site serves.

Internet is needed only for the NASA GIBS map tiles. The fonts are served by the site itself (Fontsource packages, SIL
OFL 1.1). Without internet the trend and tree cover squares still work and the map shows a warning.

Caching (`vercel.json`): build files under `/assets/` for a year (their names change with each build), API files for an
hour plus a day of background refresh, `/data/` for a day.

## Check the views locally

The steps are the same on Windows, macOS and Linux. Run each command on its own line. In Windows PowerShell 5.1 the
`&&` operator does not exist.

1. Install Node.js 22 (22.18 or newer) from nodejs.org, then check it with `node -v`.
2. Get the code and open the app folder:
   ```
   git clone https://github.com/AetherKernel/SIGNO.git
   cd SIGNO/web
   ```
3. Install the dependencies: `npm ci`.
4. Sample data: run `npm run dev` and open **http://localhost:5173**.
   - Expected: a **Sample data** label in the top bar. The map shows the sample trend layer only (no tree cover map: the
     sample source publishes no cover file). The **Trends** view and the **Cross-checks** view say that their data is not
     published yet.
5. Pipeline data: stop the server (Ctrl+C), then run `npm run dev:real` and open **http://localhost:5173** again.
   - Expected: no **Sample data** label. The map opens on **Tree cover** (the default), the **Trend** type is enabled, and
     the **Trends** and **Cross-checks** views have their content.
6. Check each view:
   - **Map (`?view=map`).** Switch between **Tree cover**, **Tree cover loss**, **Burned area** and **Trend**. With
     **Trend**, pick a variable and use **Show** (All, Significant, Falling, Rising): dotted squares are not significant.
     Move the year slider and press **Play**. The legend has a tooltip with the false-positive and detection rates.
   - **Area viewer.** Click a square (or press Enter on a focused one). Check the summary, **What changed from A to B**
     (the difference is B minus A), the tree cover and loss charts (Hansen only, with a dashed marker at 2011), **Trends in this area**
     and **Exact values**. Change the years with **From** and **To**, or with `[` and `]`. Press Esc to close.
   - **Documented case.** On a first visit, the filters offer **Start with a documented case: La Pampa gold mining, Peru**.
     It opens the La Pampa square with its reference.
   - **Trends (`?view=trends`).** Switch the zone. Choose a measure in the table: its chart shows the yearly values and the
     Sen line; for greenness and temperature, a thin bar per year also shows the lowest and highest month. Check **How the test works and how we checked it** and the
     **Check numbers for every measure** table.
   - **Cross-checks (`?view=checks`).** Check the card **Hansen loss vs official deforestation (INPE PRODES)**: it leads with what agrees and explains **Why the trend starts in 2011**. Click a hotspot: the map opens on tree cover loss at the peak year, with the square
     open.
   - **Method & sources (`?view=method`).** Check the method, the significance level, the sources with their DOIs, and the
     limits. The **Code and reproduction** block gives the repository, the Colab link and the commands `python -m pipeline.trends`
     and `python -m pipeline.verify`. The GLDAS rainfall check (r = 0.991) and the region name **Amazon biome (RAISG 2025)**
     (with a tooltip; the outline is not drawn) are there too.
   - **Keyboard.** Tab to the squares: one stop for the whole grid. Arrow keys move between squares, Enter or Space opens
     one. Esc closes the area viewer, and focus returns to the square.
   - **Links.** Copy the link of an area (it keeps `from` and `to`) and open it in a private window. It must show the same
     view (the query parameters are in `.ai-context/02-architecture.md`).
   - **Phone width.** In the browser's device mode at 375 px, the page has no horizontal scroll. The map bar has a
     **Filters** button that opens the filters as a sheet. Wide tables scroll sideways inside their box.
   - **Dark mode.** Set the operating system to dark, then reload.
   - **Console.** No errors. GIBS tile errors are expected when offline.
7. API and static files: open http://localhost:5173/api/v1/manifest.json (expected: JSON that starts with
   `"apiVersion": "v1"`). With `dev:real`, check that `/api/v1/zones.json`, `/api/v1/cover.json`,
   `/api/v1/validation.json` and `/data/borders.json` answer (with the sample `dev` they return 404, as the sample source
   publishes none of them, except `borders.json`). From a second terminal, the HTTP status is `200`:
   - macOS / Linux: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/v1/zones.json`
   - Windows PowerShell: `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5173/api/v1/zones.json`
8. Production build: stop the server, run `npm run build:real`, then `npx vite preview` and open
   http://localhost:4173. Repeat the view checks there.

## Deployment (Vercel)

- Vercel project: repository `AetherKernel/SIGNO`, **Root Directory `web`** (ADR-003).
- Production is deployed from `main`. Each pull request gets a preview URL for team review
  (see [`.ai-context/02-architecture.md`](../.ai-context/02-architecture.md), *Environments*).
- The production URL must open without login (submission rule).
- Vercel runs no long processes (ADR-002). The data pipeline runs outside Vercel, see
  [`pipeline/README.md`](../pipeline/README.md).
- The Vercel project exists (P-006, done 14 Nov). Since 15 Nov it builds the pipeline data: `vercel.json` runs
  `npm run build:real` (P-009, done).

## Data contract

The browser reads only the API. `web/server/buildApi.ts` publishes it from one of two sources, chosen with
`SIGNO_DATA_SOURCE`: `mock` (the default, sample data) or `files` (the pipeline export). Full endpoint list:
[`.ai-context/06-api-mcp.md`](../.ai-context/06-api-mcp.md). Schema and rules for each file:
[`.ai-context/03-database.md`](../.ai-context/03-database.md). Types: `shared/contracts.ts`. Route map: `shared/apiPaths.ts`.

| Endpoint | Type | Served when | Content |
|---|---|---|---|
| `/api/v1/manifest.json` | `Manifest` | always | data status, region, variables with their products, `slopeUnits` and `trendYears`, `extras` (cover, validation, rasters, zones, borders) |
| `/api/v1/trends/{variable}.json` | `TrendLayer` | always | per cell: slope per decade, its 95 % CI (`slopeCi95`), raw p-value, `significant` (after the correction), Sen line; the method; summary counts |
| `/api/v1/series/{variable}/{cell}.json` | `CellSeries` | always | monthly points, six-month `semesters`, calendar years `annual`; the area viewer loads it only for "Show monthly values" |
| `/api/v1/cells/{cell}.json` | `CellBundle` | always | per variable: `units`, yearly `annual` and the cell's `trend` row; the one file the area viewer loads when a square opens |
| `/api/v1/cover.json` | `CoverLayer` | `extras.cover` | yearly Hansen and MODIS tree cover, Hansen loss, burned area, flags; per cell `trends` for loss (`lossKm2`, 2011–2025) and MODIS tree cover; `trendMethod`; `methodChangeYear`, `lossTrendYears`, `hansenNote` |
| `/api/v1/validation.json` | `ValidationReport` | `extras.validation` | descriptive cross-checks per zone and documented cases (no p-values there); `trendChecks` (drift check D1, checks V1–V4, Hansen–PRODES check `hansenConsistency`) |
| `/api/v1/zones.json` | `ZonesReport` | `extras.zones` | per zone: yearly values, lowest and highest month per year, zone trend (no correction; Hansen loss 2011–2025, with its 95 % CI), cell counts |
| `/api/v1/rasters.json` | `RasterIndex` | `extras.rasters` | where the 0.05° map PNGs are; published, but no view reads it yet |
| `/data/borders.json` | GeoJSON (static) | `extras.borders` | country borders for orientation; not part of the API |

The pipeline's full exports sit in `web/public/data/` and are served as static files. The views do not read the
`amazon_*.json` files or this folder's `validation.json`. The server reads only `maps/index.json`, to build `rasters.json`:

| File | Content | Size |
|---|---|---|
| `amazon_monthly.json` | Monthly values per zone (whole Amazon, Brazil, Peru) | 248 kB |
| `amazon_semester.json` | Six-month values per zone | 45 kB |
| `amazon_annual.json` | Yearly tree cover, Hansen loss, burned area | 9 kB |
| `validation.json` | Cross-checks from `pipeline.validate` | 42 kB |
| `borders.json` | Country borders (Natural Earth) | 63 kB |
| `maps/index.json` and `maps/**/*.png` | 0.05° map layers: 129 PNG files in 5 layers | 17.4 MB |

- Never edit these files by hand. They are written by `python -m pipeline.export_json`, `export_maps`, `validate`,
  `export_borders` and, for the trend results, `trends` (see [`pipeline/README.md`](../pipeline/README.md)).
- Known data limits (dates, missing months, which variables are context only) are in `pipeline/README.md`, *Known limits*.
- Rules for code that reads the API: each series has its own months, so do not assume one shared month list. `mean`,
  `total`, `value` and `slopePerDecade` can be `null`, and the UI shows them as gaps or as "not tested", never as zeros.

## The interface

Four views, chosen with `?view=` (map, trends, checks, method). The top bar links them.

| View | What it shows |
|---|---|
| **Map** (default) | Left: filters (map type, trend variable and filter, year and play, square opacity, country borders, base map, legend, first-visit hint). Centre: the map, NASA GIBS imagery under translucent 1° squares, focused on the region (the rest of the continent is veiled; pan and zoom stay inside). Click a square to open the area viewer |
| **Trends** | Zone selector (whole Amazon, Brazilian Amazon, Peruvian Amazon); four headline cards (Hansen tree cover, tree cover loss, daytime temperature, rainfall); a table with one row per measure; a chart for the chosen measure with the Sen line; "What this means"; "How the test works and how we checked it" with the trust checks |
| **Cross-checks** | How the two tree cover sources agree; loss against fire; hotspots and the La Pampa case (MAAP #233 link). A hotspot or the case opens its square on the map |
| **Method & sources** | How the verdict is reached (method, α, what "significant" means); the method of the cover trends; the sources with their DOIs; the limits |

**Map types.** **Tree cover** (default): Hansen canopy cover, six green classes (0–20 to 90–100 % of the square). The map
uses Hansen only; MODIS (MOD44B) is in the cross-checks and the Method view only. **Tree cover loss** and **Burned area**: one year at
a time. **Trend**: NDVI, EVI, daytime temperature, rainfall, burned area and Hansen tree cover loss (2011–2025 on the map), in
slope colours per decade (orange falling, purple rising). Dotted squares are not significant. The colour scale ends at
the 90th percentile of the significant slopes; when squares go beyond it, the legend marks the end with "≤" or "≥" and
gives the real range of the coloured squares. Opacity defaults: 55 % for
tree cover, 70 % for trend, 80 % for loss and burned area (adjustable).

**Area viewer** (a dialog over the map). A summary; the documented-case note (La Pampa, with its 0.05° numbers and the
MAAP reference) or the hotspot note; year travel (From, To, play, `[` and `]`); what changed from A to B, in each
measure's units; the tree cover, loss and burned charts (dashed 2011 marker on the Hansen charts); the trends in this area (the loss trend, 2011–2025); the exact values, with the p-value and α (tooltip) and a 95 % CI column; and links (open in
Trends, the square's JSON files, copy link).

**Trends view.** The headline numbers, the table and the chart of the zones come from `zones.json`. "Clear trend" is the
zone test, one test per zone and measure, not corrected for multiple tests. The counts of squares are corrected (false
discovery rate 5 %). Hansen loss is tested from 2011 (2011–2025 only); the years 2001–2010 are shown, greyed, with an info tooltip, and are not used in the trend. Sen lines are solid when the trend is clear and dashed when it is not. Satellite drift years (NDVI, EVI, daytime temperature from 2021) are greyed. A change that involves a drift year gets a "?" mark.

**Interface rules (15 Nov 2026, for José's review).**

- One row or answer per measure. All values are visible.
- A value or change affected by a known limit carries a "?" mark and a short tooltip. An unclear trend shows its value with "?", its p-value and its CI. A change from A to B that involves a drift year (NDVI, EVI, daytime LST from 2021) gets "?" and the NASA note: the satellite passes earlier, so part of the change may come from the overpass time.
- A clear trend shows its 95 % CI as "(95 % CI a to b)".
- "Months used" is renamed "Months with data (whole series)". Burned area is shown once, in km².
- Every Hansen chart marks 2011 with a dashed line and a tooltip.
- Internal codes (D1, B1, V1, V2, P-008) are removed from the UI. The words for trends are in `src/lib/trendWords.ts`.
- The guide tour texts are updated.
- Tips added on the evening of 15 Nov: a borderline tip on the Brazil and Peru loss trends; a level-shift tip on the
  whole-Amazon loss trend; "squares are not independent" in the squares tip; drift years described as a coincidence in
  time, not proof of cause; V1 and V2 worded as memoryless noise and the same test trend in every square; a note in
  Exact values that the interval is not corrected; one info icon per card.

**Copy rules** (the views keep them):

- The pipeline decides significance. The browser shows the backend's verdicts and counts. The only arithmetic is the
  difference of two backend values in the area viewer (B minus A).
- A trend is a pattern in the measurements. No page names a cause.
- Hansen loss is stand-replacing loss (fire, logging, mining, clearing), not deforestation.
- Hansen loss before and after 2011 is not comparable (Hansen's reprocessing); only 2011–2025 is tested, and the earlier years are shown greyed.
- Loss and fire in the same square show where they coincide, not that one caused the other.
- Hansen tree cover cannot rise (regrowth is not counted). MODIS, shown only in the cross-checks and Method, reads lower over dense forest, so it confirms where cover
  changed, not how much.
- Cross-check statistics are descriptive: r carries no p-value and no significance wording.
- Differences are absolute, in the variable's units (or points, or °C), never a percentage.
- Unitless indices (NDVI, EVI) are labelled by name, not by a unit.

## Known limits shown in the UI

| Limit | Where it is shown |
|---|---|
| Sample data | Top bar label, sample notes in the views (sample data only) |
| Zone tests are not corrected for multiple tests | Trends view (table header, "How the test works") |
| Hansen tree cover cannot rise | Trends view (Hansen card and table note), area viewer caption, Method limits |
| Satellite drift from 2021 (NDVI, EVI, daytime temperature) | Trends view (greyed years, note in the table and the chart), area viewer and map ("?" mark on changes that involve them) |
| Loss is not deforestation; no cause identified | Trends view, area viewer, Method limits |
| Same place is not the same cause | Area viewer, Cross-checks, Method limits |
| MODIS and Hansen differ in level; MODIS 2025 is anomalous | Cross-checks and Method limits (MODIS is not shown elsewhere) |
| Hansen loss before and after 2011 is not comparable | Yearly charts (dashed 2011 marker, InfoTip), Trends view (trend from 2011 only), Cross-checks (PRODES card), Method limits |
| Coarse squares (1°); zoom adds no detail | Method limits |
| Squares are not independent (neighbours share weather years) | Squares tip |
| Hansen loss rises as a level shift from 2016, not a steady climb | Level-shift tip on the whole-Amazon loss trend |
| Brazil and Peru loss trends are borderline | Borderline tip on the Brazil and Peru loss trends |
| A documented case is diluted at 1° | Area viewer case note (La Pampa) |
| Region boundary is provisional | Method & sources (P-008); the map crop is the bounding box |
| Base map and borders are for orientation | Map filters, Method sources |

## Pending

| ID | Item |
|---|---|
| P-024 | Raster overlays (fire blocks and 0.05° detail from the PNGs, through `rasters.json`). `rasters.json` is served (added after the 18:00 freeze of 15 Nov); no view uses it yet |
| P-026 | UX plan partly implemented. Not built: the forest-context charts and the small multiples of the Trends view; the 17 questions of the plan are open |
| P-025 | Browser check at 375 px, in dark mode, with the keyboard and the console, covering the map, the area viewer and the Trends view |
| P-028 | Team confirmation of ADR-006 and ADR-009 (José and Kiara) |
| P-029 | Done (15 Nov): 95 % confidence intervals of the slopes are published and cross-checked against SciPy (`theilslopes`). Still open under P-029: the grid answer A3. The comparison with NASA Giovanni is open under P-007 (C3) |
| P-013 | Land cover from MapBiomas: not added (a data decision with Alexis) |
| P-014 | Crop to the real Amazon boundary (after P-008). Post-deadline option: an outline from a redistributable boundary, e.g. RESOLVE Ecoregions or BasinATLAS (CC BY 4.0) |
| P-016 | Place names over the map (the country borders are drawn since 15 Nov, the labels are not). Post-deadline option: Natural Earth names (public domain); depends on P-008 |

Tracking: [`.ai-context/05-tech-debt.md`](../.ai-context/05-tech-debt.md).

## Layout of the code

| Folder | Responsibility |
|---|---|
| `shared/` | Data contract (`contracts.ts`) and route map (`apiPaths.ts`). No logic |
| `server/` | Data sources (`sources/`), validation, period, year and cover rules, API publisher (`buildApi.ts`) |
| `src/services/` | The only HTTP code |
| `src/hooks/` | Data loading and URL state |
| `src/components/`, `src/App.tsx` | Views only. No `fetch` |
| `src/lib/` | Formatting, colour classes, URL view state, base map config, zone trend presentation (no statistics) |

`npm run check:layers` fails the build if a layer imports what it must not.

**New on 15 Nov (ADR-009):** `src/components/InfoTip.tsx` (the info button with its tooltip), `MethodChangeNote.tsx` (the note that explains the dashed 2011 marker), `HansenConsistencyCard.tsx` (the Cross-checks card for Hansen against INPE PRODES), and `src/lib/hansen.ts` (the 2011 method change as the UI needs it; it reads the published year and ratio and computes nothing), and `src/lib/trendWords.ts` (the words for the trend views and the "?" marks). The `InfoTip` component gained a "?" variant. The contract gained `slopeCi95`, `driftFromYear`, `lossTrendYears`; `validate.ts` checks that the low bound is at most the slope and the slope at most the high bound.
