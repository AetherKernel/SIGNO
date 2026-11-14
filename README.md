# SIGNO

**Team AETHER** (Peru) · NASA Space Apps Challenge 2026 · Challenge: *Be An Earth System Trend Detective!* ·
Local event: Lima.

SIGNO looks for real, long-term change in Earth system variables using NASA data, and tries to tell that change
apart from noise.

**Live prototype:** <https://signo-chi-pink.vercel.app/>

> Status (14 Nov 2026): the problem and region are decided (the Amazon forest as one natural region); the
> statistical method and the final variables are still being decided by the team.

## Repository layout

```
SIGNO/
├── .ai-context/   # Living project docs: 01 logic · 02 architecture · 03 data · 04 decisions (ADRs) · 05 pending · 06 API
├── CLAUDE.md      # Working rules for the AI coding assistant (in Spanish)
├── web/           # The app deployed on Vercel (Root Directory)
│   ├── shared/    # Data contract (types) and API route map, used by both layers
│   ├── server/    # Backend: data sources (mock / pipeline files), validation, API v1 publisher
│   ├── src/       # Frontend (React + TypeScript): services → hooks → components
│   └── scripts/   # Architecture guard (layer boundaries)
├── LICENSE        # Apache License 2.0
└── README.md
```

## Architecture

The backend reads the data through a swappable source, validates it against the shared contract and publishes a
read-only, versioned **static API** (`/api/v1/manifest.json`, `/api/v1/trends/{variable}.json`,
`/api/v1/series/{variable}/{cell}.json`). The frontend only talks to that API. While the analysis pipeline is in
progress the site runs on clearly labelled **synthetic sample data**. The pipeline's export format is in
[`web/server/data/README.md`](web/server/data/README.md); switching to it is one environment variable,
`SIGNO_DATA_SOURCE=files`. Details: [`.ai-context/02-architecture.md`](.ai-context/02-architecture.md) and
[`.ai-context/06-api-mcp.md`](.ai-context/06-api-mcp.md).

Run it locally (Node.js 22.18 or later):

```bash
cd web
npm install
npm run dev
```

`npm run build` publishes the API, checks the layer boundaries and types, and builds the site.

Downloaded NASA data goes in `data/`, which is not versioned (see `.gitignore`). Each dataset will be listed below
with its DOI or product page.

## Data sources

To be completed as datasets are chosen. Every NASA product used is cited here with its full reference.

## Use of AI

The team uses AI tools to speed up the work, following the Space Apps rules: AI is not used to come up with how to
solve the challenge, and design decisions are made by the team.

- **Claude (Anthropic), via Claude Code:** set up this repository's structure and documentation, and wrote the web
  app's code to the team's architecture brief: the shared contract, the backend (data sources, validation, API
  publisher), the frontend and the synthetic mock data. Each of those files starts with a header comment saying so.
  The statistical method is not AI-designed: it is the team's decision and is not implemented yet.
- **Gemini (Google):** literature and data-source exploration.

Any code or data generated with AI carries a header comment saying so. Images and videos generated with AI carry a
visible watermark.

## License

Original content in this repository is released under the [Apache License 2.0](LICENSE).
