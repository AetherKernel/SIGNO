// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// Unit tests for the optional extras of the contract: tree cover layer, validation report and raster index
// (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import type { CoverCell } from '../shared/contracts.ts'
import { mapRasterIndex } from './sources/fileSource.ts'
import type { SourceCover, SourceRasterIndex, SourceTrendLayer, SourceValidation } from './sources/types.ts'
import { ContractError, validateCover, validateRasterIndex, validateValidationReport } from './validate.ts'

const trends: SourceTrendLayer = {
  variableId: 'ndvi',
  regionId: 'amazon',
  period: { start: '2001-01', end: '2024-12' },
  cellSizeDeg: 1,
  method: { name: 'No trend test applied yet', description: 'test', alpha: 0.05 },
  cells: [
    { cellId: 'r00c00', lat: -3.5, lon: -60.5, slopePerDecade: null, pValue: null, significant: false, validMonths: 100 },
    { cellId: 'r00c01', lat: -3.5, lon: -59.5, slopePerDecade: null, pValue: null, significant: false, validMonths: 100 },
  ],
}

function coverCell(overrides: Partial<CoverCell> = {}): CoverCell {
  return {
    cellId: 'r00c00',
    lat: -3.5,
    lon: -60.5,
    hansenTreeCover: [90, 89, 88],
    modisTreeCover: [70, 69, null],
    lossKm2: [10, 20],
    burnedKm2: [0, 5],
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
    flags: [{ source: 'modis', year: 2002, note: 'Suspect year.' }],
    cells,
    ...overrides,
  }
}

describe('validateCover', () => {
  it('accepts a valid layer, with null gaps and equal consecutive Hansen values', () => {
    assert.doesNotThrow(() => validateCover(cover(), trends))
    assert.doesNotThrow(() => validateCover(cover([coverCell({ hansenTreeCover: [90, 90, null] })]), trends))
  })

  it('rejects Hansen tree cover that increases (regrowth is not counted)', () =>
    assert.throws(() => validateCover(cover([coverCell({ hansenTreeCover: [90, 88, 89] })]), trends), /must not increase/))

  it('allows an increase within the 1e-6 tolerance', () =>
    assert.doesNotThrow(() => validateCover(cover([coverCell({ hansenTreeCover: [90, 90.0000005, 80] })]), trends)))

  it('rejects an increase across a null gap', () =>
    assert.throws(() => validateCover(cover([coverCell({ hansenTreeCover: [80, null, 85] })]), trends), /must not increase/))

  it('rejects MODIS values outside 0-100', () =>
    assert.throws(() => validateCover(cover([coverCell({ modisTreeCover: [70, 101, null] })]), trends), /modisTreeCover\[1\]/))

  it('rejects negative loss or burned areas', () => {
    assert.throws(() => validateCover(cover([coverCell({ lossKm2: [10, -1] })]), trends), /lossKm2/)
    assert.throws(() => validateCover(cover([coverCell({ burnedKm2: [-1, 0] })]), trends), /burnedKm2/)
  })

  it('rejects an area larger than the cell', () =>
    assert.throws(() => validateCover(cover([coverCell({ lossKm2: [10, 50000] })]), trends), /lossKm2/))

  it('rejects arrays whose length does not match the years', () => {
    assert.throws(() => validateCover(cover([coverCell({ hansenTreeCover: [90, 89] })]), trends), /3 values/)
    assert.throws(() => validateCover(cover([coverCell({ lossKm2: [10] })]), trends), /2 values/)
    assert.throws(() => validateCover(cover([coverCell({ burnedKm2: [1, 2, 3] })]), trends), /2 values/)
  })

  it('rejects a cellId that is not in the trend grid', () =>
    assert.throws(() => validateCover(cover([coverCell({ cellId: 'r09c09' })]), trends), /not in the trend grid/))

  it('rejects a cell whose lat/lon differ from the trend grid', () =>
    assert.throws(() => validateCover(cover([coverCell({ lat: -4.5 })]), trends), /do not match the trend grid/))

  it('rejects duplicate cellIds', () =>
    assert.throws(() => validateCover(cover([coverCell(), coverCell()]), trends), /duplicate cellId/))

  it('rejects a cell size different from the trend grid', () =>
    assert.throws(() => validateCover(cover([coverCell()], { cellSizeDeg: 0.5 }), trends), /cellSizeDeg/))

  it('rejects years that are not increasing and flags of unknown years', () => {
    assert.throws(() => validateCover(cover([coverCell()], { years: [2000, 2000, 2002] }), trends), /increasing/)
    assert.throws(() => validateCover(cover([coverCell()], { flags: [{ source: 'modis', year: 1999, note: 'x' }] }), trends), /flag year/)
  })

  it('throws ContractError', () =>
    assert.throws(() => validateCover(cover([coverCell({ cellId: 'r09c09' })]), trends), ContractError))
})

const cellIds = new Set(['r00c00', 'r00c01'])

