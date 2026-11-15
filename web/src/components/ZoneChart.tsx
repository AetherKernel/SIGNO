// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Yearly values of one measure in one zone (Trends view). Lines for states, bars for amounts. The Sen trend line is drawn
// only over the tested years and only when the zone test ran; years outside the test are greyed (satellite drift years for
// NDVI and EVI) and incomplete years are hollow. For measures with a monthly range (greenness, temperature) a thin bar per year
// shows the lowest and highest month: the seasonal cycle, shown as information and never tested. One tab stop: left and right
// arrows move between years. A text readout and a collapsible table repeat every number (no information in colour alone).

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import type { ZoneVariable } from '../../shared/contracts.ts'
import {
  drawnSenLine,
  formatNumber,
  formatValue,
  LST_NOTE,
  LST_NOTE_ES,
  measureName,
  monthName,
  niceTicks,
  pointState,
  rangeSentence,
  slopeSentence,
  stateReason,
  valueSentence,
  unitParts,
  type Measure,
  type PointState,
} from '../lib/zoneTrends.ts'
import { localizeUnits } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'
import './trends.css'

const PAD = { left: 58, right: 16, top: 22, bottom: 30 }

function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || 640)
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || 640))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export interface ZoneChartProps {
  variable: ZoneVariable
  measure: Measure
  /** The year the readout describes; null when the measure has no value. */
  year: number | null
  onYear: (year: number) => void
}

