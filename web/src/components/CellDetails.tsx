// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.

import type { CellTrend, Variable } from '../../shared/contracts.ts'
import { useCellSeries } from '../hooks/useSignoData.ts'
import { formatCoordinates, formatPValue, formatSlope } from '../lib/format.ts'
import { SeriesChart } from './SeriesChart.tsx'

export function CellDetails({ cell, variable }: { cell: CellTrend; variable: Variable }) {
  const series = useCellSeries(variable.id, cell.cellId)
  return (
    <section className="details" aria-live="polite">
      <h3>Area at {formatCoordinates(cell.lat, cell.lon)}</h3>
      <p>
        <strong>{formatSlope(cell.slopePerDecade, variable.units)}</strong> · {formatPValue(cell.pValue)} ·{' '}
        {cell.significant ? 'significant change' : 'not significant: could be noise'} · {cell.validMonths} valid
        months
      </p>
      {series.loading && <p className="muted">Loading monthly values…</p>}
      {series.error && <p className="error">{series.error}</p>}
      {series.data && <SeriesChart series={series.data} variable={variable} />}
    </section>
  )
}
