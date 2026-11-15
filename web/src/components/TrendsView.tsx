// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Trends view (?view=trends&zone=&var=): how the whole Amazon and its Brazilian and Peruvian parts changed, from the yearly
// zone values and tests of zones.json. Headline cards, a table with one row per measure that selects the detail chart, the
// detail with a plain-language reading, and "How the test works and how we checked it". It shows the pipeline's slopes, p-values,
// significance flags and counts as they are: nothing is tested, averaged or counted here. Zone tests are one test per zone and
// measure and are NOT corrected for multiple tests; the counts of squares are (false discovery rate). It never claims a cause.
// Lazy-loaded by App and mounted inside <main>; keep the named export and the props.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Manifest, Zone, ZonesReport, ZoneVariable } from '../../shared/contracts.ts'
import { useZones } from '../hooks/useZones.ts'
import { useMediaQuery } from '../hooks/useMediaQuery.ts'
import { useValidation } from '../hooks/useSignoData.ts'
import { useUrlParams } from '../hooks/useUrlParam.ts'
import { formatPValue } from '../lib/format.ts'
import {
  defaultYear,
  DIRECTION_WORD,
  directionOf,
  formatSignedNumber,
  formatValue,
  LST_NOTE,
  measureFor,
  measuresOf,
  orderedZoneIds,
  rangeSentence,
  slopeParts,
  slopeSentence,
  unitParts,
  zoneHeading,
  zoneSelectorLabel,
  type Direction,
  type Measure,
} from '../lib/zoneTrends.ts'
import { Sparkline, ZoneChart } from './ZoneChart.tsx'
import { TrendMethod } from './TrendMethod.tsx'
import { ViewLink } from './ViewLink.tsx'
import './trends.css'

export interface TrendsViewProps {
  manifest: Manifest
}

/** The measures of the four headline cards. */
const KPI_KEYS = ['hansenTreeCover', 'lossKm2', 'lst_day', 'precip']

export function TrendsView({ manifest }: TrendsViewProps) {
  const zonesPublished = manifest.extras.zones === true
  const zones = useZones(zonesPublished)
  const validation = useValidation(manifest.extras.validation)

  if (!zonesPublished) {
    return (
      <div className="page page-trends">
        <h1>How has the Amazon changed since 2001?</h1>
        <p className="muted">
          Zone trends are not published yet. The map and the cross-checks work: <ViewLink view="map">open the map</ViewLink> or{' '}
          <ViewLink view="checks">see the cross-checks</ViewLink>.
        </p>
      </div>
    )
  }
  if (zones.error) {
    return (
      <div className="page page-trends">
        <h1>How has the Amazon changed since 2001?</h1>
        <p className="error" role="alert">
          Could not load the zone trends ({zones.error}).
        </p>
        <p>
          <button type="button" className="btn" onClick={zones.retry}>
            Try again
          </button>
        </p>
      </div>
    )
  }
  if (!zones.data) {
    return (
      <div className="page page-trends" aria-busy="true">
        <h1>How has the Amazon changed since 2001?</h1>
        <div className="tr-skeleton" style={{ height: 96 }} />
        <div className="tr-skeleton" style={{ height: 384 }} />
        <div className="tr-skeleton" style={{ height: 280 }} />
        <p className="sr-only" role="status">
          Loading the zone trends…
        </p>
      </div>
    )
  }
  // The method panel treats a null validation as "check results not published".
  return <TrendsDashboard report={zones.data} validation={manifest.extras.validation ? validation : null} />
}

// Dashboard

