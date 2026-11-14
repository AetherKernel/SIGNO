# 2. Architecture

## Where things live

| Place | Holds | Why |
|---|---|---|
| This repo, `C:\Users\DiNiCHi\dev\SIGNO`, remote `github.com/AetherKernel/SIGNO` | Code, notebooks, these docs | Outside Google Drive (ADR-001) |
| Drive `03 Proyectos IA/SIGNO` | Team documents: research, notes, drafts, design system core | Team only, not code |
| Drive `03 Proyectos IA/SIGNO/submission` | Submission material in English: demo video, slides, AI-generated images (watermarked), sources of the local data point | Public link, this folder only (same pattern as the 2025 winners) |
| `data/` in this repo (git-ignored) | Downloaded NASA data | Too large to version; cited in README |

## Components

| Component | Folder | State |
|---|---|---|
| Web prototype (React 19 + Vite 8 + TypeScript, ADR-003) | `web/` | Placeholder page that proves the build and deploy work. Commands: `npm install`, `npm run dev`, `npm run build`, `npm run lint` (run inside `web/`) |
| Data processing and analysis | not created yet | Waits for the team's method and variables (05, P-002) |

The template's demo files (`web/src/App.css`, `web/src/assets/`, `web/public/icons.svg`) are no longer used and can
be removed when the real interface is built.

### Options under evaluation (the team decides)

These options follow from ADR-002 (Vercel runs no long processes). They are informed by the 2025 global winners:
three of them published on Vercel, and six of ten had no ML in the product. They are **not decisions**: when the
team picks one, record it here and as an ADR.

| Option | Shape | Pros | Risks |
|---|---|---|---|
| 1. Precomputed + static site | Python analysis runs locally or in Google Colab and exports results (JSON/GeoJSON/PNG) to the repo; a static web app on Vercel reads them. Proven by 2025 winner Zumorroda-X (`imerg_to_game_json.py` turns GPM IMERG into JSON for its Vercel site) | Lowest risk; fast; no credentials online; works offline from NASA | Users only see precomputed regions and variables |
| 2. Option 1 + small serverless function | Adds a Python function on Vercel for one light on-demand query | Some interactivity beyond the precomputed set | Vercel time and size limits; would need Earthdata credentials as environment variables |
| 3. Option 1 or 2 + LLM explainer | An LLM explains variables or suggests which ones to look at for a region (allowed by the challenge text) | Helps the target audience | Must never decide significance; must be declared under the Space Apps AI rule |

Whatever the option, the statistical test is the product's core and must be transparent and validated (05, P-007).

## Environments

| Environment | Where | Notes |
|---|---|---|
| Local | Windows 11, Python 3.13 via `py` | Data download and analysis |
| Preview | Vercel, one URL per pull request | Team review before merging |
| Production | Vercel, deployed from `main` | Public link for the submission (ADR-002); must open without login |

Vercel does not run long processes or Streamlit, so heavy data work stays outside it (ADR-002). Access to NASA data requires an Earthdata Login account
per member; credentials never go in the repo.

## Tests

None yet.
