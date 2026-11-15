# SIGNO

**Team AETHER** (Peru) · NASA Space Apps Challenge 2026 · Challenge: *Be An Earth System Trend Detective!* ·
Local event: Lima.

SIGNO looks for real, long-term change in Earth system variables using NASA data, and tries to tell that change
apart from noise.

**Live prototype:** <https://signo-chi-pink.vercel.app/>

> Status (15 Nov 2026): NASA and Hansen data for 2000–2026 is processed, clipped to the Amazon, cross-checked and
> exported to the web app's API source (`web/server/data/`) ([`pipeline/README.md`](pipeline/README.md)). The team's
> trend test is applied (ADR-006): the app shows where each measure rose or fell, with the test's own checks. The live
> prototype is built from this export (real data, no sample-data notice). Team confirmation of ADR-006 and the
> browser check of the interface are pending (`.ai-context/05-tech-debt.md`, P-028 and P-025).

## Repository layout

```
SIGNO/
├── .ai-context/   # Living project docs: 01 logic · 02 architecture · 03 data · 04 decisions (ADRs) · 05 pending · 06 API
├── CLAUDE.md      # Working rules for the AI coding assistant (in Spanish)
├── data/          # Not versioned, except data/README.md: where to download every dataset
├── docs/          # Internal planning documents (Spanish)
├── notebooks/     # Google Colab notebook that runs the whole pipeline
├── pipeline/      # Python: download → clip to the Amazon → clean → exports for the web → trend test and validation
├── web/           # The app deployed on Vercel (Root Directory)
│   ├── shared/    # Data contract (types) and API route map, used by both layers
│   ├── server/    # Backend: data sources (mock / pipeline files), validation, API v1 publisher
│   ├── src/       # Frontend (React + TypeScript): services → hooks → components
│   └── scripts/   # Architecture guard (layer boundaries)
│   ├── server/data/   # Pipeline export in the API contract (versioned; built with SIGNO_DATA_SOURCE=files)
│   └── public/data/   # Extra pipeline outputs: zone series JSON, map PNGs, validation.json, borders.json (versioned)
├── LICENSE        # Apache License 2.0
└── README.md
```

## Architecture

The backend reads the data through a swappable source, validates it against the shared contract and publishes a
read-only, versioned **static API** (`/api/v1/manifest.json`, `/api/v1/trends/{variable}.json`,
`/api/v1/series/{variable}/{cell}.json`, `/api/v1/cells/{cell}.json`, and the optional `cover.json`, `validation.json`, `zones.json` and
`rasters.json`). The frontend only talks to that API; the country borders are a static file. The live site is built from
the pipeline export (`npm run build:real`, `dataStatus: real`); `npm run build` keeps clearly labelled **synthetic
sample data** for development. The pipeline's export format is in
[`web/server/data/README.md`](web/server/data/README.md); the switch is the environment variable
`SIGNO_DATA_SOURCE=files`, which `npm run build:real` sets. Details: [`.ai-context/02-architecture.md`](.ai-context/02-architecture.md) and
[`.ai-context/06-api-mcp.md`](.ai-context/06-api-mcp.md).

Run it locally (Node.js 22.18 or later):

```bash
cd web
npm install
npm run dev
```

`npm run build` publishes the API from the sample data, runs the unit tests, checks the layer boundaries and types,
and builds the site. To use the pipeline data instead, run `npm run dev:real` or `npm run build:real` (they need the
exported files in `web/server/data/` and `web/public/data/maps/`). The local check, step by step, is in
[`web/README.md`](web/README.md).


Reproduce the data (Python 3.10+, an Earthdata Login account; steps and order in [`pipeline/README.md`](pipeline/README.md)):

```bash
python -m venv .venv && .venv/Scripts/python -m pip install -r pipeline/requirements.txt
python -m pipeline.download --start 2000-01 --end 2026-10   # four monthly products: downloads, clips, deletes global files
python -m pipeline.tiles --product MOD44B --start 2000 --end 2025         # tree cover tiles
python -m pipeline.tiles --product MCD64A1 --start 2000-11 --end 2026-10  # burned area tiles
python -m pipeline.hansen                                   # Hansen forest cover and loss (no login)
python -m pipeline.grace                                    # GRACE water storage
python -m pipeline.export_json                              # writes web/public/data/*.json
python -m pipeline.export_maps                              # writes web/public/data/maps/
python -m pipeline.export_api                               # writes web/server/data/ (API source for the web app)
python -m pipeline.export_cover                             # writes web/server/data/cover.json (after export_api)
python -m pipeline.validate                                 # writes validation.json in web/public/data/ and web/server/data/
python -m pipeline.trends                                   # step 8: trend test (run last; re-running steps 3 to 7 removes its results)
python -m pipeline.export_borders                           # step 9: country borders, web/public/data/borders.json
```

