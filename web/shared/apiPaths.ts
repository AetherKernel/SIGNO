// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14 (per-cell path added 2026-11-15). Reviewed and
// owned by team AETHER.
//
// API v1 route map, shared by the backend (which publishes these files) and the frontend (which requests them).
// Paths are relative to the API base: "/api/v1" by default (see src/services/apiClient.ts).

export const API_BASE_PATH = '/api/v1'

export const apiPaths = {
  manifest: (): string => 'manifest.json',
  cover: (): string => 'cover.json',
  validation: (): string => 'validation.json',
  rasters: (): string => 'rasters.json',
  zones: (): string => 'zones.json',
  trends: (variableId: string): string => `trends/${variableId}.json`,
  series: (variableId: string, cellId: string): string => `series/${variableId}/${cellId}.json`,
  /** Every variable's series and trend row of one cell (added 2026-11-15; the area viewer reads only this file). */
  cell: (cellId: string): string => `cells/${cellId}.json`,
}
