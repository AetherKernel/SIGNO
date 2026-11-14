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
