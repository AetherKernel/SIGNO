// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "Cross-checks" tab of the drawer: how far the independent tree cover datasets agree, and where loss and fire
// coincide. Everything is descriptive and comes from the validation report: r values carry no p-value, there is no
// significance wording, and co-location with fire is never presented as a cause.

import { useState } from 'react'
import type { Hotspot, ValidationCase, ValidationReport, ValidationZone } from '../../shared/contracts.ts'
import { formatCoordinates, formatPercent, formatPoints, formatShare } from '../lib/format.ts'
import { ViewLink } from './ViewLink.tsx'
import { BarChart, CoverChart } from './CoverCharts.tsx'

export interface ValidationPanelProps {
  report: ValidationReport | null
  loading: boolean
  error: string | null
  /** Years of the MODIS series the API flags as suspect, drawn hollow in the case charts. */
  flaggedModisYears: number[]
  onShowHotspot: (hotspot: Hotspot) => void
  onShowCase: (place: ValidationCase, peakYear: number) => void
}

const DOI_LABEL: Record<string, string> = {
  MOD44B: 'NASA MOD44B v061, MODIS tree cover',
  HANSEN: 'Hansen/UMD Global Forest Change (Hansen et al. 2013)',
  MCD64A1: 'NASA MCD64A1 v061, MODIS burned area',
}

/** "MAAP #233 (Sep 2025), https://…" -> the text and the link, so the link can be a real anchor. */
function splitReference(reference: string): { text: string; url: string | null } {
  const url = /https?:\/\/\S+/.exec(reference)?.[0] ?? null
  return { text: reference.replace(url ?? '', '').replace(/[,\s]+$/, ''), url }
}

/** Year of the highest value of a yearly series (where the case is shown on the map). */
function peakYear(years: number[], values: (number | null)[]): number {
  let best = years[years.length - 1]
  let max = -Infinity
  values.forEach((v, i) => {
    if (v !== null && v > max) {
      max = v
      best = years[i]
    }
  })
  return best
}

