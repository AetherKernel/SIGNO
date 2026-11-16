// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
//
// Words of the "clear or not" rule, shared by every place that shows a trend (map readout, area viewer, Trends cards, table,
// zone chart): a clear trend is its direction, slope and "(95 % CI a to b)"; a trend that is not clear is its slope followed by
// a "?" whose tip says why it is not proven, with the p-value and the interval; "not tested" is "—". Also the tip of the
// satellite drift years (NDVI, EVI, daytime temperature). Everything here only writes values the pipeline published (p,
// interval, counts); nothing is tested or computed. Sentences with numbers are returned whole (one string per sentence), so a
// page translator replaces them whole (lib/translationGuard.ts).

import type { Variable } from '../../shared/contracts.ts'
import { formatNumber } from './zoneTrends.ts'
import { type Tr } from './i18n.ts'

/** The published 95 % interval of a slope: [low, high], or absent. */
export type Ci = readonly [number, number] | null | undefined

/** Decimal comma in Spanish prose (the tips); the tables and charts keep the decimal point (see lib/i18n.ts). */
function es(text: string, t: Tr): string {
  return t(text, text.replace(/(\d)\.(\d)/g, '$1,$2'))
}

/** "95 % CI −35.1 to 19.0" / "IC 95 % de −35.1 a 19.0"; null when the pipeline gave no interval. */
export function ciText(ci: Ci, t: Tr, format: (value: number) => string = formatNumber): string | null {
  if (!ci) return null
  return t(`95 % CI ${format(ci[0])} to ${format(ci[1])}`, `IC 95 % de ${format(ci[0])} a ${format(ci[1])}`)
}

/** "−35.1 to 19.0" / "−35.1 a 19.0" (the bounds alone, for a table column); null without an interval. */
export function ciBounds(ci: Ci, t: Tr, format: (value: number) => string = formatNumber): string | null {
  return ci ? t(`${format(ci[0])} to ${format(ci[1])}`, `${format(ci[0])} a ${format(ci[1])}`) : null
}

/** "(95 % CI −35.1 to 19.0)" for next to a slope, or "" without an interval. */
export function ciInline(ci: Ci, t: Tr, format?: (value: number) => string): string {
  const text = ciText(ci, t, format)
  return text ? `(${text})` : ''
}