Downloaded data is not versioned (`data/raw/`, `data/interim/`, `*.zip`). [`data/README.md`](data/README.md)
explains where to download each dataset, including the boundary files that must be fetched by hand.

## Method

**The question.** For each 1° square of the Amazon (566 squares) and for three zones (the whole Amazon, Brazil and Peru),
the test asks whether a measure changed over the years more than its year-to-year variation explains. A change is called
clear only when the test says so, after a correction for testing hundreds of squares at once.

**How it works.**

1. **One value per year.** Each year becomes one number: the average of its 12 months (greenness, temperature) or the total
   (rainfall, burned area). A year counts only when all 12 months are there. The seasons therefore do not enter the test.
2. **Mann–Kendall test.** It asks whether the yearly values tend to go up or down, and gives a p-value.
3. **Sen slope.** The size of the change per decade: the median of the slopes between all pairs of years, so a few odd
   years barely move it.
4. **Many squares at once.** For the squares, the Benjamini–Hochberg false discovery rate is applied per measure, with a
   significance level of 0.05. The zone results are not corrected (there are three zones).
5. **Rules fixed before the first run.** A square needs at least 80 % of its years. If more than 20 % of the squares of a
   measure show year-to-year memory, a variant of the test that allows for it is used (none did). Two satellite checks:
   NDVI and EVI end in 2020, because the Terra satellite's overpass time drifts with them (r = 0.85), and daytime
   temperature ends in 2020 by a team rule for the same drift. MODIS tree cover 2025 is excluded because it is flagged
   as suspect.

| Measure | Years tested | Source |
|---|---|---|
| Greenness (NDVI, EVI) | 2001–2020 | NASA MODIS MOD13C2 |
| Daytime surface temperature | 2001–2020 | NASA MODIS MOD11C3 |
| Rainfall | 2001–2024 | NASA GPM IMERG |
| Burned area | 2001–2025 | NASA MODIS MCD64A1 |
| Tree cover loss (km² per year) | 2001–2025 | Hansen/UMD Global Forest Change (Landsat) |
| Tree cover, MODIS | 2000–2024 | NASA MOD44B |

Hansen tree cover itself is not tested: it can only go down, because regrowth is not counted, so a test would be biased.

**Key results (first run, 15 Nov 2026; `web/server/data/validation.json` is the source).**

- Squares with a clear rise and fall: daytime temperature rose in 429 squares and fell in none; NDVI rose in 158 and fell
  in 48; EVI rose in 68 and fell in 3; rainfall fell in 69 and rose in none; tree cover loss rose in 318 and fell in 20;
  MODIS tree cover fell in 135 and rose in 27; burned area rose in 27 and fell in 20.
- Whole Amazon (zone test, not corrected): daytime temperature rose by about 0.33 °C per decade and EVI rose, both clearly;
  MODIS tree cover fell clearly; NDVI did not change clearly.
- Checks: with the years shuffled, almost no square is flagged (at most 0.18 % of squares for burned area, none for the
  other measures). A made-up trend of the typical size is found in 53 to 92 % of the squares on average, depending on the
  measure.
- Known place: La Pampa (gold mining, Madre de Dios) has tree cover loss that rises clearly and MODIS tree cover that falls
  clearly, but the 1° square averages a much larger area, so the change looks diluted.

**Limits.**

- A trend is a pattern in the measurements. It does not establish a cause. Loss includes fire, logging, mining and clearing,
  not only deforestation.
- A change that is not clear is not proof that nothing changed: the check with made-up trends shows that the test misses
  a part of them.
- Squares of 1° are coarse, and neighbouring squares are not independent. No confidence interval of the slope is published
  yet, and the comparison with NASA Giovanni is not done (`.ai-context/05-tech-debt.md`, P-029).
- The Mann–Kendall p-value ignores the gap of a missing year (only burned-area squares have one). The slope uses the real years.
- The numbers above are the first run. A re-run can change them slightly; the validation file is the source.

