// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// View state that lives in the URL (?view=&map=&var=&year=&show=&op=&borders=&base=&cell=&z=&lat=&lon=), so any view
// can be shared. Parsing is defensive: a malformed parameter falls back to the default instead of breaking the page.
// Old links still work: `variable=` is read as `var=` and `filter=` as `show=` (see MapScreen for the legacy rules).

export type CellFilter = 'all' | 'significant' | 'decreasing' | 'increasing'

export interface MapView {
  zoom: number
  lat: number
  lon: number
}

// Application views (?view=)

export type AppView = 'map' | 'trends' | 'checks' | 'method'

export const APP_VIEWS: { id: AppView; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'trends', label: 'Trends' },
  { id: 'checks', label: 'Cross-checks' },
  { id: 'method', label: 'Method & sources' },
]

/** The view of the URL; a missing or unknown value opens the map (so every old link still works). */
export function parseAppView(value: string | null): AppView {
  return value === 'trends' || value === 'checks' || value === 'method' ? value : 'map'
}

// Map types (?map=)

export type MapType = 'cover' | 'loss' | 'burned' | 'trend'

export function parseMapType(value: string | null): MapType | null {
  return value === 'cover' || value === 'loss' || value === 'burned' || value === 'trend' ? value : null
}

/** Cell fill opacity (percent) when `op` is absent. Loss and burned are higher because their zero cells are not drawn. */
export const DEFAULT_OPACITY: Record<MapType, number> = { cover: 55, loss: 80, burned: 80, trend: 70 }

export const OPACITY_MIN = 20
export const OPACITY_MAX = 100

/** The `op` parameter as a whole percent between 20 and 100, or the default of the map type. */
export function parseOpacity(value: string | null, type: MapType): number {
  const n = Number(value)
  if (value === null || value.trim() === '' || !Number.isFinite(n)) return DEFAULT_OPACITY[type]
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(n)))
}

export function parseFilter(value: string | null): CellFilter {
  return value === 'significant' || value === 'decreasing' || value === 'increasing' ? value : 'all'
}

/** Which cells a filter keeps lit. Uses the backend's `significant` flag as is. */
export function matchesFilter(cell: { slopePerDecade: number | null; significant: boolean }, filter: CellFilter): boolean {
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

/** Source of the tree cover values. The map only uses Hansen; MODIS stays in the area viewer and the cross-checks. */
export type CoverSource = 'hansen' | 'modis'

/** The year asked for in the URL when the layer has it, else its last year (2025 in the current export). */
export function resolveYear(years: number[], param: string | null, flaggedYears: number[] = []): number {
  const asked = Number(param)
  if (param !== null && years.includes(asked)) return asked
  const usable = years.filter((y) => !flaggedYears.includes(y))
  return (usable.length > 0 ? usable : years)[(usable.length > 0 ? usable : years).length - 1] ?? 2025
}
