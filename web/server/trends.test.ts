// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// Unit tests for the trend additions of the contract: the P-002 exemption for the team's trend results, the
// per-cell cover trends, validation.json "trendChecks", zones.json, borders and the new Variable fields
// (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CoverCell, TrendChecks, Variable } from '../shared/contracts.ts'
import type { SourceCover, SourceTrendLayer, SourceValidation, SourceZones } from './sources/types.ts'
import { validateBorders, validateCover, validateValidationReport, validateVariables, validateZones } from './validate.ts'

const grid: SourceTrendLayer = {
  variableId: 'ndvi',
  regionId: 'amazon',
  period: { start: '2001-01', end: '2024-12' },
  cellSizeDeg: 1,
  method: { name: 'Mann-Kendall', description: 'test', alpha: 0.05 },
  cells: [
    { cellId: 'r00c00', lat: -3.5, lon: -60.5, slopePerDecade: -0.01, pValue: 0.001, significant: true, validMonths: 100 },
    { cellId: 'r00c01', lat: -3.5, lon: -59.5, slopePerDecade: null, pValue: null, significant: false, validMonths: 100 },
  ],
}
const cellIds = new Set(['r00c00', 'r00c01'])

// --- cover.json trends ------------------------------------------------------------------------------------------

function coverCell(overrides: Partial<CoverCell> = {}): CoverCell {
  return {
    cellId: 'r00c00',
    lat: -3.5,
    lon: -60.5,
    hansenTreeCover: [90, 89, 88],
    modisTreeCover: [70, 69, null],
    lossKm2: [10, 20],
    burnedKm2: [0, 5],
    trends: {
      lossKm2: { slopePerDecade: 8.2, pValue: 0.003, significant: true },
      modisTreeCover: null,
    },
    ...overrides,
  }
}

function cover(cells: CoverCell[] = [coverCell()], overrides: Partial<SourceCover> = {}): SourceCover {
  return {
    cellSizeDeg: 1,
    years: [2000, 2001, 2002],
    lossYears: [2001, 2002],
    burnedYears: [2001, 2002],
    definitions: { hansenTreeCover: 'Tree cover (Hansen).' },
    flags: [],
    trendMethod: 'Mann-Kendall on yearly values, Benjamini-Hochberg FDR.',
    cells,
    ...overrides,
  }
}

describe('cover.json trends (P-002 exemption)', () => {
  it('accepts per-cell trends and trendMethod with p-values and significance', () => assert.doesNotThrow(() => validateCover(cover(), grid)))

  it('still accepts a cover layer without trends (older export)', () =>
    assert.doesNotThrow(() => validateCover(cover([coverCell({ trends: undefined })], { trendMethod: undefined }), grid)))

  it('still rejects p-values or significance outside the trends fields', () => {
    const withSignificance = cover()
    ;(withSignificance.definitions as Record<string, unknown>).significant = 'yes'
    assert.throws(() => validateCover(withSignificance, grid), /no p-values/)
    const cellWithP = coverCell()
    ;(cellWithP as unknown as Record<string, unknown>).pValue = 0.01
    assert.throws(() => validateCover(cover([cellWithP]), grid), /no p-values/)
  })

  it('requires trendMethod when cells carry trends', () =>
    assert.throws(() => validateCover(cover([coverCell()], { trendMethod: undefined }), grid), /trendMethod/))

  it('rejects a p-value outside [0, 1], a significant trend without a slope and a non-boolean significant', () => {
    const t = (trend: unknown): CoverCell => coverCell({ trends: { lossKm2: trend as never, modisTreeCover: null } })
    assert.throws(() => validateCover(cover([t({ slopePerDecade: 1, pValue: 1.5, significant: false })]), grid), /pValue/)
    assert.throws(() => validateCover(cover([t({ slopePerDecade: null, pValue: 0.01, significant: true })]), grid), /needs a slope and a p-value/)
    assert.throws(() => validateCover(cover([t({ slopePerDecade: 1, pValue: 0.5, significant: 'no' })]), grid), /significant/)
  })
})

// --- validation.json trendChecks --------------------------------------------------------------------------------

