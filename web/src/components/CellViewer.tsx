// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15 (one data file per square, same day). Reviewed
// and owned by team AETHER.
//
// The cell viewer (UX spec section 3): a dialog over the map that tells what happened in one 1° square, in plain words.
// A native <dialog> opened with showModal() gives the focus trap, the inert background and Esc. Closing (Esc, Close
// button, backdrop click) calls `onClose` so the parent removes ?cell= (and ?from=, ?to=); afterwards `onRestoreFocus`
// returns focus to the square on the map.
// Content: summary, documented-case note, year travel (A to B: tree cover, loss, burned area and the yearly value of
// each monthly variable, with B minus A), small yearly charts, the team's trend result for each measure, exact values and
// links. Every number is published by the backend; the browser formats them and subtracts two of them (B minus A).
// Data: cover.json and validation.json arrive through props; the series and trend row of each monthly variable load
// here through useCellProfile, from the square's one API file (cells/{cellId}.json, since 2026-11-15).

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { CoverLayer, Manifest, ValidationReport } from '../../shared/contracts.ts'
import { useCellProfile } from '../hooks/useCellProfile.ts'
import { useUrlParams } from '../hooks/useUrlParam.ts'
import {
  buildSummary,
  buildTrendEntries,
  coverRows,
  findDocumentedPlace,
  resolveTravel,
  seriesRow,
  viewerYears,
  type DocumentedPlace,
} from '../lib/cellView.ts'
import type { MapCell } from '../lib/cover.ts'
import { formatCoordinates, formatKm2, formatPercent } from '../lib/format.ts'
import { trendOptions } from '../lib/trendMap.ts'
import { CellChanges } from './CellChanges.tsx'
import { CellTrends } from './CellTrends.tsx'
import { CellValues } from './CellValues.tsx'
import { ViewLink } from './ViewLink.tsx'
import { YearChart, type ChartSeries } from './YearChart.tsx'
import { YearTravel } from './YearTravel.tsx'
import './cellViewer.css'

export interface CellViewerProps {
  /** The square being viewed (from ?cell=); null = closed. */
  cell: MapCell | null
  manifest: Manifest
  /** cover.json, already loaded for the map; null in sample data (no cover layer). */
  cover: CoverLayer | null
  /** validation.json (for the documented-case badge); null until loaded or when the API does not serve it. */
  validation: ValidationReport | null
  /** The user asked to close (Esc, Close, backdrop). The parent removes cell, from and to from the URL with push. */
  onClose: () => void
  /** Called after the dialog closed, with the id of the square that was open: return focus to it on the map. */
  onRestoreFocus: (cellId: string) => void
}

/** A small map of the region: every square as a dot and this one in the accent colour. Decorative. */
function Locator({ cover, cellId }: { cover: CoverLayer; cellId: string }) {
  const geometry = useMemo(() => {
    const size = cover.cellSizeDeg
    const lons = cover.cells.map((c) => c.lon)
    const lats = cover.cells.map((c) => c.lat)
    const west = Math.min(...lons) - size / 2
    const north = Math.max(...lats) + size / 2
    const scale = Math.min(96 / (Math.max(...lons) + size / 2 - west), 80 / (north - (Math.min(...lats) - size / 2)))
    const rect = (lat: number, lon: number) => {
      const x = (lon - size / 2 - west) * scale
      const y = (north - (lat + size / 2)) * scale
      const w = Math.max(1, size * scale - 0.6)
      return `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${w.toFixed(1)}h${(-w).toFixed(1)}z`
    }
    const others = cover.cells.filter((c) => c.cellId !== cellId).map((c) => rect(c.lat, c.lon)).join('')
    const here = cover.cells.find((c) => c.cellId === cellId)
    return { others, here: here ? rect(here.lat, here.lon) : '', x: 0, w: (Math.max(...lons) + size / 2 - west) * scale, h: (north - (Math.min(...lats) - size / 2)) * scale }
  }, [cover, cellId])
  return (
    <svg className="cv-locator" width={96} height={80} viewBox={`0 0 ${Math.ceil(geometry.w)} ${Math.ceil(geometry.h)}`} aria-hidden="true">
      <path className="cv-locator-cells" d={geometry.others} />
      <path className="cv-locator-here" d={geometry.here} />
    </svg>
  )
}