function TrendsDashboard({ report, validation }: { report: ZonesReport; validation: ReturnType<typeof useValidation> | null }) {
  const [params, setParams] = useUrlParams()
  const compact = useMediaQuery('(max-width: 767px)')
  const detailRef = useRef<HTMLElement>(null)
  const [picked, setPicked] = useState<{ key: string; year: number } | null>(null)

  const zoneIds = orderedZoneIds(Object.keys(report.zones))
  const zoneParam = params.get('zone')
  const zoneId = zoneParam !== null && zoneIds.includes(zoneParam) ? zoneParam : (zoneIds[0] ?? 'amazon')
  const zone: Zone | undefined = report.zones[zoneId]
  if (!zone) return <p className="muted page-status">This report has no zones.</p>

  const rows = measuresOf(zone)
  const asked = measureFor(params.get('var'))
  const selected =
    rows.find((r) => asked !== null && r.measure.key === asked.key) ?? rows.find((r) => r.variable.zoneTrend) ?? rows[0]
  const heading = zoneHeading(zoneId, zone.label)
  const missing = rows.length < 8
  const notAvailable = ['lossKm2', 'burned_area', 'ndvi', 'evi', 'lst_day', 'precip', 'modisTreeCover', 'hansenTreeCover'].filter(
    (key) => !zone.variables[key],
  )

  const select = (measure: Measure) => {
    setParams({ var: measure.id })
    detailRef.current?.scrollIntoView({ block: 'nearest' })
  }

  const yearKey = selected ? `${zoneId}/${selected.measure.key}` : ''
  const year =
    selected === undefined ? null : picked?.key === yearKey ? picked.year : defaultYear(selected.variable, selected.measure)

  return (
    <div className="page page-trends tr">
      <header className="tr-head">
        <div>
          <h1>How has the {heading} changed since 2001?</h1>
          <p className="muted tr-lead">
            Yearly values and a trend test for each measure: Mann-Kendall test on yearly values, Sen slope per decade, α = {report.alpha}.{' '}
            <a href="#how-it-works">How the test works and how we checked it</a>
          </p>
          {report.dataStatus === 'mock' && <p className="tr-small muted">Sample data: these numbers are synthetic.</p>}
        </div>
        <ZoneSelector
          ids={zoneIds}
          labels={Object.fromEntries(zoneIds.map((id) => [id, zoneSelectorLabel(id, report.zones[id].label)]))}
          value={zoneId}
          compact={compact}
          onChange={(id) => setParams({ zone: id })}
        />
      </header>

      <section aria-label="Headline numbers">
        <ul className="tr-kpis">
          {KPI_KEYS.map((key) => {
            const row = rows.find((r) => r.measure.key === key)
            return row ? (
              <li key={key}>
                <Kpi measure={row.measure} variable={row.variable} selected={selected?.measure.key === key} onSelect={() => select(row.measure)} />
              </li>
            ) : null
          })}
        </ul>
        <p className="tr-small muted">
          “Clear trend” is a zone-level test: one test for this zone and measure, not corrected for multiple tests. Counts of squares
          are corrected (false discovery rate {Math.round(report.alpha * 100)} %).
        </p>
      </section>

      <section aria-labelledby="tr-table-title" className="tr-section">
        <h2 id="tr-table-title">Every measure, one row each</h2>
        <div className="tr-table-scroll tr-measures-wrap">
          <table className="tr-measures">
            <caption className="sr-only">
              Trend of each measure in the {heading}. Choose a measure to show its chart below the table.
            </caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Years tested</th>
                <th scope="col">Direction</th>
                <th scope="col">Change per decade</th>
                <th scope="col">Clear trend? <span className="tr-colnote">zone-level test</span></th>
                <th scope="col">Squares falling | rising</th>
                <th scope="col">Yearly values</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ measure, variable }) => (
                <MeasureRow
                  key={measure.key}
                  measure={measure}
                  variable={variable}
                  selected={selected?.measure.key === measure.key}
                  onSelect={() => select(measure)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="tr-small muted">
          Squares: 1° squares of the zone with a clear fall or rise (after correcting for testing many squares), out of the squares
          tested. Hansen tree cover is shown as context and is not tested.
          {missing && notAvailable.length > 0 && ` Not available for the ${heading}: ${notAvailable.map((k) => measureFor(k)?.name ?? k).join(', ')}.`}
        </p>
      </section>

      {selected && (
        <section ref={detailRef} aria-labelledby="tr-detail-title" className="tr-section tr-detail">
          <div className="tr-detail-chart">
            <h2 id="tr-detail-title">
              {selected.measure.name}, {heading}
            </h2>
            <p className="tr-small muted tr-units">
              {selected.variable.units === 'unitless' ? 'Yearly mean, no units' : `Yearly values in ${selected.variable.units}`}
            </p>
            <ZoneChart
              key={yearKey}
              variable={selected.variable}
              measure={selected.measure}
              year={year}
              onYear={(y) => setPicked({ key: yearKey, year: y })}
            />
            <p className="tr-small muted">Source: {selected.measure.source}</p>
          </div>
          <aside className="tr-detail-text" aria-labelledby="tr-means-title">
            <h3 id="tr-means-title">What this means</h3>
            <Meaning report={report} heading={heading} measure={selected.measure} variable={selected.variable} year={year} />
            {selected.measure.map && (
              <p>
                <ViewLink view="map" params={selected.measure.map} className="btn primary">
                  See it on the map
                </ViewLink>
              </p>
            )}
          </aside>
        </section>
      )}

      {selected && <TrendMethod report={report} validation={validation} measure={selected.measure} />}

      <footer className="tr-foot tr-small muted">
        <p>
          Sources: NASA MODIS MOD13C2, MOD11C3, MCD64A1 and MOD44B (LP DAAC), NASA GPM IMERG (GES DISC) and Hansen/UMD/Google/USGS/NASA
          Global Forest Change. Zone values are area-weighted means of the 1° squares. The Brazilian and Peruvian parts hold the squares
          that lie mostly inside each country.
        </p>
        <p>{report.aiDisclosure}</p>
        <p>
          <ViewLink view="checks">Cross-checks</ViewLink> · <ViewLink view="method" hash="trend-test">Method and sources</ViewLink>
        </p>
      </footer>
    </div>
  )
}

