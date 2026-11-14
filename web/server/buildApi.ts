// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Backend entry point: reads the selected data source, validates it against the contract and publishes the
// read-only API v1 as static JSON under public/api/v1 (served by Vite in development and by Vercel in
// production, ADR-004). Run with `npm run api:build`; `npm run dev` and `npm run build` run it first.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { API_BASE_PATH, apiPaths } from '../shared/apiPaths.ts'
import { API_VERSION } from '../shared/contracts.ts'
import type { CellSeries, Manifest, TrendLayer } from '../shared/contracts.ts'
import { createDataSource } from './sources/index.ts'
import { summarize } from './summary.ts'
import { validateRegion, validateSeries, validateTrendLayer, validateVariables } from './validate.ts'

const OUT_DIR = resolve(import.meta.dirname, '..', 'public', ...API_BASE_PATH.split('/').filter(Boolean))

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
  for (const variable of variables) {
    const layer = await source.getTrendLayer(variable.id)
    validateTrendLayer(layer, variable, region)
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
      }
      write(apiPaths.series(variable.id, cellId), cellSeries)
      files += 1
    }
  }

  const manifest: Manifest = { apiVersion: API_VERSION, generatedAt, dataStatus: source.status, region, variables }
  write(apiPaths.manifest(), manifest)
  files += 1

  console.log(`API ${API_VERSION}: ${files} files from "${source.description}" -> ${OUT_DIR}`)
}

main().catch((error: unknown) => {
  console.error(`API build failed. ${(error as Error).message}`)
  process.exit(1)
})
