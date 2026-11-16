<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and extended on 2026-11-15 from source checks; reviewed by the team. -->

# Data

Only this file is versioned: `data/raw/`, `data/interim/` and every `.zip` are git-ignored. Every dataset below
must be downloaded by whoever runs the pipeline, from the source listed here. This keeps the public repository
light and free of data whose license does not allow redistribution, and keeps the analysis reproducible.

The fastest route is the pipeline (see `pipeline/README.md`): `python -m pipeline.download` gets the four monthly NASA
products, clips them to the Amazon and deletes each global file. The four sources added on 2026-11-15 (MOD44B, MCD64A1,
GRACE, Hansen) have their own commands in the same file. Only the boundary files are downloaded by hand.

Facts below were checked on 2026-11-14 against the official catalog pages (NASA Earthdata/CMR, GES DISC, LP DAAC and
each provider's site). The sources added on 2026-11-15 were checked that day; their NASA citations come from CMR.
Re-check versions and latest dates before a new run.

## Quick start: what you must create and provide

1. **Create by hand (only this):**

```
data/
└── raw/
    └── boundaries/
        ├── Biomas_2025.zip          # REQUIRED: RAISG biome (manual download, terms of use) — https://www.raisg.org/en/download/biomes/
        └── hybas_sa_lev03_v1c.zip   # OPTIONAL: only if AMAZON_BOUNDARY = "hydrobasins_basin" in pipeline/config.py — https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_sa_lev03_v1c.zip
```

Keep the original file names: the pipeline finds the zips by name anywhere under `data/raw/`. If you redirect logs as in
`pipeline/README.md` (`> data/interim/logs/<PRODUCT>.log`), create `data/interim/logs/` first. The shell needs it; the pipeline does not.

2. **Provide outside the repo:** an Earthdata Login account (<https://urs.earthdata.nasa.gov>) with the
   **NASA GESDISC DATA ARCHIVE** application approved, and your credentials in `~/_netrc` (Windows) or `~/.netrc`.
   Never put credentials inside the repo.

3. **Do not create these; the pipeline creates them itself:**
   - `data/raw/<PRODUCT>/`: temporary global files and tiles, deleted after each step.
   - `data/raw/boundaries/ne_10m_admin_0_countries.zip`: Natural Earth, downloaded automatically.
   - `data/raw/HANSEN/` and `data/raw/GRACE/`: temporary.
   - Everything in `data/interim/`: clips, 0.05° statistics, Hansen, GRACE and masks.

   Approximate volume: about 80 GB transferred in total, about 1.9 GB kept in `data/interim/`. The run order is in
   `pipeline/README.md` (step 8, `python -m pipeline.trends`, runs last).

   After the two manual items above, `python -m pipeline.run_all` runs everything in order: downloads, exports, trend test and the check in item 5.

4. **Git ignores these** (already in `.gitignore`, nothing to add): `/data/raw/`, `/data/interim/` and every `*.zip`.
   Only `data/README.md` is versioned in this folder. The results the web app reads are versioned elsewhere:
   `web/server/data/` and `web/public/data/`.

5. To check a fresh run against the committed results, compare the regenerated files in `web/server/data/` and
   `web/public/data/` with the repository versions. Run `python -m pipeline.verify` to do this comparison (see `pipeline/README.md`, *Reproduce and verify*).

## Before you start

1. Create a free **Earthdata Login** account: <https://urs.earthdata.nasa.gov>.
2. In your Earthdata profile, go to *Applications → Authorized Apps → Approve More* and approve
   **NASA GESDISC DATA ARCHIVE** (needed for GLDAS and IMERG).
3. Save your credentials in a netrc file outside the repository (`C:\Users\<user>\_netrc` on Windows, `~/.netrc` on
   Linux and macOS), never in code. See `pipeline/README.md`.

## Study area

- **Clip box:** lat −21° to 10.5°, lon −80° to −43° (`pipeline/config.py`). The earlier box (lat −20° to 9°,
  lon −80° to −44°) cut every published boundary: the basin reaches −20.48° S and the RAISG biome 10.02° N.
- **Exact boundary:** pending team decision P-008 (basin or biome). The pipeline uses the RAISG biome for now and
  can switch with one setting. Candidate sources are listed under *Boundaries* below.
- **Zones exported:** whole Amazon, Brazilian Amazon, Peruvian Amazon (Amazon polygon AND country polygon).

## NASA datasets

The four monthly products are NASA open data ("openly shared, without restriction", [EOSDIS Data Use Policy](https://earthdata.nasa.gov/earth-observation-data/data-use-policy)),
require Earthdata Login, and are hosted in Earthdata Cloud (AWS us-west-2). Outside AWS us-west-2, download over HTTPS (the earthaccess default).
The three NASA sources added on 2026-11-15 (below) are also open data and use Earthdata Login.

| Variable | Product (short name, version) | Grid · step | Period available | Format · size | DOI |
|---|---|---|---|---|---|
| Greenness (NDVI, EVI) | `MOD13C2` v061, MODIS/Terra Vegetation Indices Monthly L3 Global 0.05Deg CMG | 0.05° · monthly | 2000-02 → 2026-10 | HDF4-EOS, ~100 MB per global file | [10.5067/MODIS/MOD13C2.061](https://doi.org/10.5067/MODIS/MOD13C2.061) |
| Land surface temperature | `MOD11C3` v061, MODIS/Terra LST/Emissivity Monthly L3 Global 0.05Deg CMG | 0.05° · monthly | 2000-02 → 2026-10 | HDF4-EOS, ~74 MB per global file | [10.5067/MODIS/MOD11C3.061](https://doi.org/10.5067/MODIS/MOD11C3.061) |
| Evapotranspiration, soil moisture | `GLDAS_NOAH025_M` v2.1, GLDAS Noah Land Surface Model L4 monthly 0.25° | 0.25° · monthly | 2000-01 → 2026-07 (early product to 2026-09) | NetCDF4, ~23 MB per global file | [10.5067/SXAVCZFAQLNO](https://doi.org/10.5067/SXAVCZFAQLNO) |
| Precipitation | `GPM_3IMERGM` v07, GPM IMERG Final Precipitation L3 1 month 0.1° | 0.1° · monthly | 1998-01 → **2025-09** (V07 ends here; V08 not yet released) | HDF5, ~18–30 MB per global file | [10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07) |
| Tree cover (% tree, non-tree vegetation, bare ground) | `MOD44B` v061, MODIS/Terra Vegetation Continuous Fields Yearly L3 Global 250 m SIN Grid | 250 m tiles → 0.05° · yearly | 2000–2025 (year Y = early March Y to early March Y+1) | HDF4, 21 sinusoidal tiles per year, ~1.3 GB per year | [10.5067/MODIS/MOD44B.061](https://doi.org/10.5067/MODIS/MOD44B.061) |
| Burned area | `MCD64A1` v061, MODIS/Terra+Aqua Burned Area Monthly L3 Global 500 m SIN Grid | 500 m tiles → 0.05° · monthly | from 2000-11 (this run: to 2026-10) | HDF4, 21 tiles per month, ~51 MB per month | [10.5067/MODIS/MCD64A1.061](https://doi.org/10.5067/MODIS/MCD64A1.061) |
| Terrestrial water storage | `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4`, JPL GRACE/GRACE-FO mascons RL06.3 v04, CRI filtered | 0.5° · monthly | 2002-04 → 2026-09 (259 months; 35 missing) | NetCDF, one global file, 44 MB | [10.5067/TEMSC-3JC634](https://doi.org/10.5067/TEMSC-3JC634) |

### How to get each one

| Product | Server-side clip to the box? | Practical route | Total volume (≈2000–2026) |
|---|---|---|---|
| MOD13C2 | **No** (no Harmony service; not in AppEEARS) | `earthaccess.search_data(short_name="MOD13C2", version="061")`, download global files, clip in Python, delete the global file | ~30 GB downloaded, much less after clipping |
| MOD11C3 | **No** (same as above) | `short_name="MOD11C3", version="061"`, same route | ~24 GB downloaded, ~0.8 GB after clipping (estimate) |
| GLDAS_NOAH025_M | **Yes**, NASA Harmony (bbox, variable and time subsetting) | `harmony-py` with the box, or `earthaccess` + clip | small once clipped |
| GPM_3IMERGM | **Yes**, NASA Harmony | `harmony-py` with the box, or `earthaccess` + clip | small once clipped |
| MOD44B | Not used (tiles are clipped in Python) | `earthaccess` search per year over the box (21 tiles), `pipeline/tiles.py`; tiles deleted after aggregating | ~33 GB downloaded, one year (~1.3 GB) on disk at a time |
| MCD64A1 | Not used (same as above) | `earthaccess` search per month over the box (21 tiles), `pipeline/tiles.py`; tiles deleted after aggregating | ~16 GB downloaded, one month (~51 MB) on disk at a time |
| GRACE mascons | Not applicable (one global file) | `earthaccess` by short name, `pipeline/grace.py`; the file is clipped to the box, then deleted | 44 MB |
| Hansen GFC | Not applicable (GeoTIFF tiles) | HTTPS from `storage.googleapis.com`, no login; `pipeline/hansen.py` downloads `treecover2000` and `lossyear` per 10° tile | ~8.6 GB (16 tiles, two layers); each tile's files are deleted after aggregating |

Reading notes:

- **MOD13C2 / MOD11C3 are HDF4.** In tests, `pyhdf` reads them; `rasterio`'s pip wheel has no HDF4 driver. The files
  have no lat/lon arrays: the grid is the global 0.05° CMG (3600 × 7200). Scale factors are applied by hand
  (NDVI/EVI × 0.0001, fill −3000; LST × 0.02 K, fill 0).
- **IMERG** stores `precipitation` in mm/hr with dimensions ordered (time, lon, lat).
- **GLDAS** `Evap_tavg` is in kg m⁻² s⁻¹; `ESoil_tavg`, `ECanop_tavg` and `Tveg_tavg` are in W m⁻².
- **MOD44B and MCD64A1** are HDF4 sinusoidal tiles, read with `pyhdf`. Each 250 m (MOD44B) or 500 m (MCD64A1) pixel
  goes to the 0.05° cell that contains its centre. MOD44B water (value 200) and fill (253) pixels are excluded.
- **GRACE** is one NetCDF file; the variable `lwe_thickness` (cm of equivalent water thickness) is used.
- **Hansen** tiles are 30 m GeoTIFFs, read with `rasterio` (which has no HDF4 driver, but reads GeoTIFF). Each 0.05°
  cell is 200 × 200 Landsat pixels.

### Known caveats (the team decides how to handle them)

- **Cloud cover.** MODIS LST exists only for clear-sky pixels; in wet months it is biased toward the few clear days
  ([Ermida et al. 2019](https://doi.org/10.1029/2018JD029354)). MOD13C2 has *pixel reliability* and *VI Quality*
  layers; MOD11C3 has `QC_Day`/`QC_Night` and clear-sky coverage layers.
- **Terra orbit drift.** Terra's overpass has drifted earlier: measured on the full series, 10.54 h local solar time
  through 2020 and 8.94 h in 2026 (see `pipeline/README.md`, *Validation*). NASA says the effect on products is still
  being assessed. Team decision (2026-11-15): daytime LST is published to 2026-10 (real NASA data), but its trend uses 2001–2020 only; the drift years from 2021 are shown with a "?" mark and not tested. Night LST is still cut at 2020-12; it is not in the web API (it is in `amazon_monthly.json`). An earlier overpass reads cooler daytime LST. Amazon yearly daytime LST: 2020 28.0 °C; 2021–2025 27.4, 27.4, 27.7, 27.6 and 26.1 °C. The 2025 drop of about 2 °C goes the wrong way for a drought (2023–2024 were record drought and heat years), which points to the overpass-time effect rather than real cooling; it is not proof. Layer
  `Day_view_time` records the observation time. Aqua twin `MYD11C3` v061 ([10.5067/MODIS/MYD11C3.061](https://doi.org/10.5067/MODIS/MYD11C3.061))
  starts 2002-07. Terra and Aqua are expected to stop in late 2026 or early 2027
  ([NASA notice](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs)).
- **Greenness artifacts over the Amazon.** Apparent dry-season greening has been attributed to sun-sensor geometry
  ([Morton et al. 2014](https://doi.org/10.1038/nature13006)) and to cloud/aerosol contamination
  ([Samanta et al. 2010](https://doi.org/10.1029/2009GL042154)). NDVI saturates over dense canopy (MOD13 ATBD).
- **GLDAS does not see deforestation.** Noah uses static land cover and a 1985–1989 greenness climatology
  ([GLDAS vegetation parameters](https://ldas.gsfc.nasa.gov/gldas/vegetation-parameters)), so its ET follows weather
  only. Team decision (2026-11-15): GLDAS ET is climate context only, not a forest indicator. GLDAS-2.1 forcing also changed in Mar 2001 and Jun 2025 ([README_GLDAS2](https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/GLDAS_NOAH025_M.2.1/doc/README_GLDAS2.pdf)).
  An observation-based alternative is `MOD16A2GF` v061 ([10.5067/MODIS/MOD16A2GF.061](https://doi.org/10.5067/MODIS/MOD16A2GF.061)):
  500 m, 8-day, sinusoidal tiles, to 2025-12, roughly 150–200 GB for the region (estimate).
- **IMERG** combines TRMM-era and GPM-era inputs; V07 reprocessed the record to improve consistency
  ([V07 release notes](https://gpm.nasa.gov/sites/default/files/2024-12/IMERG_V07_ReleaseNotes_241126.pdf)).
- **Tree cover (MOD44B).** A 250 m estimate, averaged per 0.05° cell over land pixels only. In the 2000 test over the
  Amazon the mean is 64.0 %, and dense forest reads about 79–85 %, not 100 %.
- **Burned area (MCD64A1).** Only mapped pixels count (unmapped and water are left out). In the August 2010 test,
  about 52,000 km² burned inside the Amazon polygon.
- **GRACE water storage.** 35 of the 294 months from 2002-04 to 2026-09 have no solution: GRACE battery gaps, and
  2017-07 to 2018-05 between the two missions. The values are the mascon estimates as published; the JPL land scale
  factors are not applied.
- **Hansen tree cover and loss.** The Hansen tiles start at 10° N, so the strip from 10.0° N to the box edge (10.5° N)
  has no Hansen data. The Amazon biome itself reaches only 10.02° N.
- **Hansen loss is stand-replacing loss,** not only deforestation: fire, logging, mining and clearing all count. Loss
  years before and after 2011 are not comparable. Hansen reprocessed its loss from 2011 onward, not for 2001–2010, and its
  user notes say that "users will notice inconsistencies as a result". Landsat 8 is used from 2013 and Landsat 9 from 2022.
  "Care must be taken when comparing change across any interval"; the data are "a relative indicator of spatiotemporal
  trends", and "definitive area estimation should not be made using pixel counts" (Hansen/UMD, GFC v1.13 user notes:
  <https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>). The loss is tested as one trend
  from 2011 to 2025 (ADR-009; 2001–2010 is shown, not tested). Hansen-derived tree
  cover has no regrowth, so it can only fall.
- **MOD44B 2025 is anomalous.** The Amazon mean falls from 62.2 % to 59.2 % in one year, while Hansen falls by 0.4
  points. The cover file flags it. MOD44B shows where loss happens, not how much: its year-to-year noise is 1–2 points.
  See `pipeline/README.md`, *Known limits*.
- **Fire co-location** is partly circular (canopy killed by fire counts as loss) and is not causation.
- **Agreement and change r values** are descriptive. They carry no p-value, and neighbouring cells are not independent.

## Boundaries (P-008)

Download into `data/raw/boundaries/`, keeping the original file names (the pipeline finds the zips by file name
anywhere under `data/raw/`). **Do not commit** any of these
unless its license allows redistribution. The pipeline needs `Biomas_2025.zip` (RAISG) and/or
`hybas_sa_lev03_v1c.zip` (HydroBASINS), depending on `AMAZON_BOUNDARY` in `pipeline/config.py`. For the same license reason, the web maps are not cut to the boundary
(see `web/README.md`).

Country polygons for the Brazil and Peru zones: **Natural Earth 1:10m Admin 0 Countries**
([ne_10m_admin_0_countries.zip](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip),
public domain, <https://www.naturalearthdata.com>). The pipeline downloads it by itself into `data/raw/boundaries/` if it is missing.

Measured on the 0.05° grid (2026-11-14), area of each Amazon polygon by country, km²:

| Country | RAISG biome | HydroBASINS basin |
|---|---|---|
| Brazil | 4,211,543 | 3,697,961 |
| Peru | 786,914 | 966,810 |
| Bolivia | 481,058 | 717,789 |
| Colombia | 480,125 | 341,912 |
| Venezuela | 469,613 | 53,779 |
| Guyana | 211,891 | 13,047 |
| Suriname | 145,732 | 186 |
| French Guiana | 83,935 | 62 |
| Ecuador | 80,847 | 131,029 |
| **Total** | **6,981,204** | **5,926,323** |

The basin practically leaves out Suriname, French Guiana and Guyana; the biome includes all nine.

| Source | Type | Download (no login) | License | Can be committed? |
|---|---|---|---|---|
| HydroBASINS v1c, level 3 South America, `PFAF_ID 622` (Amazon river basin; Tocantins is 624 apart) | Basin | [hybas_sa_lev03_v1c.zip](https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_sa_lev03_v1c.zip) (2.7 MB) | HydroSHEDS v1 License, no stand-alone redistribution; required credit "© World Wildlife Fund, Inc. (2006-2022)" ([TechDoc](https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf)). Cite Lehner & Grill 2013, doi:10.1002/hyp.9740 | No |
| BasinATLAS v10 (HydroATLAS) | Basin (same polygons) | [hydrosheds.org/hydroatlas](https://www.hydrosheds.org/hydroatlas) (2.5–4 GB) | CC BY 4.0, cite Linke et al. 2019, doi:10.1038/s41597-019-0300-6 | Yes, with attribution (a clipped subset) |
| RAISG *Cuencas 2025* | Basin (appears to include Araguaia-Tocantins) | [raisg.org/en/download/basins](https://www.raisg.org/en/download/basins/) | [RAISG terms](https://www.raisg.org/en/terms-of-use/): non-commercial, unaltered, registered users | No |
| RAISG *Biomas 2025*, record "Amazonía" | Biome | [raisg.org/en/download/biomes](https://www.raisg.org/en/download/biomes/) | RAISG terms | No |
| Eva & Huber 2005 (JRC), *A proposal for defining the geographical boundaries of Amazonia* | Biogeographic | [zip](https://forobs.jrc.ec.europa.eu/static/amazon/amazonia_boundary_proposal_Eva_2005.zip) | No license stated ("all rights reserved") | No |
| RESOLVE Ecoregions 2017 | Ecoregions (team selects the Amazon ones) | [Ecoregions2017.zip](https://storage.googleapis.com/teow2016/Ecoregions2017.zip) (~150 MB) | CC BY 4.0, cite Dinerstein et al. 2017, doi:10.1093/biosci/bix014 | Yes, with attribution |

Checked extents and coverage: the HydroBASINS Amazon basin spans lon −79.6 to −50.3, lat −20.5 to 5.3; the RAISG
biome spans lon −79.5 to −43.6, lat −18.2 to 10.0. The basin practically leaves out Suriname, French Guiana and
Guyana, which drain straight to the Atlantic; the RAISG biome includes all nine (per-country table above).

## Independent reference data (validation and context)

| Dataset | Coverage | Access | License | Citation |
|---|---|---|---|---|
| Hansen/UMD Global Forest Change v1.13 (2000–2025), 30 m. **Used** by `pipeline/hansen.py` (treecover2000 and lossyear, 16 tiles from 10° N to 20° S, 80° W to 50° W) | Global | [download page](https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html), no login | CC BY 4.0; credit "Source: Hansen/UMD/Google/USGS/NASA" | Hansen et al. 2013, doi:10.1126/science.1244693 |
| MapBiomas Amazonía Collection 6 (1985–2023), 30 m | 9 countries | [amazonia.mapbiomas.org](https://amazonia.mapbiomas.org/) | CC BY 4.0 | MapBiomas Amazonía ATBD 6.0 |
| NASA FIRMS active fires (MODIS since 2000-11, VIIRS since 2012) | Global | [archive download](https://firms.modaps.eosdis.nasa.gov/download/), Earthdata Login or email code | NASA open data | doi:10.5067/FIRMS/MODIS/MCD14ML |
| INPE PRODES / DETER (TerraBrasilis) | Brazil only | [download](https://terrabrasilis.dpi.inpe.br/en/download-2/) | CC BY-SA 4.0 (portal) | TerraBrasilis citation page |
| INPE PRODES, Brazilian Legal Amazon, yearly clear-cut (`PRODES_AMAZON_KM2` in `pipeline/config.py`); PRODES year = August to July; clear-cut of primary forest of at least 6.25 ha. Used for the Hansen check only | Brazilian Amazon | [INPE press release, 16 Oct 2026](https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/brasil-alcanca-menores-taxas-de-desmatamento-da-serie-historica-na-amazonia-e-no-cerrado) | Not checked yet: check INPE's terms before redistributing | INPE, "Série Histórica Taxas Prodes Amazônia", Apresentação Coletiva Prodes 2026, 16 Oct 2026, p. 4 |
| MINAM Geobosques forest loss (2001–2025) | Peru only | [geobosques.minam.gob.pe](https://geobosques.minam.gob.pe/) | not verified | MINAM annual reports |
| MAAP reports on La Pampa, Madre de Dios (e.g. MAAP #233, Sep 2025) | Case studies | [maapprogram.org](https://www.maapprogram.org/?p=26475) | not verified (cite only) | by report number |

## Data added by team members

Record here every extra file a team member downloads, so others can repeat it.

| Date | Who | Dataset and version | Exact source (URL, query, tool) | Saved as | License / citation |
|---|---|---|---|---|---|
| 2026-11-14 | Alexis | MOD13C2 v061, MOD11C3 v061, GLDAS_NOAH025_M v2.1, GPM_3IMERGM v07: March and August 2020 (validation sample) | Earthdata Search, <https://search.earthdata.nasa.gov>, temporal filter 2020-03-01 to 2020-08-31 | `data/raw/<SHORT_NAME>/` | NASA open data, citations in README |
| 2026-11-14 | Alexis | RAISG Biomas 2025 | <https://www.raisg.org/en/download/biomes/> | `data/raw/boundaries/Biomas_2025.zip` | RAISG terms of use |
| 2026-11-14 | Alexis | HydroBASINS v1c level 3 South America | <https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_sa_lev03_v1c.zip> | `data/raw/boundaries/hybas_sa_lev03_v1c.zip` | HydroSHEDS v1 License |
| 2026-11-14 | Pipeline (automatic) | Natural Earth 1:10m Admin 0 Countries (`ne_10m_admin_0_countries.zip`) | <https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip>, downloaded by `pipeline/` when missing | `data/raw/boundaries/ne_10m_admin_0_countries.zip` | Public domain (Natural Earth) |
| 2026-11-14 | Alexis | Full run 2000–2026, four products: MOD13C2 v061 (321 months, 2000-02 to 2026-10), MOD11C3 v061 (321, 2000-02 to 2026-10), GLDAS_NOAH025_M v2.1 (319, 2000-01 to 2026-07), GPM_3IMERGM v07 (309, 2000-01 to 2025-09). Status: complete, all months, none missing | `pipeline/download.py`, one process per product: `--products <PRODUCT> --start 2000-01 --end 2026-10` (see `pipeline/README.md`) | Clips in `data/interim/<SHORT_NAME>/<YYYY-MM>.nc`; logs in `data/interim/logs/<SHORT_NAME>.log` | NASA open data, citations in README |
| 2026-11-15 | Alexis | Cleanup: the eight 2020 sample files of the four monthly products (448 MB) deleted. Their months are kept in `data/interim/` | Local files only | Deleted | — |
| 2026-11-15 | Alexis | MOD44B v061, yearly 2000–2025, 21 tiles per year. Status: done (26 years) | `pipeline/tiles.py --product MOD44B --start 2000 --end 2025` (earthaccess, short name, v061, bounding box) | `data/interim/MOD44B/<YYYY>.nc`; tiles deleted after each year | NASA open data, citation in README |
| 2026-11-15 | Alexis | MCD64A1 v061, monthly 2000-11 → 2026-09, 21 tiles per month. Status: done (311 months; 2026-10 not yet published by NASA) | `pipeline/tiles.py --product MCD64A1 --start 2000-11 --end 2026-10` (earthaccess, short name, v061, bounding box) | `data/interim/MCD64A1/<YYYY-MM>.nc`; tiles deleted after each month | NASA open data, citation in README |
| 2026-11-15 | Alexis | TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4 (RL06.3 v04, CRI). Status: done (259 months, 35 missing) | `pipeline/grace.py` (earthaccess, short name) | `data/interim/GRACE/tws.nc`; global file deleted | NASA open data, citation in README |
| 2026-11-15 | Alexis | Hansen/UMD GFC v1.13 (2000–2025), treecover2000 and lossyear, 16 tiles. Status: done (16 tiles) | `pipeline/hansen.py` (HTTPS from `storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/`, no login) | `data/interim/HANSEN/tiles/<tile>.npz` and `data/interim/HANSEN/gfc_v1.13.nc`; GeoTIFFs deleted | CC BY 4.0; Hansen et al. 2013 |

## Layout

Folders marked (git-ignored) are created by the pipeline except data/raw/boundaries/ (see Quick start).

```
data/
├── README.md                    # this file (the only versioned file)
├── raw/                         # as downloaded (git-ignored)
│   ├── <SHORT_NAME>/            # monthly NASA global files; download.py deletes them after clipping
│   ├── MOD44B/<YYYY>/           # MOD44B tiles of one year; tiles.py deletes them after aggregating
│   ├── MCD64A1/<YYYY-MM>/       # MCD64A1 tiles of one month; deleted after aggregating
│   ├── GRACE/                   # GRACE global NetCDF; deleted after clipping
│   ├── HANSEN/                  # Hansen GeoTIFFs of one tile (.part while downloading); deleted after aggregating
│   └── boundaries/              # boundary zips: Biomas_2025.zip, hybas_sa_lev03_v1c.zip, ne_10m_admin_0_countries.zip
└── interim/                     # re-created by the pipeline (git-ignored)
    ├── <SHORT_NAME>/<YYYY-MM>.nc   # clipped, cleaned month (MOD13C2, MOD11C3, GLDAS_NOAH025_M, GPM_3IMERGM)
    ├── MOD44B/<YYYY>.nc            # tree cover per 0.05° cell, one product year
    ├── MCD64A1/<YYYY-MM>.nc        # burned share per 0.05° cell, one month
    ├── HANSEN/tiles/<tile>.npz     # Hansen result per 10° tile (resumable)
    ├── HANSEN/gfc_v1.13.nc         # Hansen cover 2000 and loss share per year, 0.05° grid
    ├── GRACE/tws.nc                # water storage anomaly, 0.5° grid, one entry per month
    ├── logs/<SHORT_NAME>.log       # download and clip log, one per product
    └── masks/                      # zone masks per grid
```

The light results are not here. They are the JSON files, `maps/` and `validation.json` in `web/public/data/`, and the
API source in `web/server/data/` (`region.json`, `variables.json`, `trends/`, `series/`, `cover.json`,
`validation.json`). Both folders are meant to be versioned; committing them is a team decision (P-023). See
`web/README.md` and `web/server/data/README.md`.
