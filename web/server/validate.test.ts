// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
// Unit tests for the contract validation (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Region, Variable } from '../shared/contracts.ts'
import type { SourceSeries, SourceTrendLayer } from './sources/types.ts'
import { ContractError, validateRegion, validateSeries, validateTrendLayer, validateVariables } from './validate.ts'

const region: Region = { id: 'amazon', name: 'Amazon', boundarySource: null, bbox: [-80, -20, -44, 10] }

const variable: Variable = {
  id: 'ndvi',
  name: 'NDVI',
  description: 'Greenness.',
  units: 'unitless',
  temporalResolution: 'monthly',
  period: { start: '2001-01', end: '2024-12' },
  product: { shortName: 'MOD13C2', version: '061', provider: 'LP DAAC', doi: null, kind: 'satellite' },
  semesterAggregation: 'mean',
}

function layer(overrides: Partial<SourceTrendLayer> = {}): SourceTrendLayer {
  return {
    variableId: 'ndvi',
    regionId: 'amazon',
    period: { start: '2001-01', end: '2024-12' },
    cellSizeDeg: 1,
    method: { name: 'test', description: 'test method', alpha: 0.05 },
    cells: [
      { cellId: 'r00c00', lat: -3, lon: -60, slopePerDecade: -0.02, pValue: 0.01, significant: true, validMonths: 280 },
      { cellId: 'r00c01', lat: -3, lon: -59, slopePerDecade: null, pValue: null, significant: false, validMonths: 3 },
    ],
    ...overrides,
  }
}

describe('validateRegion', () => {
  it('accepts a valid region', () => assert.doesNotThrow(() => validateRegion(region)))
  it('rejects an inverted bbox', () =>
    assert.throws(() => validateRegion({ ...region, bbox: [-44, -20, -80, 10] }), ContractError))
  it('rejects an id with spaces or capitals', () => assert.throws(() => validateRegion({ ...region, id: 'The Amazon' }), /invalid id/))
})

describe('validateVariables', () => {
  it('accepts valid variables', () => assert.doesNotThrow(() => validateVariables([variable])))
  it('rejects an empty list', () => assert.throws(() => validateVariables([]), /non-empty/))
  it('rejects duplicate ids', () => assert.throws(() => validateVariables([variable, variable]), /duplicate/))
  it('rejects a bad month format', () =>
    assert.throws(() => validateVariables([{ ...variable, period: { start: '2001-1', end: '2024-12' } }]), /YYYY-MM/))
  it('rejects a missing or unknown semesterAggregation', () =>
    assert.throws(() => validateVariables([{ ...variable, semesterAggregation: 'median' as 'mean' }]), /semesterAggregation/))
  it('rejects a period that ends before it starts', () =>
    assert.throws(() => validateVariables([{ ...variable, period: { start: '2024-01', end: '2001-01' } }]), /after/))
})

describe('validateTrendLayer', () => {
  it('accepts a valid layer, including a cell without enough data', () =>
    assert.doesNotThrow(() => validateTrendLayer(layer(), variable, region)))
  it('rejects a p-value outside [0, 1]', () => {
    const bad = layer()
    bad.cells[0] = { ...bad.cells[0], pValue: 1.7 }
    assert.throws(() => validateTrendLayer(bad, variable, region), /pValue must be in \[0, 1\]/)
  })
  it('rejects a significant cell without a p-value', () => {
    const bad = layer()
    bad.cells[0] = { ...bad.cells[0], pValue: null }
    assert.throws(() => validateTrendLayer(bad, variable, region), /needs a slope and a p-value/)
  })
  it('rejects NaN slopes', () => {
    const bad = layer()
    bad.cells[0] = { ...bad.cells[0], slopePerDecade: Number.NaN }
    assert.throws(() => validateTrendLayer(bad, variable, region), /slopePerDecade/)
  })
  it('accepts a Sen line and rejects a malformed one', () => {
    const ok = layer()
    ok.cells[0] = { ...ok.cells[0], line: { start: { year: 2001, value: 1 }, end: { year: 2025, value: 2 } } }
    assert.doesNotThrow(() => validateTrendLayer(ok, variable, region))
    const bad = layer()
    bad.cells[0] = { ...bad.cells[0], line: { start: { year: 2001, value: Number.NaN }, end: { year: 2025, value: 2 } } }
    assert.throws(() => validateTrendLayer(bad, variable, region), /line must be/)
  })
  it('rejects duplicate cell ids', () => {
    const bad = layer()
    bad.cells[1] = { ...bad.cells[1], cellId: 'r00c00' }
    assert.throws(() => validateTrendLayer(bad, variable, region), /duplicate cellId/)
  })
  it('rejects a layer for another variable or region', () => {
    assert.throws(() => validateTrendLayer(layer({ variableId: 'lst_day' }), variable, region), /variableId/)
    assert.throws(() => validateTrendLayer(layer({ regionId: 'andes' }), variable, region), /regionId/)
  })
  it('rejects an alpha outside (0, 1)', () =>
    assert.throws(() => validateTrendLayer(layer({ method: { name: 'x', description: 'y', alpha: 5 } }), variable, region), /alpha/))
})

describe('validateSeries', () => {
  const ok: SourceSeries = { r00c00: [{ month: '2001-01', value: 0.8 }, { month: '2001-02', value: null }] }
  it('accepts valid series with missing months as null', () => assert.doesNotThrow(() => validateSeries(ok, layer())))
  it('rejects a cell that is not in the trend layer', () =>
    assert.throws(() => validateSeries({ r09c09: ok.r00c00 }, layer()), /not in the trend layer/))
  it('rejects months out of order', () =>
    assert.throws(() => validateSeries({ r00c00: [{ month: '2001-02', value: 1 }, { month: '2001-01', value: 1 }] }, layer()), /increasing order/))
  it('rejects sentinel-like non-numbers', () =>
    assert.throws(() => validateSeries({ r00c00: [{ month: '2001-01', value: 'NaN' as unknown as number }] }, layer()), /number or null/))
})
