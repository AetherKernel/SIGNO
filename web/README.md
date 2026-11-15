<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and extended on 2026-11-15 (interface, trend views); reviewed by the team. -->

# SIGNO web app

Static web app built with React 19, Vite 8 and TypeScript, deployed on Vercel. The stack is decided in ADR-003
([`.ai-context/04-decisions-adr.md`](../.ai-context/04-decisions-adr.md)). The browser reads only a read-only, versioned
API (`/api/v1/…`) and one static file (the country borders). It never runs the data pipeline.

## Status (15 Nov 2026)

| Area | State |
|---|---|
| Interface | Four views: the map (filters, squares, area viewer), Trends, Cross-checks, and Method & sources. The trend test is applied (ADR-006): the Trend type of the map, the zone trends and the trust checks are published with the pipeline data |
| Checks | 102 backend unit tests, lint, layer check, type check, mock and real builds, and a local serve of `/`, the manifest and the optional files |
| Live site | Real data: Vercel builds with `npm run build:real` (pipeline export) since 2026-11-15 |
| Not built | Raster overlays (P-024); the forest-context charts and the small multiples of the Trends view (P-026) |
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
| `npm test` | none | 102 backend unit tests in six files |
| `npm run lint` | none | oxlint |

Each run replaces `web/public/api/v1/` (git-ignored), so the last command decides which data the local site serves.

Internet is needed for the NASA GIBS map tiles and the Google Fonts. Without it the trend and tree cover squares still
work, the map shows a warning, and the fonts fall back to system fonts.

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
     Move the year slider and press **Play**.
   - **Area viewer.** Click a square (or press Enter on a focused one). Check the summary, **What changed from A to B**
     (the difference is B minus A), the tree cover charts (MODIS 2025 is drawn as a hollow dot), **Trends in this area**
     and **Exact values**. Change the years with **From** and **To**, or with `[` and `]`. Press Esc to close.
   - **Documented case.** On a first visit, the filters offer **Start with a documented case: La Pampa gold mining, Peru**.
     It opens the La Pampa square with its reference.
   - **Trends (`?view=trends`).** Switch the zone. Choose a measure in the table: its chart shows the yearly values and the
     Sen line; for greenness and temperature, a thin bar per year also shows the lowest and highest month. Check **How the test works and how we checked it** and the
     **Check numbers for every measure** table.
   - **Cross-checks (`?view=checks`).** Click a hotspot: the map opens on tree cover loss at the peak year, with the square
     open.
   - **Method & sources (`?view=method`).** Check the method, the significance level, the sources with their DOIs, and the
     limits.
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
| `/api/v1/trends/{variable}.json` | `TrendLayer` | always | per cell: slope per decade, raw p-value, `significant` (after the correction), Sen line; the method; summary counts |
| `/api/v1/series/{variable}/{cell}.json` | `CellSeries` | always | monthly points, six-month `semesters`, calendar years `annual` |
| `/api/v1/cover.json` | `CoverLayer` | `extras.cover` | yearly Hansen and MODIS tree cover, Hansen loss, burned area, flags; per cell `trends` for loss and MODIS tree cover; `trendMethod` |
| `/api/v1/validation.json` | `ValidationReport` | `extras.validation` | descriptive cross-checks per zone and documented cases (no p-values there); `trendChecks` (drift check D1, checks V1–V4) |
| `/api/v1/zones.json` | `ZonesReport` | `extras.zones` | per zone: yearly values, lowest and highest month per year, zone trend (no correction), cell counts |
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
uses Hansen; MODIS (MOD44B) is in the area viewer and the cross-checks. **Tree cover loss** and **Burned area**: one year at
a time. **Trend**: NDVI, EVI, daytime temperature, rainfall, burned area, Hansen tree cover loss and MODIS tree cover, in
slope colours per decade (orange falling, purple rising). Dotted squares are not significant. The colour scale ends at
the 90th percentile of the significant slopes; when squares go beyond it, the legend marks the end with "≤" or "≥" and
gives the real range of the coloured squares. Opacity defaults: 55 % for
tree cover, 70 % for trend, 80 % for loss and burned area (adjustable).

**Area viewer** (a dialog over the map). A summary; the documented-case note (La Pampa, with its 0.05° numbers and the
MAAP reference) or the hotspot note; year travel (From, To, play, `[` and `]`); what changed from A to B, in each
measure's units; the tree cover, loss and burned charts; the trends in this area; the exact values; and links (open in
Trends, the square's JSON files, copy link).

**Trends view.** The headline numbers, the table and the chart of the zones come from `zones.json`. "Clear trend" is the
zone test, one test per zone and measure, not corrected for multiple tests. The counts of squares are corrected (false
discovery rate 5 %). Satellite drift years (NDVI, EVI, daytime temperature after 2020) are greyed.

**Copy rules** (the views keep them):

- The pipeline decides significance. The browser shows the backend's verdicts and counts. The only arithmetic is the
  difference of two backend values in the area viewer (B minus A).
- A trend is a pattern in the measurements. No page names a cause.
- Hansen loss is stand-replacing loss (fire, logging, mining, clearing), not deforestation.
- Loss and fire in the same square show where they coincide, not that one caused the other.
- Hansen tree cover cannot rise (regrowth is not counted). MODIS reads lower over dense forest, so it confirms where cover
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
| Satellite drift after 2020 (NDVI, EVI, temperature) | Trends view (greyed years, note in the table and the chart) |
| Loss is not deforestation; no cause identified | Trends view, area viewer, Method limits |
| Same place is not the same cause | Area viewer, Cross-checks, Method limits |
| MODIS and Hansen differ in level; suspect MODIS 2025 | Area viewer (hollow dot, note), Method limits |
| Coarse squares (1°); zoom adds no detail | Method limits |
| A documented case is diluted at 1° | Area viewer case note (La Pampa) |
| Region boundary is provisional | Method & sources (P-008); the map crop is the bounding box |
| Base map and borders are for orientation | Map filters, Method sources |

## Pending

| ID | Item |
|---|---|
| P-024 | Raster overlays (fire blocks and 0.05° detail from the PNGs, through `rasters.json`). Not built |
| P-026 | UX plan partly implemented. Not built: the forest-context charts and the small multiples of the Trends view; the 17 questions of the plan are open |
| P-025 | Browser check at 375 px, in dark mode, with the keyboard and the console, covering the map, the area viewer and the Trends view |
| P-028 | Team confirmation of ADR-006 (José and Kiara) |
| P-029 | Comparison with NASA Giovanni, and a confidence interval for the slope (not in the product yet) |
| P-013 | Land cover from MapBiomas: not added (a data decision with Alexis) |
| P-014 | Crop to the real Amazon boundary (after P-008) |
| P-015, P-016 | Self-host the fonts; place names over the map (the country borders are drawn since 15 Nov, the labels are not) |

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
