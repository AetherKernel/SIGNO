// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Presentation helpers for the yearly maps (tree cover, tree cover loss, burned area): colour classes, reading a value
// out of the cover layer, and the "paint" the map uses to colour its cells. No statistics here: values are the
// backend's, shown as they are.

import type { CoverCell, CoverFlag, CoverLayer } from '../../shared/contracts.ts'
import { formatCoordinates, formatKm2, formatPercent } from './format.ts'
import type { CoverSource } from './viewState.ts'

/** Colour class edges (percent of the cell). Finer at the top because most Amazon cells are dense forest. */
export const COVER_BREAKS = [0, 20, 40, 60, 80, 90, 100]
export const COVER_CLASSES = COVER_BREAKS.length - 1

export const SOURCE_LABEL: Record<CoverSource, string> = {
  hansen: 'Hansen (Landsat, 30 m)',
  modis: 'MODIS MOD44B (250 m)',
}

/** Colour class 0..5 of a tree cover percent, or null when there is no value. */
export function coverClass(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  for (let k = COVER_CLASSES - 1; k > 0; k--) if (value >= COVER_BREAKS[k]) return k
  return 0
}

export function coverColor(value: number | null): string {
  const k = coverClass(value)
  return k === null ? 'var(--cell-empty)' : `var(--green-${k})`
}

/** Tree cover of one cell for a source and a year; null when the year or the cell is missing. */
export function coverValue(cell: CoverCell | undefined, source: CoverSource, years: number[], year: number): number | null {
  if (!cell) return null
  const index = years.indexOf(year)
  if (index < 0) return null
  return (source === 'hansen' ? cell.hansenTreeCover : cell.modisTreeCover)[index] ?? null
}

/** The known problem of a source in a year (for example the suspect MODIS 2025), if the API lists one. */
export function flagFor(cover: CoverLayer | null, source: CoverSource, year: number): CoverFlag | null {
  return cover?.flags.find((f) => f.source.toLowerCase() === source && f.year === year) ?? null
}

/** What the source's "year" means, in plain words. */
export function yearMeaning(source: CoverSource, year: number): string {
  return source === 'hansen' ? year === 2000 ? 'in 2000 (baseline)' : `end of ${year}` : `March ${year} to March ${year + 1}`
}

export function coverByCellId(cover: CoverLayer | null): Map<string, CoverCell> {
  return new Map((cover?.cells ?? []).map((c) => [c.cellId, c]))
}

/** Class edges (km2 per cell) of the loss and burned maps, chosen from the data (quartiles and the 90th percentile). */
export const LOSS_BREAKS = [5, 25, 100, 250]
export const BURNED_BREAKS = [10, 50, 200, 800]

/** Colour classes of the amount maps: 1..5, as many as breaks plus one. Class 0 is "none" (not drawn). */
export const AMOUNT_CLASSES = 5

/** Class of an amount: null = no data, 0 = none (zero), 1..5 by `breaks` (lower edge included). */
export function amountClass(value: number | null, breaks: number[]): number | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value <= 0) return 0
  return 1 + breaks.filter((b) => value >= b).length
}

/** A map cell: only where it is. Its value comes from the paint (by cellId). */
export interface MapCell {
  cellId: string
  lat: number
  lon: number
}

/**
 * How the map draws one cell.
 *   solid  = filled with `color`
 *   none   = zero (loss, burned): no fill, but the cell stays clickable
 *   empty  = no value: grey hatch
 *   dotted = trend that is not significant: lighter fill and dots
 * `dim` lights the cell down (a trend filter that does not keep it).
 */
export type CellStyleKind = 'solid' | 'none' | 'empty' | 'dotted'

export interface CellStyle {
  color: string
  kind: CellStyleKind
  dim?: boolean
}

