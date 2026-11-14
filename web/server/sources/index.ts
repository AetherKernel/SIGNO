// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Chooses the data source. This is the only place to touch when Alexis's pipeline data replaces the mock:
//   SIGNO_DATA_SOURCE=mock   (default) synthetic sample data
//   SIGNO_DATA_SOURCE=files  JSON exported by the pipeline into SIGNO_DATA_DIR (default: server/data)

import { resolve } from 'node:path'
import { createFileSource } from './fileSource.ts'
import { createMockSource } from './mockSource.ts'
import type { DataSource } from './types.ts'

export const DEFAULT_DATA_DIR = resolve(import.meta.dirname, '..', 'data')

export function createDataSource(env: Record<string, string | undefined> = process.env): DataSource {
  const kind = env.SIGNO_DATA_SOURCE ?? 'mock'
  if (kind === 'mock') return createMockSource()
  if (kind === 'files') return createFileSource(env.SIGNO_DATA_DIR ? resolve(env.SIGNO_DATA_DIR) : DEFAULT_DATA_DIR)
  throw new Error(`Unknown SIGNO_DATA_SOURCE "${kind}" (expected "mock" or "files")`)
}
