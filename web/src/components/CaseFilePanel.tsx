// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "Case file" panel (left): what is on the map. Variable, filters, period comparison, base map and legend,
// like the layer panel of NASA Worldview.

import type { TrendLayer, Variable } from '../../shared/contracts.ts'
import type { Basemap, BasemapId } from '../lib/basemaps.ts'
import { formatPeriod } from '../lib/format.ts'
import type { CellFilter } from '../lib/viewState.ts'
import { MapLegend } from './MapLegend.tsx'
import { TrendSummaryPanel } from './TrendSummaryPanel.tsx'
import { VariablePicker } from './VariablePicker.tsx'

interface Props {
  variables: Variable[]
  variable: Variable
  layer: TrendLayer | null
  layerError: string | null
  filter: CellFilter
  compare: boolean
  basemaps: Basemap[]
  basemap: Basemap
  regionName: string
  onVariable: (variableId: string) => void
  onFilter: (filter: CellFilter) => void
  onCompare: (compare: boolean) => void
  onBasemap: (id: BasemapId) => void
  onOpenMethod: () => void
}

export function CaseFilePanel(props: Props) {
  const { variables, variable, layer, layerError, filter, compare, basemaps, basemap, regionName } = props
  return (
    <aside id="case-file" className="panel case-file" aria-label="Case file">
      <VariablePicker variables={variables} value={variable.id} onChange={props.onVariable} />

      {layerError && <p className="error small">{layerError}</p>}
      {layer && <TrendSummaryPanel layer={layer} filter={filter} onFilter={props.onFilter} />}

      <section className="section" aria-labelledby="compare-title">
        <h2 id="compare-title" className="kicker">
          Time
        </h2>
        <label className="switch">
          <span>Compare two periods in the series</span>
          <input type="checkbox" checked={compare} onChange={(event) => props.onCompare(event.target.checked)} />
        </label>
        <p className="small muted">Record: {formatPeriod(variable.period)}, monthly</p>
      </section>

      <section className="section" aria-labelledby="base-title">
        <h2 id="base-title" className="kicker">
          Base map
        </h2>
        <label className="sr-only" htmlFor="basemap">
          Base map imagery
        </label>
        <select
          id="basemap"
          className="select"
          value={basemap.id}
          onChange={(event) => props.onBasemap(event.target.value as BasemapId)}
        >
          {basemaps.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <p className="small muted">{basemap.note}</p>
      </section>

      {layer && <MapLegend layer={layer} variable={variable} />}

      <section className="section footer-note" aria-label="About this case">
        <span>
          Region: {regionName} · {layer ? `${layer.cellSizeDeg}° cells` : ''}
        </span>
        <span>
          Method: {layer?.method.name ?? '…'} ·{' '}
          <button type="button" className="btn ghost" style={{ minHeight: 0, padding: 0, color: 'var(--accent)' }} onClick={props.onOpenMethod}>
            how the verdict is decided
          </button>
        </span>
        <span>
          NASA Space Apps Challenge 2026 · Team AETHER ·{' '}
          <a href="https://github.com/AetherKernel/SIGNO">Source code</a>
        </span>
      </section>
    </aside>
  )
}
