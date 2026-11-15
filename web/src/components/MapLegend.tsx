// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Legend of the trend map: six PuOr classes from -max to +max, plus the keys for "not significant" (dots),
// "no data" and the selected area. Colour is never the only cue: the dots and the numbers carry the meaning too.

import type { TrendLayer, Variable } from '../../shared/contracts.ts'
import { formatSigned, legendBreaks, maxAbsSlope, SLOPE_CLASSES, unitSuffix } from '../lib/format.ts'

export function MapLegend({ layer, variable }: { layer: TrendLayer; variable: Variable }) {
  const maxAbs = maxAbsSlope(layer.cells)
  const breaks = legendBreaks(maxAbs)
  return (
    <section className="section legend" aria-labelledby="legend-title">
      <h2 id="legend-title" className="kicker">
        Legend · trend per decade
      </h2>
      <div className="legend-ends">
        <span>Decreases</span>
        <span>Increases</span>
      </div>
      <div className="legend-bar" role="img" aria-label={`Six colour classes from ${formatSigned(-maxAbs)} to ${formatSigned(maxAbs)}${unitSuffix(variable.units)} per decade: orange decreases, purple increases`}>
        {Array.from({ length: SLOPE_CLASSES }, (_, k) => (
          <i key={k} style={{ background: `var(--puor-${k})` }} />
        ))}
      </div>
      <div className="legend-ticks" aria-hidden="true">
        <span>{formatSigned(breaks[0])}</span>
        <span>0</span>
        <span>{formatSigned(breaks[SLOPE_CLASSES])}</span>
      </div>
      <p className="small muted">
        Units: {variable.units === 'unitless' ? 'NDVI' : variable.units} per decade
      </p>
      <div className="legend-key">
        <svg width="28" height="18" aria-hidden="true">
          <rect width="28" height="18" style={{ fill: 'var(--puor-1)' }} />
          {[5, 14, 23].flatMap((x) => [5, 13].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#fff" stroke="rgb(0 0 0 / 0.5)" strokeWidth="0.5" />))}
        </svg>
        Dotted: not significant, could be noise
      </div>
      <div className="legend-key">
        <svg width="28" height="18" aria-hidden="true">
          <rect width="28" height="18" style={{ fill: 'var(--cell-empty)' }} />
        </svg>
        Grey: not enough data
      </div>
      <div className="legend-key">
        <svg width="28" height="18" aria-hidden="true">
          <rect x="2" y="2" width="24" height="14" fill="none" strokeWidth="3" style={{ stroke: 'var(--accent)' }} />
        </svg>
        Outlined: the area you opened
      </div>
    </section>
  )
}
