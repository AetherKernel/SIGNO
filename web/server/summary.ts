// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Business logic kept out of the frontend: aggregate counts shown in the summary panel.

import type { CellTrend, TrendSummary } from '../shared/contracts.ts'

export function summarize(cells: CellTrend[]): TrendSummary {
  const significant = cells.filter((c) => c.significant && c.slopePerDecade !== null)
  return {
    cellsTotal: cells.length,
    cellsTested: cells.filter((c) => c.pValue !== null).length,
    cellsSignificant: significant.length,
    significantIncreasing: significant.filter((c) => (c.slopePerDecade as number) > 0).length,
    significantDecreasing: significant.filter((c) => (c.slopePerDecade as number) < 0).length,
  }
}
