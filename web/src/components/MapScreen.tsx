// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15 (legend range passed through, 2026-11-15).
// Reviewed and owned by team AETHER.
//
// The Map view (?view=map): a filter panel on the left and the map, nothing else. Map types: tree cover, tree cover loss
// and burned area (yearly, from cover.json) and trend (one measure at a time, from trends/{id}.json or from the cover
// trends). Clicking a square sets ?cell= and opens the cell viewer, a dialog over the map. All state is in the URL.
// Old links still work: ?variable= is read as ?var= and ?filter= as ?show=; ?src= and ?compare= are dropped.
// Data comes only from hooks (src/hooks) → service (src/services) → API v1 (published by server/).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CoverLayer, Manifest, ValidationReport } from '../../shared/contracts.ts'
import { useBorders, useTrendLayer, type Remote } from '../hooks/useSignoData.ts'
import { useUrlParams, type ParamsPatch } from '../hooks/useUrlParam.ts'
import { basemaps as listBasemaps, isBasemapId, type BasemapId } from '../lib/basemaps.ts'
import { makeBurnedPaint, makeCoverPaint, makeLossPaint, peakYear, type CellPaint, type MapCell } from '../lib/cover.ts'
import { useLang } from '../lib/i18n.ts'
import {
  coverResults,
  layerResults,
  makeTrendPaint,
  noneTested,
  summaryLine,
  trendOptions,
  type TrendPaintInfo,
} from '../lib/trendMap.ts'
import {
  parseFilter,
  parseMapType,
  parseOpacity,
  parseView,
  resolveYear,
  type CellFilter,
  type MapType,
  type MapView,
} from '../lib/viewState.ts'
import { CellViewer } from './CellViewer.tsx'
import { MapFilters } from './MapFilters.tsx'
import { MapLegend, type TrendLegendInfo } from './MapLegend.tsx'
import { TrendMap } from './TrendMap.tsx'

interface Props {
  manifest: Manifest
  cover: Remote<CoverLayer>
  validation: Remote<ValidationReport>
}

/** Moves keyboard focus back to a square (or to the map) after the viewer closed. */
function focusCell(cellId: string) {
  const square = document.querySelector<SVGElement>(`[data-cell-id="${cellId}"]`)
  const target = square ?? document.querySelector<HTMLElement>('.map')
  target?.focus({ preventScroll: true })
}

