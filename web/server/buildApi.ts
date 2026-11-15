// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Backend entry point: reads the selected data source, validates it against the contract and publishes the
// read-only API v1 as static JSON under public/api/v1 (served by Vite in development and by Vercel in
// production, ADR-004). Run with `npm run api:build`; `npm run dev` and `npm run build` run it first.
// With `--source=files` (npm run dev:real / build:real) it publishes the pipeline data, including the optional
// cover.json, validation.json, zones.json and rasters.json.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { API_BASE_PATH, apiPaths } from '../shared/apiPaths.ts'
import { API_VERSION } from '../shared/contracts.ts'
import type { CellSeries, CoverLayer, Manifest, RasterIndex, TrendLayer, ValidationReport, ZonesReport } from '../shared/contracts.ts'
import { computeAnnual } from './annual.ts'
import { computeSemesters } from './periods.ts'
import { createDataSource } from './sources/index.ts'
import type { SourceTrendLayer } from './sources/types.ts'
import { summarize } from './summary.ts'
import {
  validateBorders,
  validateCover,
  validateRasterIndex,
  validateRegion,
  validateSeries,
  validateTrendLayer,
  validateValidationReport,
  validateVariables,
  validateZones,
} from './validate.ts'

const OUT_DIR = resolve(import.meta.dirname, '..', 'public', ...API_BASE_PATH.split('/').filter(Boolean))
// Static country borders (not part of the API): the UI loads it from BORDERS_URL.
const BORDERS_FILE = resolve(import.meta.dirname, '..', 'public', 'data', 'borders.json')

function write(relativePath: string, body: unknown): void {
  const file = join(OUT_DIR, relativePath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(body))
}

async function main(): Promise<void> {
  const source = createDataSource()
  const generatedAt = new Date().toISOString()

  const region = await source.getRegion()
  validateRegion(region)
  const variables = await source.getVariables()
  validateVariables(variables)

  // Rebuild from scratch so files of removed variables or cells never linger. OUT_DIR is generated and git-ignored.
  rmSync(OUT_DIR, { recursive: true, force: true })

  let files = 0
  let firstLayer: SourceTrendLayer | null = null
  for (const variable of variables) {
    const layer = await source.getTrendLayer(variable.id)
    validateTrendLayer(layer, variable, region)
    firstLayer ??= layer
    const series = await source.getSeries(variable.id)
    validateSeries(series, layer)

    const trendLayer: TrendLayer = {
      apiVersion: API_VERSION,
      ...layer,
      generatedAt,
      dataStatus: source.status,
      summary: summarize(layer.cells),
    }
    write(apiPaths.trends(variable.id), trendLayer)
    files += 1

    for (const [cellId, points] of Object.entries(series)) {
      const cellSeries: CellSeries = {
        apiVersion: API_VERSION,
        variableId: variable.id,
        cellId,
        units: variable.units,
        dataStatus: source.status,
        points,
        semesters: computeSemesters(points, variable.semesterAggregation),
        annual: computeAnnual(points, variable.semesterAggregation),
      }
      write(apiPaths.series(variable.id, cellId), cellSeries)
      files += 1
    }
  }

  // Optional extras (tree cover, validation report, raster index): published only when the source has them.
  const extras = { cover: false, validation: false, rasters: false, zones: false, borders: false }
  const grid = firstLayer as SourceTrendLayer

  const sourceCover = (await source.getCover?.()) ?? null
  if (sourceCover) {
    validateCover(sourceCover, grid)
    const cover: CoverLayer = { apiVersion: API_VERSION, ...sourceCover, generatedAt, dataStatus: source.status }
    write(apiPaths.cover(), cover)
    extras.cover = true
    files += 1
  }

  const sourceValidation = (await source.getValidation?.()) ?? null
  if (sourceValidation) {
    validateValidationReport(sourceValidation, new Set(grid.cells.map((c) => c.cellId)))
    const report: ValidationReport = { apiVersion: API_VERSION, ...sourceValidation, generatedAt, dataStatus: source.status }
    write(apiPaths.validation(), report)
    extras.validation = true
    files += 1
  }

  const sourceZones = (await source.getZones?.()) ?? null
  if (sourceZones) {
    validateZones(sourceZones, grid.cells.length)
    const zones: ZonesReport = { apiVersion: API_VERSION, ...sourceZones, generatedAt, dataStatus: source.status }
    write(apiPaths.zones(), zones)
    extras.zones = true
    files += 1
  }

  // Country borders are a static file, not an API file: only checked here (a broken file fails the build) and reported.
  if (existsSync(BORDERS_FILE)) {
    validateBorders(JSON.parse(readFileSync(BORDERS_FILE, 'utf8')))
    extras.borders = true
  }

  const sourceRasters = (await source.getRasterIndex?.()) ?? null
  if (sourceRasters) {
    validateRasterIndex(sourceRasters, source.mapsDir ?? '')
    const rasters: RasterIndex = { apiVersion: API_VERSION, ...sourceRasters, generatedAt, dataStatus: source.status }
    write(apiPaths.rasters(), rasters)
    extras.rasters = true
    files += 1
  }

  const manifest: Manifest = { apiVersion: API_VERSION, generatedAt, dataStatus: source.status, region, variables, extras }
  write(apiPaths.manifest(), manifest)
  files += 1

  console.log(`API ${API_VERSION}: ${files} files from "${source.description}" -> ${OUT_DIR}`)
}

main().catch((error: unknown) => {
  console.error(`API build failed. ${(error as Error).message}`)
  process.exit(1)
})
