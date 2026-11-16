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
// 2026-11-15: one tree cover (Hansen only, no MODIS); one loss trend (2011-2025) with 2001-2010 shown greyed and the 2011 marker;
// notes in InfoTips; one burned-area row (km2 from the cover layer); the trend intro is one line with its tip.

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
import { useLang } from '../lib/i18n.ts'
import { lossTrendYears, trendOptions } from '../lib/trendMap.ts'
import { CellChanges } from './CellChanges.tsx'
import { CellTrends } from './CellTrends.tsx'
import { CellValues } from './CellValues.tsx'
import { InfoTip } from './InfoTip.tsx'
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
  const { t } = useLang()
  const match = /(https?:\/\/\S+)/.exec(text)
  if (!match) return <>{text}</>
  const url = match[1].replace(/[.,;)]+$/, '')
  return (
    <>
      {text.slice(0, match.index).replace(/[,\s]+$/, '')}{' '}
      <a href={url} target="_blank" rel="noreferrer">
        {t('source', 'fuente')}
      </a>
    </>
  )
}

function PlaceNote({ place }: { place: DocumentedPlace }) {
  const { t } = useLang()
  if (place.kind === 'case') {
    const { place: p } = place
    const first = p.hansenTreeCover[0] ?? null
    const last = p.hansenTreeCover[p.hansenTreeCover.length - 1] ?? null
    return (
      <aside className="flag-note cv-case" aria-label={t('Documented case', 'Caso documentado')}>
        <strong>
          {t('Documented case', 'Caso documentado')}: {p.label}.
        </strong>{' '}
        {first !== null && last !== null && (
          <>
            {t(
              `At 0.05° (about 5 km) tree cover fell from ${formatPercent(first)} in ${p.years[0]} to ${formatPercent(last)} in ${p.years[p.years.length - 1]}. This 1° square averages a much larger area, so its change looks smaller.`,
              `A 0.05° (unos 5 km) la cobertura arbórea bajó de ${formatPercent(first)} en ${p.years[0]} a ${formatPercent(last)} en ${p.years[p.years.length - 1]}. Este cuadro de 1° promedia un área mucho mayor, por eso su cambio parece menor.`,
            )}{' '}
          </>
        )}
        {t('Reference', 'Referencia')}: <Reference text={p.reference} />.{' '}
        <ViewLink view="checks" hash={`case-${p.id}`} params={place.zoneId ? { zone: place.zoneId } : {}}>
          {t('Open the cross-check', 'Abrir el contraste')}
        </ViewLink>
      </aside>
    )
  }
  return (
    <aside className="flag-note cv-case" aria-label={t('Cross-check hotspot', 'Punto crítico de los contrastes')}>
      <strong>{t('Cross-check hotspot.', 'Punto crítico de los contrastes.')}</strong>{' '}
      {t(
        `At 0.05° (about 5 km) inside this square, tree cover loss peaked in ${place.hotspot.peakLossYear}. The 1° square averages a much larger area, so its own numbers look smaller. It is one of the places listed in the cross-checks.`,
        `A 0.05° (unos 5 km) dentro de este cuadro, la pérdida de cobertura tuvo su máximo en ${place.hotspot.peakLossYear}. El cuadro de 1° promedia un área mucho mayor, por eso sus cifras parecen menores. Es uno de los lugares listados en los contrastes.`,
      )}{' '}
      <ViewLink view="checks">{t('Open the cross-checks', 'Abrir los contrastes')}</ViewLink>
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
  const { t } = useLang()
  const [params, setParams] = useUrlParams()
  const [copied, setCopied] = useState(false)
  const variables = manifest.variables
  const profile = useCellProfile(cell.cellId, variables.map((v) => v.id))
  const coverCell = useMemo(() => cover?.cells.find((c) => c.cellId === cell.cellId) ?? null, [cover, cell.cellId])

  const years = useMemo(() => viewerYears(cover, variables), [cover, variables])
  const travel = resolveTravel(years, params.get('from'), params.get('to'), cover?.lossYears[0] ?? years[0])
  const { from, to } = travel
  const setTravel = (a: number, b: number) => setParams({ from: String(a), to: String(b) })

  // One answer per measure: burned area is read in km2 from the cover layer, so its yearly-share series row is left out here.
  const rows = [
    ...(cover ? coverRows(cover, coverCell, t) : []),
    ...variables.filter((v) => !(cover && v.id === 'burned_area')).map((v) => seriesRow(v, profile.series[v.id], t)),
  ]
  const options = useMemo(() => trendOptions(variables, cover, t), [variables, cover, t])
  // Squares tested per measure (for the "?" tip of a trend that is not clear), from the published checks.
  const squaresTested = Object.fromEntries((validation?.trendChecks?.variables ?? []).map((v) => [v.variableId, v.cellsTested]))
  const entries = buildTrendEntries(options, profile.trends, coverCell, t, squaresTested)
  // 1 % of this square, in km2 (111.32 km per degree, scaled by cos(latitude); the same cell area the pipeline uses).
  const km2PerPercent = cover ? (111.32 ** 2 * Math.cos((cell.lat * Math.PI) / 180) * cover.cellSizeDeg ** 2) / 100 : null
  const summary = buildSummary(cover, coverCell, entries, from, to, t)
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
  const treeSeries: ChartSeries[] = cover ? [{ id: 'hansen', label: t('Tree cover', 'Cobertura arbórea'), values: coverCell?.hansenTreeCover ?? [] }] : []
  // Loss: the years before the Hansen method change are real but not in the trend (greyed); the Sen line covers 2011-2025 only.
  const lossEntry = entries.find((e) => e.id === 'lossKm2')
  const lossStart = cover ? lossTrendYears(cover)[0] : 0
  const lossKinds = cover ? cover.lossYears.map((year) => (year < lossStart ? ('outside' as const) : ('ok' as const))) : []
  const where = formatCoordinates(cell.lat, cell.lon)
  const seriesUrl = (id: string) => `${API_BASE_PATH}/${apiPaths.series(id, cell.cellId)}`

  return (
    <div className="viewer-inner">
      <header className="viewer-head">
        <div>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>
            {t('Area around', 'Área alrededor de')} {where}
          </h2>
          <p className="small muted">
            {t('1° area (about 12,000 km²) · Square', 'Área de 1° (unos 12 000 km²) · Cuadro')} {cell.cellId}
            {place && (
              <span className="cv-pill">
                {place.kind === 'case' ? t('Documented case', 'Caso documentado') : t('Cross-check hotspot', 'Punto crítico de los contrastes')}
              </span>
            )}
          </p>
        </div>
        {cover && <Locator cover={cover} cellId={cell.cellId} />}
        <button type="button" className="btn" aria-label={t('Close area viewer', 'Cerrar el visor del área')} onClick={onCloseClick}>
          {t('Close', 'Cerrar')} <span aria-hidden="true">✕</span>
        </button>
      </header>

      <YearTravel years={years} from={from} to={to} onChange={setTravel} />

      <div className="viewer-body">
        <p id={summaryId} className="cv-summary">
          {summary.sentences.join(' ')}
        </p>
        {summary.others.length > 0 && (
          <details className="cv-others">
            <summary>{t(`Other clear trends (${summary.others.length})`, `Otras tendencias claras (${summary.others.length})`)}</summary>
            <ul>
              {summary.others.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
          </details>
        )}
        {place && <PlaceNote place={place} />}

        <section aria-labelledby={`${titleId}-changed`} className="cv-section">
          <h3 id={`${titleId}-changed`}>
            {t(`What changed from ${from} to ${to}`, `Qué cambió de ${from} a ${to}`)}
          </h3>
          <p className="sr-only" aria-live="polite">
            {t(`Showing ${from} and ${to}.`, `Mostrando ${from} y ${to}.`)}
          </p>
          <CellChanges rows={rows} years={years} from={from} to={to} onRetry={profile.retry} />
          <p className="small muted">
            {t(
              'A difference is the later value minus the earlier one, in the measure’s own units, never a percentage.',
              'Una diferencia es el valor posterior menos el anterior, en las unidades de la medida, nunca un porcentaje.',
            )}
            <InfoTip>
              {t(
                'Years that are incomplete or have no value are shown, but left out of differences.',
                'Los años incompletos o sin valor se muestran, pero no entran en las diferencias.',
              )}
            </InfoTip>
          </p>
        </section>

        {cover && coverCell && (
          <section aria-labelledby={`${titleId}-charts`} className="cv-section">
            <h3 id={`${titleId}-charts`}>{t('Tree cover, loss and fire by year', 'Cobertura, pérdida y fuego por año')}</h3>
            <YearChart
              years={cover.years}
              type="line"
              series={treeSeries}
              format={formatPercent}
              tick={(v) => `${Math.round(v)} %`}
              domain={[0, 100]}
              from={from}
              to={to}
              methodMarker
              label={t(
                `Tree cover of this area, ${cover.years[0]} to ${cover.years[cover.years.length - 1]}`,
                `Cobertura arbórea de esta área, ${cover.years[0]} a ${cover.years[cover.years.length - 1]}`,
              )}
              caption={t(
                'Tree cover counts loss but not regrowth, so it can only go down. Source: Hansen/UMD Global Forest Change (Landsat).',
                'La cobertura arbórea cuenta la pérdida pero no el rebrote, así que solo puede bajar. Fuente: Hansen/UMD Global Forest Change (Landsat).',
              )}
            />
            <div className="cv-pair">
              <YearChart
                years={cover.lossYears}
                type="bars"
                series={[{ id: 'loss', label: t('Loss', 'Pérdida'), values: coverCell.lossKm2, kinds: lossKinds }]}
                format={(v) => formatKm2(v, t)}
                tick={(v) => v.toLocaleString('en-US')}
                tone="loss"
                from={from}
                to={to}
                tested={lossEntry?.years ?? null}
                sen={lossEntry?.result?.line}
                significant={lossEntry?.result?.significant ?? false}
                methodMarker
                label={t('Tree cover lost per year in this area, in square kilometres', 'Cobertura perdida por año en esta área, en kilómetros cuadrados')}
                caption={t(
                  'Tree cover lost each year (km²), from any cause (fire, logging, mining, clearing). Shaded: the years of the trend. Source: Hansen/UMD.',
                  'Cobertura perdida cada año (km²), por cualquier causa (fuego, tala, minería, desbroce). Sombreado: los años de la tendencia. Fuente: Hansen/UMD.',
                )}
                height={150}
              />
              <YearChart
                years={cover.burnedYears}
                type="bars"
                series={[{ id: 'burned', label: t('Burned', 'Quemado'), values: coverCell.burnedKm2 }]}
                format={(v) => formatKm2(v, t)}
                tick={(v) => v.toLocaleString('en-US')}
                tone="burned"
                from={from}
                to={to}
                label={t('Area burned per year in this area, in square kilometres', 'Superficie quemada por año en esta área, en kilómetros cuadrados')}
                caption={t(
                  'Area burned each year (km²). Fire and loss in the same place do not show which caused which. Source: NASA MCD64A1.',
                  'Superficie quemada cada año (km²). Que haya fuego y pérdida en el mismo lugar no muestra cuál causó cuál. Fuente: NASA MCD64A1.',
                )}
                height={150}
              />
            </div>
          </section>
        )}

        <section aria-labelledby={`${titleId}-trends`} className="cv-section">
          <h3 id={`${titleId}-trends`}>{t('Trends in this area', 'Tendencias en esta área')}</h3>
          <p className="small muted">
            {t('Test on yearly values: a trend is “clear” only if it stands out from the usual ups and downs.', 'Test sobre valores anuales: una tendencia es “clara” solo si destaca de las subidas y bajadas habituales.')}
            <InfoTip>
              {t(
                'The test looks at yearly values, so the seasons do not count. A trend is clear when it stands out from year-to-year variation even after correcting for the many squares tested at once (false discovery rate 5 %).',
                'El test mira valores anuales, así que las estaciones no cuentan. Una tendencia es clara cuando destaca sobre la variación de un año a otro incluso tras corregir por los muchos cuadros probados a la vez (tasa de falsos descubrimientos del 5 %).',
              )}
            </InfoTip>
          </p>
          <CellTrends
            entries={entries}
            variables={variables}
            series={profile.series}
            from={from}
            to={to}
            onRetry={profile.retry}
            km2PerPercent={km2PerPercent}
          />
        </section>

        <details className="cv-exact-details">
          <summary>{t('Exact values', 'Valores exactos')}</summary>
          <CellValues rows={rows} years={years} from={from} to={to} entries={entries} alpha={validation?.trendChecks?.design.alpha ?? null} />
        </details>

        <section aria-labelledby={`${titleId}-links`} className="cv-section">
          <h3 id={`${titleId}-links`} className="sr-only">
            {t('Links', 'Enlaces')}
          </h3>
          <div className="cv-links">
            {top && (
              <ViewLink view="trends" params={{ var: top.id }} className="btn">
                {t('Open in Trends', 'Abrir en Tendencias')}
              </ViewLink>
            )}
            <details className="cv-menu">
              <summary className="btn">{t('Download this area’s data (JSON)', 'Descargar los datos de esta área (JSON)')}</summary>
              <ul>
                <li>
                  <a href={`${API_BASE_PATH}/${apiPaths.cell(cell.cellId)}`} target="_blank" rel="noreferrer">
                    {t('All measures of this area (one file)', 'Todas las medidas de esta área (un archivo)')}
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
                      {t('Tree cover, loss and burned area (all squares)', 'Cobertura, pérdida y área quemada (todos los cuadros)')}
                    </a>
                  </li>
                )}
              </ul>
            </details>
            <button type="button" className="btn" onClick={copyLink}>
              {t('Copy link to this view', 'Copiar el enlace a esta vista')}
            </button>
            <span className="small muted" role="status" aria-live="polite">
              {copied ? t('Link copied', 'Enlace copiado') : ''}
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
