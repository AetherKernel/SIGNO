// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// Trend map (ADR-005). Leaflet draws NASA GIBS imagery underneath; the trend grid is an SVG overlay that React renders
// into Leaflet's SVG layer. The SVG uses Web Mercator y-units so cells line up with the imagery at every zoom.
// Colour = direction and size of the change (PuOr classes); dots = not significant, as decided by the backend data.
// Keyboard: one Tab stop for the grid, arrow keys move between cells, Enter or Space opens a cell.

import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { CellTrend, Region, TrendLayer, Variable } from '../../shared/contracts.ts'
import type { Basemap } from '../lib/basemaps.ts'
import { formatCoordinates, formatPValue, formatSlope, maxAbsSlope, slopeColor } from '../lib/format.ts'
import { matchesFilter, type CellFilter, type MapView } from '../lib/viewState.ts'

interface Props {
  layer: TrendLayer
  region: Region
  variable: Variable
  basemap: Basemap
  filter: CellFilter
  selectedCellId: string | null
  initialView: MapView | null
  onSelect: (cellId: string) => void
  onViewChange: (view: MapView) => void
}

const RAD = Math.PI / 180
/** Web Mercator northing in "degree" units, so x (longitude) and y share one scale. */
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD
const svgY = (lat: number) => -mercY(lat)

