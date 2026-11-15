// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The first-visit guide: a short tour over the real interface (pick a measure, read the map, open a square, is the change
// real?) and three demo cases that open the app already set up through the URL state (?view=, ?map=, ?var=, ?cell=).
// Design chosen by José (option B, a tour on the interface; opens by itself on the first visit, "Guide" opens it again).
//
// Every number in the demo cases is read from the API (validation.json, trendChecks). Nothing is counted, tested or
// averaged here (ADR-004). Burned area is left out on purpose until the method review closes its open point.

import type { ValidationReport } from '../../shared/contracts.ts'
import { formatTrendSlope } from './format.ts'
import { EN, type Tr } from './i18n.ts'

/** URL parameters to set (a string) or remove (null), as useUrlParams takes them. */
type ParamsPatch = Record<string, string | null>

/** One step of the tour. `anchors` are CSS selectors tried in order; the first visible one is highlighted. */
export interface GuideStep {
  id: string
  title: string
  body: string[]
  anchors: string[]
}

export function guideSteps(t: Tr = EN): GuideStep[] {
  return [
    {
      id: 'measure',
      title: t('1. Pick what to look at', '1. Elige qué mirar'),
      body: [
        t(
          'Choose the map (trend, tree cover, forest loss or fire) and, on the trend map, the measure.',
          'Elige el mapa (tendencia, cobertura arbórea, pérdida de bosque o fuego) y, en el mapa de tendencia, la medida.',
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
          'Each square is 1° (about 12,000 km²). Its colour is the trend: how much the measure changed per decade, from 2001. Orange falls, purple rises; stronger colour, bigger change.',
          'Cada cuadro mide 1° (unos 12 000 km²). Su color es la tendencia: cuánto cambió la medida por década, desde 2001. Naranja baja, morado sube; cuanto más intenso, mayor el cambio.',
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
      title: t('Same process, opposite signs', 'Mismo proceso, signos opuestos'),
      text: ndvi
        ? t(
            `Vegetation greenness (NDVI) fell in ${ndvi.significantDecreasing} squares and rose in ${ndvi.significantIncreasing} (${ndvi.period[0]}–${ndvi.period[1]}): the same Amazon changes in both directions.`,
            `El verdor de la vegetación (NDVI) bajó en ${ndvi.significantDecreasing} cuadros y subió en ${ndvi.significantIncreasing} (${ndvi.period[0]}–${ndvi.period[1]}): la misma Amazonía cambia en ambos sentidos.`,
          )
        : null,
      patch: { ...BASE, var: 'ndvi', show: 'significant' },
    },
    {
      id: 'pampa',
      title: t('La Pampa, Madre de Dios (gold mining)', 'La Pampa, Madre de Dios (minería de oro)'),
      text:
        loss && loss.slopePerDecade !== null
          ? t(
              `Forest loss in this square is rising: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)}${loss.significant ? ', a clear trend' : ''}.`,
              `La pérdida de bosque en este cuadro va en aumento: ${formatTrendSlope(loss.slopePerDecade, 'km² per year, per decade', t)}${loss.significant ? ', una tendencia clara' : ''}.`,
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
