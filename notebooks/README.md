<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and updated on 2026-11-15; reviewed by the team. -->

# Notebooks

`signo_pipeline_colab.ipynb` runs the whole pipeline in **Google Colab** (free tier), from download to the files the
web app reads. It can be opened straight from GitHub:

```
https://colab.research.google.com/github/AetherKernel/SIGNO/blob/main/notebooks/signo_pipeline_colab.ipynb
```

**Status: tested end to end in Colab on 15 Nov 2026 (ADR-008): 1 h 22 min, results identical to the repository.** The notebook has 47 cells: sections 1–16, plus 4b, 14b, 14c and 15b.

The notebooks are public, so they must never contain credentials, and their saved outputs must not show them.
Downloaded data is not committed: see [`data/README.md`](../data/README.md) for every source.

## Earthdata credentials in Colab

Store them as Colab **Secrets** (key icon in the left bar, and switch on "Notebook access" for each one):

- `EARTHDATA_TOKEN` (a user token from your Earthdata profile), **or**
- `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`.

Section 2 of the notebook tries the token first, copies the secrets into environment variables and never prints them.
The `python -m` commands inherit them. The login uses `earthaccess`; its valid strategies in version 0.19.0 are
`"interactive"`, `"netrc"` and `"environment"`.

Also check, in your Earthdata profile (*Applications → Authorized Apps*), that **NASA GESDISC DATA ARCHIVE** is
approved. Without it the GLDAS, IMERG and GRACE downloads fail.

## Colab limits to plan around

- Free sessions last at most 12 hours and stop earlier when idle; the Colab disk is wiped when they stop. Section 3
  keeps `data/interim/` on the Colab disk (decided 2026-11-15: faster than Google Drive, no Drive access needed), so
  keep the tab open. If the session stops, start again from section 1. Within a session, re-running a cell skips the
  periods already finished.
- Every pipeline cell starts with `%%time`, so each output ends with the time the step took. The times of the 15 Nov 2026 run are below.
- Colab is not in AWS us-west-2, so data is downloaded over HTTPS (the earthaccess default), not read from S3.
- The two MODIS products (`MOD13C2`, `MOD11C3`) only come as global files. The pipeline downloads each one, clips it to
  the box and deletes the global file, so disk use stays low.
- Section 4b (`run_all`) downloads four sources at a time, as the team's PC did (see `pipeline/README.md`). The optional
  step cells run one after another and take longer.

## Times measured on 15 Nov 2026

Free Colab tier, Python 3.13.18, 115 GB free disk, empty disk at the start (data downloaded again from NASA), section 4b
(`pipeline.run_all`). **Total: 1 h 22 min 10 s.** The download rows run in parallel, so they are not added up. One after
another, the downloads would take about 3 h 50 min.

| Step | Time (h:mm:ss) |
|---|---|
| Downloads, all eight sources, four at a time | 1:13:56 |
| MCD64A1 (slowest source) | 1:13:51 |
| MOD44B | 0:45:00 |
| MOD11C3 | 0:30:30 |
| MOD13C2 | 0:30:00 |
| GLDAS | 0:19:35 |
| GPM_3IMERGM (IMERG) | 0:18:25 |
| Hansen | 0:13:20 |
| GRACE | 0:00:40 |
| export_json | 0:01:32 |
| export_maps | 0:00:26 |
| export_api | 0:01:08 |
| export_cover | 0:00:12 |
| validate | 0:00:12 |
| test_trends | 0:00:04 |
| trends | 0:04:31 |
| export_borders | 0:00:03 |
| verify | 0:00:06 |

Result of `pipeline.verify`: 147 IDENTICAL, 3 TEXT (the P-035 wording), 0 ROUNDING, 0 DIFFERENT, of 150 files.

## The notebook, section by section

Section 4b is the recommended route. Sections 5 to 14c are optional "one step at a time" cells, guarded by
`STEP_BY_STEP = False`, so "Run all" does not run anything twice. Set it to `True` to retry one step.

