// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Chooses the data source. This is the only place to touch when Alexis's pipeline data replaces the mock:
//   mock   (default) synthetic sample data
//   files  JSON exported by the pipeline into SIGNO_DATA_DIR (default: server/data), plus the raster index in
//          SIGNO_MAPS_DIR (default: public/data/maps)
// Pick it with the command-line argument `--source=files` (works the same on every shell: `npm run build:real`)
// or with the environment variable SIGNO_DATA_SOURCE. The argument wins.

import { resolve } from 'node:path'
import { createFileSource } from './fileSource.ts'
import { createMockSource } from './mockSource.ts'
import type { DataSource } from './types.ts'

export const DEFAULT_DATA_DIR = resolve(import.meta.dirname, '..', 'data')
export const DEFAULT_MAPS_DIR = resolve(import.meta.dirname, '..', '..', 'public', 'data', 'maps')

const SOURCE_ARG = /^--source=(.*)$/

export function createDataSource(
  env: Record<string, string | undefined> = process.env,
  argv: string[] = process.argv.slice(2),
): DataSource {
  const fromArg = argv.map((a) => SOURCE_ARG.exec(a)?.[1]).find((v) => v !== undefined)
  const kind = fromArg ?? env.SIGNO_DATA_SOURCE ?? 'mock'
  if (kind === 'mock') return createMockSource()
  if (kind === 'files') {
    return createFileSource(
      env.SIGNO_DATA_DIR ? resolve(env.SIGNO_DATA_DIR) : DEFAULT_DATA_DIR,
      env.SIGNO_MAPS_DIR ? resolve(env.SIGNO_MAPS_DIR) : DEFAULT_MAPS_DIR,
    )
  }
  throw new Error(`Unknown data source "${kind}" (expected "mock" or "files"; set --source=... or SIGNO_DATA_SOURCE)`)
}