function report(): SourceValidation {
  return {
    meta: { generatedUtc: '2026-11-15T00:00:00+00:00', sources: { MOD44B: '10.5067/MODIS/MOD44B.061' }, note: 'Descriptive only.', aiDisclosure: 'SI.' },
    zones: [
      {
        zoneId: 'amazon',
        label: 'Amazon',
        agreement2000: { r: 0.88, cells: 100, biasPp: -22.5, rmsePp: 25.3, byHansenClass: [{ hansenRange: [0, 10], cells: 5, hansenMean: 4.5, modisMean: 12.2 }] },
        changeVsLoss: { r: -0.7, cells: 100, definition: 'MODIS change vs Hansen loss', byLossDecile: [{ decile: 1, hansenLossShareMean: 0, modisChangePpMean: 1.2, cells: 10 }] },
        lossWithFire: { definition: 'Loss in burned cells', years: [{ year: 2001, lossKm2: 100, lossInBurnedCellsKm2: 40, share: 0.4, zoneShareOfCellsBurned: 0.06 }] },
        hotspots: [{ lat: -3.5, lon: -60.5, apiCellId: 'r00c00', hansenLossShare: 0.9, peakLossYear: 2020, peakLossShare: 0.2, hansenTreeCover2000: 99, modisChangePp: -48, burnedYears: [2018] }],
      },
    ],
    cases: [
      {
        id: 'la_pampa',
        label: 'La Pampa',
        lat: -3.5,
        lon: -60.5,
        reference: 'MAAP #233',
        apiCellId: 'r00c01',
        years: [2000, 2001],
        hansenTreeCover: [99, 98],
        modisTreeCover: [80, null],
        lossYears: [2001],
        hansenLossShare: [0.01],
        burnedMonths: 0,
        burnedMonthsList: [],
        burnedPeriod: '2001-01..2026-09',
      },
    ],
  }
}

describe('validateValidationReport', () => {
  it('accepts a valid report', () => assert.doesNotThrow(() => validateValidationReport(report(), cellIds)))

  it('rejects any p-value or significance field (P-002)', () => {
    const withP = report()
    ;(withP.zones[0].agreement2000 as unknown as Record<string, unknown>).pValue = 0.01
    assert.throws(() => validateValidationReport(withP, cellIds), /no p-values/)
    const withSignificant = report()
    ;(withSignificant.zones[0].changeVsLoss as unknown as Record<string, unknown>).significant = true
    assert.throws(() => validateValidationReport(withSignificant, cellIds), /no p-values/)
  })

  it('rejects an r outside [-1, 1]', () => {
    const bad = report()
    bad.zones[0].agreement2000.r = 1.4
    assert.throws(() => validateValidationReport(bad, cellIds), /agreement2000\.r/)
  })

  it('rejects a hotspot or case that points to a cell outside the API grid', () => {
    const hotspot = report()
    hotspot.zones[0].hotspots[0].apiCellId = 'r99c99'
    assert.throws(() => validateValidationReport(hotspot, cellIds), /not in the API grid/)
    const caseFile = report()
    caseFile.cases[0].apiCellId = 'r99c99'
    assert.throws(() => validateValidationReport(caseFile, cellIds), /not in the API grid/)
  })

  it('rejects a case without a citation or with mismatched arrays', () => {
    const noReference = report()
    noReference.cases[0].reference = ''
    assert.throws(() => validateValidationReport(noReference, cellIds), /reference/)
    const badLength = report()
    badLength.cases[0].hansenTreeCover = [99]
    assert.throws(() => validateValidationReport(badLength, cellIds), /hansenTreeCover/)
  })

  it('rejects a share above 1 and duplicate zones', () => {
    const share = report()
    share.zones[0].lossWithFire.years[0].share = 1.2
    assert.throws(() => validateValidationReport(share, cellIds), /share/)
    const twice = report()
    twice.zones.push(twice.zones[0])
    assert.throws(() => validateValidationReport(twice, cellIds), /duplicate zoneId/)
  })
})

// --- Raster index -------------------------------------------------------------------------------------------------

const workDir = mkdtempSync(join(tmpdir(), 'signo-maps-'))
after(() => rmSync(workDir, { recursive: true, force: true }))

/** Minimal PNG header (signature + IHDR length/type + width + height): enough for the size check. */
function pngHeader(width: number, height: number): Buffer {
  const head = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0)
  head.writeUInt32BE(13, 8)
  head.write('IHDR', 12, 'ascii')
  head.writeUInt32BE(width, 16)
  head.writeUInt32BE(height, 20)
  return head
}

function mapsFolder(name: string, files: Record<string, Buffer>): string {
  const dir = join(workDir, name)
  mkdirSync(dir, { recursive: true })
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), body)
  }
  return dir
}

function rasterIndex(): SourceRasterIndex {
  return {
    grid: { west: -80, south: -21, east: -79, north: -20, stepDeg: 0.5, rows: 2, cols: 2, nodata: 255, row0: 'north', col0: 'west' },
    layers: [
      { id: 'hansen_loss', source: 'HANSEN', doi: '10.1126/science.1244693', encoding: 'sqrt_share', frames: [{ key: '2001', url: '/data/maps/hansen/loss_2001.png' }] },
      { id: 'burned', source: 'MCD64A1', doi: '10.5067/MODIS/MCD64A1.061', encoding: 'sqrt_share', frames: [{ key: '2026-H2', url: '/data/maps/burned/2026-H2.png', nMonths: 3 }] },
    ],
  }
}

