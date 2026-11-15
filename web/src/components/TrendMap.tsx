// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15; tree cover, loss, burned and
// transparent cells with country borders added 2026-11-15; guard against a zero-size container added 2026-11-15.
// Reviewed and owned by team AETHER.
//
// The map (ADR-005). Leaflet draws NASA GIBS imagery underneath; the 1-degree cells are an SVG overlay that React renders
// into Leaflet's SVG layer. The SVG uses Web Mercator y-units so cells line up with the imagery at every zoom.
// Layers, bottom to top: imagery (200) · outside-region mask (350) · cells (400) · country borders (450, a Leaflet pane)
// · selected cell outline (460, a Leaflet pane). The cells are semi-transparent so the ground shows through them.
// What a cell looks like comes from a CellPaint (tree cover, loss, burned area or trend); this component only draws it.
// Keyboard: one Tab stop for the grid, arrow keys move between cells, Enter or Space opens a cell.

import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { Region } from '../../shared/contracts.ts'
import type { Basemap } from '../lib/basemaps.ts'
import type { CellPaint, MapCell } from '../lib/cover.ts'
import { formatCoordinates } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'
import type { MapView } from '../lib/viewState.ts'
import type { Borders } from '../services/staticData.ts'

interface Props {
  cells: MapCell[]
  /** Cell size in degrees (square cells). */
  cellSizeDeg: number
  region: Region
  basemap: Basemap
  paint: CellPaint
  /** Fill opacity of the cells, percent (20 to 100). */
  opacity: number
  /** Country borders drawn above the cells; null hides them. */
  borders: Borders | null
  selectedCellId: string | null
  initialView: MapView | null
  /** Ask the map to fly to a point; send a new object each time (the object is the request). */
  flyTo?: { lat: number; lon: number } | null
  onSelect: (cellId: string) => void
  onViewChange: (view: MapView) => void
}

const RAD = Math.PI / 180
/** Web Mercator northing in "degree" units, so x (longitude) and y share one scale. */
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD
const svgY = (lat: number) => -mercY(lat)

const BORDERS_CREDIT = 'Borders: <a href="https://www.naturalearthdata.com">Natural Earth</a>'

/** DOM id prefix of a cell, used to return focus to it from outside the map. */
export const CELL_ATTRIBUTE = 'data-cell-id'

