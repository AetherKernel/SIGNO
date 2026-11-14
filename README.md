# SIGNO

**Team AETHER** (Peru) · NASA Space Apps Challenge 2026 · Challenge: *Be An Earth System Trend Detective!* ·
Local event: Lima.

SIGNO looks for real, long-term change in Earth system variables using NASA data, and tries to tell that change
apart from noise.

> Status: research phase (14 Nov 2026). The method and the architecture are still being decided by the team.

## Repository layout

```
SIGNO/
├── .ai-context/   # Living project docs: 01 logic · 02 architecture · 03 data · 04 decisions (ADRs) · 05 pending · 06 API
├── CLAUDE.md      # Working rules for the AI coding assistant (in Spanish)
├── web/           # Web prototype (React + Vite + TypeScript), deployed on Vercel
├── LICENSE        # Apache License 2.0
└── README.md
```

Run the web prototype locally (Node.js 22+):

```bash
cd web
npm install
npm run dev
```

Downloaded NASA data goes in `data/`, which is not versioned (see `.gitignore`). Each dataset will be listed below
with its DOI or product page.

## Data sources

To be completed as datasets are chosen. Every NASA product used is cited here with its full reference.

## Use of AI

The team uses AI tools to speed up the work, following the Space Apps rules: AI is not used to come up with how to
solve the challenge, and design decisions are made by the team.

- **Claude (Anthropic), via Claude Code:** set up this repository's structure, its documentation files and the
  placeholder web page (`web/src/App.tsx`, `web/src/index.css`, marked with a header comment).
- **Gemini (Google):** literature and data-source exploration.

Any code or data generated with AI carries a header comment saying so. Images and videos generated with AI carry a
visible watermark.

## License

Original content in this repository is released under the [Apache License 2.0](LICENSE).
