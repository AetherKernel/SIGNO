// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
//
// The Hansen method change of 2011, as the UI needs it. Hansen's team reprocessed loss from 2011 onward and not before, so
// the loss trend covers 2011-2025 only; the years 2001-2010 are real data, shown greyed ("shown, not in the trend") and
// never tested with the later years. Every yearly chart of Hansen loss or tree cover marks 2011 with a dashed line. The year
// and the Hansen / PRODES ratio come from the published files (cover.json methodChangeYear and validation.json
// trendChecks.hansenConsistency); nothing is computed here. App provides them through HansenContext so a chart does not need
// them as props.
// 2026-11-15: one trend (2011-2025) instead of two segments; the tip of the marker is now the short "shown, not in the trend" text.

import { createContext, useContext } from 'react'
import type { CoverLayer, HansenConsistencySegment, TrendChecks, ValidationCase, ValidationReport } from '../../shared/contracts.ts'
import { EN, type Tr } from './i18n.ts'

/** Year the Hansen loss data were reprocessed (default when a file does not say). */
export const DEFAULT_METHOD_YEAR = 2011

export interface HansenInfo {
  /** First year of the reprocessed loss. */
  year: number
  /** Hansen loss / INPE PRODES in the Brazilian Amazon in the segment that starts in `year`; null when not published. */
  ratio: number | null
}

export const HansenContext = createContext<HansenInfo>({ year: DEFAULT_METHOD_YEAR, ratio: null })

export function useHansenInfo(): HansenInfo {
  return useContext(HansenContext)
}

/** The segment of hansenConsistency that starts at the method change year (the late segment), if published. */
export function lateSegment(validation: ValidationReport | null | undefined): HansenConsistencySegment | null {
  const h = validation?.trendChecks?.hansenConsistency
  return h?.segments.find((s) => s.years[0] === h.methodChangeYear) ?? null
}

export function hansenInfoOf(cover: CoverLayer | null, validation: ValidationReport | null): HansenInfo {
  const consistency = validation?.trendChecks?.hansenConsistency
  return {
    year: cover?.methodChangeYear ?? consistency?.methodChangeYear ?? DEFAULT_METHOD_YEAR,
    ratio: lateSegment(validation)?.hansenBrazilVsProdes.ratio ?? null,
  }
}

/** A ratio such as 2.7 or 1.15 (two decimals at most), with a decimal comma in Spanish text ("2,7"). */
export function formatRatio(ratio: number, t: Tr = EN): string {
  const text = String(Number(ratio.toFixed(2)))
  return t(text, text.replace('.', ','))
}

/** Text of the tooltip of the method-change marker and of the greyed early years. */
export function methodChangeText(info: HansenInfo, t: Tr = EN): string {
  const before = `2001–${info.year - 1}`
  return t(
    `${before}: shown, not in the trend. Hansen measured these years with its earlier method (it reprocessed loss only from ${info.year}). Real data, not comparable with later years.`,
    `${before}: se muestran, pero no entran en la tendencia. Hansen midió esos años con su método anterior (solo reprocesó la pérdida desde ${info.year}). Son datos reales, no comparables con los años siguientes.`,
  )
}

/** First year in which a documented place loses at least 1 % of its local area (the "loss from 2012" of La Pampa). */
export function lossOnsetYear(place: ValidationCase | undefined): number | null {
  if (!place) return null
  const index = place.hansenLossShare.findIndex((share) => share !== null && share >= 0.01)
  return index < 0 ? null : place.lossYears[index]
}

/**
 * The known-places check (V3) in plain words. The hotspots were picked for their loss peaks (single events such as fire years),
 * so a steady trend is not expected there; La Pampa is a documented, sustained case. All numbers come from the published checks.
 */
export function knownPlacesSentence(checks: TrendChecks, cases: ValidationCase[], t: Tr = EN): string | null {
  const hotspots = checks.v3KnownPlaces.filter((p) => p.kind === 'hotspot')
  const pampa = checks.v3KnownPlaces.find((p) => p.kind === 'case' && p.caseId === 'la_pampa')
  if (hotspots.length === 0) return null
  const years = checks.variables.find((v) => v.variableId === 'lossKm2')?.period
  const period = years ? `${years[0]}–${years[1]}` : ''
  const clear = hotspots.filter((p) => p.lossKm2?.significant).length
  const onset = lossOnsetYear(cases.find((c) => c.id === 'la_pampa'))
  const pampaClear = pampa?.lossKm2?.significant === true
  const ofHotspots =
    clear === 0
      ? t(`none of the ${hotspots.length} is clear`, `ninguno de los ${hotspots.length} es claro`)
      : t(`${clear} of the ${hotspots.length} are clear`, `${clear} de los ${hotspots.length} son claros`)
  const place = t(`La Pampa (gold mining${onset ? `, loss from ${onset}` : ''})`, `La Pampa (minería de oro${onset ? `, pérdida desde ${onset}` : ''})`)
  return t(
    `The ${hotspots.length} hotspots were chosen for their loss peaks (single events such as fire years), so a steady trend is not expected there. With ${period}, ${ofHotspots} after correcting for multiple tests, while ${place} ${pampaClear ? 'is clear' : 'is not clear'}.`,
    `Los ${hotspots.length} puntos críticos se eligieron por sus picos de pérdida (eventos puntuales, como años de incendios), así que ahí no se espera una tendencia sostenida. Con ${period}, ${ofHotspots} tras corregir por pruebas múltiples, mientras que ${place} ${pampaClear ? 'es clara' : 'no es clara'}.`,
  )
}
