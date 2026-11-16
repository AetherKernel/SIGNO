// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// 2026-11-15: Sen lines are solid only for a clear trend (dashed and muted otherwise), as in the Trends view.
// 2026-11-15: optional dashed marker at 2011 (the Hansen method change) with its InfoTip; years before it are greyed ("outside").
//
// Small yearly charts of the cell viewer. YearChart draws one or two yearly series as a line (states: tree cover, NDVI)
// or as bars (amounts: loss, burned area, rain), marks the two years A and B, and can shade the years the trend test used.
// Missing values are gaps, never zeros; an incomplete year is a hollow dot or a pale bar and is not joined to the line.
// One tab stop: the left and right arrow keys move the readout from year to year (the pointer does the same).
// Sparkline is the tiny version in the change table. Both draw the backend's numbers as they are: no fitting, no averaging.

import type { SenLine } from '../../shared/contracts.ts'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useHansenInfo } from '../lib/hansen.ts'
import { useLang } from '../lib/i18n.ts'
import { MethodChangeNote } from './MethodChangeNote.tsx'

/** ok = a normal point; hollow = incomplete or suspect (not joined to the line); outside = complete but not used by the test. */
export type PointKind = 'ok' | 'hollow' | 'outside'

export interface ChartSeries {
  id: string
  label: string
  values: (number | null)[]
  kinds?: PointKind[]
  dashed?: boolean
  /** Text shown in the readout for a year (why a value is hollow or outside). */
  notes?: (string | null)[]
}

const PAD = { left: 50, right: 12, top: 18, bottom: 22 }

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const m = max / exp
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * exp
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(Math.max(260, w))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

interface Props {
  years: number[]
  type: 'line' | 'bars'
  series: ChartSeries[]
  /** Writes a value with its unit (readout and tooltip). */
  format: (value: number) => string
  /** Writes a y-axis tick. Defaults to `format`. */
  tick?: (value: number) => string
  /** Fixed y range (tree cover is 0 to 100 %). */
  domain?: [number, number]
  tone?: 'plain' | 'loss' | 'burned'
  /** Year A and year B of the viewer. */
  from: number
  to: number
  /** First and last year the trend test used: shaded. */
  tested?: [number, number] | null
  /** The cell's Sen line over the tested years, when the pipeline gives it. */
  sen?: SenLine | null
  /** Whether the test calls the trend clear: a Sen line is solid then, dashed and muted otherwise. */
  significant?: boolean
  /** Hansen series: mark the year Hansen reprocessed its loss data with a dashed line, a label and an InfoTip. */
  methodMarker?: boolean
  /** Accessible name. */
  label: string
  caption?: string
  height?: number
}

