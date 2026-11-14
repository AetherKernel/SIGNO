# 5. Pending (tech debt)

| ID | Priority | Item | Why | Approach |
|---|---|---|---|---|
| P-002 | High | Decide method and final variables | Problem and region decided (01); web stack decided (ADR-003) | Variables after Alexis's data exploration; method by the team; record in 01 and 02, ADR if formal |
| P-008 | High | Define the exact boundary of "the Amazon" | The map, the data clipping and the results depend on it | Choose the hydrological basin or the forest biome; take the boundary from a published source (e.g. HydroSHEDS for the basin, RAISG for the biome), check its license and cite it |
| P-003 | High | Earthdata Login for every member | Required to download NASA data | Each member signs up at urs.earthdata.nasa.gov |
| P-004 | Medium | Cite every dataset and reference in README | Space Apps rule; needed for global awards | Add each source as it is used |
| P-005 | Medium | Final AI-usage statement | Space Apps AI rule | Update README "Use of AI" before submission |
| P-009 | High | Replace the mock with Alexis's pipeline export | The site shows synthetic data (flagged "Sample data") | Pipeline writes `web/server/data/` per its README; build with `SIGNO_DATA_SOURCE=files` locally, then set it in Vercel and redeploy (ADR-004) |
| P-011 | Low | Remove unused template files | `web/src/App.css`, `web/src/assets/`, `web/public/icons.svg` are dead code | Delete with the owner's OK |
| P-007 | High | Validation plan for the trend test | Judges reward validated methods (2025 "Best Use of Data" winner); Validity criterion | Show the method does not invent trends where there are none, finds trends already documented in the literature, and matches NASA Giovanni for the same area; the team defines the concrete checks |

## Done

- 2026-11-14: repository cloned outside Drive and documented (ADR-001).
- 2026-11-14: P-001, repository made public (Space Apps links must open without login).
- 2026-11-14: layered architecture with static API v1 and swappable data source (ADR-004).
- 2026-11-14: P-010, 26 backend unit tests (`npm test`), run in every build.
- 2026-11-14: P-006, Vercel project deployed by José at <https://signo-chi-pink.vercel.app/>; checked without
  cookies (HTTP 200, no login redirect), no console errors, no horizontal scroll at 375 px.
