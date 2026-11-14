# 6. API & MCP

## API v1 (read-only, static JSON)

Published by `web/server/buildApi.ts` on every `npm run dev` / `npm run build`, served by Vite locally and by Vercel
in production (ADR-004). Route map: `web/shared/apiPaths.ts`. Types: `web/shared/contracts.ts`. Every response
carries `apiVersion: "v1"`; the frontend rejects other versions.

Base URL: `/api/v1` (production: `https://signo-chi-pink.vercel.app/api/v1`). The frontend can be pointed at
another API with the build variable `VITE_API_BASE_URL`.

| Method | Path | Response type | Contents |
|---|---|---|---|
| GET | `/api/v1/manifest.json` | `Manifest` | API version, generation time, `dataStatus`, the region, the list of variables with their NASA product |
| GET | `/api/v1/trends/{variableId}.json` | `TrendLayer` | Trend of every cell for one variable, the method, and the summary counts |
| GET | `/api/v1/series/{variableId}/{cellId}.json` | `CellSeries` | Monthly values behind one cell's trend |

Errors are plain HTTP status codes (404 for an unknown variable or cell). Responses have
`Cache-Control: public, max-age=0, must-revalidate` and `Access-Control-Allow-Origin: *` (`web/vercel.json`), so
judges and other tools can read the data directly.

## MCP

N/A: the project exposes no MCP tools.