function trendChecks(): TrendChecks {
  return {
    generatedUtc: '2026-11-15T00:00:00+00:00',
    design: { alpha: 0.05, minCompleteShare: 0.8, autocorrelationRuleThreshold: 0.2, permutations: 20, seed: 1, text: 'Mann-Kendall with FDR.' },
    variables: [
      {
        variableId: 'ndvi',
        testUsed: 'Mann-Kendall (original)',
        autocorrelationShare: 0.17,
        period: [2001, 2020],
        units: 'unitless per decade',
        cellsTotal: 2,
        cellsTested: 2,
        significantIncreasing: 1,
        significantDecreasing: 0,
        medianSlopePerDecade: 0.003,
        medianSlopePerDecadeSignificant: 0.005,
        cellsWithMissingYear: 0,
      },
    ],
    d1Drift: {
      years: [2015, 2025],
      overpassHoursFirstYear: 10.5,
      overpassHoursLastYear: 9.4,
      variables: { ndvi: { r: 0.85, pValue: 0.001, n: 11, endsIn2020: true } },
      rule: 'If |r| >= 0.5 the test ends in 2020.',
    },
    v1FalsePositives: { ndvi: { permutations: 20, meanShareSignificant: 0, maxShareSignificant: 0 } },
    v2Detection: { ndvi: { injectedSlopePerDecade: 0.006, meanShareDetected: 0.57, minShareDetected: 0.54, meanShareDetectedIncreasing: 0.57 } },
    v3KnownPlaces: [
      {
        cellId: 'r00c01',
        kind: 'case',
        zones: ['amazon'],
        caseId: 'la_pampa',
        label: 'La Pampa',
        lossKm2: { slopePerDecade: 37, pValue: 1e-8, qValue: 1e-5, significant: true, direction: 'increasing', expectedDirection: 'increasing', directionAsExpected: true },
        modisTreeCover: null,
      },
    ],
    v4ZoneTrends: { amazon: { ndvi: { slopePerDecade: 0.001, pValue: 0.5, significant: false, years: [2001, 2020], n: 20, test: 'original' } } },
  }
}

function report(): SourceValidation {
  return {
    meta: { generatedUtc: '2026-11-15T00:00:00+00:00', sources: { MOD44B: '10.5067/MODIS/MOD44B.061' }, note: 'Descriptive only.', aiDisclosure: 'SI.' },
    zones: [
      {
        zoneId: 'amazon',
        label: 'Amazon',
        agreement2000: { r: 0.88, cells: 100, biasPp: -22.5, rmsePp: 25.3, byHansenClass: [] },
        changeVsLoss: { r: -0.7, cells: 100, definition: 'MODIS change vs Hansen loss', byLossDecile: [] },
        lossWithFire: { definition: 'Loss in burned cells', years: [] },
        hotspots: [],
      },
    ],
    cases: [],
    trendChecks: trendChecks(),
  }
}

describe('validation.json trendChecks (P-002 exemption)', () => {
  it('accepts p-values and significance inside trendChecks', () => assert.doesNotThrow(() => validateValidationReport(report(), cellIds)))

  it('still rejects p-values and significance in the other sections', () => {
    const withP = report()
    ;(withP.zones[0].agreement2000 as unknown as Record<string, unknown>).pValue = 0.01
    assert.throws(() => validateValidationReport(withP, cellIds), /no p-values/)
    const withSignificant = report()
    ;(withSignificant.zones[0].hotspots as unknown as Record<string, unknown>[]).push({
      lat: -3.5,
      lon: -60.5,
      apiCellId: 'r00c00',
      hansenLossShare: 0.9,
      peakLossYear: 2020,
      peakLossShare: 0.2,
      hansenTreeCover2000: 99,
      modisChangePp: -48,
      burnedYears: [],
      significant: true,
    })
    assert.throws(() => validateValidationReport(withSignificant, cellIds), /no p-values/)
  })

  it('rejects a known place outside the API grid and shares outside [0, 1]', () => {
    const place = report()
    place.trendChecks!.v3KnownPlaces[0].cellId = 'r99c99'
    assert.throws(() => validateValidationReport(place, cellIds), /not in the API grid/)
    const share = report()
    share.trendChecks!.v1FalsePositives.ndvi.meanShareSignificant = 1.4
    assert.throws(() => validateValidationReport(share, cellIds), /meanShareSignificant/)
  })

  it('accepts a report without trendChecks', () => {
    const plain = report()
    delete plain.trendChecks
    assert.doesNotThrow(() => validateValidationReport(plain, cellIds))
  })
})

// --- zones.json -------------------------------------------------------------------------------------------------

function zones(): SourceZones {
  return {
    note: 'Yearly zone values.',
    alpha: 0.05,
    aiDisclosure: 'SI.',
    zones: {
      amazon: {
        label: 'Amazon (whole region)',
        variables: {
          ndvi: {
            units: 'unitless',
            annual: [
              { year: 2001, value: 0.8, complete: true },
              { year: 2002, value: 0.81, complete: true },
              { year: 2003, value: null, complete: false },
            ],
            monthlyRange: [{ year: 2001, min: 0.78, minMonth: 3, max: 0.82, maxMonth: 11 }],
            zoneTrend: { slopePerDecade: 0.001, pValue: 0.4, significant: false, years: [2001, 2002], n: 2, test: 'original' },
            cellSummary: { tested: 2, significantIncreasing: 1, significantDecreasing: 0 },
          },
          hansenTreeCover: { units: '%', annual: [{ year: 2000, value: 86.5, complete: true }] },
        },
      },
    },
  }
}