| Section | What it does | Output |
|---|---|---|
| 1. Get the code | Clones the public repository once per session and installs `pipeline/requirements.txt` | `/content/SIGNO` |
| 2. Earthdata credentials | Copies the Colab Secrets into environment variables | none (variables only) |
| 3. Keep the intermediate data on the Colab disk | Creates `data/interim/` and prints the free disk space (warns under 20 GB) | `/content/SIGNO/data/interim` |
| 4. Boundary files | Downloads HydroBASINS v1c. Stops with a message if `Biomas_2025.zip` (RAISG) has not been uploaded. Natural Earth is downloaded by the pipeline | `data/raw/boundaries/` |
| 4b. Run everything (recommended) | Runs `!python -m pipeline.run_all` with `%%time`: checks, downloads (four sources at a time), exports, trend test and verify. No need to run sections 5 to 14c | All outputs of sections 5 to 14c, plus `data/interim/logs/run_summary.json` and `verify_report.json` |
| 5. Monthly products (optional) | `pipeline.download`, one cell each: MOD13C2 and MOD11C3 (2000-01 → 2026-10), GLDAS_NOAH025_M (→ 2026-07) and GPM_3IMERGM (→ 2025-09) | `data/interim/<PRODUCT>/<YYYY-MM>.nc` |
| 6. MOD44B tiles (optional) | `pipeline.tiles --product MOD44B` (2000–2025) | `data/interim/MOD44B/<YYYY>.nc` |
| 7. MCD64A1 tiles (optional) | `pipeline.tiles --product MCD64A1` (2000-11 → 2026-09) | `data/interim/MCD64A1/<YYYY-MM>.nc` |
| 8. Hansen (optional) | `pipeline.hansen` (16 tiles over HTTPS, no login) | `data/interim/HANSEN/gfc_v1.13.nc` |
| 9. GRACE (optional) | `pipeline.grace` (no retry loop: run the cell again if it fails) | `data/interim/GRACE/tws.nc` |
| 10. JSON exports (optional) | `pipeline.export_json`. Check the months-per-source count it prints before you publish | `web/public/data/amazon_*.json` |
| 11. Map layers (optional) | `pipeline.export_maps` | `web/public/data/maps/` |
| 12. API files (optional) | `pipeline.export_api` | `web/server/data/`: rewrites only `region.json`, `variables.json`, `trends/` and `series/`. Other files there are kept |
| 13. Tree cover per cell (optional) | `pipeline.export_cover` (after section 12) | `web/server/data/cover.json` |
| 14. Cross-validation (optional) | `pipeline.validate` | `web/public/data/validation.json` and `web/server/data/validation.json` |
| 14b. Trend test (step 8, run last) (optional) | `pipeline.test_trends`, `pipeline.trends` | trend results in `web/server/data/trends/`, `cover.json`, `zones.json`, `validation.json` (`trendChecks`); re-run after any re-run of `export_api`, `export_cover` or `validate` |
| 14c. Country borders (optional) | `pipeline.export_borders` | `web/public/data/borders.json` (Natural Earth, public domain) |
| 15. Quick summary | Prints the top-level keys and counts of `validation.json`, and the variables in `variables.json` | none |
| 15b. Check the results | Runs `pipeline.verify`, compares every output file with the committed version and prints IDENTICAL/ROUNDING/TEXT/DIFFERENT per file | `data/interim/logs/verify_report.json` |
| 16. Results back to the repository | Zips `web/public/data` and `web/server/data`, downloads the two zips, and also downloads `run_summary.json` and `verify_report.json` | two zip files, `run_summary.json`, `verify_report.json` |

Section 16 ends with the team's normal workflow: copy the files into a local clone, then branch, review and push. Never
commit the intermediate data, the boundary zips or any credential; only the generated files in `web/public/data/` and
`web/server/data/`.

## How to check that a Colab run reproduces the results

- **Pass:** section 15b reports no DIFFERENT file. IDENTICAL, ROUNDING and TEXT are not failures; DIFFERENT is.
- **Expected differences:** a monthly list can be one item longer if NASA published a month after 15 Nov 2026 inside the
  requested range (for example burned area for 2026-10). Trend results use complete years only, so their numbers should
  still match.
- **Report:** download `verify_report.json` (in `data/interim/logs/`) from the Colab file browser and keep it with your run.
  The 15 Nov 2026 result is recorded in `.ai-context/05-tech-debt.md` (P-018, closed).

## Known messages

- **Red "ERROR: pip's dependency resolver..." lines** during the install (section 1). They are about Colab's own packages
  (google-colab, tensorflow, gradio, numba, datasets, gcsfs). They are expected and harmless; no restart is needed.
- **HTTP 403 for HydroBASINS** (section 4). The optional HydroBASINS download answered 403 in Colab. HydroBASINS is only
  needed when `AMAZON_BOUNDARY = "hydrobasins_basin"`. The cell now warns and continues.

## Open issues

None open for the notebook; see `.ai-context/05-tech-debt.md`.

## Conventions

- Number notebooks in run order: `00_...`, `01_...`.
- First cell: a markdown header with purpose, inputs, outputs and, if any code was generated with AI, a line saying so
  (Space Apps AI rule).
- Second cell: `pip install` of anything Colab does not ship (for example `earthaccess pyhdf harmony-py`).
- Clear outputs that could reveal account details before committing.
