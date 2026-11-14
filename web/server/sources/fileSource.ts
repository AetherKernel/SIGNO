// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// FILES data source: reads the JSON files exported by the team's data pipeline (Alexis) from a folder.
// Layout and shapes are documented in server/data/README.md; types are in ./types.ts and shared/contracts.ts.
// Everything read here is validated by server/validate.ts before it is published.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Region, Variable } from '../../shared/contracts.ts'
import type { DataSource, SourceSeries, SourceTrendLayer } from './types.ts'

function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Missing data file: ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`)
  }
}

export function createFileSource(dataDir: string): DataSource {
  return {
    status: 'real',
    description: `Pipeline export in ${dataDir}`,
    getRegion: async () => readJson<Region>(join(dataDir, 'region.json')),
    getVariables: async () => readJson<Variable[]>(join(dataDir, 'variables.json')),
    getTrendLayer: async (variableId) => readJson<SourceTrendLayer>(join(dataDir, 'trends', `${variableId}.json`)),
    getSeries: async (variableId) => readJson<SourceSeries>(join(dataDir, 'series', `${variableId}.json`)),
  }
}