/** "MAAP #233 (Sep 2025), https://…": the text, with its web address as a link. */
function Reference({ text }: { text: string }) {
  const match = /(https?:\/\/\S+)/.exec(text)
  if (!match) return <>{text}</>
  const url = match[1].replace(/[.,;)]+$/, '')
  return (
    <>
      {text.slice(0, match.index).replace(/[,\s]+$/, '')}{' '}
      <a href={url} target="_blank" rel="noreferrer">
        source
      </a>
    </>
  )
}

function PlaceNote({ place }: { place: DocumentedPlace }) {
  if (place.kind === 'case') {
    const { place: p } = place
    const first = p.hansenTreeCover[0] ?? null
    const last = p.hansenTreeCover[p.hansenTreeCover.length - 1] ?? null
    return (
      <aside className="flag-note cv-case" aria-label="Documented case">
        <strong>Documented case: {p.label}.</strong>{' '}
        {first !== null && last !== null && (
          <>
            At 0.05° (about 5 km) tree cover fell from {formatPercent(first)} in {p.years[0]} to {formatPercent(last)} in {p.years[p.years.length - 1]}
            . This 1° square averages a much larger area, so its change looks smaller.{' '}
          </>
        )}
        Reference: <Reference text={p.reference} />.{' '}
        <ViewLink view="checks" hash={`case-${p.id}`} params={place.zoneId ? { zone: place.zoneId } : {}}>
          Open the cross-check
        </ViewLink>
      </aside>
    )
  }
  return (
    <aside className="flag-note cv-case" aria-label="Cross-check hotspot">
      <strong>Cross-check hotspot.</strong> At 0.05° (about 5 km) inside this square, tree cover loss peaked in {place.hotspot.peakLossYear}.
      The 1° square averages a much larger area, so its own numbers look smaller. It is one of the places listed in the cross-checks.{' '}
      <ViewLink view="checks">Open the cross-checks</ViewLink>
    </aside>
  )
}

interface ContentProps extends Omit<CellViewerProps, 'cell' | 'onClose' | 'onRestoreFocus'> {
  cell: MapCell
  titleId: string
  summaryId: string
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onCloseClick: () => void
}

