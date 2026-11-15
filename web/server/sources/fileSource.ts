// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// FILES data source: reads the JSON files exported by the team's data pipeline (Alexis) from a folder.
// Layout and shapes are documented in server/data/README.md; types are in ./types.ts and shared/contracts.ts.
// Everything read here is validated by server/validate.ts before it is published.
//
// Optional extras: cover.json, validation.json and zones.json in the data folder, and the raster index
// (public/data/maps/index.json, written by the pipeline next to the PNGs). A missing extra is not an error:
// the manifest simply reports it as absent.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RasterFrame, RasterLayer, Region, Variable } from '../../shared/contracts.ts'
import type { DataSource, SourceCover, SourceRasterIndex, SourceSeries, SourceTrendLayer, SourceValidation, SourceZones } from './types.ts'

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Missing data file: ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`)
  }
}

function readOptionalJson<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null
}

/** Public URL prefix under which the raster PNGs are served (Vite and Vercel serve public/data/maps). */
export const MAPS_URL_PREFIX = '/data/maps/'

/** Shape of public/data/maps/index.json as the pipeline writes it (snake_case). */
interface PipelineMapsIndex {
  grid: {
    lat_min: number
    lat_max: number
    lon_min: number
    lon_max: number
    step_deg: number
    row0: string
    col0: string
    nodata: number
    rows: number
    cols: number
  }
  note?: string
  layers: Record<
    string,
    {
      source: string
      doi: string
      encoding: 'percent' | 'sqrt_share'
      period?: string
      files: Record<string, string>
      n_months?: Record<string, number>
    }
  >
}

function framesOf(layer: PipelineMapsIndex['layers'][string]): RasterFrame[] {
  return Object.entries(layer.files)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, file]) => {
      const frame: RasterFrame = { key, url: `${MAPS_URL_PREFIX}${file}` }
      const nMonths = layer.n_months?.[key]
      if (nMonths !== undefined) frame.nMonths = nMonths
      return frame
    })
}

/** snake_case pipeline index -> RasterIndex (without the envelope). hansen_treecover2000 becomes frame "2000" of hansen_tree_cover. */
export function mapRasterIndex(raw: PipelineMapsIndex): SourceRasterIndex {
  const g = raw.grid
  if (g.row0 !== 'north' || g.col0 !== 'west') throw new Error(`maps/index.json: expected row0 "north" and col0 "west", got "${g.row0}" and "${g.col0}"`)
  const layers: RasterLayer[] = []
  const baseline = raw.layers.hansen_treecover2000
  const target = raw.layers.hansen_tree_cover
  const merge = !!baseline && !!target && baseline.encoding === target.encoding
  for (const [id, layer] of Object.entries(raw.layers)) {
    if (merge && id === 'hansen_treecover2000') continue
    let frames = framesOf(layer)
    if (merge && id === 'hansen_tree_cover') {
      frames = [...framesOf(baseline).filter((f) => f.key === '2000'), ...frames.filter((f) => f.key !== '2000')]
    }
    const out: RasterLayer = { id, source: layer.source, doi: layer.doi, encoding: layer.encoding, frames }
    if (layer.period !== undefined) out.period = layer.period
    layers.push(out)
  }
  const index: SourceRasterIndex = {
    grid: {
      west: g.lon_min,
      south: g.lat_min,
      east: g.lon_max,
      north: g.lat_max,
      stepDeg: g.step_deg,
      rows: g.rows,
      cols: g.cols,
      nodata: g.nodata,
      row0: 'north',
      col0: 'west',
    },
    layers,
  }
  if (raw.note !== undefined) index.note = raw.note
  return index
}

export function createFileSource(dataDir: string, mapsDir: string): DataSource {
  return {
    status: 'real',
    description: `Pipeline export in ${dataDir}`,
    mapsDir,
    getRegion: async () => readJson<Region>(join(dataDir, 'region.json')),
    getVariables: async () => readJson<Variable[]>(join(dataDir, 'variables.json')),
    getTrendLayer: async (variableId) => readJson<SourceTrendLayer>(join(dataDir, 'trends', `${variableId}.json`)),
    getSeries: async (variableId) => readJson<SourceSeries>(join(dataDir, 'series', `${variableId}.json`)),
    getCover: async () => readOptionalJson<SourceCover>(join(dataDir, 'cover.json')),
    getValidation: async () => readOptionalJson<SourceValidation>(join(dataDir, 'validation.json')),
    getZones: async () => readOptionalJson<SourceZones>(join(dataDir, 'zones.json')),
    getRasterIndex: async () => {
      const raw = readOptionalJson<PipelineMapsIndex>(join(mapsDir, 'index.json'))
      return raw ? mapRasterIndex(raw) : null
    },
  }
}
