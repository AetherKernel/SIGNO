// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15; semester highlight added 2026-11-15.
// Reviewed and owned by team AETHER.
//
// Monthly time series of one cell. Missing months (null) break the line instead of being invented. The optional
// comparison only shades a second date range; it computes nothing.

import { useState, type PointerEvent } from 'react'
import type { CellSeries, Period, Variable } from '../../shared/contracts.ts'
import { semesterLabel } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'

const W = 640
const H = 240
const PAD = { left: 52, right: 12, top: 14, bottom: 30 }

interface Props {
  series: CellSeries
  variable: Variable
  /** When set, the second period is shaded. */
  compare: [Period, Period] | null
  /** A six-month period to shade (key like "2025-H2" and its months). Dashed when the period is incomplete. */
  highlight?: { key: string; months: Period; complete: boolean } | null
}

export function SeriesChart({ series, variable, compare, highlight = null }: Props) {
  const { t } = useLang()
  const [hover, setHover] = useState<number | null>(null)
  const values = series.points.map((p) => p.value).filter((v): v is number => v !== null)
  if (values.length === 0) return <p className="muted small">{t('No valid months for this area.', 'No hay meses válidos para esta área.')}</p>

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const lo = min - span * 0.05
  const hi = max + span * 0.05
  const n = series.points.length
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)

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

  const yTicks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3)
  const digits = span < 1 ? 2 : 1
  const years = series.points
    .map((p, i) => ({ year: Number(p.month.slice(0, 4)), i, january: p.month.endsWith('-01') }))
    .filter((t) => t.january && t.year % 5 === 0)
  const missing = n - values.length
  const unit = variable.units === 'unitless' ? variable.name : variable.units
  const hiFirst = highlight ? series.points.findIndex((p) => p.month >= highlight.months.start) : -1
  const hiLast = highlight ? series.points.findLastIndex((p) => p.month <= highlight.months.end) : -1
  const bandStart = compare ? series.points.findIndex((p) => p.month >= compare[1].start) : -1

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * W
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))
    setHover(i >= 0 && i < n ? i : null)
  }
  const point = hover !== null ? series.points[hover] : null

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t(
          `Monthly ${variable.name} for this area, ${series.points[0]?.month} to ${series.points[n - 1]?.month}, ${missing} missing months`,
          `${variable.name} mensual para esta área, ${series.points[0]?.month} a ${series.points[n - 1]?.month}, ${missing} meses sin dato`,
        )}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {bandStart > 0 && (
          <>
            <rect className="band" x={x(bandStart)} y={PAD.top} width={x(n - 1) - x(bandStart)} height={H - PAD.top - PAD.bottom} />
            <line className="band-edge" x1={x(bandStart)} x2={x(bandStart)} y1={PAD.top} y2={H - PAD.bottom} />
          </>
        )}
        {highlight && hiFirst >= 0 && hiLast >= hiFirst && (
          <rect
            className={highlight.complete ? 'semester-band' : 'semester-band partial'}
            x={x(hiFirst) - (x(1) - x(0)) / 2}
            y={PAD.top}
            width={x(hiLast) - x(hiFirst) + (x(1) - x(0))}
            height={H - PAD.top - PAD.bottom}
          />
        )}
        {yTicks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {t.toFixed(digits)}
            </text>
          </g>
        ))}
        {years.map((t) => (
          <text key={t.year} className="tick" x={x(t.i)} y={H - 10} textAnchor="middle">
            {t.year}
          </text>
        ))}
        {segments.map((d, i) => (
          <path key={i} className="line" d={d} />
        ))}
        {point && point.value !== null && hover !== null && (
          <>
            <circle className="hover-dot" cx={x(hover)} cy={y(point.value)} r={4} />
            <text className="tick" x={Math.min(W - PAD.right, Math.max(PAD.left + 60, x(hover)))} y={PAD.top - 2} textAnchor="middle">
              {point.month}: {point.value.toFixed(digits + 1)}
            </text>
          </>
        )}
      </svg>
      <figcaption>
        {t(
          `Monthly values (${unit}) · ${missing} missing month${missing === 1 ? '' : 's'} (for example clouds) shown as gaps`,
          `Valores mensuales (${unit}) · ${missing} ${missing === 1 ? 'mes sin dato' : 'meses sin dato'} (por ejemplo, nubes) como huecos`,
        )}
        {compare ? t(` · shaded: ${compare[1].start} to ${compare[1].end}`, ` · sombreado: ${compare[1].start} a ${compare[1].end}`) : ''}
        {highlight
          ? t(
              ` · highlighted: ${semesterLabel(highlight.key, t)}${highlight.complete ? '' : ' (incomplete)'}`,
              ` · resaltado: ${semesterLabel(highlight.key, t)}${highlight.complete ? '' : ' (incompleto)'}`,
            )
          : ''}
      </figcaption>
    </figure>
  )
}
