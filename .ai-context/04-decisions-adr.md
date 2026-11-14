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
