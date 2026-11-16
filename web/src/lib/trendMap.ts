// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15; range of the coloured squares for the legend
// added 2026-11-15. Reviewed and owned by team AETHER.
// 2026-11-15: MODIS tree cover removed from the trends; Hansen loss has one trend (2011-2025; the earlier years are shown, not
// tested). "Clear or not" rule: a clear square reads direction, slope and 95 % CI; one that is not clear reads its slope and a "?"
// whose tip says why it is not proven (p-value, correction, interval).
//
// The trend map: which measures can be mapped as a trend, and how their cells are painted. A trend comes from the
// backend only (slope per decade, p-value, "significant" after the false discovery rate correction): the browser
// picks values and formats them, it never tests or fits anything.
//   - the monthly variables (NDVI, EVI, daytime temperature, rainfall, burned area): trends/{id}.json
//   - tree cover loss (Hansen): CoverCell.trends in cover.json (lossKm2 = 2011-2025)

import type { CoverCellTrend, SenLine, CoverLayer, TrendLayer, ValidationReport, Variable } from '../../shared/contracts.ts'
import { ciInline, unclearTip } from './trendWords.ts'
import type { CellPaint, MapCell } from './cover.ts'
import { formatCoordinates, formatTrendSlope, maxAbsSlope, slopeColor, unitLabel } from './format.ts'
import { EN, type Tr } from './i18n.ts'
import { matchesFilter, type CellFilter } from './viewState.ts'

export interface TrendOption {
  /** Value of ?var=. The monthly variables use their manifest id; the loss trend is "lossKm2" (2011-2025). */
  id: string
  name: string
  /** Units of the slope, already "per decade". */
  slopeUnits: string
  /** First and last year of the test. */
  years: [number, number]
  kind: 'series' | 'cover'
}

export interface TrendResult {
  slopePerDecade: number | null
  pValue: number | null
  significant: boolean
  line?: SenLine
  slopeCi95?: [number, number] | null
}

export type CoverTrendKey = 'lossKm2'

const yearOf = (month: string) => Number(month.slice(0, 4))

/** The measures that can be shown as a trend, in the order of the Variable select. */
export function trendOptions(variables: Variable[], cover: CoverLayer | null, t: Tr = EN): TrendOption[] {
  const options: TrendOption[] = variables.map((v) => ({
    id: v.id,
    name: v.name,
    slopeUnits: v.slopeUnits ?? `${unitLabel(v)} per decade`,
    years: v.trendYears ? [v.trendYears.start, v.trendYears.end] : [yearOf(v.period.start), yearOf(v.period.end)],
    kind: 'series',
  }))
  if (cover && cover.cells.some((c) => c.trends?.lossKm2)) options.push(lossOption(cover, t))
  return options
}

/** Years of the loss trend: cover.json lossTrendYears, else from the method change year to the last year of loss. */
export function lossTrendYears(cover: CoverLayer): [number, number] {
  if (cover.lossTrendYears) return [cover.lossTrendYears[0], cover.lossTrendYears[1]]
  const last = cover.lossYears[cover.lossYears.length - 1]
  return [cover.methodChangeYear ?? cover.lossYears[0], last]
}

/** The loss trend (Hansen, 2011-2025) as a trend option. */
export function lossOption(cover: CoverLayer, t: Tr = EN): TrendOption {
  return {
    id: 'lossKm2',
    name: t('Tree cover loss', 'Pérdida de cobertura arbórea'),
    slopeUnits: 'km² per year, per decade',
    years: lossTrendYears(cover),
    kind: 'cover',
  }
}

export function optionLabel(option: TrendOption): string {
  // Short on purpose: the select must not truncate. The loss trend carries its years because it starts later than the others.
  return option.kind === 'cover' ? `${option.name}, ${option.years[0]}–${option.years[1]}` : option.name
}

/** Trend results by cell id for a monthly variable. */
export function layerResults(layer: TrendLayer): Map<string, TrendResult> {
  return new Map(layer.cells.map((c) => [c.cellId, c]))
}

/** Trend results by cell id for a cover measure; cells that were not tested are left out. */
export function coverResults(cover: CoverLayer, key: CoverTrendKey): Map<string, TrendResult> {
  const results = new Map<string, TrendResult>()
  for (const cell of cover.cells) {
    const trend: CoverCellTrend | null | undefined = cell.trends?.[key]
    if (trend) results.set(cell.cellId, trend)
  }
  return results
}

/** True when no cell was tested (the "trend test not published yet" state). */
export function noneTested(results: Map<string, TrendResult>): boolean {
  for (const r of results.values()) if (r.slopePerDecade !== null) return false
  return true
}