describe('validateZones', () => {
  it('accepts a valid report, including a variable that is never tested (Hansen tree cover)', () => assert.doesNotThrow(() => validateZones(zones(), 2)))

  it('rejects annual years that are not increasing, and values that are not numbers or null', () => {
    const years = zones()
    years.zones.amazon.variables.ndvi.annual[1].year = 2001
    assert.throws(() => validateZones(years, 2), /increasing integers/)
    const value = zones()
    ;(value.zones.amazon.variables.ndvi.annual[0] as unknown as Record<string, unknown>).value = Number.NaN
    assert.throws(() => validateZones(value, 2), /number or null/)
  })

  it('rejects missing units', () => {
    const bad = zones()
    bad.zones.amazon.variables.ndvi.units = ''
    assert.throws(() => validateZones(bad, 2), /units are required/)
  })

  it('rejects a monthly range with min above max, or a month outside 1-12', () => {
    const range = zones()
    range.zones.amazon.variables.ndvi.monthlyRange![0].min = 0.9
    assert.throws(() => validateZones(range, 2), /min <= max/)
    const month = zones()
    month.zones.amazon.variables.ndvi.monthlyRange![0].maxMonth = 13
    assert.throws(() => validateZones(month, 2), /months must be integers 1-12/)
  })

  it('rejects a zone trend that is significant without a slope, or a p-value outside [0, 1]', () => {
    const noSlope = zones()
    noSlope.zones.amazon.variables.ndvi.zoneTrend!.significant = true
    noSlope.zones.amazon.variables.ndvi.zoneTrend!.slopePerDecade = null
    assert.throws(() => validateZones(noSlope, 2), /needs a slope and a p-value/)
    const p = zones()
    p.zones.amazon.variables.ndvi.zoneTrend!.pValue = 2
    assert.throws(() => validateZones(p, 2), /pValue/)
  })

  it('rejects cell counts above the grid, or significant counts above the tested cells', () => {
    assert.throws(() => validateZones(zones(), 1), /within the 1 cells/)
    const counts = zones()
    counts.zones.amazon.variables.ndvi.cellSummary!.significantDecreasing = 2
    assert.throws(() => validateZones(counts, 2), /at most tested/)
  })

  it('rejects a test on Hansen tree cover and an LST test after 2020', () => {
    const hansen = zones()
    hansen.zones.amazon.variables.hansenTreeCover.cellSummary = { tested: 1, significantIncreasing: 0, significantDecreasing: 1 }
    assert.throws(() => validateZones(hansen, 2), /Hansen tree cover must not be tested/)
    const lst = zones()
    lst.zones.amazon.variables.lst_day = { ...lst.zones.amazon.variables.ndvi, zoneTrend: { slopePerDecade: 0.3, pValue: 0.01, significant: true, years: [2001, 2024], n: 20, test: 'original' } }
    assert.throws(() => validateZones(lst, 2), /lst_day must not be tested after 2020/)
  })

  it('rejects a zone id that is not a valid id', () => {
    const bad = zones()
    bad.zones['Amazon Brazil'] = bad.zones.amazon
    assert.throws(() => validateZones(bad, 2), /invalid id/)
  })
})

// --- borders and Variable fields --------------------------------------------------------------------------------

describe('validateBorders', () => {
  const feature = { type: 'Feature', properties: { name: 'Peru', iso3: 'PER' }, geometry: { type: 'Polygon', coordinates: [] } }
  it('accepts a FeatureCollection of polygons', () => assert.doesNotThrow(() => validateBorders({ type: 'FeatureCollection', features: [feature] })))
  it('rejects anything else', () => {
    assert.throws(() => validateBorders({ type: 'Feature' }), /FeatureCollection/)
    assert.throws(() => validateBorders({ type: 'FeatureCollection', features: [] }), /FeatureCollection/)
    assert.throws(() => validateBorders({ type: 'FeatureCollection', features: [{ ...feature, geometry: { type: 'Point' } }] }), /Polygon/)
  })
})

describe('Variable.slopeUnits and Variable.trendYears', () => {
  const variable: Variable = {
    id: 'precip',
    name: 'Rainfall',
    description: 'Rain.',
    units: 'mm/month',
    temporalResolution: 'monthly',
    period: { start: '2001-01', end: '2025-09' },
    product: { shortName: 'GPM_3IMERGM', version: '07', provider: 'GES DISC', doi: null, kind: 'satellite' },
    semesterAggregation: 'sum',
    slopeUnits: 'mm per year, per decade',
    trendYears: { start: 2001, end: 2024 },
  }
  it('accepts valid values and their absence', () => {
    assert.doesNotThrow(() => validateVariables([variable]))
    assert.doesNotThrow(() => validateVariables([{ ...variable, slopeUnits: undefined, trendYears: undefined }]))
  })
  it('rejects slope units without "per decade"', () =>
    assert.throws(() => validateVariables([{ ...variable, slopeUnits: 'mm per year' }]), /per decade/))
  it('rejects tested years that are inverted or outside the period', () => {
    assert.throws(() => validateVariables([{ ...variable, trendYears: { start: 2024, end: 2001 } }]), /trendYears/)
    assert.throws(() => validateVariables([{ ...variable, trendYears: { start: 2001, end: 2030 } }]), /inside the period/)
  })
})
