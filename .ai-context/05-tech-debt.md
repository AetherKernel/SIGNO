# 5. Pending (tech debt)

| ID | Priority | Item | Why | Approach |
|---|---|---|---|---|
| P-002 | High | Decide method and final variables | Problem and region decided (01); web stack decided (ADR-003) | Variables after Alexis's data exploration; method by the team; record in 01 and 02, ADR if formal |
| P-008 | High | Define the exact boundary of "the Amazon" | The map, the data clipping and the results depend on it | Choose the hydrological basin or the forest biome; take the boundary from a published source (e.g. HydroSHEDS for the basin, RAISG for the biome), check its license and cite it |
| P-003 | High | Earthdata Login for every member | Required to download NASA data | Each member signs up at urs.earthdata.nasa.gov |
| P-004 | Medium | Cite every dataset and reference in README | Space Apps rule; needed for global awards | Add each source as it is used |
| P-005 | Medium | Final AI-usage statement | Space Apps AI rule | Update README "Use of AI" before submission |
| P-006 | High | Set up the Vercel project | Public link for the submission (ADR-002) | Tonight (Sat 14): import `AetherKernel/SIGNO` in Vercel with Root Directory `web` (ADR-003), deploy `main`, open the production URL in a private window to confirm there is no login |
| P-007 | High | Validation plan for the trend test | Judges reward validated methods (2025 "Best Use of Data" winner); Validity criterion | Show the method does not invent trends where there are none, finds trends already documented in the literature, and matches NASA Giovanni for the same area; the team defines the concrete checks |

## Done

- 2026-11-14: repository cloned outside Drive and documented (ADR-001).
- 2026-11-14: P-001, repository made public (Space Apps links must open without login).