const goodFiles = (): Record<string, Buffer> => ({
  'hansen/loss_2001.png': pngHeader(2, 2),
  'burned/2026-H2.png': pngHeader(2, 2),
})

describe('validateRasterIndex', () => {
  it('accepts an index whose files exist and match the grid', () =>
    assert.doesNotThrow(() => validateRasterIndex(rasterIndex(), mapsFolder('ok', goodFiles()))))

  it('rejects a missing raster file', () => {
    const files = goodFiles()
    delete files['burned/2026-H2.png']
    assert.throws(() => validateRasterIndex(rasterIndex(), mapsFolder('missing', files)), /missing raster file/)
  })

  it('rejects a file that is not a PNG', () =>
    assert.throws(
      () => validateRasterIndex(rasterIndex(), mapsFolder('notpng', { ...goodFiles(), 'hansen/loss_2001.png': Buffer.alloc(40, 1) })),
      /not a PNG/,
    ))

  it('rejects a PNG whose size differs from the grid', () =>
    assert.throws(
      () => validateRasterIndex(rasterIndex(), mapsFolder('size', { ...goodFiles(), 'hansen/loss_2001.png': pngHeader(3, 2) })),
      /does not match the grid/,
    ))

  it('rejects grid rows and cols that do not match the bounds', () => {
    const index = rasterIndex()
    index.grid.rows = 5
    assert.throws(() => validateRasterIndex(index, mapsFolder('rows', goodFiles())), /do not match the bounds/)
  })

  it('rejects urls that leave the maps folder, bad frame keys and bad encodings', () => {
    const dir = mapsFolder('urls', goodFiles())
    const outside = rasterIndex()
    outside.layers[0].frames[0].url = '/data/maps/../secret.png'
    assert.throws(() => validateRasterIndex(outside, dir), /url must start/)
    const key = rasterIndex()
    key.layers[0].frames[0].key = '2001-H3'
    assert.throws(() => validateRasterIndex(key, dir), /key must be/)
    const encoding = rasterIndex()
    encoding.layers[0].encoding = 'linear' as 'percent'
    assert.throws(() => validateRasterIndex(encoding, dir), /encoding/)
  })
})

describe('mapRasterIndex', () => {
  const raw = {
    grid: { lat_min: -21, lat_max: 10.5, lon_min: -80, lon_max: -43, step_deg: 0.05, row0: 'north', col0: 'west', nodata: 255, rows: 630, cols: 740 },
    layers: {
      hansen_treecover2000: { source: 'HANSEN', doi: 'd', encoding: 'percent' as const, files: { '2000': 'hansen/treecover2000.png' } },
      hansen_tree_cover: {
        source: 'HANSEN',
        doi: 'd',
        encoding: 'percent' as const,
        period: 'end of year',
        files: { '2002': 'hansen/tree_cover_2002.png', '2001': 'hansen/tree_cover_2001.png' },
      },
      burned: {
        source: 'MCD64A1',
        doi: 'd2',
        encoding: 'sqrt_share' as const,
        files: { '2026-H2': 'burned/2026-H2.png', '2026-H1': 'burned/2026-H1.png' },
        n_months: { '2026-H1': 6, '2026-H2': 3 },
      },
    },
  }

  it('converts the grid to camelCase', () => {
    const { grid } = mapRasterIndex(raw)
    assert.deepEqual([grid.west, grid.south, grid.east, grid.north, grid.stepDeg, grid.rows, grid.cols], [-80, -21, -43, 10.5, 0.05, 630, 740])
  })

  it('merges hansen_treecover2000 as frame "2000" of hansen_tree_cover, in order', () => {
    const { layers } = mapRasterIndex(raw)
    assert.deepEqual(layers.map((l) => l.id), ['hansen_tree_cover', 'burned'])
    assert.deepEqual(
      layers[0].frames.map((f) => [f.key, f.url]),
      [
        ['2000', '/data/maps/hansen/treecover2000.png'],
        ['2001', '/data/maps/hansen/tree_cover_2001.png'],
        ['2002', '/data/maps/hansen/tree_cover_2002.png'],
      ],
    )
  })

  it('carries nMonths of the burned half-years', () => {
    const burned = mapRasterIndex(raw).layers.find((l) => l.id === 'burned')
    assert.deepEqual(burned?.frames.map((f) => [f.key, f.nMonths]), [['2026-H1', 6], ['2026-H2', 3]])
  })

  it('keeps hansen_treecover2000 as its own layer when there is nothing to merge it into', () => {
    const { layers } = mapRasterIndex({ ...raw, layers: { hansen_treecover2000: raw.layers.hansen_treecover2000 } })
    assert.deepEqual(layers.map((l) => l.id), ['hansen_treecover2000'])
  })

  it('rejects an index whose rows do not start at the north', () =>
    assert.throws(() => mapRasterIndex({ ...raw, grid: { ...raw.grid, row0: 'south' } }), /row0/))
})
