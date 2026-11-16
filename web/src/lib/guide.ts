// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The first-visit guide: a short tour over the real interface (pick a measure, read the map, open a square, is the change
// real?) and three demo cases that open the app already set up through the URL state (?view=, ?map=, ?var=, ?cell=).
// Design chosen by José (option B, a tour on the interface; opens by itself on the first visit, "Guide" opens it again).
//
// Every number in the demo cases is read from the API (validation.json, trendChecks). Nothing is counted, tested or
// averaged here (ADR-004). Burned area is left out on purpose until the method review closes its open point.
// 2026-11-15: "tree cover loss" (not "forest loss"); the years of the trends are read from the checks (loss starts in 2011); the case
// "Greenness: rises in some places, falls in others"; step 4 gives the two error rates of the test.

import type { ValidationReport } from '../../shared/contracts.ts'
import { formatTrendSlope } from './format.ts'
import { EN, type Tr } from './i18n.ts'
import { ciInline } from './trendWords.ts'
import { formatShare } from './zoneTrends.ts'

/** URL parameters to set (a string) or remove (null), as useUrlParams takes them. */
type ParamsPatch = Record<string, string | null>

/** One step of the tour. `anchors` are CSS selectors tried in order; the first visible one is highlighted. */
export interface GuideStep {
  id: string
  title: string
  body: string[]
  anchors: string[]
}

export function guideSteps(t: Tr = EN, report: ValidationReport | null = null): GuideStep[] {
  // Years of the trends, from the published checks: the monthly measures start in the first year they are tested, loss later (2011).
  const variables = report?.trendChecks?.variables ?? []
  const lossStart = variables.find((v) => v.variableId === 'lossKm2')?.period[0] ?? null
  const firstStart = variables.length > 0 ? Math.min(...variables.filter((v) => v.variableId !== 'lossKm2' && v.variableId !== 'modisTreeCover').map((v) => v.period[0])) : null
  const when =
    firstStart !== null && Number.isFinite(firstStart)
      ? lossStart !== null && lossStart > firstStart
        ? t(` from ${firstStart}; tree cover loss from ${lossStart}`, ` desde ${firstStart}; la pérdida de cobertura arbórea desde ${lossStart}`)
        : t(` from ${firstStart}`, ` desde ${firstStart}`)
      : ''
  // The two error rates of the test: false alarms on shuffled years (the worst measure) and the share of simulated trends it finds.
  const falseAlarms = Object.values(report?.trendChecks?.v1FalsePositives ?? {}).map((v) => v.meanShareSignificant)
  const detections = Object.values(report?.trendChecks?.v2Detection ?? {}).map((v) => v.meanShareDetected)
  const errorLine =
    falseAlarms.length > 0 && detections.length > 0
      ? t(
          `In our checks the test flagged at most ${formatShare(Math.max(...falseAlarms))} of the squares on shuffled years (false alarms) and found ${Math.round(Math.min(...detections) * 100)}–${Math.round(Math.max(...detections) * 100)} % of simulated trends.`,
          `En nuestras comprobaciones el test marcó como máximo el ${formatShare(Math.max(...falseAlarms))} de los cuadros con años barajados (falsas alarmas) y encontró entre el ${Math.round(Math.min(...detections) * 100)} y el ${Math.round(Math.max(...detections) * 100)} % de las tendencias simuladas.`,
        )
      : null
  return [
    {
      id: 'measure',
      title: t('1. Pick what to look at', '1. Elige qué mirar'),
      body: [
        t(
          'Choose the map (trend, tree cover, tree cover loss or fire) and, on the trend map, the measure.',
          'Elige el mapa (tendencia, cobertura arbórea, pérdida de cobertura arbórea o fuego) y, en el mapa de tendencia, la medida.',
        ),
        t(
          'NDVI and EVI measure how green the vegetation is, seen from NASA satellites. Temperature is the land surface by day; rainfall comes from NASA GPM.',
          'NDVI y EVI miden qué tan verde está la vegetación, vista desde satélites de la NASA. La temperatura es la de la superficie de día; la lluvia viene de NASA GPM.',
        ),
      ],
      anchors: ['.map-filters', '.map-bar .btn'],
    },
    {
      id: 'read',
      title: t('2. Read the map', '2. Lee el mapa'),
      body: [
        t(
          `Each square is 1° (about 12,000 km²). Its colour is the trend: how much the measure changed per decade${when}. Orange falls, purple rises; stronger colour, bigger change.`,
          `Cada cuadro mide 1° (unos 12 000 km²). Su color es la tendencia: cuánto cambió la medida por década${when}. Naranja baja, morado sube; cuanto más intenso, mayor el cambio.`,
        ),
        t(
          'Dotted squares: no clear trend. Hatched squares: not tested, too few years with data.',
          'Cuadros punteados: sin tendencia clara. Cuadros rayados: sin probar, muy pocos años con datos.',
        ),
      ],
      anchors: ['.map-filters .legend-sec', '.map-bar-legend', '.map-wrap'],
    },
    {
      id: 'square',
      title: t('3. Open a square', '3. Abre un cuadro'),
      body: [
        t(
          'Click or tap a square to open its file: its yearly values and the verdict for every measure in that place.',
          'Haz clic o toca un cuadro para abrir su ficha: sus valores de cada año y el veredicto de cada medida en ese lugar.',
        ),
        t(
          'With the keyboard: Tab to the map, move with the arrow keys and press Enter.',
          'Con el teclado: llega al mapa con Tab, muévete con las flechas y pulsa Enter.',
        ),
      ],
      anchors: ['.map-wrap'],
    },
    {
      id: 'real',
      title: t('4. Is the change real?', '4. ¿El cambio es real?'),
      body: [
        t(
          'Trends tests each measure for the whole Amazon and for its Brazilian and Peruvian parts.',
          'Tendencias prueba cada medida para toda la Amazonía y para sus partes de Brasil y de Perú.',
        ),
        t(
          '"Clear trend" means the change stands out from the normal ups and downs between years. With hundreds of squares tested at once, a few would look like trends by pure chance, so the bar is raised for all of them (false discovery rate 5 %).',
          '"Tendencia clara" significa que el cambio sobresale de las subidas y bajadas normales entre años. Con cientos de cuadros probados a la vez, unos pocos parecerían tendencias por puro azar, así que la exigencia sube para todos (tasa de falsos descubrimientos del 5 %).',
        ),
        ...(errorLine ? [errorLine] : []),
      ],
      anchors: ['.viewnav a[href*="view=trends"]'],
    },
  ]
}