/** "p = 0.429" or "p < 0.001"; null when there is no p-value. */
export function pPhrase(p: number | null | undefined): string | null {
  if (p === null || p === undefined) return null
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p.toFixed(3)}`
}

export interface TipFacts {
  p: number | null | undefined
  ci?: Ci
  /** Squares tested in the same variable (the correction clause); omit for a zone-level test, which is not corrected. */
  squares?: number | null
  alpha?: number
}

/** The tip of a trend that is not clear: why it is "not proven", with p, the correction and the interval. */
export function unclearTip({ p, ci, squares, alpha = 0.05 }: TipFacts, t: Tr, format?: (value: number) => string): string {
  const pText = pPhrase(p)
  const a = String(alpha)
  const rule = squares
    ? t(`clear needs p < ${a} after correcting for the ${squares} squares tested`, `clara exige p < ${a.replace('.', ',')} tras corregir por los ${squares} cuadros probados`)
    : t(`clear needs p < ${a}`, `clara exige p < ${a.replace('.', ',')}`)
  const inside = pText ? `${pText}; ${rule}` : rule
  const interval = ciText(ci, t, format)
  return es(
    t(
      `The test cannot tell this change apart from the normal year-to-year variation (${inside}).${interval ? ` ${interval}.` : ''} Not proven is not the same as no change.`,
      `El test no distingue este cambio de la variación normal de un año a otro (${inside}).${interval ? ` ${interval}.` : ''} No demostrado no es lo mismo que sin cambio.`,
    ),
    t,
  )
}

/** The tip of a clear trend: the p-value and what "clear" required. */
export function clearTip({ p, ci, squares, alpha = 0.05 }: TipFacts, t: Tr, format?: (value: number) => string): string {
  const pText = pPhrase(p)
  const a = String(alpha)
  const interval = ciText(ci, t, format)
  const base = squares
    ? t(
        `Clear: ${pText ? `${pText}, ` : ''}below ${a} and still below it after correcting for the ${squares} squares tested at once (false discovery rate ${Math.round(alpha * 100)} %).`,
        `Clara: ${pText ? `${pText}, ` : ''}menor que ${a.replace('.', ',')} y sigue por debajo tras corregir por los ${squares} cuadros probados a la vez (tasa de falsos descubrimientos del ${Math.round(alpha * 100)} %).`,
      )
    : t(
        `Clear: ${pText ? `${pText}, ` : ''}below ${a} (one test for this zone and measure).`,
        `Clara: ${pText ? `${pText}, ` : ''}menor que ${a.replace('.', ',')} (un test para esta zona y medida).`,
      )
  return es(`${base}${interval ? ` ${interval}.` : ''}`, t)
}

// Satellite drift (NDVI, EVI, daytime temperature)

const DRIFT_IDS = new Set(['ndvi', 'evi', 'lst_day'])

/** True for the three measures whose later years are shown but not tested because the Terra overpass time drifts. */
export function hasDrift(variableId: string): boolean {
  return DRIFT_IDS.has(variableId)
}

/**
 * First drift year of a monthly variable: the published `driftFromYear`, else the year after the last tested year (older exports),
 * else null (rain and burned area have no drift years).
 */
export function driftStartOf(variable: Pick<Variable, 'id' | 'driftFromYear' | 'trendYears'>): number | null {
  if (!DRIFT_IDS.has(variable.id)) return null
  if (variable.driftFromYear !== undefined) return variable.driftFromYear
  return variable.trendYears ? variable.trendYears.end + 1 : null
}

/** The tip of a value or a change that involves a drift year. */
export function driftTip(variableId: string, fromYear: number, t: Tr): string {
  return variableId === 'lst_day'
    ? t(
        `Real NASA data (Terra satellite, MODIS). Since ${fromYear} the satellite passes earlier, which can change the measured temperature; part of this change may come from the overpass time, not from the ground.`,
        `Dato real de NASA (satélite Terra, MODIS). Desde ${fromYear} el satélite pasa más temprano y eso puede cambiar la temperatura medida; parte de este cambio puede deberse a la hora de paso y no al terreno.`,
      )
    : t(
        `Real NASA data (Terra satellite, MODIS). Since ${fromYear} the satellite passes earlier, which can change the measured greenness; part of this change may come from the overpass time, not from the forest.`,
        `Dato real de NASA (satélite Terra, MODIS). Desde ${fromYear} el satélite pasa más temprano y eso puede cambiar el verdor medido; parte de este cambio puede deberse a la hora de paso y no al bosque.`,
      )
}

// 2026-11-15: tips of the tree cover loss zone results (whole Amazon, Brazilian and Peruvian parts), chosen by zone id.

/** The Brazilian and Peruvian parts: their loss result is borderline (p close to 0.05). */
export function borderlineLossTip(zoneId: string, measureKey: string, significant: boolean, t: Tr): string | null {
  if (measureKey !== 'lossKm2' || !significant || (zoneId !== 'amazon_brazil' && zoneId !== 'amazon_peru')) return null
  return t(
    'Borderline result: p is close to 0.05. It does not hold when one year is left out, or after correcting for the 18 zone tests shown. The whole-Amazon rise does hold.',
    'Resultado al límite: p está cerca de 0,05. No se mantiene al quitar un año ni al corregir por los 18 tests de zona mostrados. La subida de la Amazonía entera sí se mantiene.',
  )
}

/** The whole-Amazon loss rise is a higher level from 2016 on, not a steady climb (numbers are whole-Amazon). */
export function lossLevelTip(zoneId: string, measureKey: string, t: Tr): string | null {
  if (measureKey !== 'lossKm2' || zoneId !== 'amazon') return null
  return t(
    'The 2011–2025 rise is a higher level from 2016 on (about 17,900 km² per year in 2011–2015 and 34,000 in 2016–2025), not a steady climb: inside 2016–2025 there is no trend. No jump appears at the Landsat 8 (2013) or Landsat 9 (2022) changes.',
    'La subida de 2011–2025 es un nivel más alto desde 2016 (unos 17 900 km² al año en 2011–2015 y 34 000 en 2016–2025), no un ascenso constante: dentro de 2016–2025 no hay tendencia. No se ve un salto con los cambios a Landsat 8 (2013) ni a Landsat 9 (2022).',
  )
}