/** How TrendMap colours and describes its cells. */
export interface CellPaint {
  /** Changes when the kind of map changes (replays the sweep); stays the same when only the year changes. */
  key: string
  regionLabel: string
  style: (cell: MapCell) => CellStyle
  /** Accessible name of a cell. */
  describe: (cell: MapCell) => string
  /** The value line of the hover or focus readout. */
  readout: (cell: MapCell) => string
}

function yearAt(years: number[], values: (number | null)[] | undefined, year: number): number | null {
  const index = years.indexOf(year)
  return index < 0 ? null : (values?.[index] ?? null)
}

const HINT = 'Tab to reach the squares, use the arrow keys to move between them and Enter to open one.'

export function makeCoverPaint(cover: CoverLayer, year: number): CellPaint {
  const cells = coverByCellId(cover)
  const valueOf = (cell: MapCell) => coverValue(cells.get(cell.cellId), 'hansen', cover.years, year)
  const readout = (cell: MapCell) => {
    const value = valueOf(cell)
    const when = year === 2000 ? 'in the 2000 baseline' : `at the end of ${year}`
    return value === null ? `No tree cover value for ${year}` : `Tree cover ${formatPercent(value)} ${when}`
  }
  return {
    key: 'cover',
    regionLabel: `Tree cover map, ${year}. ${HINT}`,
    style: (cell) => {
      const value = valueOf(cell)
      return value === null ? { color: 'var(--cell-empty)', kind: 'empty' } : { color: coverColor(value), kind: 'solid' }
    },
    describe: (cell) => `${formatCoordinates(cell.lat, cell.lon)}: ${readout(cell)}`,
    readout,
  }
}

function makeAmountPaint(
  cover: CoverLayer,
  year: number,
  field: 'lossKm2' | 'burnedKm2',
  years: number[],
  breaks: number[],
  prefix: 'loss' | 'burn',
  texts: { map: string; some: (km2: string, year: number) => string; none: (year: number) => string; missing: (year: number) => string },
): CellPaint {
  const cells = coverByCellId(cover)
  const valueOf = (cell: MapCell) => yearAt(years, cells.get(cell.cellId)?.[field], year)
  const readout = (cell: MapCell) => {
    const value = valueOf(cell)
    if (value === null) return texts.missing(year)
    return value <= 0 ? texts.none(year) : texts.some(formatKm2(value), year)
  }
  return {
    key: field === 'lossKm2' ? 'loss' : 'burned',
    regionLabel: `${texts.map}, ${year}. ${HINT}`,
    style: (cell) => {
      const k = amountClass(valueOf(cell), breaks)
      if (k === null) return { color: 'var(--cell-empty)', kind: 'empty' }
      return k === 0 ? { color: 'transparent', kind: 'none' } : { color: `var(--${prefix}-${k})`, kind: 'solid' }
    },
    describe: (cell) => `${formatCoordinates(cell.lat, cell.lon)}: ${readout(cell)}`,
    readout,
  }
}

export function makeLossPaint(cover: CoverLayer, year: number): CellPaint {
  return makeAmountPaint(cover, year, 'lossKm2', cover.lossYears, LOSS_BREAKS, 'loss', {
    map: 'Tree cover loss map',
    some: (km2, y) => `${km2} of tree cover lost in ${y}`,
    none: (y) => `No tree cover lost in ${y}`,
    missing: (y) => `No tree cover loss value for ${y}`,
  })
}

export function makeBurnedPaint(cover: CoverLayer, year: number): CellPaint {
  return makeAmountPaint(cover, year, 'burnedKm2', cover.burnedYears, BURNED_BREAKS, 'burn', {
    map: 'Burned area map',
    some: (km2, y) => `${km2} burned in ${y}`,
    none: (y) => `No burned area in ${y}`,
    missing: (y) => `No burned area value for ${y}`,
  })
}

/** Year of the highest value of a yearly series (where a documented case is shown on the map). */
export function peakYear(years: number[], values: (number | null)[]): number {
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
