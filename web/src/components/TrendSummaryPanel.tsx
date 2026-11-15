// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// Summary counts that double as map filters: pressing a count lights only those cells. Counts come from the
// backend's summary (never recomputed here).

import type { TrendLayer } from '../../shared/contracts.ts'
import type { CellFilter } from '../lib/viewState.ts'

interface Props {
  layer: TrendLayer
  filter: CellFilter
  onFilter: (filter: CellFilter) => void
}

export function TrendSummaryPanel({ layer, filter, onFilter }: Props) {
  const { summary } = layer
  const items: { id: CellFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All cells', count: summary.cellsTotal },
    { id: 'significant', label: 'Significant change', count: summary.cellsSignificant },
    { id: 'decreasing', label: 'Significantly decreasing', count: summary.significantDecreasing },
    { id: 'increasing', label: 'Significantly increasing', count: summary.significantIncreasing },
  ]
  return (
    <section className="section" aria-labelledby="filters-title">
      <h2 id="filters-title" className="kicker">
        Show on the map
      </h2>
      <div className="filters">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="filter"
            aria-pressed={filter === item.id}
            onClick={() => onFilter(item.id)}
          >
            <span className="filter-label">{item.label}</span>
            <span className="filter-count">{item.count}</span>
          </button>
        ))}
      </div>
      <p className="small muted">
        {summary.cellsTested} of {summary.cellsTotal} cells tested · significance as decided by the method (α ={' '}
        {layer.method.alpha})
      </p>
    </section>
  )
}