export function MapScreen({ manifest, cover, validation }: Props) {
  const { lang, t } = useLang()
  const [params, setParams] = useUrlParams()
  const extras = manifest.extras
  const [initialView] = useState<MapView | null>(() => parseView(params.get('z'), params.get('lat'), params.get('lon')))
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null)

  const basemaps = useMemo(() => listBasemaps(), [])
  const baseParam = params.get('base')
  const basemap = basemaps.find((b) => b.id === (isBasemapId(baseParam) ? baseParam : 'bluemarble')) ?? basemaps[0]

  // Cover maps need cover.json; without it (sample data, or a failed load) only the trend map exists.
  const coverOk = extras.cover === true && cover.data !== null
  const askedType = parseMapType(params.get('map'))
  const varParam = params.get('var') ?? params.get('variable')
  const show: CellFilter = parseFilter(params.get('show') ?? params.get('filter'))

  const options = useMemo(() => trendOptions(manifest.variables, cover.data, t), [manifest.variables, cover.data, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const trendOption = options.find((o) => o.id === varParam) ?? options[0] ?? null
  // The trend layer of a monthly variable. It also gives the grid when there is no cover layer.
  const layerId = trendOption?.kind === 'series' ? trendOption.id : null
  const layer = useTrendLayer(layerId)
  const layerData = layer.data && layer.data.variableId === layerId ? layer.data : null
  const [lastLayer, setLastLayer] = useState<typeof layerData>(null)
  if (layerData && layerData !== lastLayer) setLastLayer(layerData)
  const gridLayer = layerData ?? lastLayer

  const results = useMemo(() => {
    if (!trendOption) return null
    if (trendOption.kind === 'series') return layerData ? layerResults(layerData) : null
    return cover.data ? coverResults(cover.data, trendOption.id as 'lossKm2' | 'modisTreeCover') : null
  }, [trendOption, layerData, cover.data])
  const trendPending = results !== null && noneTested(results)

  // The map type. Trend asked while no square was tested falls back to tree cover.
  let mapType: MapType = !coverOk ? 'trend' : (askedType ?? 'cover')
  if (mapType === 'trend' && trendPending && coverOk) mapType = 'cover'

  // Old links: ?variable=evi alone meant the trend map of EVI; ?filter= meant ?show=; ?src= and ?compare= are gone.
  useEffect(() => {
    const legacyVar = params.get('variable')
    const legacyFilter = params.get('filter')
    if (legacyVar === null && legacyFilter === null && !params.has('src') && !params.has('compare')) return
    const patch: ParamsPatch = { variable: null, filter: null, src: null, compare: null }
    if (legacyVar !== null && !params.has('var')) patch.var = legacyVar
    if (legacyFilter !== null && !params.has('show')) patch.show = parseFilter(legacyFilter) === 'all' ? null : parseFilter(legacyFilter)
    if (legacyVar !== null && askedType === null && extras.cover) {
      const known = options.find((o) => o.id === legacyVar)
      if (known?.kind === 'series') {
        // Wait for the layer: the trend map is only the right start when the variable has tested squares.
        if (!layerData && !layer.error) return
        patch.map = layerData && layerData.summary.cellsTested > 0 ? 'trend' : 'cover'
      } else if (known) {
        if (!results) return
        patch.map = noneTested(results) ? 'cover' : 'trend'
      }
    }
    setParams(patch)
  }, [params, askedType, extras.cover, options, layerData, layer.error, results, setParams])

  // Which squares and how to colour them.
  const cells: MapCell[] | null = cover.data?.cells ?? gridLayer?.cells ?? null
  const cellSizeDeg = cover.data?.cellSizeDeg ?? gridLayer?.cellSizeDeg ?? null
  const years =
    !cover.data || mapType === 'trend'
      ? []
      : mapType === 'cover'
        ? cover.data.years
        : mapType === 'loss'
          ? cover.data.lossYears
          : cover.data.burnedYears
  const year = resolveYear(years, params.get('year'))

  const trendInfo: TrendPaintInfo | null = useMemo(
    () => (mapType === 'trend' && trendOption && results ? makeTrendPaint(trendOption, results, show, t) : null),
    [mapType, trendOption, results, show, lang], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const paint: CellPaint | null = useMemo(() => {
    if (mapType === 'trend') return trendInfo?.paint ?? null
    if (!cover.data) return null
    if (mapType === 'cover') return makeCoverPaint(cover.data, year, t)
    return mapType === 'loss' ? makeLossPaint(cover.data, year, t) : makeBurnedPaint(cover.data, year, t)
  }, [mapType, trendInfo, cover.data, year, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the previous paint while the next trend layer loads, so the map (and its zoom) is never torn down.
  const [lastPaint, setLastPaint] = useState<CellPaint | null>(null)
  if (paint && paint !== lastPaint) setLastPaint(paint)
  const shownPaint = paint ?? lastPaint

  const opacity = parseOpacity(params.get('op'), mapType)
  const bordersAllowed = extras.borders !== false
  const bordersOn = params.get('borders') !== '0'
  const borders = useBorders(bordersAllowed && bordersOn)

  const cellParam = params.get('cell')
  const selected = cells?.find((c) => c.cellId === cellParam) ?? null

  const legendTrend: TrendLegendInfo | null =
    mapType === 'trend' && trendOption
      ? {
          name: trendOption.name,
          slopeUnits: trendOption.slopeUnits,
          maxAbs: trendInfo?.maxAbs ?? 0,
          range: trendInfo?.range ?? null,
          pending: trendInfo?.pending ?? false,
        }
      : null

  const set = useCallback((patch: ParamsPatch) => setParams(patch), [setParams])
  const onYear = useCallback((y: number) => setParams({ year: String(y) }), [setParams])
  const onViewChange = useCallback(
    (view: MapView) => setParams({ z: String(Number(view.zoom.toFixed(1))), lat: view.lat.toFixed(2), lon: view.lon.toFixed(2) }),
    [setParams],
  )
  const openCell = useCallback((cellId: string) => setParams({ cell: cellId }, { push: true }), [setParams])
  const closeCell = useCallback(() => setParams({ cell: null, from: null, to: null }, { push: true }), [setParams])

  // First-visit hint: the documented case of La Pampa (needs the cross-check report for its place and cell).
  const laPampa = validation.data?.cases.find((c) => c.id === 'la_pampa') ?? null
  const startCase = laPampa
    ? () => {
        setParams({ map: 'loss', year: String(peakYear(laPampa.lossYears, laPampa.hansenLossShare)), cell: laPampa.apiCellId }, { push: true })
        setFlyTo({ lat: laPampa.lat, lon: laPampa.lon })
      }
    : null

  const legend = (compact: boolean) => (
    <MapLegend mapType={mapType} year={year} trend={legendTrend} compact={compact} />
  )

  return (
    <>
      <h1 className="sr-only">
        {t('Amazon map: tree cover, tree cover loss, burned area and trends', 'Mapa de la Amazonía: cobertura, pérdida de cobertura, área quemada y tendencias')}
      </h1>
      <MapFilters
        mapType={mapType}
        onMapType={(type) => set({ map: type })}
        coverAvailable={coverOk}
        trendAvailable={!trendPending}
        trendOptions={options}
        trendId={trendOption?.id ?? ''}
        onTrendId={(id) => set({ var: id })}
        trendSummary={trendOption ? summaryLine(trendOption, layerData, validation.data, t) : null}
        show={show}
        onShow={(next) => set({ show: next === 'all' ? null : next })}
        years={years}
        year={year}
        onYear={onYear}
        opacity={opacity}
        onOpacity={(value) => set({ op: String(value) })}
        bordersAvailable={bordersAllowed}
        bordersOn={bordersOn}
        onBorders={(on) => set({ borders: on ? null : '0' })}
        basemaps={basemaps}
        basemap={basemap}
        onBasemap={(id: BasemapId) => set({ base: id === 'bluemarble' ? null : id })}
        legend={legend(false)}
        compactLegend={legend(true)}
        onStartCase={startCase}
        error={layer.error ?? (extras.cover ? cover.error : null)}
      />

      <div className="map-wrap">
        {cells && cellSizeDeg !== null && shownPaint ? (
          <TrendMap
            cells={cells}
            cellSizeDeg={cellSizeDeg}
            region={manifest.region}
            basemap={basemap}
            paint={shownPaint}
            opacity={opacity}
            borders={bordersOn ? (borders.data ?? null) : null}
            selectedCellId={selected?.cellId ?? null}
            initialView={initialView}
            flyTo={flyTo}
            onSelect={openCell}
            onViewChange={onViewChange}
          />
        ) : (
          <p className="map-overlay map-status" role="status">
            {layer.error ?? (extras.cover ? cover.error : null) ?? t('Loading the map…', 'Cargando el mapa…')}
          </p>
        )}
      </div>

      <CellViewer
        cell={selected}
        manifest={manifest}
        cover={cover.data}
        validation={validation.data}
        onClose={closeCell}
        onRestoreFocus={focusCell}
      />
    </>
  )
}