Details, the checks V1–V4 and the zone table: [`pipeline/README.md`](pipeline/README.md) (*Trend test*) and
[`.ai-context/01-logic.md`](.ai-context/01-logic.md) (*Method*), with the decision in
[`.ai-context/04-decisions-adr.md`](.ai-context/04-decisions-adr.md) (ADR-006).

## Data sources

Datasets used by the pipeline (15 Nov 2026). Access details, versions, periods and caveats, and the candidates not used
yet: [`data/README.md`](data/README.md).

**NASA data**

- Didan, K. (2021). *MODIS/Terra Vegetation Indices Monthly L3 Global 0.05Deg CMG V061* [Data set]. NASA EOSDIS
  Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD13C2.061
- Wan, Z., Hook, S., Hulley, G. (2021). *MODIS/Terra Land Surface Temperature/Emissivity Monthly L3 Global 0.05Deg
  CMG V061* [Data set]. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD11C3.061
- Beaudoing, H., Rodell, M., NASA/GSFC/HSL (2020). *GLDAS Noah Land Surface Model L4 monthly 0.25 x 0.25 degree
  V2.1* [Data set]. Goddard Earth Sciences Data and Information Services Center (GES DISC).
  https://doi.org/10.5067/SXAVCZFAQLNO
- Huffman, G. J., Stocker, E. F., Bolvin, D. T., Nelkin, E. J., Tan, J. (2023). *GPM IMERG Final Precipitation L3
  1 month 0.1 degree x 0.1 degree V07* [Data set]. GES DISC. https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07
- DiMiceli, C., Sohlberg, R., Townshend, J. (2022). *MODIS/Terra Vegetation Continuous Fields Yearly L3 Global 250m
  SIN Grid V061* [Data set]. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD44B.061
- Giglio, L., Justice, C., Boschetti, L., Roy, D. (2021). *MODIS/Terra+Aqua Burned Area Monthly L3 Global 500m SIN
  Grid V061* [Data set]. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MCD64A1.061
- Wiese, D. N., Yuan, D.-N., Boening, C., Landerer, F. W., Watkins, M. M. (2023). *JPL GRACE and GRACE-FO Mascon
  Ocean, Ice, and Hydrology Equivalent Water Height CRI Filtered RL06.3Mv04* [Data set]. NASA Physical Oceanography
  DAAC (PO.DAAC). https://doi.org/10.5067/TEMSC-3JC634

**Other data**

- Hansen, M. C., Potapov, P. V., Moore, R., Hancher, M., Turubanova, S. A., Tyukavina, A., Thau, D., Stehman, S. V.,
  Goetz, S. J., Loveland, T. R., Kommareddy, A., Egorov, A., Chini, L., Justice, C. O., Townshend, J. R. G. (2013).
  High-Resolution Global Maps of 21st-Century Forest Cover Change. *Science* 342: 850–853.
  https://doi.org/10.1126/science.1244693. Data: Global Forest Change v1.13 (2000–2025, GFC-2025), credit "Source:
  Hansen/UMD/Google/USGS/NASA", CC BY 4.0, https://glad.earthengine.app/view/global-forest-change

