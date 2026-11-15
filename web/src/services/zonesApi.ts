// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Typed service for zones.json (yearly values and trends of the whole Amazon and its Brazilian and Peruvian parts).
// Request it only when manifest.extras.zones is true.

import { apiPaths } from '../../shared/apiPaths.ts'
import type { ZonesReport } from '../../shared/contracts.ts'
import { getJson } from './apiClient.ts'

export const zonesApi = {
  getZones: (signal?: AbortSignal): Promise<ZonesReport> => getJson<ZonesReport>(apiPaths.zones(), signal),
}
