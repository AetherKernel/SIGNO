// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
// Unit tests for the summary counts and the mock source (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CellTrend } from '../shared/contracts.ts'
import { createDataSource } from './sources/index.ts'
import { createMockSource } from './sources/mockSource.ts'
import { summarize } from './summary.ts'
import { validateRegion, validateSeries, validateTrendLayer, validateVariables } from './validate.ts'

const cell = (overrides: Partial<CellTrend>): CellTrend => ({
  cellId: 'c',
  lat: 0,
  lon: 0,
  slopePerDecade: 0,
  pValue: 0.5,
  significant: false,
  validMonths: 100,
  ...overrides,
})

describe('summarize', () => {
  it('counts tested, significant, increasing and decreasing cells', () => {
    const result = summarize([
      cell({ cellId: 'a', slopePerDecade: 0.2, pValue: 0.01, significant: true }),
      cell({ cellId: 'b', slopePerDecade: -0.3, pValue: 0.001, significant: true }),
      cell({ cellId: 'c', slopePerDecade: -0.1, pValue: 0.4, significant: false }),
      cell({ cellId: 'd', slopePerDecade: null, pValue: null, significant: false }),
    ])
    assert.deepEqual(result, {
      cellsTotal: 4,
      cellsTested: 3,
      cellsSignificant: 2,
      significantIncreasing: 1,
      significantDecreasing: 1,
    })
  })
  it('handles an empty list', () => assert.equal(summarize([]).cellsTotal, 0))
})

describe('mock source', () => {
  it('satisfies the contract and is labelled as mock', async () => {
    const source = createMockSource()
    assert.equal(source.status, 'mock')
    const region = await source.getRegion()
    validateRegion(region)
    const variables = await source.getVariables()
    validateVariables(variables)
    for (const variable of variables) {
      const layer = await source.getTrendLayer(variable.id)
      validateTrendLayer(layer, variable, region)
      validateSeries(await source.getSeries(variable.id), layer)
    }
  })
  it('is deterministic between builds', async () => {
    const a = await createMockSource().getTrendLayer('ndvi')
    const b = await createMockSource().getTrendLayer('ndvi')
    assert.deepEqual(a, b)
  })
})

describe('createDataSource', () => {
  it('defaults to the mock', () => assert.equal(createDataSource({}).status, 'mock'))
  it('selects the pipeline files', () => assert.equal(createDataSource({ SIGNO_DATA_SOURCE: 'files' }).status, 'real'))
  it('rejects an unknown source', () => assert.throws(() => createDataSource({ SIGNO_DATA_SOURCE: 'sql' }), /Unknown/))
})