export function TrendMap(props: Props) {
  const { lang, t } = useLang()
  const { cells, cellSizeDeg: size, region, basemap, paint, opacity, borders, selectedCellId, initialView, flyTo = null } = props
  const [west, south, east, north] = region.bbox

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const callbacks = useRef({ onSelect: props.onSelect, onViewChange: props.onViewChange })
  const initialViewRef = useRef(initialView)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const pointerType = useRef('mouse')
  const cellRefs = useRef(new Map<string, SVGRectElement>())
  const touchedRef = useRef(false)

  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [selectionSvg, setSelectionSvg] = useState<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(0)
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  /** Touch: the first tap on a square shows its readout with an "Open" button; a second tap also opens it. */
  const [touchId, setTouchId] = useState<string | null>(null)
  const [tileErrorFor, setTileErrorFor] = useState<string | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const dotsId = `dots-${uid}`
  const hatchId = `hatch-${uid}`

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
    // Phones: the credits are one compact line (CSS) so they never crowd the Filters bar; a tap shows them in full
    // (the first tap opens them instead of following a link). Desktop: always in full, nothing changes.
    const credits = map.attributionControl.getContainer()
    credits?.addEventListener('click', (event) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return
      if (!credits.classList.contains('is-open')) {
        event.preventDefault()
        credits.classList.add('is-open')
      } else if (!(event.target instanceof HTMLAnchorElement)) {
        credits.classList.remove('is-open')
      }
    })
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map)

    // Room around the region, with extra space at the bottom for the readout.
    const frame: L.FitBoundsOptions = { paddingTopLeft: [24, 24], paddingBottomRight: [24, 72], animate: false }
    const padding = L.point(48, 96)
    // Leaflet derives the zoom from the container's size. With no room for the padding (0 px while the page or its pane
    // is hidden, or a container smaller than the padding) it computes NaN and throws, which blanked the whole app. So the
    // region is fitted only when there is room; until then a provisional view keeps the map valid, and the
    // ResizeObserver below fits the region as soon as the container has a size.
    const hasRoom = () => container.clientWidth > padding.x && container.clientHeight > padding.y
    const fitRegion = () => {
      if (hasRoom()) map.setMinZoom(map.getBoundsZoom(bounds, false, padding))
    }
    fitRegion()
    const start = initialViewRef.current
    if (start) map.setView([start.lat, start.lon], Math.max(start.zoom, map.getMinZoom()))
    else if (hasRoom()) map.fitBounds(bounds, frame)
    else map.setView(bounds.getCenter(), 3, { animate: false })

    // Outside the region the imagery stays visible under a veil (context, not focus), and the region's edge is drawn.
    // Pan and zoom stay inside the region (maxBounds + minZoom above). The region is the API's bounding box until the
    // team picks the real boundary (P-008).
    map.createPane('mask').style.zIndex = '350'
    map.createPane('borders').style.zIndex = '450'
    map.createPane('selection').style.zIndex = '460'
    const world: L.LatLngExpression[] = [[-85, -180], [85, -180], [85, 180], [-85, 180]]
    const box: L.LatLngExpression[] = [[south, west], [north, west], [north, east], [south, east]]
    L.polygon([world, box], { pane: 'mask', className: 'region-mask', interactive: false, stroke: false }).addTo(map)
    L.rectangle(bounds, { pane: 'mask', className: 'region-edge', interactive: false, fill: false }).addTo(map)

    const viewBox = `${west} ${svgY(north)} ${east - west} ${svgY(south) - svgY(north)}`
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgEl.setAttribute('viewBox', viewBox)
    svgEl.setAttribute('preserveAspectRatio', 'none')
    L.svgOverlay(svgEl, bounds, { interactive: true }).addTo(map)
    // The selected-cell outline lives in its own pane, above the borders, and never takes a click.
    const selectionEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    selectionEl.setAttribute('viewBox', viewBox)
    selectionEl.setAttribute('preserveAspectRatio', 'none')
    L.svgOverlay(selectionEl, bounds, { pane: 'selection', interactive: false }).addTo(map)

    // Until the user moves the map, keep the whole region framed and keep the view out of the URL.
    touchedRef.current = start !== null
    const touch = () => {
      touchedRef.current = true
    }
    for (const type of ['pointerdown', 'wheel', 'keydown', 'touchstart']) container.addEventListener(type, touch)

    map.on('zoomend', () => setZoom(map.getZoom()))
    map.on('moveend', () => {
      if (!touchedRef.current) return
      const c = map.getCenter()
      callbacks.current.onViewChange({ zoom: map.getZoom(), lat: c.lat, lon: c.lng })
    })
    map.on('mousemove', (e: L.LeafletMouseEvent) => setCursor({ lat: e.latlng.lat, lon: e.latlng.lng }))
    map.on('mouseout', () => setCursor(null))

    const resize = new ResizeObserver(() => {
      map.invalidateSize()
      fitRegion()
      if (!touchedRef.current && hasRoom()) map.fitBounds(bounds, frame)
    })
    resize.observe(container)

    mapRef.current = map
    setZoom(map.getZoom())
    setSvg(svgEl)
    setSelectionSvg(selectionEl)
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

  // Country borders, above the cells: a dark casing and a white line, so they read on dark imagery and on pale cells.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !svg || !borders) return
    const data = borders as unknown as Parameters<typeof L.geoJSON>[0]
    const common = { pane: 'borders', interactive: false, fill: false, lineJoin: 'round' } as const
    const casing = L.geoJSON(data, { style: { ...common, color: '#000', opacity: 0.45, weight: 3 } })
    const line = L.geoJSON(data, { style: { ...common, color: '#fff', opacity: 0.9, weight: 1.25 } })
    casing.addTo(map)
    line.addTo(map)
    map.attributionControl.addAttribution(BORDERS_CREDIT)
    return () => {
      casing.remove()
      line.remove()
      map.attributionControl.removeAttribution(BORDERS_CREDIT)
    }
  }, [borders, svg])

  // Fly to a requested point (a documented case). The view then counts as moved by the user.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !svg || !flyTo) return
    touchedRef.current = true
    const target = L.latLng(flyTo.lat, flyTo.lon)
    const zoomTo = Math.min(Math.max(map.getZoom(), 6), map.getMaxZoom())
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(target, zoomTo, { animate: false })
    else map.flyTo(target, zoomTo, { duration: 1.2 })
  }, [flyTo, svg])

  // Grid index of a point: rows and columns counted from the south-west corner of the first square, so a point anywhere
  // inside a square (and the square's centre) gives the same index.
  const origin = useMemo(() => ({ lat: (cells[0]?.lat ?? 0) - size / 2, lon: (cells[0]?.lon ?? 0) - size / 2 }), [cells, size])
  const rowColKey = (lat: number, lon: number): string =>
    `${Math.floor((lat - origin.lat) / size)},${Math.floor((lon - origin.lon) / size)}`
  const grid = useMemo(() => {
    const byRowCol = new Map<string, MapCell>()
    for (const cell of cells) {
      byRowCol.set(`${Math.floor((cell.lat - origin.lat) / size)},${Math.floor((cell.lon - origin.lon) / size)}`, cell)
    }
    return byRowCol
  }, [cells, origin, size])

  const selected = cells.find((c) => c.cellId === selectedCellId) ?? null
  const rovingId = focusId ?? selected?.cellId ?? cells[0]?.cellId ?? null
  const focusedCell = focused ? (cells.find((c) => c.cellId === rovingId) ?? null) : null
  const hoverCell = cursor ? (grid.get(rowColKey(cursor.lat, cursor.lon)) ?? null) : null
  const touchCell = touchId ? (cells.find((c) => c.cellId === touchId) ?? null) : null
  const readoutCell = focusedCell ?? hoverCell ?? touchCell ?? (cursor ? null : selected)
  const atMaxZoom = zoom >= basemap.maxZoom
  const pxPerUnit = (256 * 2 ** zoom) / 360
  const dot = { gap: 9 / pxPerUnit, r: 1.7 / pxPerUnit }
  const hatch = { gap: 6 / pxPerUnit, stroke: 1.4 / pxPerUnit }
  const styles = useMemo(() => new Map(cells.map((c) => [c.cellId, paint.style(c)])), [cells, paint])

  const moveFocus = (cell: MapCell) => {
    setFocusId(cell.cellId)
    cellRefs.current.get(cell.cellId)?.focus({ preventScroll: true })
    const map = mapRef.current
    if (map && !map.getBounds().contains([cell.lat, cell.lon])) map.panTo([cell.lat, cell.lon])
  }

  const onKeyDown = (event: KeyboardEvent, cell: MapCell) => {
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
    pointerType.current = event.pointerType
  }

  const onClick = (event: MouseEvent, cell: MapCell) => {
    const start = pointerStart.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return // it was a drag
    setFocusId(cell.cellId)
    if (pointerType.current === 'touch' && touchId !== cell.cellId) {
      setTouchId(cell.cellId) // first tap: show the readout
      return
    }
    setTouchId(null)
    callbacks.current.onSelect(cell.cellId)
  }

  const cellGeometry = (cell: MapCell) => {
    const y = svgY(cell.lat + size / 2)
    return { x: cell.lon - size / 2, y, width: size, height: svgY(cell.lat - size / 2) - y }
  }

  const op = opacity / 100
  const groupStyle = { '--cell-op': op } as CSSProperties
  const overlay = (
    <>
      <defs>
        <pattern id={dotsId} width={dot.gap} height={dot.gap} patternUnits="userSpaceOnUse">
          <circle cx={dot.gap / 2} cy={dot.gap / 2} r={dot.r} fill="rgb(255 255 255 / 0.9)" stroke="rgb(0 0 0 / 0.5)" strokeWidth={0.4 / pxPerUnit} />
        </pattern>
        <pattern id={hatchId} width={hatch.gap} height={hatch.gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={hatch.gap} style={{ stroke: 'var(--cell-empty)', strokeWidth: hatch.stroke }} />
        </pattern>
      </defs>
      <g key={paint.key} className="cells sweep" style={groupStyle}>
        {cells.map((cell) => {
          const g = cellGeometry(cell)
          const style = styles.get(cell.cellId) ?? { color: 'var(--cell-empty)', kind: 'empty' as const }
          const delay = `${Math.round(((cell.lon - west) / (east - west)) * 600)}ms`
          const label = paint.describe(cell)
          return (
            <g key={cell.cellId}>
              <rect
                ref={(el) => {
                  if (el) cellRefs.current.set(cell.cellId, el)
                  else cellRefs.current.delete(cell.cellId)
                }}
                {...g}
                {...{ [CELL_ATTRIBUTE]: cell.cellId }}
                className={['cell', style.kind, style.dim ? 'dimmed' : ''].join(' ')}
                style={{ animationDelay: delay, fill: style.kind === 'none' || style.kind === 'empty' ? 'transparent' : style.color }}
                role="button"
                tabIndex={cell.cellId === rovingId ? 0 : -1}
                aria-label={label}
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
                <title>{label}</title>
              </rect>
              {style.kind === 'dotted' && !style.dim && <rect {...g} className="cell-dots" fill={`url(#${dotsId})`} pointerEvents="none" />}
              {style.kind === 'empty' && !style.dim && <rect {...g} className="cell-hatch" fill={`url(#${hatchId})`} pointerEvents="none" />}
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
    </>
  )

  const selectionOutline = selected && (
    <>
      <rect {...cellGeometry(selected)} className="cell-selected" stroke="#ffffff" strokeWidth={6} />
      <rect {...cellGeometry(selected)} className="cell-selected" strokeWidth={3} style={{ stroke: 'var(--accent)' }} />
    </>
  )

  // Leaflet builds the zoom buttons once, in English: rename them when the language changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const names: [string, string][] = [
      ['.leaflet-control-zoom-in', t('Zoom in', 'Acercar')],
      ['.leaflet-control-zoom-out', t('Zoom out', 'Alejar')],
    ]
    for (const [selector, name] of names) {
      const button = container.querySelector(selector)
      button?.setAttribute('title', name)
      button?.setAttribute('aria-label', name)
    }
  }, [lang, svg]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={containerRef} className="map" role="region" aria-label={paint.regionLabel} />
      {svg && createPortal(overlay, svg)}
      {selectionSvg && selectionOutline && createPortal(selectionOutline, selectionSvg)}

      <div className="map-overlay readout" aria-live="polite">
        <span>
          {readoutCell
            ? formatCoordinates(readoutCell.lat, readoutCell.lon)
            : cursor
              ? formatCoordinates(cursor.lat, cursor.lon, 2)
              : window.matchMedia('(pointer: coarse)').matches
                ? t('Tap a square to see its value', 'Toca un cuadro para ver su valor')
                : t('Move over a square to see its value', 'Pasa sobre un cuadro para ver su valor')}
        </span>
        {readoutCell && <span>{paint.readout(readoutCell)}</span>}
        {readoutCell && (
          <span className="muted">
            {touchCell && readoutCell === touchCell
              ? t('Open its file with the button, or tap the square again', 'Abre su ficha con el botón, o toca el cuadro otra vez')
              : t('Click to open this area', 'Haz clic para abrir esta área')}
          </span>
        )}
        {/* Touch: a visible way to open the square's file, instead of relying on a second tap (José, 15 Nov). */}
        {touchCell && readoutCell === touchCell && (
          <button
            type="button"
            className="btn primary readout-open"
            onClick={() => {
              setTouchId(null)
              callbacks.current.onSelect(touchCell.cellId)
            }}
          >
            {t('Open this area’s file', 'Abrir la ficha de esta área')}
          </button>
        )}
      </div>

      {atMaxZoom && (
        <p className="map-overlay zoom-note" role="status">
          <strong>{t(`Maximum zoom for ${basemap.label}.`, `Zoom máximo para ${basemap.labelEs}.`)}</strong>{' '}
          {t(`Squares are ${size}° wide; closer views would only enlarge them.`, `Los cuadros miden ${size}°; acercar más solo los agrandaría.`)}
        </p>
      )}
      {tileErrorFor === basemap.id && basemap.url && (
        <p className="map-overlay map-status" role="status">
          {t('NASA GIBS imagery is not loading. The squares still work.', 'Las imágenes de NASA GIBS no cargan. Los cuadros siguen funcionando.')}
        </p>
      )}
    </>
  )
}