function CellContent({ cell, manifest, cover, validation, titleId, summaryId, headingRef, onCloseClick }: ContentProps) {
  const [params, setParams] = useUrlParams()
  const [copied, setCopied] = useState(false)
  const variables = manifest.variables
  const profile = useCellProfile(cell.cellId, variables.map((v) => v.id))
  const coverCell = useMemo(() => cover?.cells.find((c) => c.cellId === cell.cellId) ?? null, [cover, cell.cellId])

  const years = useMemo(() => viewerYears(cover, variables), [cover, variables])
  const travel = resolveTravel(years, params.get('from'), params.get('to'), cover?.lossYears[0] ?? years[0])
  const { from, to } = travel
  const setTravel = (a: number, b: number) => setParams({ from: String(a), to: String(b) })

  const rows = [...(cover ? coverRows(cover, coverCell) : []), ...variables.map((v) => seriesRow(v, profile.series[v.id]))]
  const options = useMemo(() => trendOptions(variables, cover), [variables, cover])
  const entries = buildTrendEntries(options, profile.trends, coverCell)
  const summary = buildSummary(cover, coverCell, entries, from, to)
  const place = findDocumentedPlace(validation, cell.cellId)
  const top = entries.find((e) => e.status === 'falling' || e.status === 'rising') ?? entries[0]

  const copyLink = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('from', String(from))
    url.searchParams.set('to', String(to))
    navigator.clipboard
      ?.writeText(url.toString())
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setCopied(false))
  }

  // Charts of the cover layer (small, one per measure).
  const flaggedModis = cover ? cover.flags.filter((f) => f.source.toLowerCase() === 'modis').map((f) => f.year) : []
  const treeSeries: ChartSeries[] = cover
    ? [
        { id: 'hansen', label: 'Hansen', values: coverCell?.hansenTreeCover ?? [] },
        {
          id: 'modis',
          label: 'MODIS',
          values: coverCell?.modisTreeCover ?? [],
          dashed: true,
          kinds: cover.years.map((y) => (flaggedModis.includes(y) ? 'hollow' : 'ok')),
          notes: cover.years.map((y) => (flaggedModis.includes(y) ? 'Suspect MODIS value' : null)),
        },
      ]
    : []
  const lossTested = entries.find((e) => e.id === 'lossKm2')?.years ?? null
  const where = formatCoordinates(cell.lat, cell.lon)
  const seriesUrl = (id: string) => `${API_BASE_PATH}/${apiPaths.series(id, cell.cellId)}`

  return (
    <div className="viewer-inner">
      <header className="viewer-head">
        <div>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>
            Area around {where}
          </h2>
          <p className="small muted">
            1° area (about 12,000 km²) · Square {cell.cellId}
            {place && <span className="cv-pill">{place.kind === 'case' ? 'Documented case' : 'Cross-check hotspot'}</span>}
          </p>
        </div>
        {cover && <Locator cover={cover} cellId={cell.cellId} />}
        <button type="button" className="btn" aria-label="Close area viewer" onClick={onCloseClick}>
          Close <span aria-hidden="true">✕</span>
        </button>
      </header>

      <YearTravel years={years} from={from} to={to} onChange={setTravel} />

      <div className="viewer-body">
        <p id={summaryId} className="cv-summary">
          {summary.join(' ')}
        </p>
        {place && <PlaceNote place={place} />}

        <section aria-labelledby={`${titleId}-changed`} className="cv-section">
          <h3 id={`${titleId}-changed`}>
            What changed from {from} to {to}
          </h3>
          <p className="sr-only" aria-live="polite">
            Showing {from} and {to}.
          </p>
          <CellChanges rows={rows} years={years} from={from} to={to} onRetry={profile.retry} />
          <p className="small muted">
            A difference is the later value minus the earlier one, in the measure’s own units, never a percentage. Years that are incomplete,
            suspect or missing are shown but left out of differences.
          </p>
        </section>

        {cover && coverCell && (
          <section aria-labelledby={`${titleId}-charts`} className="cv-section">
            <h3 id={`${titleId}-charts`}>Tree cover, loss and fire by year</h3>
            <YearChart
              years={cover.years}
              type="line"
              series={treeSeries}
              format={formatPercent}
              tick={(v) => `${Math.round(v)} %`}
              domain={[0, 100]}
              from={from}
              to={to}
              label={`Tree cover of this area, ${cover.years[0]} to ${cover.years[cover.years.length - 1]}, Hansen and MODIS`}
              caption="Hansen (solid) counts loss but not regrowth, so it can only go down. MODIS (dashed) is an independent check; a hollow dot is a suspect value. Source: Hansen/UMD Global Forest Change (Landsat); NASA MOD44B."
            />
            <div className="cv-pair">
              <YearChart
                years={cover.lossYears}
                type="bars"
                series={[{ id: 'loss', label: 'Loss', values: coverCell.lossKm2 }]}
                format={formatKm2}
                tick={(v) => v.toLocaleString('en-US')}
                tone="loss"
                from={from}
                to={to}
                tested={lossTested}
                sen={coverCell.trends?.lossKm2?.line}
                label="Tree cover lost per year in this area, in square kilometres"
                caption="Tree cover lost each year (km²). Includes fire, logging, mining and clearing, not only deforestation. Source: Hansen/UMD."
                height={150}
              />
              <YearChart
                years={cover.burnedYears}
                type="bars"
                series={[{ id: 'burned', label: 'Burned', values: coverCell.burnedKm2 }]}
                format={formatKm2}
                tick={(v) => v.toLocaleString('en-US')}
                tone="burned"
                from={from}
                to={to}
                label="Area burned per year in this area, in square kilometres"
                caption="Area burned each year (km²). Fire and loss in the same place do not show which caused which. Source: NASA MCD64A1."
                height={150}
              />
            </div>
          </section>
        )}

        <section aria-labelledby={`${titleId}-trends`} className="cv-section">
          <h3 id={`${titleId}-trends`}>Trends in this area</h3>
          <p className="small muted">
            The team’s test looks at yearly values, so the seasons do not count. “A clear trend” means it stands out from year-to-year
            variation even after correcting for the many squares tested at once (false discovery rate 5 %).
          </p>
          <CellTrends entries={entries} variables={variables} series={profile.series} from={from} to={to} onRetry={profile.retry} />
        </section>

        <details className="cv-exact-details">
          <summary>Exact values</summary>
          <CellValues rows={rows} years={years} from={from} to={to} entries={entries} alpha={validation?.trendChecks?.design.alpha ?? null} />
        </details>

        <section aria-labelledby={`${titleId}-links`} className="cv-section">
          <h3 id={`${titleId}-links`} className="sr-only">
            Links
          </h3>
          <div className="cv-links">
            {top && (
              <ViewLink view="trends" params={{ var: top.id }} className="btn">
                Open in Trends
              </ViewLink>
            )}
            <details className="cv-menu">
              <summary className="btn">Download this area’s data (JSON)</summary>
              <ul>
                <li>
                  <a href={`${API_BASE_PATH}/${apiPaths.cell(cell.cellId)}`} target="_blank" rel="noreferrer">
                    All measures of this area (one file)
                  </a>
                </li>
                {variables.map((v) => (
                  <li key={v.id}>
                    <a href={seriesUrl(v.id)} target="_blank" rel="noreferrer">
                      {v.name}
                    </a>
                  </li>
                ))}
                {cover && (
                  <li>
                    <a href={`${API_BASE_PATH}/${apiPaths.cover()}`} target="_blank" rel="noreferrer">
                      Tree cover, loss and burned area (all squares)
                    </a>
                  </li>
                )}
              </ul>
            </details>
            <button type="button" className="btn" onClick={copyLink}>
              Copy link to this view
            </button>
            <span className="small muted" role="status" aria-live="polite">
              {copied ? 'Link copied' : ''}
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

export function CellViewer({ cell, manifest, cover, validation, onClose, onRestoreFocus }: CellViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openCellId = useRef<string | null>(null)
  const latest = useRef({ cell, onClose, onRestoreFocus })
  const titleId = useId()
  const summaryId = useId()

  useEffect(() => {
    latest.current = { cell, onClose, onRestoreFocus }
  })

  // Open when a square is set, close when it is removed (Back, or the Close button after the parent updated the URL).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (cell && !dialog.open) {
      openCellId.current = cell.cellId
      dialog.showModal()
      headingRef.current?.focus()
    } else if (!cell && dialog.open) {
      dialog.close()
    } else if (cell) {
      openCellId.current = cell.cellId
    }
  }, [cell])

  const handleClosed = () => {
    const id = openCellId.current
    // Esc or the Close button: the URL still holds the square, so ask the parent to remove it.
    if (latest.current.cell) latest.current.onClose()
    if (id) latest.current.onRestoreFocus(id)
  }

  return (
    <dialog
      ref={dialogRef}
      className="viewer"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      onClose={handleClosed}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      {cell && (
        <CellContent
          cell={cell}
          manifest={manifest}
          cover={cover}
          validation={validation}
          titleId={titleId}
          summaryId={summaryId}
          headingRef={headingRef}
          onCloseClick={() => dialogRef.current?.close()}
        />
      )}
    </dialog>
  )
}