export function ZoneChart({ variable, measure, year, onYear }: ZoneChartProps) {
  const { t } = useLang()
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const readoutId = useId()
  const points = variable.annual.filter((p) => p.value !== null)
  const trend = variable.zoneTrend
  const sen = drawnSenLine(variable, measure)
  const showBand = measure.kind === 'line' && (variable.monthlyRange?.length ?? 0) > 0
  const height = width < 480 ? 250 : 300

  if (points.length === 0) return <p className="muted">{t('No yearly values for this measure.', 'No hay valores anuales para esta medida.')}</p>

  const years = points.map((p) => p.year)
  const firstYear = years[0]
  const lastYear = years[years.length - 1]
  const plotW = Math.max(120, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const x = (yr: number) => PAD.left + ((yr - (firstYear - 0.5)) / (lastYear - firstYear + 1)) * plotW
  const slot = plotW / (lastYear - firstYear + 1)

  // y domain: every value drawn (yearly values, monthly range, Sen line); bars start at zero
  const drawn: number[] = points.map((p) => p.value as number)
  if (showBand) for (const r of variable.monthlyRange ?? []) drawn.push(r.min, r.max)
  if (sen) drawn.push(sen.y0, sen.y1)
  let lo = Math.min(...drawn)
  let hi = Math.max(...drawn)
  if (measure.kind === 'bars' && lo > 0) {
    lo = 0
    hi += (hi || 1) * 0.06
  } else {
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08
    lo -= pad
    hi += pad
  }
  const ticks = niceTicks(lo, hi, 4)
  lo = Math.min(lo, ticks[0] ?? lo)
  hi = Math.max(hi, ticks[ticks.length - 1] ?? hi)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH

  const xStep = width < 480 ? 10 : 5
  const xTicks = years.filter((yr) => yr % xStep === 0)
  const states = new Map<number, PointState>(points.map((p) => [p.year, pointState(p, variable, measure)]))
  const seriesColor = measure.key === 'lossKm2' ? 'var(--loss-4)' : measure.key === 'burned_area' ? 'var(--burn-4)' : 'var(--accent)'
  const hasUnused = [...states.values()].some((s) => s === 'drift' || s === 'unused')
  const hasIncomplete = [...states.values()].some((s) => s === 'incomplete')
  const driftStart = measure.drift && trend ? trend.years[1] + 0.5 : null

  // Lines: solid through the years used in the test; dashed grey through the drift years that follow
  const used = points.filter((p) => states.get(p.year) === 'used')
  const linePath = used.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.value as number).toFixed(1)}`).join('')
  const lastUsed = used[used.length - 1]
  const drift = points.filter((p) => states.get(p.year) === 'drift')
  const driftPath =
    lastUsed && drift.length > 0
      ? [lastUsed, ...drift].map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.value as number).toFixed(1)}`).join('')
      : ''

  const yearAt = (clientX: number, left: number): number => {
    const raw = firstYear - 0.5 + ((clientX - left - PAD.left) / plotW) * (lastYear - firstYear + 1)
    return years.reduce((best, yr) => (Math.abs(yr - raw) < Math.abs(best - raw) ? yr : best), years[0])
  }
  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    onYear(yearAt(event.clientX, box.left))
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = year === null ? -1 : years.indexOf(year)
    const next =
      event.key === 'ArrowLeft' ? Math.max(0, at - 1)
      : event.key === 'ArrowRight' ? Math.min(years.length - 1, at + 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? years.length - 1
      : null
    if (next === null) return
    event.preventDefault()
    onYear(years[next])
  }

  const current = year === null ? null : (points.find((p) => p.year === year) ?? null)
  const currentState = current ? states.get(current.year) : undefined
  const range = year === null ? null : rangeSentence(variable, year, t)
  const units = variable.units
  const monthlyRange = variable.monthlyRange ?? []
  const missingYears = variable.annual.filter((p) => p.value === null).map((p) => p.year)
  const name = measureName(measure, t)
  const label = t(`${name}, yearly values ${firstYear} to ${lastYear}`, `${name}, valores anuales de ${firstYear} a ${lastYear}`)

  return (
    <figure className="tr-chart">
      <div
        ref={wrapRef}
        className="tr-chart-wrap"
        tabIndex={0}
        role="group"
        aria-label={t(`${label}. Use the left and right arrow keys to move between years.`, `${label}. Usa las flechas izquierda y derecha para moverte entre años.`)}
        aria-describedby={readoutId}
        onKeyDown={onKey}
      >
        <svg width={width} height={height} role="img" aria-label={label} onPointerMove={(e) => e.pointerType === 'mouse' && onPointer(e)} onPointerDown={onPointer}>
          <defs>
            <pattern id={`${readoutId}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="tr-hatch" />
            </pattern>
          </defs>

          {/* Years tested */}
          {trend && (
            <>
              <rect className="tr-window" x={x(trend.years[0] - 0.5)} y={PAD.top} width={x(trend.years[1] + 0.5) - x(trend.years[0] - 0.5)} height={plotH} />
              <text className="tr-note" x={x(trend.years[0] - 0.5) + 6} y={PAD.top - 8}>
                {t('Years tested', 'Años probados')}: {trend.years[0]}–{trend.years[1]}
              </text>
            </>
          )}
          {driftStart !== null && lastYear + 0.5 > driftStart && (
            <>
              <rect className="tr-drift" x={x(driftStart)} y={PAD.top} width={x(lastYear + 0.5) - x(driftStart)} height={plotH} fill={`url(#${readoutId}-hatch)`} />
              <text className="tr-note" x={x(lastYear + 0.5) - 4} y={PAD.top - 8} textAnchor="end">
                {t('Satellite drift years: not tested', 'Años con deriva del satélite: sin probar')}
              </text>
            </>
          )}

          {/* Grid and axes */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="tr-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className="tr-tick" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((yr) => (
            <text key={yr} className="tr-tick" x={x(yr)} y={height - 9} textAnchor="middle">
              {yr}
            </text>
          ))}

          {/* Monthly range: lowest and highest month of each complete year (information, not tested) */}
          {showBand &&
            monthlyRange.map((r) => (
              <rect key={r.year} className="tr-band" x={x(r.year) - Math.min(4, slot * 0.3)} width={Math.min(8, slot * 0.6)} y={y(r.max)} height={Math.max(1, y(r.min) - y(r.max))} rx="1.5" />
            ))}

          {/* Selected year */}
          {year !== null && <line className="tr-selected-rule" x1={x(year)} x2={x(year)} y1={PAD.top} y2={PAD.top + plotH} />}

          {/* Values */}
          {measure.kind === 'bars'
            ? points.map((p) => {
                const state = states.get(p.year) as PointState
                const w = Math.max(3, slot * 0.64)
                return (
                  <rect
                    key={p.year}
                    className={`tr-bar tr-${state}${p.year === year ? ' is-selected' : ''}`}
                    style={{ '--series': seriesColor } as CSSProperties}
                    x={x(p.year) - w / 2}
                    width={w}
                    y={y(p.value as number)}
                    height={Math.max(1, y(Math.max(lo, 0)) - y(p.value as number))}
                  />
                )
              })
            : (
              <>
                {driftPath && <path className="tr-line-drift" d={driftPath} />}
                {linePath && <path className="tr-line" style={{ '--series': seriesColor } as CSSProperties} d={linePath} />}
                {points.map((p) => {
                  const state = states.get(p.year) as PointState
                  return (
                    <circle
                      key={p.year}
                      className={`tr-dot tr-${state}${p.year === year ? ' is-selected' : ''}`}
                      style={{ '--series': seriesColor } as CSSProperties}
                      cx={x(p.year)}
                      cy={y(p.value as number)}
                      r={p.year === year ? 5.5 : 3.5}
                    />
                  )
                })}
              </>
            )}

          {/* Sen slope line, only where the zone test ran */}
          {sen && trend && (
            <>
              <line className={trend.significant ? 'tr-sen is-clear' : 'tr-sen'} x1={x(sen.x0)} y1={y(sen.y0)} x2={x(sen.x1)} y2={y(sen.y1)} />
              {trend.slopePerDecade !== null && (
                <text className="tr-sen-label" x={x(sen.x1) - 4} y={y(sen.y1) - 8} textAnchor="end">
                  {trend.significant ? t('Sen slope', 'Pendiente de Sen') : t('Sen slope (no clear trend)', 'Pendiente de Sen (sin tendencia clara)')}:{' '}
                  {slopeSentence(trend.slopePerDecade, units, t)}
                </text>
              )}
            </>
          )}
        </svg>
      </div>

      <ul className="tr-legend" aria-label={t('Chart key', 'Leyenda del gráfico')}>
        <li>
          <span className="tr-key tr-key-used" style={{ '--series': seriesColor } as CSSProperties} aria-hidden="true" />
          {trend ? t('Years used in the test', 'Años usados en el test') : t('Yearly values (context, not tested)', 'Valores anuales (contexto, sin probar)')}
        </li>
        {hasUnused && (
          <li>
            <span className="tr-key tr-key-unused" aria-hidden="true" />
            {measure.drift ? t('Satellite drift years (not used)', 'Años con deriva del satélite (no se usan)') : t('Years not used', 'Años no usados')}
          </li>
        )}
        {hasIncomplete && (
          <li>
            <span className="tr-key tr-key-incomplete" style={{ '--series': seriesColor } as CSSProperties} aria-hidden="true" />
            {t('Flagged or incomplete year (hollow)', 'Año marcado o incompleto (hueco)')}
          </li>
        )}
        {showBand && (
          <li>
            <span className="tr-key tr-key-band" aria-hidden="true" />
            {t('Lowest to highest month of the year (seasonality)', 'Del mes más bajo al más alto del año (estacionalidad)')}
          </li>
        )}
        {sen && (
          <li>
            <span className={`tr-key tr-key-sen${trend?.significant ? ' is-clear' : ''}`} aria-hidden="true" />
            {trend?.significant ? t('Sen trend line', 'Línea de tendencia de Sen') : t('Sen trend line (not a clear trend)', 'Línea de tendencia de Sen (sin tendencia clara)')}
          </li>
        )}
      </ul>

      <figcaption id={readoutId} className="tr-readout" aria-live="polite">
        {current && year !== null ? (
          <>
            {/* One string per element: the readout changes with the year, also under a page translator. */}
            <strong>{`${year}:`}</strong>{' '}
            <span>{`${valueSentence(measure, current.value as number, units, t)}${currentState && currentState !== 'used' ? ` (${stateReason(currentState, variable, measure, t)})` : ''}.`}</span>{' '}
            <span>{range}</span>
          </>
        ) : (
          t('Choose a year on the chart to read its value.', 'Elige un año en el gráfico para leer su valor.')
        )}
      </figcaption>

      {measure.drift && trend && (
        <p className="tr-small muted">
          {measure.key === 'lst_day'
            ? t(LST_NOTE, LST_NOTE_ES)
            : t(
                `The test ends in ${trend.years[1]}: later years are biased by the satellite's orbit drift (see the checks below).`,
                `El test termina en ${trend.years[1]}: los años siguientes están sesgados por la deriva de la órbita del satélite (ver las comprobaciones abajo).`,
              )}
        </p>
      )}
      {trend && sen && (
        <p className="tr-small muted">
          {t('The slope, the line and the test come from the data pipeline.', 'La pendiente, la línea y el test vienen del pipeline de datos.')}
        </p>
      )}
      {missingYears.length > 0 && (
        <p className="tr-small muted">
          {t(
            `No value for ${missingYears.join(', ')}: ${missingYears.length === 1 ? 'the year is' : 'the years are'} incomplete.`,
            `Sin valor para ${missingYears.join(', ')}: ${missingYears.length === 1 ? 'el año está incompleto' : 'los años están incompletos'}.`,
          )}
        </p>
      )}

      <details className="tr-details">
        <summary>{t('Show the numbers', 'Mostrar las cifras')}</summary>
        <div className="tr-table-scroll">
          <table className="tr-values">
            <caption className="sr-only">
              {name}: {t('yearly values', 'valores anuales')}
              {unitParts(units).value ? t(` in ${units}`, ` en ${localizeUnits(units, t)}`) : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Year', 'Año')}</th>
                <th scope="col">{t('Value', 'Valor')}</th>
                {showBand && <th scope="col">{t('Lowest month', 'Mes más bajo')}</th>}
                {showBand && <th scope="col">{t('Highest month', 'Mes más alto')}</th>}
                <th scope="col">{t('Used in the test?', '¿Usado en el test?')}</th>
              </tr>
            </thead>
            <tbody>
              {variable.annual.map((p) => {
                const state = pointState(p, variable, measure)
                const r = variable.monthlyRange?.find((m) => m.year === p.year)
                return (
                  <tr key={p.year} className={p.year === year ? 'is-selected' : undefined}>
                    <th scope="row">{p.year}</th>
                    <td>{p.value === null ? t('no value', 'sin valor') : formatValue(p.value, units)}</td>
                    {showBand && <td>{r ? `${formatValue(r.min, units)} (${monthName(r.minMonth, t)})` : '—'}</td>}
                    {showBand && <td>{r ? `${formatValue(r.max, units)} (${monthName(r.maxMonth, t)})` : '—'}</td>}
                    <td>{state === 'used' ? (trend ? t('Yes', 'Sí') : t('Not tested', 'Sin probar')) : stateReason(state, variable, measure, t)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Small yearly sparkline for a table row: the values, the drift years in grey and the Sen line over the tested years. */
export function Sparkline({ variable, measure }: { variable: ZoneVariable; measure: Measure }) {
  const W = 128
  const H = 32
  const points = variable.annual.filter((p) => p.value !== null)
  if (points.length < 2) return null
  const sen = drawnSenLine(variable, measure)
  const values = points.map((p) => p.value as number)
  if (sen) values.push(sen.y0, sen.y1)
  const lo = Math.min(...values, measure.kind === 'bars' ? 0 : Infinity)
  const hi = Math.max(...values)
  const first = points[0].year
  const last = points[points.length - 1].year
  const x = (yr: number) => 3 + ((yr - first) / (last - first || 1)) * (W - 6)
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6)
  const path = (list: typeof points) => list.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.value as number).toFixed(1)}`).join('')
  const usedPoints = points.filter((p) => pointState(p, variable, measure) === 'used')
  const otherPoints = points.filter((p) => pointState(p, variable, measure) !== 'used')
  const lastUsed = usedPoints[usedPoints.length - 1]
  return (
    <svg className="tr-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {otherPoints.length > 0 && lastUsed && <path className="tr-spark-drift" d={path([lastUsed, ...otherPoints.filter((p) => p.year > lastUsed.year)])} />}
      <path className="tr-spark-line" d={path(usedPoints)} />
      {sen && <line className="tr-spark-sen" x1={x(sen.x0)} y1={y(sen.y0)} x2={x(sen.x1)} y2={y(sen.y1)} />}
    </svg>
  )
}
