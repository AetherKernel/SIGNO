// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Filter panel of the map view (left): map type, trend variable and filter, year, square opacity, country borders,
// base map, legend and a first-visit hint. It replaces the old "Case file" column and the controls over the map.
// On a phone the same content opens in a bottom sheet from the "Filters" button, and the compact legend stays visible
// in the bar under the map. The panel only edits what the URL holds; it computes nothing.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery.ts'
import type { Basemap, BasemapId } from '../lib/basemaps.ts'
import { useLang } from '../lib/i18n.ts'
import { optionLabel, type TrendOption } from '../lib/trendMap.ts'
import { OPACITY_MAX, OPACITY_MIN, type CellFilter, type MapType } from '../lib/viewState.ts'
import { SelectedKey } from './MapLegend.tsx'

export interface MapFiltersProps {
  mapType: MapType
  onMapType: (type: MapType) => void
  /** The tree cover, loss and burned area maps need cover.json; without it only the trend map exists (sample data). */
  coverAvailable: boolean
  /** False when the trend test has no result yet: the Trend option stays, disabled, with a note. */
  trendAvailable: boolean
  trendOptions: TrendOption[]
  trendId: string
  onTrendId: (id: string) => void
  /** "212 of 566 squares changed significantly: 140 down, 72 up." from the backend; null when there is none. */
  trendSummary: string | null
  show: CellFilter
  onShow: (show: CellFilter) => void
  /** Years of the yearly maps (empty for the trend map). */
  years: number[]
  year: number
  onYear: (year: number) => void
  opacity: number
  onOpacity: (opacity: number) => void
  /** The borders file is expected to exist (manifest.extras.borders is not false). */
  bordersAvailable: boolean
  bordersOn: boolean
  onBorders: (on: boolean) => void
  basemaps: Basemap[]
  basemap: Basemap
  onBasemap: (id: BasemapId) => void
  legend: ReactNode
  compactLegend: ReactNode
  /** Opens the documented case (La Pampa) on the map; null when the case is not available. */
  onStartCase: (() => void) | null
  /** An error from loading a layer, shown under the map type. */
  error: string | null
}

const HINT_KEY = 'signo.mapHint.dismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

const MAP_TYPES: { id: MapType; label: string; labelEs: string; help: string; helpEs: string; needsCover: boolean }[] = [
  {
    id: 'cover',
    label: 'Tree cover',
    labelEs: 'Cobertura arbórea',
    help: 'Share of each square covered by trees (Hansen, 30 m Landsat).',
    helpEs: 'Parte de cada cuadro cubierta por árboles (Hansen, Landsat de 30 m).',
    needsCover: true,
  },
  {
    id: 'loss',
    label: 'Tree cover loss',
    labelEs: 'Pérdida de cobertura',
    help: 'Area where trees were lost that year: fire, logging, mining or clearing.',
    helpEs: 'Superficie donde se perdieron árboles ese año: fuego, tala, minería o desbroce.',
    needsCover: true,
  },
  {
    id: 'burned',
    label: 'Burned area',
    labelEs: 'Área quemada',
    help: 'Area burned that year (NASA MODIS).',
    helpEs: 'Superficie quemada ese año (NASA MODIS).',
    needsCover: true,
  },
  {
    id: 'trend',
    label: 'Trend',
    labelEs: 'Tendencia',
    help: 'Where a measure rose or fell, beyond year-to-year noise.',
    helpEs: 'Dónde una medida subió o bajó, más allá del ruido de un año a otro.',
    needsCover: false,
  },
]

const SHOW_OPTIONS: { id: CellFilter; label: string; labelEs: string }[] = [
  { id: 'all', label: 'All', labelEs: 'Todos' },
  { id: 'significant', label: 'Significant', labelEs: 'Significativos' },
  { id: 'decreasing', label: 'Falling', labelEs: 'Bajan' },
  { id: 'increasing', label: 'Rising', labelEs: 'Suben' },
]

function yearMeaning(type: MapType, year: number, t: (en: string, es: string) => string): string {
  if (type === 'cover') return year === 2000 ? t('2000 baseline', 'Línea base 2000') : t(`End of ${year}`, `Fin de ${year}`)
  return type === 'loss' ? t(`Lost during ${year}`, `Perdida durante ${year}`) : t(`Burned during ${year}`, `Quemada durante ${year}`)
}

