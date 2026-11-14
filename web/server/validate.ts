// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Runtime checks of the data contract. Pipeline output that breaks the contract fails the build with a clear
// message instead of reaching users. Each function throws ContractError on the first problem it finds.

import { ID_PATTERN } from '../shared/contracts.ts'
import type { CellTrend, Period, Region, SeriesPoint, Variable } from '../shared/contracts.ts'
import type { SourceSeries, SourceTrendLayer } from './sources/types.ts'

export class ContractError extends Error {
  constructor(where: string, problem: string) {
    super(`${where}: ${problem}`)
    this.name = 'ContractError'
  }
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function check(condition: boolean, where: string, problem: string): void {
  if (!condition) throw new ContractError(where, problem)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function checkId(id: unknown, where: string): void {
  check(typeof id === 'string' && ID_PATTERN.test(id), where, `invalid id ${JSON.stringify(id)} (use a-z, 0-9, "_", "-")`)
}

function checkPeriod(period: Period | undefined, where: string): void {
  check(!!period && MONTH_PATTERN.test(period.start) && MONTH_PATTERN.test(period.end), where, 'period must be {start, end} as "YYYY-MM"')
  check((period as Period).start <= (period as Period).end, where, 'period.start is after period.end')
}

export function validateRegion(region: Region): void {
  const where = 'region.json'
  checkId(region?.id, `${where} id`)
  check(typeof region.name === 'string' && region.name.length > 0, where, 'name is required')
  check(Array.isArray(region.bbox) && region.bbox.length === 4 && region.bbox.every(isFiniteNumber), where, 'bbox must be [west, south, east, north]')
  const [west, south, east, north] = region.bbox
  check(west < east && south < north && west >= -180 && east <= 180 && south >= -90 && north <= 90, where, 'bbox out of range or inverted')
  check(region.boundarySource === null || typeof region.boundarySource === 'string', where, 'boundarySource must be a string or null')
}

export function validateVariables(variables: Variable[]): void {
  const where = 'variables.json'
  check(Array.isArray(variables) && variables.length > 0, where, 'must be a non-empty array')
  const seen = new Set<string>()
  for (const v of variables) {
    const at = `${where} [${v?.id}]`
    checkId(v?.id, at)
    check(!seen.has(v.id), at, 'duplicate variable id')
    seen.add(v.id)
    check(typeof v.name === 'string' && v.name.length > 0, at, 'name is required')
    check(typeof v.description === 'string' && v.description.length > 0, at, 'description is required (plain language)')
    check(typeof v.units === 'string' && v.units.length > 0, at, 'units are required')
    check(v.temporalResolution === 'monthly', at, 'temporalResolution must be "monthly"')
    checkPeriod(v.period, at)
    check(!!v.product && typeof v.product.shortName === 'string' && typeof v.product.provider === 'string', at, 'product needs shortName and provider')
    check(v.product.kind === 'satellite' || v.product.kind === 'model', at, 'product.kind must be "satellite" or "model"')
  }
}

function validateCell(cell: CellTrend, alpha: number, at: string): void {
  checkId(cell?.cellId, at)
  check(isFiniteNumber(cell.lat) && cell.lat >= -90 && cell.lat <= 90, at, 'lat out of range')
  check(isFiniteNumber(cell.lon) && cell.lon >= -180 && cell.lon <= 180, at, 'lon out of range')
  check(cell.slopePerDecade === null || isFiniteNumber(cell.slopePerDecade), at, 'slopePerDecade must be a number or null')
  check(cell.pValue === null || (isFiniteNumber(cell.pValue) && cell.pValue >= 0 && cell.pValue <= 1), at, 'pValue must be in [0, 1] or null')
  check(typeof cell.significant === 'boolean', at, 'significant must be true or false')
  check(!cell.significant || (cell.pValue !== null && cell.slopePerDecade !== null), at, 'a significant cell needs a slope and a p-value')
  check(!cell.significant || alpha > 0, at, 'method.alpha must be set')
  check(Number.isInteger(cell.validMonths) && cell.validMonths >= 0, at, 'validMonths must be a non-negative integer')
}

export function validateTrendLayer(layer: SourceTrendLayer, variable: Variable, region: Region): void {
  const where = `trends/${variable.id}.json`
  check(layer?.variableId === variable.id, where, `variableId must be "${variable.id}"`)
  check(layer.regionId === region.id, where, `regionId must be "${region.id}"`)
  checkPeriod(layer.period, where)
  check(isFiniteNumber(layer.cellSizeDeg) && layer.cellSizeDeg > 0, where, 'cellSizeDeg must be > 0')
  check(!!layer.method && typeof layer.method.name === 'string' && typeof layer.method.description === 'string', where, 'method needs name and description')
  check(isFiniteNumber(layer.method.alpha) && layer.method.alpha > 0 && layer.method.alpha < 1, where, 'method.alpha must be in (0, 1)')
  check(Array.isArray(layer.cells) && layer.cells.length > 0, where, 'cells must be a non-empty array')
  const seen = new Set<string>()
  for (const cell of layer.cells) {
    const at = `${where} cell ${cell?.cellId}`
    validateCell(cell, layer.method.alpha, at)
    check(!seen.has(cell.cellId), at, 'duplicate cellId')
    seen.add(cell.cellId)
  }
}

export function validateSeries(series: SourceSeries, layer: SourceTrendLayer): void {
  const where = `series/${layer.variableId}.json`
  check(!!series && typeof series === 'object' && !Array.isArray(series), where, 'must be an object keyed by cellId')
  const cellIds = new Set(layer.cells.map((c) => c.cellId))
  for (const [cellId, points] of Object.entries(series)) {
    const at = `${where} cell ${cellId}`
    check(cellIds.has(cellId), at, 'cellId is not in the trend layer')
    check(Array.isArray(points) && points.length > 0, at, 'points must be a non-empty array')
    let previous = ''
    for (const p of points as SeriesPoint[]) {
      check(MONTH_PATTERN.test(p?.month), at, `bad month ${JSON.stringify(p?.month)}`)
      check(p.month > previous, at, `months must be in increasing order (at ${p.month})`)
      check(p.value === null || isFiniteNumber(p.value), at, `value must be a number or null (at ${p.month})`)
      previous = p.month
    }
  }
}
