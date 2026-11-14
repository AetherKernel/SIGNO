// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Presentation helpers only (number formatting and colours). No data access and no statistics here.

export function formatSlope(slope: number | null, units: string): string {
  if (slope === null) return 'not enough data'
  const sign = slope > 0 ? '+' : ''
  const unit = units === 'unitless' ? '' : ` ${units}`
  return `${sign}${slope.toFixed(Math.abs(slope) < 0.1 ? 3 : 2)}${unit} per decade`
}

export function formatPValue(p: number | null): string {
  if (p === null) return 'not tested'
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`
}

export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lon).toFixed(1)}°${ew}`
}

/** Diverging colour for a slope: orange for decreasing, teal for increasing, scaled by the layer's largest |slope|. */
export function slopeColor(slope: number | null, maxAbs: number): string {
  if (slope === null || maxAbs === 0) return 'var(--cell-empty)'
  const t = Math.min(1, Math.abs(slope) / maxAbs)
  const hue = slope < 0 ? 24 : 174
  const lightness = 88 - t * 48
  return `hsl(${hue} 70% ${lightness}%)`
}