function AgreementCard({ zone }: { zone: ValidationZone }) {
  const a = zone.agreement2000
  return (
    <section className="vcard" aria-labelledby="v-agree">
      <h3 id="v-agree">Do the two tree cover datasets agree? (year 2000)</h3>
      <p className="small">
        Across {a.cells.toLocaleString('en-US')} small cells, MODIS and Hansen agree on where tree cover is dense and
        where it is sparse
        {a.r !== null ? ` (r = ${a.r.toFixed(2)}, a descriptive measure with no p-value)` : ''}. But MODIS reads{' '}
        {Math.abs(a.biasPp).toFixed(1)} points {a.biasPp < 0 ? 'lower' : 'higher'} than Hansen on average (typical gap{' '}
        {a.rmsePp.toFixed(1)} points). That is why SIGNO uses MODIS to confirm where change happened, not how much tree
        cover there is.
      </p>
      <table className="vtable">
        <caption className="sr-only">Mean tree cover by Hansen class, Hansen and MODIS</caption>
        <thead>
          <tr>
            <th scope="col">Hansen class (% tree cover)</th>
            <th scope="col">Cells</th>
            <th scope="col">Hansen</th>
            <th scope="col">MODIS</th>
          </tr>
        </thead>
        <tbody>
          {a.byHansenClass.map((c) => (
            <tr key={c.hansenRange.join('-')}>
              <th scope="row">
                {c.hansenRange[0]}–{c.hansenRange[1]} %
              </th>
              <td className="mono">{c.cells.toLocaleString('en-US')}</td>
              <td>
                <span className="mono">{formatPercent(c.hansenMean)}</span>
                <span className="hbar" aria-hidden="true">
                  <i className="hansen" style={{ width: `${c.hansenMean}%` }} />
                </span>
              </td>
              <td>
                <span className="mono">{formatPercent(c.modisMean)}</span>
                <span className="hbar" aria-hidden="true">
                  <i className="modis" style={{ width: `${c.modisMean}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ChangeCard({ zone }: { zone: ValidationZone }) {
  const c = zone.changeVsLoss
  const maxAbs = Math.max(1, ...c.byLossDecile.map((d) => Math.abs(d.modisChangePpMean)))
  return (
    <section className="vcard" aria-labelledby="v-change">
      <h3 id="v-change">Does MODIS see change where Hansen sees loss?</h3>
      <p className="small">
        Cells are sorted into ten groups by the share of their area Hansen lost since 2001 (group 1 lost the least,
        group 10 the most). Bars show how much MODIS tree cover changed in each group ({c.definition}).
        {c.r !== null ? ` Across cells r = ${c.r.toFixed(2)} (descriptive, no p-value).` : ''} This change is the mean 2024–25 minus the mean 2001–02 and includes the MODIS 2025 year flagged as suspect. This confirms where tree
        cover changed, not by how much.
      </p>
      <table className="vtable">
        <caption className="sr-only">MODIS tree cover change by group of Hansen loss</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Hansen loss (share of area)</th>
            <th scope="col">MODIS change (points)</th>
          </tr>
        </thead>
        <tbody>
          {c.byLossDecile.map((d) => (
            <tr key={d.decile}>
              <th scope="row">{d.decile}</th>
              <td className="mono">{formatShare(d.hansenLossShareMean)}</td>
              <td>
                <span className="mono">{formatPoints(d.modisChangePpMean)}</span>
                <span className="dbar" aria-hidden="true">
                  <i
                    className={d.modisChangePpMean < 0 ? 'down' : 'up'}
                    style={{ width: `${(Math.abs(d.modisChangePpMean) / maxAbs) * 50}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const SW = 640
const SH = 180
const SPAD = { left: 44, right: 10, top: 10, bottom: 24 }

function FireCard({ zone }: { zone: ValidationZone }) {
  const years = zone.lossWithFire.years
  const n = years.length
  const step = (SW - SPAD.left - SPAD.right) / Math.max(1, n)
  const y = (share: number) => SPAD.top + (1 - share) * (SH - SPAD.top - SPAD.bottom)
  const mostWithoutFire = n > 0 && years.every((year) => year.share < 0.5)
  return (
    <section className="vcard" aria-labelledby="v-fire">
      <h3 id="v-fire">Is the loss where fire was detected?</h3>
      <p>
        <strong>Same place is not the same cause.</strong>
        {mostWithoutFire && ` In ${zone.label} most loss happens without fire: in every year, more than half of the loss was in cells with no burned area.`}
      </p>
      <p className="small">
        Bars: the share of each year’s tree cover loss that fell in cells where burned area was also detected. Ticks:
        the share of all cells in the zone that burned that year or the year before (the base rate). Loss and fire in the same place
        show where the two coincide. They do not show that fire caused the loss, or the other way round.
      </p>
      <figure className="chart">
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          role="img"
          aria-label={`Share of yearly tree cover loss in cells with burned area, ${years[0]?.year} to ${years[n - 1]?.year}, for ${zone.label}, with the share of cells burned as a base rate`}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line className="grid" x1={SPAD.left} x2={SW - SPAD.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={SPAD.left - 6} y={y(t) + 3} textAnchor="end">
                {t * 100} %
              </text>
            </g>
          ))}
          {years.map((year, i) => (
            <g key={year.year}>
              <rect
                className="bar bar-burned"
                x={SPAD.left + step * i + step * 0.12}
                width={step * 0.76}
                y={y(year.share)}
                height={Math.max(0, SH - SPAD.bottom - y(year.share))}
              >
                <title>{`${year.year}: ${formatShare(year.share)} of the loss in cells with burned area; ${formatShare(year.zoneShareOfCellsBurned)} of cells burned`}</title>
              </rect>
              <line
                className="base-rate"
                x1={SPAD.left + step * i + step * 0.04}
                x2={SPAD.left + step * (i + 1) - step * 0.04}
                y1={y(year.zoneShareOfCellsBurned)}
                y2={y(year.zoneShareOfCellsBurned)}
              />
              {year.year % 5 === 0 && (
                <text className="tick" x={SPAD.left + step * (i + 0.5)} y={SH - 6} textAnchor="middle">
                  {year.year}
                </text>
              )}
            </g>
          ))}
        </svg>
        <figcaption>Bars: loss in cells with fire · black ticks: cells with fire (base rate)</figcaption>
      </figure>
      <details className="values-table">
        <summary>Show values</summary>
        <table>
          <caption className="sr-only">Tree cover loss in cells with burned area by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Loss (km²)</th>
              <th scope="col">Loss in burned cells (km²)</th>
              <th scope="col">Share</th>
              <th scope="col">Base rate</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year.year}>
                <th scope="row">{year.year}</th>
                <td className="mono">{year.lossKm2.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="mono">{year.lossInBurnedCellsKm2.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="mono">{formatShare(year.share)}</td>
                <td className="mono">{formatShare(year.zoneShareOfCellsBurned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="small muted">{zone.lossWithFire.definition}</p>
    </section>
  )
}

function CasesCard({
  zone,
  cases,
  flaggedModisYears,
  onShowHotspot,
  onShowCase,
}: {
  zone: ValidationZone
  cases: ValidationCase[]
  flaggedModisYears: number[]
  onShowHotspot: (hotspot: Hotspot) => void
  onShowCase: (place: ValidationCase, peakYear: number) => void
}) {
  return (
    <section className="vcard" aria-labelledby="v-places">
      <h3 id="v-places">Hotspots of tree cover loss and documented places</h3>
      <p className="small">
        Select a place to open it on the map, in the tree cover view at its year of largest loss.
      </p>
      <ol className="hotspots" aria-label={`Hotspots in ${zone.label}`}>
        {zone.hotspots.map((h, i) => (
          <li key={`${h.apiCellId}-${h.lat}-${h.lon}-${i}`}>
            <button type="button" className="hotspot" onClick={() => onShowHotspot(h)}>
              <span className="mono">
                {formatCoordinates(h.lat, h.lon, 2)} · {h.apiCellId}
              </span>
              <span className="small">
                Largest loss in {h.peakLossYear} ({formatShare(h.peakLossShare)} of the local area). Lost since 2001:{' '}
                {formatShare(h.hansenLossShare)}. Tree cover in 2000: {formatPercent(h.hansenTreeCover2000)}. MODIS
                change: {formatPoints(h.modisChangePp)} (mean 2024–25 minus mean 2001–02, includes the MODIS 2025 year
                flagged as suspect).
              </span>
              <span className="small muted">
                {h.burnedYears.length === 0
                  ? 'No burned area detected here'
                  : `Burned area detected in ${h.burnedYears.length} year${h.burnedYears.length === 1 ? '' : 's'}`}
              </span>
              <span className="small action">Show on the map</span>
            </button>
          </li>
        ))}
      </ol>

      {cases.map((place) => {
        const ref = splitReference(place.reference)
        const peak = peakYear(place.lossYears, place.hansenLossShare)
        return (
          <article key={place.id} className="case-card" aria-labelledby={`case-${place.id}`}>
            <h4 id={`case-${place.id}`}>{place.label}</h4>
            <p className="small muted mono">
              {formatCoordinates(place.lat, place.lon, 2)} · cell {place.apiCellId}
            </p>
            {place.id === 'la_pampa' && (
              <p className="small">
                In the data, Hansen loss here starts in 2012, jumps in 2014, pauses in 2020–21 and resumes in 2023.
                Gold mining in La Pampa is documented by {ref.text}
                {ref.url && (
                  <>
                    {' '}
                    (<a href={ref.url} target="_blank" rel="noreferrer">source</a>)
                  </>
                )}
                . SIGNO’s data do not identify causes: they show where and when the tree cover changed.
              </p>
            )}
            {place.id !== 'la_pampa' && (
              <p className="small">
                Reference: {ref.text}
                {ref.url && (
                  <>
                    {' '}
                    (<a href={ref.url} target="_blank" rel="noreferrer">source</a>)
                  </>
                )}
                .
              </p>
            )}
            <CoverChart
              years={place.years}
              hansen={place.hansenTreeCover}
              modis={place.modisTreeCover}
              selectedYear={null}
              flaggedModisYears={flaggedModisYears}
              label={`Tree cover at ${place.label}, Hansen and MODIS, ${place.years[0]} to ${place.years[place.years.length - 1]}`}
            />
            <h5 className="subhead">Share of the area lost each year (Hansen)</h5>
            <BarChart
              years={place.lossYears}
              values={place.hansenLossShare}
              selectedYear={null}
              tone="loss"
              unit="percent"
              label={`Share of the area lost each year at ${place.label}, ${place.lossYears[0]} to ${place.lossYears[place.lossYears.length - 1]}`}
            />
            <p className="small">
              Months with burned area detected here ({place.burnedPeriod}): <strong>{place.burnedMonths}</strong>
              {place.burnedMonths > 0 ? ` (${place.burnedMonthsList.join(', ')})` : ''}.
            </p>
            <button type="button" className="btn" onClick={() => onShowCase(place, peak)}>
              Show on the map
            </button>
          </article>
        )
      })}
    </section>
  )
}

export function ValidationPanel({ report, loading, error, flaggedModisYears, onShowHotspot, onShowCase }: ValidationPanelProps) {
  const [zoneId, setZoneId] = useState<string | null>(null)
  if (loading) return <p className="muted small">Loading the cross-checks…</p>
  if (error) return <p className="error small">{error}</p>
  if (!report) return null
  const zone = report.zones.find((z) => z.zoneId === zoneId) ?? report.zones[0]
  if (!zone) return <p className="muted small">The report has no zones.</p>

  return (
    <section id="panel-validation" role="tabpanel" aria-labelledby="tab-validation" className="validation">
      <p className="small">
        Cross-checks of the tree cover data against an independent dataset and against fire. They are descriptive:
        they do not test trends, and none of them says why tree cover changed. The trend test and its own checks are in{' '}
        <ViewLink view="trends" hash="how-it-works">How the test works</ViewLink> (Trends view).
      </p>
      <div className="zone-pick">
        <label htmlFor="zone-select" className="kicker">
          Zone
        </label>
        <select id="zone-select" className="select" value={zone.zoneId} onChange={(event) => setZoneId(event.target.value)}>
          {report.zones.map((z) => (
            <option key={z.zoneId} value={z.zoneId}>
              {z.label}
            </option>
          ))}
        </select>
      </div>

      <AgreementCard zone={zone} />
      <ChangeCard zone={zone} />
      <FireCard zone={zone} />
      <CasesCard
        zone={zone}
        cases={report.cases}
        flaggedModisYears={flaggedModisYears}
        onShowHotspot={onShowHotspot}
        onShowCase={onShowCase}
      />

      <div className="source">
        <strong>Sources</strong>
        <ul className="plain">
          {Object.entries(report.meta.sources).map(([name, doi]) => (
            <li key={name} className="small">
              {DOI_LABEL[name] ?? name} ·{' '}
              <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                doi:{doi}
              </a>
            </li>
          ))}
        </ul>
        <span className="small muted">{report.meta.note}</span>
        <span className="small muted">{report.meta.aiDisclosure}</span>
      </div>
    </section>
  )
}
