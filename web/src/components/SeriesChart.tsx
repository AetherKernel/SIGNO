// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Monthly time series of one cell. Missing months (null) break the line instead of being invented.

import type { CellSeries, Variable } from '../../shared/contracts.ts'

const W = 640
const H = 200
const PAD = { left: 48, right: 12, top: 12, bottom: 28 }

export function SeriesChart({ series, variable }: { series: CellSeries; variable: Variable }) {
  const values = series.points.map((p) => p.value).filter((v): v is number => v !== null)
  if (values.length === 0) return <p className="muted">No valid months for this area.</p>

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => PAD.left + (i / Math.max(1, series.points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom)

  const segments: string[] = []
  let current = ''
  series.points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
  })
  if (current) segments.push(current)

  const years = series.points
    .map((p, i) => ({ year: p.month.slice(0, 4), i, isJanuary: p.month.endsWith('-01') }))
    .filter((t) => t.isJanuary && Number(t.year) % 5 === 0)
  const unit = variable.units === 'unitless' ? '' : ` ${variable.units}`
  const missing = series.points.length - values.length

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly ${variable.name}, ${series.points.length} months`}>
        <line className="axis" x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} />
        <text className="tick" x={PAD.left - 6} y={y(max) + 4} textAnchor="end">
          {max.toFixed(2)}
        </text>
        <text className="tick" x={PAD.left - 6} y={y(min) + 4} textAnchor="end">
          {min.toFixed(2)}
        </text>
        {years.map((t) => (
          <text key={t.year} className="tick" x={x(t.i)} y={H - 8} textAnchor="middle">
            {t.year}
          </text>
        ))}
        {segments.map((d, i) => (
          <path key={i} className="line" d={d} />
        ))}
      </svg>
      <figcaption className="muted">
        Monthly values{unit} · {missing} missing month{missing === 1 ? '' : 's'} (e.g. clouds) shown as gaps
      </figcaption>
    </figure>
  )
}