/** "212 of 566 squares changed significantly: 140 down, 72 up." from the backend's counts; null when there are none. */
export function summaryLine(option: TrendOption, layer: TrendLayer | null, validation: ValidationReport | null, t: Tr = EN): string | null {
  let counts: { tested: number; down: number; up: number } | null = null
  if (option.kind === 'series' && layer && layer.variableId === option.id) {
    const s = layer.summary
    counts = { tested: s.cellsTested, down: s.significantDecreasing, up: s.significantIncreasing }
  } else if (option.kind === 'cover') {
    const v = validation?.trendChecks?.variables.find((x) => x.variableId === option.id)
    if (v) counts = { tested: v.cellsTested, down: v.significantDecreasing, up: v.significantIncreasing }
  }
  if (!counts || counts.tested === 0) return null
  const n = counts.down + counts.up
  const [all, tested, down, up] = [n, counts.tested, counts.down, counts.up].map((x) => x.toLocaleString('en-US'))
  return t(
    `${all} of ${tested} squares changed significantly: ${down} down, ${up} up. Years tested: ${option.years[0]}–${option.years[1]}.`,
    `${all} de ${tested} cuadros cambiaron de forma significativa: ${down} bajan, ${up} suben. Años probados: ${option.years[0]}–${option.years[1]}.`,
  )
}

/** Legend range: symmetric, at the 90th percentile of |significant slopes| so typical values show (larger ones take the end colour). */
function legendRange(results: TrendResult[]): number {
  const sig = results.filter((r) => r.significant && r.slopePerDecade !== null && r.slopePerDecade !== 0).map((r) => Math.abs(r.slopePerDecade as number))
  if (sig.length === 0) return maxAbsSlope(results)
  sig.sort((a, b) => a - b)
  return sig[Math.min(sig.length - 1, Math.floor(0.9 * (sig.length - 1)))]
}

/** Lowest and highest slope among the coloured (significant, non-zero) squares; null when none is coloured. */
function coloredRange(results: TrendResult[]): { min: number; max: number } | null {
  const slopes = results.filter((r) => r.significant && r.slopePerDecade !== null && r.slopePerDecade !== 0).map((r) => r.slopePerDecade as number)
  return slopes.length === 0 ? null : { min: Math.min(...slopes), max: Math.max(...slopes) }
}

export interface TrendPaintInfo {
  paint: CellPaint
  /** Legend range (90th percentile of |significant slopes|): the legend is symmetric around zero; larger slopes take the end colour. */
  maxAbs: number
  /** Real lowest and highest slope of the coloured squares, so the legend can say when its ends are clipped. */
  range: { min: number; max: number } | null
  /** No cell was tested. */
  pending: boolean
}

/** Paint of a trend map. Colour = direction and size; dotted = not significant (as decided by the backend). */
export function makeTrendPaint(option: TrendOption, results: Map<string, TrendResult>, filter: CellFilter, t: Tr = EN): TrendPaintInfo {
  const maxAbs = legendRange([...results.values()])
  const span = `${option.years[0]}–${option.years[1]}`
  const readout = (cell: MapCell) => {
    const r = results.get(cell.cellId)
    if (!r || r.slopePerDecade === null) return t('Not tested: too few years with data', 'Sin probar: muy pocos años con datos')
    if (!r.significant)
      return t(
        `No clear trend: ${formatTrendSlope(r.slopePerDecade, option.slopeUnits, t)} (${span})`,
        `Sin tendencia clara: ${formatTrendSlope(r.slopePerDecade, option.slopeUnits, t)} (${span})`,
      )
    if (r.slopePerDecade === 0)
      return t(`No measurable slope: clear order but no measurable slope (${span})`, `Sin pendiente medible: orden claro, pero sin pendiente medible (${span})`)
    const word = r.slopePerDecade < 0 ? t('Falling', 'Baja') : t('Rising', 'Sube')
    const ci = ciInline(r.slopeCi95, t)
    return `${word}: ${formatTrendSlope(r.slopePerDecade, option.slopeUnits, t)}${ci ? ` ${ci}` : ''} (${span})`
  }
  // A square that is not clear shows its slope and a "?" (the tip says why it is not proven); a square that was not tested has none.
  const squares = [...results.values()].filter((r) => r.slopePerDecade !== null).length
  const readoutTip = (cell: MapCell): string | null => {
    const r = results.get(cell.cellId)
    if (!r || r.slopePerDecade === null || r.significant) return null
    return unclearTip({ p: r.pValue, ci: r.slopeCi95, squares }, t)
  }
  const paint: CellPaint = {
    key: `trend:${option.id}`,
    regionLabel: t(
      `Trend map of ${option.name}, ${span}. Tab to reach the squares, use the arrow keys to move between them and Enter to open one.`,
      `Mapa de tendencia de ${option.name}, ${span}. Usa Tab para llegar a los cuadros, las flechas para moverte entre ellos y Enter para abrir uno.`,
    ),
    style: (cell) => {
      const r = results.get(cell.cellId)
      if (!r || r.slopePerDecade === null) return { color: 'var(--cell-empty)', kind: 'empty' }
      const solid = r.significant && r.slopePerDecade !== 0
      return {
        // Not significant: a fixed light neutral fill, so it never looks stronger than a significant square.
        color: solid ? slopeColor(r.slopePerDecade, maxAbs) : 'var(--surface)',
        kind: solid ? 'solid' : 'dotted',
        dim: !matchesFilter(r, filter),
      }
    },
    describe: (cell) => `${formatCoordinates(cell.lat, cell.lon)}: ${readout(cell)}${readoutTip(cell) ? ' ?' : ''}`,
    readout,
    readoutTip,
  }
  return { paint, maxAbs, range: coloredRange([...results.values()]), pending: noneTested(results) }
}
