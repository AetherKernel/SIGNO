# 4. Decisions (ADRs)

## ADR-001: Repository separated from Google Drive

- **Date:** 2026-11-14
- **Status:** Accepted

**Context.** Workspace projects usually live in `J:\Mi unidad\03 Proyectos IA`, which Google Drive syncs. For SIGNO
the owner wants to understand every step that is applied, and Drive syncing a `.git` folder can corrupt the
repository (file locks, conflict copies). The team already created `github.com/AetherKernel/SIGNO`.

**Decision.** The repository is cloned at `C:\Users\DiNiCHi\dev\SIGNO`, outside Drive, and holds the code and
`.ai-context/`. The Drive folder `03 Proyectos IA/SIGNO` keeps only team documents. The repo is registered in the
workspace `projects.toml` as `SIGNO-repo` (a different key from the Drive folder name, so both can coexist in
`--all`), which gives it the same context-sync checks.

**Consequences.** Code changes are shared through GitHub, not Drive. The design-system core stays in the Drive
folder, because the design-system check only runs for folders inside the workspace. The sync is run with the
workspace script's absolute path (see CLAUDE.md).

## ADR-002: Vercel as the publishing platform

- **Date:** 2026-11-14
- **Status:** Accepted (team decision, José)

**Context.** The submission needs a public link that opens without login. The team needs a place to publish the
SIGNO web tool directly from the GitHub repository during a 48-hour hackathon.

**Decision.** SIGNO's public web tool is published on Vercel, connected to `github.com/AetherKernel/SIGNO`.

**Consequences.**

- Every push to `main` triggers a production deploy, and pull requests get preview URLs.
- Vercel serves static sites and front-end frameworks, and runs short serverless functions (Python included). It
  does not host long-running servers: Streamlit apps and long data downloads or processing do not run there. Heavy
  NASA data work has to happen outside Vercel, and the web tool consumes its results. How exactly is part of the
  architecture the team still has to decide (05, P-002).
- Vercel's Deployment Protection can put a login in front of deployments. The production URL used in the submission
  must be checked from a private browser window (05, P-006).
- No Earthdata credentials go to the front end. If a function ever needs them, they live in Vercel environment
  variables, never in the repo.

## ADR-003: Web prototype with React + Vite + TypeScript in `web/`

- **Date:** 2026-11-14
- **Status:** Accepted (José)

**Context.** SIGNO needs a public web prototype on Vercel (ADR-002), built in hours. José already builds React +
TypeScript front ends with Vite (Mi-puestito), so the team spends no time learning a new stack.

**Decision.** The web app lives in `web/`, scaffolded with the official `create-vite` template `react-ts` (React 19,
Vite 8, TypeScript, oxlint). It is a static single-page app: `npm run build` produces `web/dist/`, which Vercel serves.

**Consequences.**

- In Vercel the project's **Root Directory is `web`**; the Vite framework preset sets build and output.
- The app only reads files it ships with, so any analysis results it shows must be exported as static files into
  the app (consistent with option 1 in tab 02, still to be confirmed by the team).
- `web/node_modules/` and `web/dist/` are git-ignored by the template's own `.gitignore`.

## ADR-004: Layered app with a static API v1 and a swappable data source

- **Date:** 2026-11-14
- **Status:** Accepted (José)

**Context.** José asked to turn the placeholder into the production architecture with a strict frontend/backend
separation, clear contracts, and a data layer that Alexis's pipeline can replace without touching the interface.
Vercel runs no long processes and the link must never sleep (ADR-002). The pipeline and method are not ready yet.

**Decision.**

- Three layers in `web/`, enforced by `scripts/checkLayers.ts`:
  - `shared/`: the contract and route map;
  - `server/`: the backend;
  - `src/`: the frontend.
- The backend reads data only through a `DataSource` port. There are two adapters:
  - `mock`: synthetic data, the default;
  - `files`: the pipeline's JSON export.

  `SIGNO_DATA_SOURCE` selects which one is used.
- The backend validates the data against the contract, computes the business aggregates and publishes a
  versioned, read-only **static API v1** (`/api/v1/...json`) at build time. The frontend reaches it only over HTTP,
  through `src/services`.
- The backend is TypeScript run directly by Node (type stripping, Node 22.18 or later). It needs no compile step
  and no extra dependencies.

**Consequences.**

- Option 1 of tab 02 is adopted. The site never sleeps, has no cold starts and holds no credentials.
- New data requires a rebuild: a push, or a redeploy in Vercel.
- Switching to real data means three steps:
  1. export the files;
  2. set `SIGNO_DATA_SOURCE=files`;
  3. rebuild.

  The frontend does not change. Contract errors stop the build.
- A runtime API can be added later behind the same paths. `VITE_API_BASE_URL` already lets the frontend point
  elsewhere.
- Vercel must use Node 22.x (`package.json` engines) so the build can run the TypeScript backend.
- The production build runs the contract validation, the layer check and the unit tests. If any of them fails,
  the deploy fails and the previous version stays live.