export function TrendMap(props: Props) {
  const { layer, region, variable, basemap, filter, selectedCellId, initialView } = props
  const [west, south, east, north] = region.bbox
  const size = layer.cellSizeDeg

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const callbacks = useRef({ onSelect: props.onSelect, onViewChange: props.onViewChange })
  const initialViewRef = useRef(initialView)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const cellRefs = useRef(new Map<string, SVGRectElement>())

  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(0)
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [tileErrorFor, setTileErrorFor] = useState<string | null>(null)
  const patternId = `dots-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    callbacks.current = { onSelect: props.onSelect, onViewChange: props.onViewChange }
  })

  // Create the Leaflet map once. The region box is fixed for the life of the page.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const bounds = L.latLngBounds([south, west], [north, east])
    // The map shows only the study region: it cannot be panned or zoomed out beyond it.
    const map = L.map(container, {
      zoomControl: false,
      zoomSnap: 0.5,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
    })
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map)

    // Room around the region, with extra space at the bottom for the coordinate readout.
    const frame: L.FitBoundsOptions = { paddingTopLeft: [24, 24], paddingBottomRight: [24, 72], animate: false }
    const fitRegion = () => map.setMinZoom(map.getBoundsZoom(bounds, false, L.point(48, 96)))
    fitRegion()
    const start = initialViewRef.current
    if (start) map.setView([start.lat, start.lon], Math.max(start.zoom, map.getMinZoom()))
    else map.fitBounds(bounds, frame)

    // Everything outside the region is covered (the "crop"), and the region's edge is drawn.
    // The region is the API's bounding box until the team picks the real boundary (P-008).
    map.createPane('mask').style.zIndex = '350'
    const world: L.LatLngExpression[] = [[-85, -180], [85, -180], [85, 180], [-85, 180]]
    const region: L.LatLngExpression[] = [[south, west], [north, west], [north, east], [south, east]]
    L.polygon([world, region], { pane: 'mask', className: 'region-mask', interactive: false, stroke: false }).addTo(map)
    L.rectangle(bounds, { pane: 'mask', className: 'region-edge', interactive: false, fill: false }).addTo(map)

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgEl.setAttribute('viewBox', `${west} ${svgY(north)} ${east - west} ${svgY(south) - svgY(north)}`)
    svgEl.setAttribute('preserveAspectRatio', 'none')
    L.svgOverlay(svgEl, bounds, { interactive: true }).addTo(map)

    // Until the user moves the map, keep the whole region framed and keep the view out of the URL.
    let touched = start !== null
    const touch = () => {
      touched = true
    }
    for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart']) container.addEventListener(type, touch)

    map.on('zoomend', () => setZoom(map.getZoom()))
    map.on('moveend', () => {
      if (!touched) return
      const c = map.getCenter()
      callbacks.current.onViewChange({ zoom: map.getZoom(), lat: c.lat, lon: c.lng })
    })
    map.on('mousemove', (e: L.LeafletMouseEvent) => setCursor({ lat: e.latlng.lat, lon: e.latlng.lng }))
    map.on('mouseout', () => setCursor(null))

    const resize = new ResizeObserver(() => {
      map.invalidateSize()
      fitRegion()
      if (!touched) map.fitBounds(bounds, frame)
    })
    resize.observe(container)

    mapRef.current = map
    setZoom(map.getZoom())
    setSvg(svgEl)
    return () => {
      for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart']) container.removeEventListener(type, touch)
      resize.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [west, south, east, north])

  // Base map imagery; its deepest level is also the zoom limit.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !svg) return
    map.setMaxZoom(basemap.maxZoom)
    if (!basemap.url) return
    const tiles = L.tileLayer(basemap.url, {
      maxNativeZoom: basemap.maxZoom,
      maxZoom: basemap.maxZoom,
      attribution: basemap.attribution,
    })
    // Warn only when the imagery is really down: several failures and no tile loaded at all.
    let loaded = 0
    let failed = 0
    tiles.on('tileload', () => {
      loaded += 1
    })
    tiles.on('tileerror', () => {
      failed += 1
      if (failed >= 4 && loaded === 0) setTileErrorFor(basemap.id)
    })
    tiles.addTo(map).bringToBack()
    return () => {
      tiles.remove()
    }
  }, [basemap.id, basemap.url, basemap.maxZoom, basemap.attribution, svg])

  const maxAbs = useMemo(() => maxAbsSlope(layer.cells), [layer.cells])
  const grid = useMemo(() => {
    const byRowCol = new Map<string, CellTrend>()
    for (const cell of layer.cells) byRowCol.set(rowColKey(cell.lat, cell.lon), cell)
    return byRowCol
    // rowColKey depends on the region and cell size, which come with the layer
  }, [layer.cells]) // eslint-disable-line react-hooks/exhaustive-deps

  function rowColKey(lat: number, lon: number): string {
    return `${Math.floor((north - lat) / size)},${Math.floor((lon - west) / size)}`
  }

  const selected = layer.cells.find((c) => c.cellId === selectedCellId) ?? null
  const rovingId = focusId ?? selected?.cellId ?? layer.cells[0]?.cellId ?? null
  const focusedCell = focused ? (layer.cells.find((c) => c.cellId === rovingId) ?? null) : null
  const hoverCell = cursor ? (grid.get(rowColKey(cursor.lat, cursor.lon)) ?? null) : null
  const readoutCell = focusedCell ?? hoverCell ?? (cursor ? null : selected)
  const atMaxZoom = zoom >= basemap.maxZoom
  const pxPerUnit = (256 * 2 ** zoom) / 360
  const dot = { gap: 9 / pxPerUnit, r: 1.7 / pxPerUnit }

  const label = (cell: CellTrend) =>
    `${cell.cellId}, ${formatCoordinates(cell.lat, cell.lon)}: ${formatSlope(cell.slopePerDecade, variable.units)}, ` +
    `p ${formatPValue(cell.pValue)}, ${cell.significant ? 'significant' : 'not significant'}`

  const moveFocus = (cell: CellTrend) => {
    setFocusId(cell.cellId)
    cellRefs.current.get(cell.cellId)?.focus({ preventScroll: true })
    const map = mapRef.current
    if (map && !map.getBounds().contains([cell.lat, cell.lon])) map.panTo([cell.lat, cell.lon])
  }

  const onKeyDown = (event: KeyboardEvent, cell: CellTrend) => {
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    if (step) {
      event.preventDefault()
      event.stopPropagation()
      const next = grid.get(rowColKey(cell.lat - step[0] * size, cell.lon + step[1] * size))
      if (next) moveFocus(next)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callbacks.current.onSelect(cell.cellId)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const onClick = (event: MouseEvent, cell: CellTrend) => {
    const start = pointerStart.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return // it was a drag
    setFocusId(cell.cellId)
    callbacks.current.onSelect(cell.cellId)
  }

  const cellGeometry = (cell: CellTrend) => {
    const y = svgY(cell.lat + size / 2)
    return { x: cell.lon - size / 2, y, width: size, height: svgY(cell.lat - size / 2) - y }
  }

  const overlay = (
    <>
      <defs>
        <pattern id={patternId} width={dot.gap} height={dot.gap} patternUnits="userSpaceOnUse">
          <circle cx={dot.gap / 2} cy={dot.gap / 2} r={dot.r} fill="rgb(255 255 255 / 0.9)" stroke="rgb(0 0 0 / 0.5)" strokeWidth={0.4 / pxPerUnit} />
        </pattern>
      </defs>
      <g key={layer.variableId} className={zoom >= 6.5 ? 'sweep near' : 'sweep'}>
        {layer.cells.map((cell) => {
          const g = cellGeometry(cell)
          const lit = matchesFilter(cell, filter)
          const delay = `${Math.round(((cell.lon - west) / (east - west)) * 600)}ms`
          return (
            <g key={cell.cellId}>
              <rect
                ref={(el) => {
                  if (el) cellRefs.current.set(cell.cellId, el)
                  else cellRefs.current.delete(cell.cellId)
                }}
                {...g}
                className={['cell', cell.significant ? 'significant' : 'not-significant', lit ? '' : 'dimmed'].join(' ')}
                style={{ animationDelay: delay, fill: slopeColor(cell.slopePerDecade, maxAbs) }}
                role="button"
                tabIndex={cell.cellId === rovingId ? 0 : -1}
                aria-label={label(cell)}
                aria-pressed={cell.cellId === selectedCellId}
                onPointerDown={onPointerDown}
                onClick={(event) => onClick(event, cell)}
                onKeyDown={(event) => onKeyDown(event, cell)}
                onFocus={() => {
                  setFocusId(cell.cellId)
                  setFocused(true)
                }}
                onBlur={() => setFocused(false)}
              >
                <title>{label(cell)}</title>
              </rect>
              {!cell.significant && lit && <rect {...g} fill={`url(#${patternId})`} pointerEvents="none" />}
            </g>
          )
        })}
        <rect
          className="sweep-line"
          x={west}
          y={svgY(north)}
          width={3 / pxPerUnit}
          height={svgY(south) - svgY(north)}
          style={{ fill: 'var(--accent)', ['--sweep-distance' as string]: `${east - west}px` }}
        />
      </g>
      {selected && (
        <>
          <rect {...cellGeometry(selected)} className="cell-selected" stroke="#ffffff" strokeWidth={6} />
          <rect {...cellGeometry(selected)} className="cell-selected" strokeWidth={3} style={{ stroke: 'var(--accent)' }} />
        </>
      )}
    </>
  )

  return (
    <>
      <div
        ref={containerRef}
        className="map"
        role="region"
        aria-label={`Trend map of ${variable.name}. Tab to reach the cells, use the arrow keys to move between them and Enter to open one.`}
      />
      {svg && createPortal(overlay, svg)}

      <div className="map-overlay readout" aria-live="polite">
        <span>
          {readoutCell
            ? `${readoutCell.cellId} · ${formatCoordinates(readoutCell.lat, readoutCell.lon)}`
            : cursor
              ? formatCoordinates(cursor.lat, cursor.lon, 2)
              : 'Select a cell to open its area file'}
        </span>
        {readoutCell && <span>{formatSlope(readoutCell.slopePerDecade, variable.units)} · p {formatPValue(readoutCell.pValue)}</span>}
        <span className="muted">
          Zoom {Number(zoom.toFixed(1))} of {basemap.maxZoom} · {size}° cells
        </span>
      </div>

      {atMaxZoom && (
        <p className="map-overlay zoom-note" role="status">
          <strong>Maximum zoom for {basemap.label}.</strong> Trend cells are {size}° wide; closer views would only
          enlarge them.
        </p>
      )}
      {tileErrorFor === basemap.id && basemap.url && (
        <p className="map-overlay map-status" role="status">
          NASA GIBS imagery is not loading. The trend cells still work.
        </p>
      )}
    </>
  )
}