/** A demo case: a sentence with numbers from the API and the URL state that shows it. */
export interface GuideCase {
  id: string
  title: string
  text: string | null
  patch: ParamsPatch
}

/** URL state shared by every demo: the trend map, nothing else carried over from where the reader was. */
const BASE: ParamsPatch = { view: 'map', map: 'trend', show: null, cell: null, from: null, to: null, year: null }

export function guideCases(report: ValidationReport | null, t: Tr = EN): GuideCase[] {
  const checks = report?.trendChecks ?? null
  const variable = (id: string) => checks?.variables.find((v) => v.variableId === id) ?? null
  const lst = variable('lst_day')
  const ndvi = variable('ndvi')
  const pampa = checks?.v3KnownPlaces.find((p) => p.caseId === 'la_pampa') ?? null
  const pampaPlace = report?.cases.find((c) => c.id === 'la_pampa') ?? null
  const loss = pampa?.lossKm2 ?? null

  return [
    {
      id: 'heat',
      title: t('The surface is heating up', 'La superficie se calienta'),
      text: lst
        ? t(
            `Daytime land surface temperature rose in ${lst.significantIncreasing} of ${lst.cellsTested} squares (${lst.period[0]}–${lst.period[1]}); ${lst.significantDecreasing === 0 ? 'it fell in none' : `it fell in ${lst.significantDecreasing}`}.`,
            `La temperatura de la superficie de día subió en ${lst.significantIncreasing} de ${lst.cellsTested} cuadros (${lst.period[0]}–${lst.period[1]}); ${lst.significantDecreasing === 0 ? 'no bajó en ninguno' : `bajó en ${lst.significantDecreasing}`}.`,
          )
        : null,
      patch: { ...BASE, var: 'lst_day' },
    },
    {
      id: 'greenness',
      title: t('Greenness: rises in some places, falls in others', 'Verdor: sube en unos lugares, baja en otros'),
      text: ndvi
        ? t(
            `Vegetation greenness (NDVI) fell in ${ndvi.significantDecreasing} squares and rose in ${ndvi.significantIncreasing} (${ndvi.period[0]}–${ndvi.period[1]}): the Amazon changes in both directions.`,
            `El verdor de la vegetación (NDVI) bajó en ${ndvi.significantDecreasing} cuadros y subió en ${ndvi.significantIncreasing} (${ndvi.period[0]}–${ndvi.period[1]}): la Amazonía cambia en ambos sentidos.`,
          )
        : null,
      patch: { ...BASE, var: 'ndvi', show: 'significant' },
    },
    {
      id: 'pampa',
      title: t('La Pampa, Madre de Dios (gold mining)', 'La Pampa, Madre de Dios (minería de oro)'),
      text:
        loss && loss.slopePerDecade !== null
          ? loss.significant
            ? t(
                `Tree cover loss in this square is ${loss.slopePerDecade < 0 ? 'falling' : 'rising'}: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)} ${ciInline(loss.slopeCi95, t)}, a clear trend.`,
                `La pérdida de cobertura arbórea en este cuadro ${loss.slopePerDecade < 0 ? 'baja' : 'sube'}: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)} ${ciInline(loss.slopeCi95, t)}, una tendencia clara.`,
              )
            : t(
                `Tree cover loss in this square: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)} ${ciInline(loss.slopeCi95, t)}, not a clear trend.`,
                `Pérdida de cobertura arbórea en este cuadro: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)} ${ciInline(loss.slopeCi95, t)}, sin tendencia clara.`,
              )
          : null,
      patch: {
        ...BASE,
        var: 'lossKm2',
        cell: pampa?.cellId ?? pampaPlace?.apiCellId ?? null,
        ...(pampaPlace ? { z: '6', lat: pampaPlace.lat.toFixed(2), lon: pampaPlace.lon.toFixed(2) } : {}),
      },
    },
  ]
}

// Seen once: remembered in this browser, so the guide opens by itself only on the first visit.

const SEEN_KEY = 'signo.guideSeen'

export function guideSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuideSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private window: the guide may open again on the next visit */
  }
}

/** Opens by itself on the first visit to the map, unless the link opens a square or says ?guide=0 (pitch, video). */
export function shouldAutoOpenGuide(params: URLSearchParams): boolean {
  const guide = params.get('guide')
  if (guide === '1') return true
  if (guide === '0') return false
  const view = params.get('view')
  if (view !== null && view !== 'map') return false
  if (params.has('cell')) return false
  return !guideSeen()
}