export function YearChart({ years, type, series, format, tick, domain, tone = 'plain', from, to, tested = null, sen = null, significant = false, methodMarker = false, label, caption, height = 170 }: Props) {
  const { t } = useLang()
  const hansen = useHansenInfo()
  const segs = tested ? [{ tested, sen, significant }] : []
  const { ref, width } = useWidth()
  const readoutId = useId()
  const [active, setActive] = useState<number | null>(null)
  const n = years.length
  const bars = type === 'bars'
  const step = (width - PAD.left - PAD.right) / Math.max(1, bars ? n : n - 1)
  const x = (i: number) => PAD.left + (bars ? step * (i + 0.5) : step * i)
  const plotBottom = height - PAD.bottom

  const present = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
  if (!domain) for (const g of segs) if (g.sen) present.push(g.sen.start.value, g.sen.end.value)
  let lo = 0
  let hi = 1
  if (domain) [lo, hi] = domain
  else if (present.length > 0) {
    const max = Math.max(...present)
    const min = Math.min(...present)
    if (bars) hi = niceMax(max)
    else {
      const pad = (max - min || Math.abs(max) || 1) * 0.1
      lo = min - pad
      hi = max + pad
    }
  }
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (plotBottom - PAD.top)
  const yTicks = [lo, lo + (hi - lo) / 2, hi]
  const writeTick = tick ?? format
  const xEvery = width >= 480 ? 5 : 10

  const indexOf = (year: number) => years.indexOf(year)
  const shown = active ?? (indexOf(to) >= 0 ? indexOf(to) : n - 1)

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - box.left
    const i = bars ? Math.floor((px - PAD.left) / step) : Math.round((px - PAD.left) / step)
    setActive(i >= 0 && i < n ? i : null)
  }
  const key = (event: KeyboardEvent<SVGSVGElement>) => {
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (delta !== 0) {
      event.preventDefault()
      setActive(Math.min(n - 1, Math.max(0, shown + delta)))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : n - 1)
    }
  }

  const readout = (() => {
    if (shown < 0 || shown >= n) return ' '
    const parts = series.flatMap((s) => {
      const v = s.values[shown]
      if (v === null || v === undefined) return []
      return [series.length > 1 ? `${s.label} ${format(v)}` : format(v)]
    })
    const notes = series.map((s) => s.notes?.[shown]).filter(Boolean)
    return `${years[shown]}: ${parts.length > 0 ? parts.join(' · ') : t('no value', 'sin valor')}${notes.length > 0 ? `. ${notes[0]}.` : ''}`
  })()

  // Line segments: runs of consecutive points that are not hollow.
  const segments = (s: ChartSeries): string[] => {
    const out: string[] = []
    let current = ''
    s.values.forEach((v, i) => {
      if (v === null || s.kinds?.[i] === 'hollow') {
        if (current) out.push(current)
        current = ''
        return
      }
      current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (current) out.push(current)
    return out
  }

  const half = bars ? step / 2 : 0
  // The method change starts in a year: the line sits on the edge between the year before and that year.
  const methodAt = methodMarker ? indexOf(hansen.year) : -1
  const methodX = methodAt > 0 ? (bars ? PAD.left + step * methodAt : x(methodAt) - step / 2) : null
  const marks = [
    { year: from, name: 'A' },
    { year: to, name: 'B' },
  ].filter((m) => indexOf(m.year) >= 0)

  return (
    <figure className="cv-chart">
      <p className="cv-readout mono" id={readoutId} aria-live="polite">
        {readout}
      </p>
      <div ref={ref} className="cv-chart-box">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          tabIndex={0}
          aria-label={t(`${label}. Use the left and right arrow keys to read each year.`, `${label}. Usa las flechas izquierda y derecha para leer cada año.`)}
          aria-describedby={readoutId}
          onPointerMove={move}
          onPointerLeave={() => setActive(null)}
          onKeyDown={key}
          onBlur={() => setActive(null)}
        >
          {segs.map((g) => {
            const from0 = indexOf(g.tested[0])
            const to0 = indexOf(g.tested[1])
            return from0 >= 0 && to0 >= from0 ? (
              <rect key={g.tested.join('-')} className="cv-tested" x={x(from0) - half} y={PAD.top} width={x(to0) - x(from0) + half * 2} height={plotBottom - PAD.top} />
            ) : null
          })}
          {yTicks.map((t) => (
            <g key={t}>
              <line className="cv-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="cv-tick" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
                {writeTick(t)}
              </text>
            </g>
          ))}
          {years.map((year, i) =>
            year % xEvery === 0 ? (
              <text key={year} className="cv-tick" x={x(i)} y={height - 6} textAnchor="middle">
                {year}
              </text>
            ) : null,
          )}
          {marks.map((m) => (
            <g key={m.name}>
              <line className={`cv-mark ${m.name === 'B' ? 'b' : 'a'}`} x1={x(indexOf(m.year))} x2={x(indexOf(m.year))} y1={PAD.top} y2={plotBottom} />
              <text className={`cv-mark-label ${m.name === 'B' ? 'b' : 'a'}`} x={x(indexOf(m.year))} y={PAD.top - 6} textAnchor="middle">
                {m.name}
              </text>
            </g>
          ))}
          {methodX !== null && (
            <g>
              <line className="cv-method" x1={methodX} x2={methodX} y1={PAD.top} y2={plotBottom} />
              <text className="cv-method-label" x={methodX + 3} y={PAD.top + 9}>
                {hansen.year}
              </text>
            </g>
          )}
          {shown >= 0 && shown < n && <line className="cv-cursor" x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={plotBottom} />}
          {bars
            ? series[0]?.values.map((v, i) =>
                v === null ? null : (
                  <rect
                    key={years[i]}
                    className={`cv-bar ${tone} ${series[0].kinds?.[i] ?? 'ok'}`}
                    x={PAD.left + step * i + step * 0.14}
                    width={Math.max(1, step * 0.72)}
                    y={y(Math.max(v, lo))}
                    height={Math.max(v > 0 ? 1 : 0, plotBottom - y(Math.max(v, lo)))}
                  />
                ),
              )
            : series.map((s) => (
                <g key={s.id}>
                  {segments(s).map((d, i) => (
                    <path key={i} className={`cv-line${s.dashed ? ' dashed' : ''}`} d={d} />
                  ))}
                  {s.values.map((v, i) =>
                    v === null ? null : (
                      <circle
                        key={years[i]}
                        className={`cv-dot ${s.kinds?.[i] ?? 'ok'}${s.dashed ? ' dashed' : ''}`}
                        cx={x(i)}
                        cy={y(v)}
                        r={s.kinds?.[i] === 'hollow' ? 3.5 : i === shown ? 3.5 : 2.2}
                      />
                    ),
                  )}
                </g>
              ))}
          {segs.map((g) =>
            g.sen && indexOf(g.sen.start.year) >= 0 && indexOf(g.sen.end.year) >= 0 ? (
              <line
                key={`sen-${g.tested.join('-')}`}
                className={`cv-sen${g.significant ? '' : ' not-clear'}`}
                x1={x(indexOf(g.sen.start.year))}
                x2={x(indexOf(g.sen.end.year))}
                y1={y(g.sen.start.value)}
                y2={y(g.sen.end.value)}
              />
            ) : null,
          )}
        </svg>
      </div>
      {caption && <figcaption className="cv-caption">{caption}</figcaption>}
      {methodX !== null && <MethodChangeNote className="cv-caption" greyed={series.some((s) => s.kinds?.includes('outside'))} />}
    </figure>
  )
}

interface SparklineProps {
  years: number[]
  values: (number | null)[]
  from: number
  to: number
}

const SW = 112
const SH = 28

/** A yearly line of 112 × 28 pixels with year A and year B marked. Decorative: the numbers are in the table row. */
export function Sparkline({ years, values, from, to }: SparklineProps) {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return <span className="cv-spark-empty" aria-hidden="true" />
  const lo = Math.min(...present)
  const hi = Math.max(...present)
  const x = (i: number) => 3 + (i / Math.max(1, years.length - 1)) * (SW - 6)
  const y = (v: number) => SH - 4 - ((v - lo) / (hi - lo || 1)) * (SH - 8)
  let d = ''
  values.forEach((v, i) => {
    d += v === null ? '' : `${d && values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  const a = years.indexOf(from)
  const b = years.indexOf(to)
  const bValue = b >= 0 ? values[b] : null
  return (
    <svg className="cv-spark" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
      {a >= 0 && <line className="cv-spark-tick" x1={x(a)} x2={x(a)} y1={1} y2={SH - 1} />}
      {b >= 0 && <line className="cv-spark-tick b" x1={x(b)} x2={x(b)} y1={1} y2={SH - 1} />}
      <path className="cv-spark-line" d={d} />
      {bValue !== null && bValue !== undefined && <circle className="cv-spark-dot" cx={x(b)} cy={y(bValue)} r={2.5} />}
    </svg>
  )
}
