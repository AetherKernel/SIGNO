// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Grid map of trend results (simple equirectangular projection over the region's bounding box). Colour = direction
// and size of the change; full colour = significant (as decided by the backend data), faded = not significant.

import type { KeyboardEvent } from 'react'
import type { CellTrend, Region, TrendLayer, Variable } from '../../shared/contracts.ts'
import { formatCoordinates, formatPValue, formatSlope, slopeColor } from '../lib/format.ts'

interface Props {
  layer: TrendLayer
  region: Region
  variable: Variable
  selectedCellId: string | null
  hideNonSignificant: boolean
  onSelect: (cellId: string) => void
}

const WIDTH = 720

export function TrendMap({ layer, region, variable, selectedCellId, hideNonSignificant, onSelect }: Props) {
  const [west, south, east, north] = region.bbox
  const scale = WIDTH / (east - west)
  const height = (north - south) * scale
  const size = layer.cellSizeDeg * scale
  const maxAbs = Math.max(0, ...layer.cells.map((c) => Math.abs(c.slopePerDecade ?? 0)))

  const label = (cell: CellTrend) =>
    `${formatCoordinates(cell.lat, cell.lon)}: ${formatSlope(cell.slopePerDecade, variable.units)}, ` +
    `${formatPValue(cell.pValue)}, ${cell.significant ? 'significant' : 'not significant'}`

  const onKey = (event: KeyboardEvent, cellId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(cellId)
    }
  }

  return (
    <figure className="map">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={`Trend map of ${variable.name}`}>
        {layer.cells.map((cell) => {
          const x = (cell.lon - layer.cellSizeDeg / 2 - west) * scale
          const y = (north - (cell.lat + layer.cellSizeDeg / 2)) * scale
          const hidden = hideNonSignificant && !cell.significant
          return (
            <rect
              key={cell.cellId}
              x={x}
              y={y}
              width={size}
              height={size}
              className={[
                'cell',
                cell.significant ? 'significant' : 'not-significant',
                cell.cellId === selectedCellId ? 'selected' : '',
              ].join(' ')}
              fill={hidden ? 'var(--cell-empty)' : slopeColor(cell.slopePerDecade, maxAbs)}
              role="button"
              tabIndex={0}
              aria-label={label(cell)}
              aria-pressed={cell.cellId === selectedCellId}
              onClick={() => onSelect(cell.cellId)}
              onKeyDown={(event) => onKey(event, cell.cellId)}
            >
              <title>{label(cell)}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="legend">
        <span>
          <i className="swatch decreasing" /> Decreasing
        </span>
        <span>
          <i className="swatch increasing" /> Increasing
        </span>
        <span>
          <i className="swatch faded" /> Not significant
        </span>
        <span className="muted">
          {layer.cellSizeDeg}° cells · {layer.period.start} to {layer.period.end}
        </span>
      </figcaption>
    </figure>
  )
}
