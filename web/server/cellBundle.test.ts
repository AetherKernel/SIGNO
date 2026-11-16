// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// Unit tests for the per-cell files of API v1 (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { API_VERSION } from '../shared/contracts.ts'
import type { CellSeries, CellTrend } from '../shared/contracts.ts'
import { CellBundleCollector } from './cellBundle.ts'

function series(variableId: string, cellId: string, value: number): CellSeries {
  return {
    apiVersion: API_VERSION,
    variableId,
    cellId,
    units: variableId === 'lst_day' ? '°C' : 'unitless',
    dataStatus: 'real',
    points: [{ month: '2001-01', value }],
    semesters: [],
    annual: [{ year: 2001, value, validMonths: 1, complete: false }],
  }
}

function trend(cellId: string, slope: number): CellTrend {
  return { cellId, lat: -12.5, lon: -70.5, slopePerDecade: slope, pValue: 0.01, significant: true, validMonths: 240 }
}

describe('CellBundleCollector', () => {
  it('groups every variable of a cell into one bundle, with the cell trend row', () => {
    const c = new CellBundleCollector()
    c.add(series('ndvi', 'r08c09', 0.8), trend('r08c09', -0.01))
    c.add(series('lst_day', 'r08c09', 27), trend('r08c09', 0.5))
    const [bundle] = c.bundles('real', ['ndvi', 'lst_day'])
    assert.equal(bundle.apiVersion, API_VERSION)
    assert.equal(bundle.cellId, 'r08c09')
    assert.equal(bundle.dataStatus, 'real')
    assert.deepEqual(Object.keys(bundle.variables), ['ndvi', 'lst_day'])
    assert.equal(bundle.variables.lst_day.units, '°C')
    assert.equal(bundle.variables.lst_day.trend?.slopePerDecade, 0.5)
    assert.deepEqual(bundle.variables.ndvi.annual, [{ year: 2001, value: 0.8, validMonths: 1, complete: false }])
    assert.equal('points' in bundle.variables.ndvi, false, 'monthly points stay in the series file')
  })

  it('passes the 95 % interval of the slope into the cell file', () => {
    const c = new CellBundleCollector()
    c.add(series('ndvi', 'r08c09', 0.8), { ...trend('r08c09', -0.01), slopeCi95: [-0.02, 0] })
    const [bundle] = c.bundles('real', ['ndvi'])
    assert.deepEqual(bundle.variables.ndvi.trend?.slopeCi95, [-0.02, 0])
  })

  it('keeps one bundle per cell and a null trend when the layer has no row', () => {
    const c = new CellBundleCollector()
    c.add(series('ndvi', 'r01c01', 0.7), null)
    c.add(series('ndvi', 'r01c02', 0.6), trend('r01c02', 0))
    const bundles = c.bundles('mock', ['ndvi'])
    assert.equal(bundles.length, 2)
    assert.equal(bundles.find((b) => b.cellId === 'r01c01')?.variables.ndvi.trend, null)
  })

  it('orders variables as the manifest does, whatever order they were added in', () => {
    const c = new CellBundleCollector()
    c.add(series('precip', 'r01c01', 1), null)
    c.add(series('ndvi', 'r01c01', 1), null)
    const [bundle] = c.bundles('real', ['ndvi', 'evi', 'precip'])
    assert.deepEqual(Object.keys(bundle.variables), ['ndvi', 'precip'])
  })
})
