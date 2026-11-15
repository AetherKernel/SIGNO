// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// MOCK data source: synthetic, deterministic sample data so the frontend and the API can be built before the real
// pipeline exists. Nothing here is a real measurement or a real statistical result. The p-values are invented
// from the synthetic signal; the real method is the team's decision (P-002).

import type { CellTrend, Region, SeriesPoint, Variable } from '../../shared/contracts.ts'
import type { DataSource, SourceSeries, SourceTrendLayer } from './types.ts'

const REGION: Region = {
  id: 'amazon',
  name: 'Amazon (approximate bounding box)',
  boundarySource: null, // P-008: basin or biome, still undecided
  bbox: [-80, -20, -44, 10],
}

const PERIOD = { start: '2001-01', end: '2024-12' }
const CELL_SIZE_DEG = 3

const VARIABLES: Variable[] = [
  {
    id: 'ndvi',
    name: 'Vegetation greenness (NDVI)',
    description:
      'How green and dense the vegetation looks from space, from -1 to 1. Healthy forest is usually above 0.7; a ' +
      'sustained drop can point to forest loss or degradation.',
    units: 'unitless',
    temporalResolution: 'monthly',
    period: PERIOD,
    product: { shortName: 'MOD13C2', version: '061', provider: 'LP DAAC', doi: '10.5067/MODIS/MOD13C2.061', kind: 'satellite' },
    semesterAggregation: 'mean',
  },
  {
    id: 'lst_day',
    name: 'Daytime land surface temperature',
    description:
      'How hot the ground surface is during the day, measured from space. Forest keeps the surface cooler than ' +
      'cleared land.',
    units: '°C',
    temporalResolution: 'monthly',
    period: PERIOD,
    product: { shortName: 'MOD11C3', version: '061', provider: 'LP DAAC', doi: '10.5067/MODIS/MOD11C3.061', kind: 'satellite' },
    semesterAggregation: 'mean',
  },
]

interface Profile {
  base: number
  seasonalAmplitude: number
  noise: number
  /** Synthetic trend range per decade. */
  slopeRange: [number, number]
  /** Slope per decade that maps to an invented p-value of about 0.02 (tunes how many mock cells look significant). */
  pScale: number
}

const PROFILES: Record<string, Profile> = {
  ndvi: { base: 0.78, seasonalAmplitude: 0.05, noise: 0.03, slopeRange: [-0.06, 0.02], pScale: 0.03 },
  lst_day: { base: 29, seasonalAmplitude: 2.5, noise: 0.8, slopeRange: [-0.2, 0.6], pScale: 0.3 },
}

/** Small seeded PRNG (mulberry32) so the mock is identical on every build. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

function months(period: { start: string; end: string }): string[] {
  const [y0, m0] = period.start.split('-').map(Number)
  const [y1, m1] = period.end.split('-').map(Number)
  const out: string[] = []
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

interface MockCell {
  cellId: string
  lat: number
  lon: number
  slopePerDecade: number
  series: SeriesPoint[]
}

function buildCells(variableId: string): MockCell[] {
  const profile = PROFILES[variableId]
  const [west, south, east, north] = REGION.bbox
  const rows = Math.round((north - south) / CELL_SIZE_DEG)
  const cols = Math.round((east - west) / CELL_SIZE_DEG)
  const monthList = months(PERIOD)
  const cells: MockCell[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cellId = `r${String(r).padStart(2, '0')}c${String(c).padStart(2, '0')}`
      const rand = prng(hash(`${variableId}:${cellId}`))
      const [lo, hi] = profile.slopeRange
      const slopePerDecade = lo + (hi - lo) * rand()
      const phase = rand() * Math.PI * 2
      const series = monthList.map((month, i) => {
        const cloudGap = rand() < 0.06 // synthetic missing months, like cloud cover
        if (cloudGap) return { month, value: null }
        const seasonal = profile.seasonalAmplitude * Math.sin((2 * Math.PI * i) / 12 + phase)
        const trend = (slopePerDecade * i) / 120
        const noise = (rand() - 0.5) * 2 * profile.noise
        return { month, value: Number((profile.base + seasonal + trend + noise).toFixed(4)) }
      })
      cells.push({
        cellId,
        lat: north - CELL_SIZE_DEG * (r + 0.5),
        lon: west + CELL_SIZE_DEG * (c + 0.5),
        slopePerDecade,
        series,
      })
    }
  }
  return cells
}

/** Invented p-value: larger synthetic slopes relative to noise get smaller values. NOT a statistical test. */
function fakePValue(slopePerDecade: number, profile: Profile): number {
  const strength = Math.abs(slopePerDecade) / profile.pScale
  return Number(Math.min(1, Math.exp(-4 * strength)).toFixed(4))
}

export function createMockSource(): DataSource {
  const cache = new Map<string, MockCell[]>()
  const cellsOf = (variableId: string): MockCell[] => {
    if (!PROFILES[variableId]) throw new Error(`Mock source has no variable "${variableId}"`)
    if (!cache.has(variableId)) cache.set(variableId, buildCells(variableId))
    return cache.get(variableId) as MockCell[]
  }

  return {
    status: 'mock',
    description: 'Synthetic sample data (server/sources/mockSource.ts); not real measurements or results',
    getRegion: async () => REGION,
    getVariables: async () => VARIABLES,
    getTrendLayer: async (variableId): Promise<SourceTrendLayer> => {
      const profile = PROFILES[variableId]
      const alpha = 0.05
      const cells: CellTrend[] = cellsOf(variableId).map((cell) => {
        const pValue = fakePValue(cell.slopePerDecade, profile)
        return {
          cellId: cell.cellId,
          lat: cell.lat,
          lon: cell.lon,
          slopePerDecade: Number(cell.slopePerDecade.toFixed(4)),
          pValue,
          significant: pValue < alpha,
          validMonths: cell.series.filter((p) => p.value !== null).length,
        }
      })
      return {
        variableId,
        regionId: REGION.id,
        period: PERIOD,
        cellSizeDeg: CELL_SIZE_DEG,
        method: {
          name: 'Mock (no statistical test)',
          description: 'Synthetic slopes and invented p-values for development only. The real method is pending (P-002).',
          alpha,
        },
        cells,
      }
    },
    getSeries: async (variableId): Promise<SourceSeries> =>
      Object.fromEntries(cellsOf(variableId).map((cell) => [cell.cellId, cell.series])),
  }
}
