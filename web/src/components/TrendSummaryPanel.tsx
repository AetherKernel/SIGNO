// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.

import type { TrendLayer } from '../../shared/contracts.ts'

export function TrendSummaryPanel({ layer }: { layer: TrendLayer }) {
  const { summary, method } = layer
  return (
    <section className="summary" aria-label="Summary">
      <dl>
        <div>
          <dt>Areas analysed</dt>
          <dd>{summary.cellsTotal}</dd>
        </div>
        <div>
          <dt>Significant change</dt>
          <dd>{summary.cellsSignificant}</dd>
        </div>
        <div>
          <dt>Significantly decreasing</dt>
          <dd>{summary.significantDecreasing}</dd>
        </div>
        <div>
          <dt>Significantly increasing</dt>
          <dd>{summary.significantIncreasing}</dd>
        </div>
      </dl>
      <p className="muted">
        Method: {method.name} (α = {method.alpha}). {method.description}
      </p>
    </section>
  )
}