// Zone selector

interface ZoneSelectorProps {
  ids: string[]
  labels: Record<string, string>
  value: string
  compact: boolean
  onChange: (id: string) => void
}

function ZoneSelector({ ids, labels, value, compact, onChange }: ZoneSelectorProps) {
  if (compact) {
    return (
      <div className="tr-zone-select">
        <label htmlFor="tr-zone">Zone</label>
        <select id="tr-zone" value={value} onChange={(e) => onChange(e.target.value)}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {labels[id]}
            </option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <fieldset className="tr-seg">
      <legend>Zone</legend>
      {ids.map((id) => (
        <label key={id}>
          <input type="radio" name="tr-zone" value={id} checked={id === value} onChange={() => onChange(id)} />
          <span>{labels[id]}</span>
        </label>
      ))}
    </fieldset>
  )
}

// Direction and counts

function DirectionIcon({ direction }: { direction: Direction }) {
  const path =
    direction === 'falling' ? 'M2 4 L12 12 M12 12 L12 6 M12 12 L6 12' : direction === 'rising' ? 'M2 12 L12 4 M12 4 L12 10 M12 4 L6 4' : 'M2 8 L12 8'
  return (
    <svg className={`tr-dir tr-dir-${direction}`} width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" focusable="false">
      {direction === 'untested' ? <path d="M3 8 L11 8" strokeDasharray="2 2" /> : <path d={path} />}
    </svg>
  )
}

function SquareBar({ tested, down, up }: { tested: number; down: number; up: number }) {
  // The bar widths are CSS ratios of the backend's counts; nothing is divided in the browser.
  return (
    <span className="tr-sqbar" style={{ '--n-total': tested, '--n-down': down, '--n-up': up } as CSSProperties} aria-hidden="true">
      <span className="tr-sq-down" />
      <span className="tr-sq-up" />
    </span>
  )
}

function squaresText(variable: ZoneVariable): string | null {
  const c = variable.cellSummary
  return c ? `${c.significantDecreasing} falling and ${c.significantIncreasing} rising, of ${c.tested} squares tested` : null
}

// Table row

function MeasureRow({ measure, variable, selected, onSelect }: { measure: Measure; variable: ZoneVariable; selected: boolean; onSelect: () => void }) {
  const trend = variable.zoneTrend
  const direction = directionOf(variable)
  const cells = variable.cellSummary
  return (
    <tr className={selected ? 'is-selected' : undefined}>
      <th scope="row" data-label="Measure">
        <button type="button" className="tr-rowbtn" aria-pressed={selected} onClick={onSelect}>
          {measure.name}
        </button>
        <span className="tr-small muted tr-units">{variable.units === 'unitless' ? 'no units' : variable.units}</span>
      </th>
      <td data-label="Years tested">
        {trend ? `${trend.years[0]}–${trend.years[1]}` : '—'}
        {measure.key === 'lst_day' && (
          <span className="tr-small muted tr-block">Ends in 2020: later years are biased by the satellite&rsquo;s orbit drift.</span>
        )}
        {(measure.key === 'ndvi' || measure.key === 'evi') && trend && (
          <span className="tr-small muted tr-block">Ends in 2020: satellite drift after that.</span>
        )}
      </td>
      <td data-label="Direction">
        <span className="tr-dirtext">
          <DirectionIcon direction={direction} />
          {DIRECTION_WORD[direction]}
        </span>
      </td>
      <td data-label="Change per decade" className="tr-num">
        {trend && trend.slopePerDecade !== null ? <SlopeText slope={trend.slopePerDecade} units={variable.units} /> : '—'}
      </td>
      <td data-label="Clear trend?">
        {trend ? (
          <span className={trend.significant ? 'tr-tag is-clear' : 'tr-tag'}>{trend.significant ? 'Clear trend' : 'Not clear'}</span>
        ) : (
          <span className="muted">Not tested</span>
        )}
      </td>
      <td data-label="Squares falling | rising">
        {cells ? (
          <>
            <span className="tr-squares">
              <span className="tr-sq-n">{cells.significantDecreasing}</span>
              <SquareBar tested={cells.tested} down={cells.significantDecreasing} up={cells.significantIncreasing} />
              <span className="tr-sq-n">{cells.significantIncreasing}</span>
            </span>
            <span className="sr-only">{squaresText(variable)}</span>
            <span className="tr-small muted tr-block" aria-hidden="true">
              of {cells.tested} tested
            </span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td data-label="Yearly values">
        <Sparkline variable={variable} measure={measure} />
      </td>
    </tr>
  )
}

function SlopeText({ slope, units }: { slope: number; units: string }) {
  const { value, unit } = slopeParts(slope, units)
  return (
    <span className="mono">
      {value}
      {unit ? ` ${unit}` : ''}
      <span className="tr-small muted tr-block">per decade</span>
    </span>
  )
}

// Headline cards

function Kpi({ measure, variable, selected, onSelect }: { measure: Measure; variable: ZoneVariable; selected: boolean; onSelect: () => void }) {
  const trend = variable.zoneTrend
  const direction = directionOf(variable)
  const cells = variable.cellSummary
  let body: ReactNode

  if (!trend) {
    // Hansen tree cover: first and last year with a value, and their difference (B minus A)
    const known = variable.annual.filter((p) => p.value !== null)
    const first = known[0]
    const last = known[known.length - 1]
    body =
      first && last ? (
        <>
          <p className="tr-kpi-value mono">
            {formatValue(first.value as number, variable.units)} → {formatValue(last.value as number, variable.units)}
          </p>
          <p className="tr-small">
            {first.year} → {last.year}: {formatSignedNumber((last.value as number) - (first.value as number))} points.
          </p>
          <p className="tr-small muted">Not tested: it can only go down, because regrowth is not counted.</p>
        </>
      ) : (
        <p className="muted">No values.</p>
      )
  } else {
    const { value, unit } = trend.slopePerDecade === null ? { value: '—', unit: '' } : slopeParts(trend.slopePerDecade, variable.units)
    body = (
      <>
        <p className="tr-kpi-dir">
          <DirectionIcon direction={direction} />
          {DIRECTION_WORD[direction]}
        </p>
        <p className="tr-kpi-value mono">
          {value}
          {unit && <small> {unit}</small>}
        </p>
        <p className="tr-small">
          per decade, {trend.years[0]}–{trend.years[1]}.{' '}
          <span className={trend.significant ? 'tr-tag is-clear' : 'tr-tag'}>{trend.significant ? 'Clear trend' : 'Not a clear trend'}</span>
        </p>
        {cells && (
          <p className="tr-small muted">
            {cells.significantDecreasing} squares falling, {cells.significantIncreasing} rising, of {cells.tested} tested.
          </p>
        )}
        {measure.key === 'lst_day' && <p className="tr-small muted">{LST_NOTE}</p>}
      </>
    )
  }

  return (
    <div className={selected ? 'tr-kpi is-selected' : 'tr-kpi'}>
      <p className="tr-kpi-label">{measure.name}</p>
      {body}
      <button type="button" className="tr-link" aria-pressed={selected} onClick={onSelect}>
        Show the chart
      </button>
    </div>
  )
}

// Plain-language reading

function Meaning({ report, heading, measure, variable, year }: { report: ZonesReport; heading: string; measure: Measure; variable: ZoneVariable; year: number | null }) {
  const trend = variable.zoneTrend
  const zone = `the ${heading}`
  const cells = variable.cellSummary
  const range = year === null ? null : rangeSentence(variable, year)
  const known = variable.annual.filter((p) => p.value !== null)
  const first = known[0]
  const last = known[known.length - 1]
  let headline: string
  if (!trend || trend.slopePerDecade === null) {
    headline =
      first && last
        ? `${measure.name} in ${zone} went from ${formatValue(first.value as number, variable.units)} in ${first.year} to ${formatValue(last.value as number, variable.units)} in ${last.year}. It is not tested: it can only go down, because regrowth is not counted.`
        : `${measure.name} has no values for ${zone}.`
  } else {
    const size = slopeSentence(Math.abs(trend.slopePerDecade), variable.units).replace(/^\+/, '')
    const pText = formatPValue(trend.pValue)
    const p = `p ${pText.startsWith('<') ? pText : `= ${pText}`}, α = ${report.alpha}`
    headline = trend.significant && trend.slopePerDecade === 0
      ? `${measure.name} in ${zone} shows a clear order from ${trend.years[0]} to ${trend.years[1]} (${p}) but no measurable slope, so we do not call it a trend.`
      : trend.significant
      ? `${measure.name} in ${zone} ${trend.slopePerDecade < 0 ? 'fell' : 'rose'} by about ${size} from ${trend.years[0]} to ${trend.years[1]}. The test says this is more than year-to-year variation (${p}).`
      : `${measure.name} in ${zone} moved by about ${size} (${trend.slopePerDecade < 0 ? 'down' : 'up'}) from ${trend.years[0]} to ${trend.years[1]}, but that is within year-to-year variation (${p}), so we do not call it a trend.`
  }
  return (
    <div className="tr-meaning">
      <p>{headline}</p>
      {trend && <p className="tr-small muted">This is one test for this zone and measure, not corrected for multiple tests.</p>}
      {range && <p>{range}</p>}
      {cells && (
        <p>
          Of the {cells.tested} squares tested, {cells.significantDecreasing} fell and {cells.significantIncreasing} rose clearly (after
          correcting for testing many squares).
        </p>
      )}
      {measure.note && <p className="tr-small muted">{measure.note}</p>}
      <p className="tr-small muted">A trend describes a pattern in measurements. It does not say what caused it.</p>
      {unitParts(variable.units).value === '' && measure.kind === 'line' && (
        <p className="tr-small muted">The index has no units: it is a ratio of satellite readings, higher means greener.</p>
      )}
    </div>
  )
}