**Tools:** [earthaccess](https://github.com/nsidc/earthaccess), [NASA Harmony](https://harmony.earthdata.nasa.gov/),
[NASA Giovanni](https://giovanni.gsfc.nasa.gov/) (planned comparison, not yet done; P-029). Statistics:
[pymannkendall](https://github.com/mmhs013/pymannkendall) (Hussain and Mahmud, 2019, *Journal of Open Source Software*
4(39): 1556, https://doi.org/10.21105/joss.01556) and [statsmodels](https://www.statsmodels.org) (false discovery rate,
Benjamini and Hochberg, 1995, *Journal of the Royal Statistical Society B* 57(1): 289–300).

**Boundaries** (final Amazon boundary pending; see `data/README.md`, *Boundaries*)

- RAISG (2025). *Biomas 2025* [shapefile]. Red Amazónica de Información Socioambiental Georreferenciada.
  https://www.raisg.org/en/download/biomes/ (used under the RAISG terms of use; not redistributed)
- Lehner, B., Grill, G. (2013). Global river hydrography and network routing: baseline data and new approaches to
  study the world's large river systems. *Hydrological Processes* 27(15): 2171–2186. https://doi.org/10.1002/hyp.9740.
  This product incorporates data from the HydroSHEDS version 1 database which is © World Wildlife Fund, Inc.
  (2006-2022) and has been used herein under license. (not redistributed)
- Natural Earth. *1:10m Cultural Vectors, Admin 0 – Countries*. Public domain. https://www.naturalearthdata.com
  (the country borders drawn on the map, `web/public/data/borders.json`)

**Python libraries:** numpy, xarray, netCDF4, h5py, pyhdf, pyshp, shapely, earthaccess, pandas, rasterio, pillow,
pymannkendall, statsmodels (versions in `pipeline/requirements.txt`).

**Base map imagery (context only, not analysed).** We acknowledge the use of imagery provided by services from NASA's
Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS): Blue Marble
Next Generation, MODIS Terra Corrected Reflectance (true colour) and MODIS Terra NDVI (monthly), served at
<https://gibs.earthdata.nasa.gov>.

**Software and fonts.** Map engine: [Leaflet](https://leafletjs.com) (BSD-2-Clause). Icons:
[Tabler Icons](https://tabler.io/icons) (MIT). Data colour scale: ColorBrewer PuOr (Cynthia Brewer, Penn State). Fonts
under the SIL Open Font License: Source Serif 4, Source Sans 3 (Adobe) and JetBrains Mono (JetBrains), served by the site
itself from the [Fontsource](https://fontsource.org) packages.

## Use of AI

The team uses AI tools to speed up the work, following the Space Apps rules: AI is not used to come up with how to
solve the challenge, and design decisions are made by the team.

- **Claude (Anthropic), via Claude Code:** set up this repository's structure and documentation, and wrote the web
  app's code to the team's architecture brief: the shared contract, the backend (data sources, validation, API
  publisher), the frontend and the synthetic mock data. It also implemented the interface of 15 Nov 2026 following the
  visual decisions made by José (concept, palette, type, layout, user journey), and the Spanish version of the
  interface (texts translated by Claude; English stays the default). Each of those files starts with a header comment
  saying so.
- **Claude (Anthropic), via Claude Code (data side):** checked candidate data sources (existence, access, license,
  citation) and drafted `data/README.md` and `notebooks/README.md` (marked with a header comment). It wrote the data
  pipeline in `pipeline/` (download, clipping, unit conversion, zone averages, and on 2026-11-15 the modules
  `tiles.py`, `hansen.py`, `grace.py`, `export_maps.py`, `export_api.py`, `export_cover.py` and `validate.py`, plus the
  Colab notebook `notebooks/signo_pipeline_colab.ipynb`; every file carries a header comment), following the team's
  choices of region, zones, datasets, periods and six-month semesters. `validate.py` computes descriptive cross-checks.
- **The trend test (ADR-006), written with Claude (Anthropic) via Claude Code on 2026-11-15:** `pipeline/trends.py` (the
  test, the slopes, the false discovery rate, the checks V1–V4 and `zones.json`), `pipeline/test_trends.py` (7 tests on
  synthetic series) and `pipeline/export_borders.py` (country borders). The team chose the method, the variables, the
  periods, the pre-registered rules and the validation plan. Where the team left a parameter open, the value comes from
  the team's kit and was delegated to Claude: the Sen slope, the false discovery rate per variable, the significance level
  of 0.05, the 80 % rule for complete years and 20 shuffles with a fixed seed. Each file has a header comment.
- **Models by task (15 Nov 2026), all via Claude Code:**
  - **Claude Opus 5.5:** the data review, the integration plan, and the review of the trend code.
  - **Claude Sonnet 5.5:** `export_api.py`, `export_cover.py`, the changes to `validate.py`, the trend code and
    `export_borders.py`, the extension of the web contract and server (six-month periods, cover, validation, zones and
    raster endpoints), and the interface changes.
  - **Claude Haiku 5.5:** the documentation.
  - The models are tools. They follow the team's decisions on datasets, region, periods, quality rules and the
    statistical method. The interface was reviewed for design and usability with the `frontend-design` and
    `ui-ux-pro-max` skills (local, not versioned).
- **Gemini (Google):** literature and data-source exploration.

Any code or data generated with AI carries a header comment saying so. Images and videos generated with AI carry a
visible watermark.

## License

Original content in this repository is released under the [Apache License 2.0](LICENSE).