/** Pause between years while playing. */
const PLAY_MS = 800

function FiltersBody(props: MapFiltersProps) {
  const { t } = useLang()
  const { mapType, years, year, trendOptions: options } = props
  const first = years[0]
  const last = years[years.length - 1]
  const trend = options.find((o) => o.id === props.trendId) ?? options[0] ?? null
  const [playing, setPlaying] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(readDismissed)
  const { onYear } = props
  /** Playing stops by itself at the last year. */
  const isPlaying = playing && year < last

  // Play: one year every 800 ms, stops at the last year. Any other input stops it (see `stopThen`).
  useEffect(() => {
    if (!playing || year >= last) return
    const timer = window.setTimeout(() => onYear(year + 1), PLAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, year, last, onYear])

  const stopThen = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    setPlaying(false)
    fn(...args)
  }

  const dismiss = () => {
    setHintDismissed(true)
    try {
      window.localStorage.setItem(HINT_KEY, '1')
    } catch {
      /* private window: the hint simply shows again next time */
    }
  }

  const types = MAP_TYPES.filter((m) => props.coverAvailable || !m.needsCover)
  const hasYear = mapType !== 'trend' && years.length > 0

  return (
    <div className="filters-body">
      <fieldset className="fsec">
        <legend>{t('Map', 'Mapa')}</legend>
        {types.map((m) => {
          const disabled = m.id === 'trend' && !props.trendAvailable
          return (
            <label key={m.id} className={disabled ? 'radio-row disabled' : 'radio-row'}>
              <input
                type="radio"
                name="map-type"
                value={m.id}
                checked={mapType === m.id}
                disabled={disabled}
                onChange={stopThen(() => props.onMapType(m.id))}
              />
              <span className="radio-label">{t(m.label, m.labelEs)}</span>
              <span className="radio-help">
                {disabled
                  ? t('Trend test results are not published yet.', 'Los resultados del test de tendencia aún no se publican.')
                  : t(m.help, m.helpEs)}
              </span>
            </label>
          )
        })}
        {props.error && <p className="error small">{props.error}</p>}
      </fieldset>

      {mapType === 'trend' && trend && (
        <div className="fsec">
          <label className="fsec-label" htmlFor="trend-var">
            {t('Variable', 'Variable')}
          </label>
          <select id="trend-var" className="select" value={trend.id} onChange={stopThen((event) => props.onTrendId(event.target.value))}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {optionLabel(o)}
              </option>
            ))}
          </select>
          {props.trendSummary && <p className="small muted">{props.trendSummary}</p>}

          <fieldset className="fset-inline">
            <legend className="fsec-label">{t('Show', 'Mostrar')}</legend>
            <div className="seg-radio">
              {SHOW_OPTIONS.map((o) => (
                <label key={o.id} className={props.show === o.id ? 'on' : undefined}>
                  <input type="radio" name="show" value={o.id} checked={props.show === o.id} onChange={() => props.onShow(o.id)} />
                  {t(o.label, o.labelEs)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {mapType === 'trend' && trend && (
        <div className="fsec">
          <p className="small muted">
            {`${t('Yearly values', 'Valores anuales')}, ${trend.years[0]}–${trend.years[1]}`}
          </p>
        </div>
      )}

      {hasYear && (
        <div className="fsec">
          <label className="fsec-label" htmlFor="map-year">
            {t('Year', 'Año')} <strong className="mono">{year}</strong>
          </label>
          <p className="small muted" aria-live="polite">
            {yearMeaning(mapType, year, t)}
          </p>
          <div className="year-controls">
            <button
              type="button"
              className="btn icon-btn"
              aria-label={t('Previous year', 'Año anterior')}
              disabled={year <= first}
              onClick={stopThen(() => onYear(year - 1))}
            >
              <span aria-hidden="true">◀</span>
            </button>
            <input
              id="map-year"
              type="range"
              min={first}
              max={last}
              step={1}
              value={year}
              aria-valuetext={`${year}, ${yearMeaning(mapType, year, t)}`}
              onChange={stopThen((event) => onYear(Number(event.target.value)))}
            />
            <button
              type="button"
              className="btn icon-btn"
              aria-label={t('Next year', 'Año siguiente')}
              disabled={year >= last}
              onClick={stopThen(() => onYear(year + 1))}
            >
              <span aria-hidden="true">▶</span>
            </button>
            <button
              type="button"
              className="btn play-btn"
              aria-pressed={isPlaying}
              onClick={() => {
                if (isPlaying) {
                  setPlaying(false)
                } else {
                  if (year >= last) onYear(first)
                  setPlaying(true)
                }
              }}
            >
              {isPlaying ? t('Pause', 'Pausa') : t('Play', 'Reproducir')}
            </button>
          </div>
        </div>
      )}

      <div className="fsec">
        <label className="fsec-label" htmlFor="map-opacity">
          {t('Square opacity', 'Opacidad de los cuadros')} <strong className="mono">{`${props.opacity} %`}</strong>
        </label>
        <input
          id="map-opacity"
          type="range"
          min={OPACITY_MIN}
          max={OPACITY_MAX}
          step={5}
          value={props.opacity}
          aria-valuetext={t(`${props.opacity} percent`, `${props.opacity} por ciento`)}
          onChange={stopThen((event) => props.onOpacity(Number(event.target.value)))}
        />
        {props.bordersAvailable && (
          <>
            <label className="check-row">
              <input type="checkbox" checked={props.bordersOn} onChange={(event) => props.onBorders(event.target.checked)} />
              {t('Country borders', 'Fronteras de países')}
            </label>
            <p className="small muted">{t('Natural Earth, for orientation only.', 'Natural Earth, solo para orientarse.')}</p>
          </>
        )}
      </div>

      <fieldset className="fsec">
        <legend>{t('Base map', 'Mapa base')}</legend>
        {props.basemaps.map((b) => (
          <label key={b.id} className="radio-row">
            <input type="radio" name="basemap" value={b.id} checked={props.basemap.id === b.id} onChange={() => props.onBasemap(b.id)} />
            <span className="radio-label">{t(b.label, b.labelEs)}</span>
            <span className="radio-help">{t(b.note, b.noteEs)}</span>
          </label>
        ))}
      </fieldset>

      <div className="fsec legend-sec">
        {props.legend}
        <SelectedKey />
      </div>

      {!hintDismissed && (
        <div className="fsec hint">
          <p className="small">
            {t('Click any square to see its numbers and how they changed.', 'Haz clic en cualquier cuadro para ver sus cifras y cómo cambiaron.')}
          </p>
          {props.onStartCase && (
            <button type="button" className="btn" onClick={props.onStartCase}>
              {t('Start with a documented case: La Pampa gold mining, Peru', 'Empieza con un caso documentado: minería de oro en La Pampa, Perú')}
            </button>
          )}
          <button type="button" className="link-btn" onClick={dismiss}>
            {t('Dismiss', 'Ocultar')}
          </button>
        </div>
      )}
    </div>
  )
}

export function MapFilters(props: MapFiltersProps) {
  const { t } = useLang()
  const mobile = useMediaQuery('(max-width: 767px)')
  const sheetRef = useRef<HTMLDialogElement>(null)
  const openSheet = useCallback(() => sheetRef.current?.showModal(), [])
  const closeSheet = useCallback(() => sheetRef.current?.close(), [])

  if (!mobile) {
    return (
      <aside className="map-filters" aria-label={t('Map filters', 'Filtros del mapa')}>
        <h2 className="sr-only">{t('Map filters', 'Filtros del mapa')}</h2>
        <FiltersBody {...props} />
      </aside>
    )
  }

  return (
    <>
      <div className="map-bar">
        <button type="button" className="btn" aria-haspopup="dialog" onClick={openSheet}>
          {t('Filters', 'Filtros')}
        </button>
        <div className="map-bar-legend">{props.compactLegend}</div>
      </div>
      <dialog
        ref={sheetRef}
        className="sheet"
        aria-label={t('Map filters', 'Filtros del mapa')}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet()
        }}
      >
        <div className="sheet-head">
          <h2>{t('Map filters', 'Filtros del mapa')}</h2>
          <button type="button" className="btn" onClick={closeSheet}>
            {t('Done', 'Listo')}
          </button>
        </div>
        <FiltersBody {...props} />
      </dialog>
    </>
  )
}
