# 2. Architecture

## Where things live

| Place | Holds | Why |
|---|---|---|
| This repo, `C:\Users\DiNiCHi\dev\SIGNO`, remote `github.com/AetherKernel/SIGNO` | Code, notebooks, these docs | Outside Google Drive (ADR-001) |
| Drive `03 Proyectos IA/SIGNO` | Team documents: research, pitch script, video, poster, notes, design system core | Shared with the team, not code |
| `data/` in this repo (git-ignored) | Downloaded NASA data | Too large to version; cited in README |

## Components

Only documentation exists yet (README, CLAUDE.md, `.ai-context/`, LICENSE). The stack and the components are decided
by the team after the research phase (see 05, P-002).

## Environments

Local development only (Windows 11, Python 3.13 via `py`). Access to NASA data requires an Earthdata Login account
per member; credentials never go in the repo.

## Tests

None yet.
