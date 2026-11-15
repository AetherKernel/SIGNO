<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-14 and updated on 2026-11-15; reviewed by the team. -->

# Notebooks

`signo_pipeline_colab.ipynb` runs the whole pipeline in **Google Colab** (free tier), from download to the files the
web app reads. It can be opened straight from GitHub:

```
https://colab.research.google.com/github/AetherKernel/SIGNO/blob/main/notebooks/signo_pipeline_colab.ipynb
```

**Status (15 Nov 2026): written (16 sections), not yet run end to end.** The open issues are listed at the end of this file.

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

- Free sessions last at most 12 hours and stop earlier when idle; temporary files are deleted when they stop. Section 3
  keeps `data/interim/` in Google Drive, so a new session finds the finished periods and skips them.
- Colab is not in AWS us-west-2, so data is downloaded over HTTPS (the earthaccess default), not read from S3.
- The two MODIS products (`MOD13C2`, `MOD11C3`) only come as global files. The pipeline downloads each one, clips it to
  the box and deletes the global file, so disk use stays low.
- The notebook runs the tile products one after another. The 1 h 10 min measured for those products was with parallel
  runs (see `pipeline/README.md`), so a notebook run takes longer.

## The notebook, section by section

| Section | What it does | Output |
|---|---|---|
| 1. Get the code | Clones the public repository once per session and installs `pipeline/requirements.txt` | `/content/SIGNO` |
| 2. Earthdata credentials | Copies the Colab Secrets into environment variables | none (variables only) |
| 3. Keep the intermediate data in Drive | Mounts Drive, creates `SIGNO_data/interim` there and links `data/interim` to it | `MyDrive/SIGNO_data/interim` |
| 4. Boundary files | Downloads HydroBASINS v1c. Stops with a message if `Biomas_2025.zip` (RAISG) has not been uploaded. Natural Earth is downloaded by the pipeline | `data/raw/boundaries/` |
| 5. Monthly products | `pipeline.download`, one cell each: MOD13C2, MOD11C3, GLDAS_NOAH025_M and GPM_3IMERGM (2000-01 → 2026-10) | `data/interim/<PRODUCT>/<YYYY-MM>.nc` |
| 6. MOD44B tiles | `pipeline.tiles --product MOD44B` (2000–2025) | `data/interim/MOD44B/<YYYY>.nc` |
| 7. MCD64A1 tiles | `pipeline.tiles --product MCD64A1` (2000-11 → 2026-10) | `data/interim/MCD64A1/<YYYY-MM>.nc` |
| 8. Hansen | `pipeline.hansen` (16 tiles over HTTPS, no login) | `data/interim/HANSEN/gfc_v1.13.nc` |
| 9. GRACE | `pipeline.grace` (no retry loop: run the cell again if it fails) | `data/interim/GRACE/tws.nc` |
| 10. JSON exports | `pipeline.export_json`. Check the months-per-source count it prints before you publish | `web/public/data/amazon_*.json` |
| 11. Map layers | `pipeline.export_maps` | `web/public/data/maps/` |
| 12. API files | `pipeline.export_api` | `web/server/data/`: rewrites only `region.json`, `variables.json`, `trends/` and `series/`. Other files there are kept |
| 13. Tree cover per cell | `pipeline.export_cover` (after section 12) | `web/server/data/cover.json` |
| 14. Cross-validation | `pipeline.validate` | `web/public/data/validation.json` and `web/server/data/validation.json` |
| 14b. Trend test (step 8, run last) | `pipeline.test_trends`, `pipeline.trends` | trend results in `web/server/data/trends/`, `cover.json`, `zones.json`, `validation.json` (`trendChecks`); re-run after any re-run of `export_api`, `export_cover` or `validate` |
| 14c. Country borders | `pipeline.export_borders` | `web/public/data/borders.json` (Natural Earth, public domain) |
| 15. Quick summary | Prints the top-level keys and counts of `validation.json`, and the variables in `variables.json` | none |
| 16. Results back to the repository | Zips `web/public/data` and `web/server/data` and downloads the two zips | two zip files |

Section 16 ends with the team's normal workflow: copy the files into a local clone, then branch, review and push. Never
commit the Drive data, the boundary zips or any credential; only the generated files in `web/public/data/` and
`web/server/data/`.

## Open issues (15 Nov 2026)

- **Not run end to end.** The notebook has not been run from start to finish in Colab yet (P-018 in
  `.ai-context/05-tech-debt.md`).

## Conventions

- Number notebooks in run order: `00_...`, `01_...`.
- First cell: a markdown header with purpose, inputs, outputs and, if any code was generated with AI, a line saying so
  (Space Apps AI rule).
- Second cell: `pip install` of anything Colab does not ship (for example `earthaccess pyhdf harmony-py`).
- Clear outputs that could reveal account details before committing.
