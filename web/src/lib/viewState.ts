// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// View state that lives in the URL (?variable=&cell=&filter=&z=&lat=&lon=&base=&compare=), so any view can be shared.
// Parsing is defensive: a malformed parameter falls back to the default instead of breaking the page.

import type { CellTrend } from '../../shared/contracts.ts'

export type CellFilter = 'all' | 'significant' | 'decreasing' | 'increasing'

export interface MapView {
  zoom: number
  lat: number
  lon: number
}

export function parseFilter(value: string | null): CellFilter {
  return value === 'significant' || value === 'decreasing' || value === 'increasing' ? value : 'all'
}

/** Which cells a filter keeps lit. Uses the backend's `significant` flag as is. */
export function matchesFilter(cell: CellTrend, filter: CellFilter): boolean {
  const slope = cell.slopePerDecade ?? 0
  if (filter === 'significant') return cell.significant
  if (filter === 'decreasing') return cell.significant && slope < 0
  if (filter === 'increasing') return cell.significant && slope > 0
  return true
}

export function parseView(z: string | null, lat: string | null, lon: string | null): MapView | null {
  if (z === null || lat === null || lon === null) return null
  const view = { zoom: Number(z), lat: Number(lat), lon: Number(lon) }
  const ok =
    Number.isFinite(view.zoom) &&
    Number.isFinite(view.lat) &&
    Number.isFinite(view.lon) &&
    Math.abs(view.lat) <= 85 &&
    Math.abs(view.lon) <= 180 &&
    view.zoom >= 0 &&
    view.zoom <= 20
  return ok ? view : null
}
