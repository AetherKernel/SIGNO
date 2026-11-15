# 5. Pending (tech debt)

| ID | Priority | Item | Why | Approach |
|---|---|---|---|---|
| P-002 | High | Decide method and final variables | Problem and region decided (01); web stack decided (ADR-003) | Variables after Alexis's data exploration; method by the team; record in 01 and 02, ADR if formal |
| P-008 | High | Define the exact boundary of "the Amazon" | The map, the data clipping and the results depend on it | Choose the hydrological basin or the forest biome; take the boundary from a published source (e.g. HydroSHEDS for the basin, RAISG for the biome), check its license and cite it |
| P-003 | High | Earthdata Login for every member | Required to download NASA data | Each member signs up at urs.earthdata.nasa.gov |
| P-004 | Medium | Cite every dataset and reference in README | Space Apps rule; needed for global awards | Add each source as it is used |
| P-005 | Medium | Final AI-usage statement | Space Apps AI rule | Update README "Use of AI" before submission |
| P-009 | High | Replace the mock with Alexis's pipeline export | The site shows synthetic data (flagged "Sample data") | Pipeline writes `web/server/data/` per its README; build with `SIGNO_DATA_SOURCE=files` locally, then set it in Vercel and redeploy (ADR-004) |
| P-007 | High | Validation plan for the trend test | Judges reward validated methods (2025 "Best Use of Data" winner); Validity criterion | Show the method does not invent trends where there are none, finds trends already documented in the literature, and matches NASA Giovanni for the same area; the team defines the concrete checks |
| P-012 | High | Period comparison values in the area file | The redesign shades a second period in the series, but the mean of each period and their difference must not be computed in the browser | Pipeline or backend publishes the period aggregates; agree the contract change with Alexis. Temperature is compared as an absolute difference, never as a percentage |
| P-013 | Medium | Land cover context in the area file (MapBiomas Amazonía) | José wants Global Forest Watch-style data for the selected area; MapBiomas is 30 m, annual 1985–2023, CC BY-SA, not NASA data | Data decision with Alexis; cite it as complementary and respect share-alike |
| P-014 | High | Crop the map to the real Amazon boundary | Today the crop follows the approximate bounding box (ADR-005) | After P-008, add the boundary geometry to the contract and use it for the crop and the edge |
| P-015 | Low | Self-host the fonts | The UI loads Source Serif 4, Source Sans 3 and JetBrains Mono from Google Fonts (SIL OFL); a venue without internet or privacy rules would fall back to system fonts | Put the woff2 files and their licence in `web/public/fonts` |
| P-016 | Low | Borders and place names over the map | GIBS `Reference_Labels_15m` answered HTTP 500 and painted the map black, so it was removed | Retry another reference layer or a vector boundary once P-008 is decided |
| P-017 | Medium | Fill the Drive design-system core with the decided tokens | Hybrid route chosen by José: 01 essence, 04 colour, 05 type in `tokens.json`, with `css_producto` pointing at `web/src/index.css` | Run `ds-generar` and `ds-validar` in Estudio-Contenido |

## Done

- 2026-11-15: interface redesign.
  - **Map:** one working screen with a GIBS map cropped to the region (ADR-005).
  - **Panels:** a case file panel, an area file panel, and a method and sources drawer.
  - **Design tokens:** José's decisions of 2026-11-14.
  - **Verified:** build, lint, keyboard access, light and dark mode, 375 px, and no console errors.
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
