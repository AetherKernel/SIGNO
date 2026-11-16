// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Small yearly charts for the area file and the validation tab: tree cover lines (Hansen solid, MODIS dashed, flagged
// MODIS years hollow) and yearly bars (loss, burned area). Missing values (null) are gaps, never zeros. The charts draw
// the backend's numbers as they are and compute nothing.
// 2026-11-15: dashed marker at 2011 (Hansen method change) with its InfoTip; the year the API flags in MODIS is "not used" (with its
// reason in an InfoTip), no longer "flagged".

import { useState, type PointerEvent } from 'react'
import { formatKm2, formatPercent } from '../lib/format.ts'
import { useHansenInfo } from '../lib/hansen.ts'
import { useLang } from '../lib/i18n.ts'
import { InfoTip } from './InfoTip.tsx'
import { MethodChangeNote } from './MethodChangeNote.tsx'

const W = 640
const H = 190
const PAD = { left: 44, right: 10, top: 12, bottom: 24 }

function useYearHover(years: number[], width: number, padLeft: number, padRight: number, bars = false) {
  const [hover, setHover] = useState<number | null>(null)
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * width
    const t = (px - padLeft) / (width - padLeft - padRight)
    const i = bars ? Math.floor(t * years.length) : Math.round(t * (years.length - 1))
    setHover(i >= 0 && i < years.length ? i : null)
  }
  return { hover, onMove, clear: () => setHover(null) }
}

interface CoverChartProps {
  years: number[]
  hansen: (number | null)[]
  modis: (number | null)[]
  selectedYear: number | null
  /** Years of the MODIS series that the API flags: shown hollow and called "not used". */
  flaggedModisYears: number[]
  /** Why those years are not used (shown in an InfoTip under the chart). */
  notUsedReason?: string
  label: string
}

/** Line path with gaps where a value is missing. */
function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string[] {
  const segments: string[] = []
  let current = ''
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (current) segments.push(current)
  return segments
}

export function CoverChart({ years, hansen, modis, selectedYear, flaggedModisYears, notUsedReason, label }: CoverChartProps) {
  const { t } = useLang()
  const hansenInfo = useHansenInfo()
  const { hover, onMove, clear } = useYearHover(years, W, PAD.left, PAD.right)
  const n = years.length
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / 100) * (H - PAD.top - PAD.bottom)
  const shown = hover ?? (selectedYear !== null ? years.indexOf(selectedYear) : -1)
  const flagged = (year: number) => flaggedModisYears.includes(year)
  const mi = years.indexOf(hansenInfo.year)

  return (
    <figure className="chart">
      <p className="chart-readout small mono" aria-hidden="true">
        {shown >= 0
          ? `${years[shown]}: Hansen ${formatPercent(hansen[shown])} · MODIS ${formatPercent(modis[shown])}${flagged(years[shown]) ? t(' (not used)', ' (no se usa)') : ''}`
          : ' '}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={clear}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {t} %
            </text>
          </g>
        ))}
        {years.map((year, i) =>
          year % 5 === 0 ? (
            <text key={year} className="tick" x={x(i)} y={H - 6} textAnchor="middle">
              {year}
            </text>
          ) : null,
        )}
        {mi > 0 && (
          <g>
            <line className="method-edge" x1={x(mi - 0.5)} x2={x(mi - 0.5)} y1={PAD.top} y2={H - PAD.bottom} />
            <text className="tick" x={x(mi - 0.5) + 3} y={PAD.top + 9}>
              {hansenInfo.year}
            </text>
          </g>
        )}
        {shown >= 0 && <line className="band-edge" x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={H - PAD.bottom} />}
        {path(modis, x, y).map((d, i) => (
          <path key={`m${i}`} className="line line-modis" d={d} />
        ))}
        {path(hansen, x, y).map((d, i) => (
          <path key={`h${i}`} className="line line-hansen" d={d} />
        ))}
        {years.map((year, i) =>
          flagged(year) && modis[i] !== null ? (
            <circle key={`f${year}`} className="dot-hollow" cx={x(i)} cy={y(modis[i] as number)} r={4.5}>
              <title>{t(`MODIS ${year}: not used`, `MODIS ${year}: no se usa`)}</title>
            </circle>
          ) : null,
        )}
        {shown >= 0 && hansen[shown] !== null && <circle className="hover-dot" cx={x(shown)} cy={y(hansen[shown] as number)} r={3.5} />}
      </svg>
      <figcaption>
        <span className="key-line solid" /> {t('Hansen (solid)', 'Hansen (continua)')} · <span className="key-line dashed" />{' '}
        {t('MODIS (dashed)', 'MODIS (discontinua)')} · {t('hollow dot: year not used · gaps are missing values', 'punto hueco: año que no se usa · los huecos son valores faltantes')}
        {flaggedModisYears.length > 0 && notUsedReason && <InfoTip label={t('Why a year is not used', 'Por qué un año no se usa')}>{notUsedReason}</InfoTip>}
      </figcaption>
      {mi > 0 && <MethodChangeNote className="small muted" />}
    </figure>
  )
}

interface BarChartProps {
  years: number[]
  values: (number | null)[]
  selectedYear: number | null
  tone: 'loss' | 'burned'
  /** "km2" or "%": how values are written. */
  unit: 'km2' | 'percent'
  label: string
  /** Hansen loss: mark the method change of 2011 with a dashed line and its InfoTip. */
  methodMarker?: boolean
}

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const m = max / exp
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * exp
}

export function BarChart({ years, values, selectedYear, tone, unit, label, methodMarker = false }: BarChartProps) {
  const { t } = useLang()
  const hansenInfo = useHansenInfo()
  const { hover, onMove, clear } = useYearHover(years, W, PAD.left, PAD.right, true)
  const n = years.length
  const step = (W - PAD.left - PAD.right) / Math.max(1, n)
  const present = values.filter((v): v is number => v !== null)
  const top = niceMax(Math.max(0, ...present))
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom)
  const write = (v: number | null) => (unit === 'km2' ? formatKm2(v, t) : v === null ? t('no data', 'sin datos') : `${(v * 100).toFixed(1)} %`)
  const tickText = (v: number) => (unit === 'km2' ? v.toLocaleString('en-US') : `${Math.round(v * 100)} %`)
  const shown = hover ?? (selectedYear !== null ? years.indexOf(selectedYear) : -1)
  const mi = methodMarker ? years.indexOf(hansenInfo.year) : -1

  return (
    <figure className="chart">
      <p className="chart-readout small mono" aria-hidden="true">
        {shown >= 0 ? `${years[shown]}: ${write(values[shown])}` : ' '}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={clear}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(top * t)} y2={y(top * t)} />
            <text className="tick" x={PAD.left - 6} y={y(top * t) + 3} textAnchor="end">
              {tickText(top * t)}
            </text>
          </g>
        ))}
        {years.map((year, i) =>
          year % 5 === 0 ? (
            <text key={year} className="tick" x={PAD.left + step * (i + 0.5)} y={H - 6} textAnchor="middle">
              {year}
            </text>
          ) : null,
        )}
        {mi > 0 && (
          <g>
            <line className="method-edge" x1={PAD.left + step * mi} x2={PAD.left + step * mi} y1={PAD.top} y2={H - PAD.bottom} />
            <text className="tick" x={PAD.left + step * mi + 3} y={PAD.top + 9}>
              {hansenInfo.year}
            </text>
          </g>
        )}
        {values.map((v, i) =>
          v === null ? null : (
            <rect
              key={years[i]}
              className={`bar bar-${tone}${years[i] === selectedYear ? ' selected' : ''}`}
              x={PAD.left + step * i + step * 0.12}
              width={step * 0.76}
              y={y(v)}
              height={Math.max(0, H - PAD.bottom - y(v))}
            />
          ),
        )}
      </svg>
      {mi > 0 && <MethodChangeNote className="small muted" />}
    </figure>
  )
}
