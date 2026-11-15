// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Builds the per-cell files of API v1 (cells/{cellId}.json): for one cell, each variable's yearly values (already
// computed by the backend) and the cell's row of that variable's trend layer.
// It only regroups values that buildApi already validated and publishes elsewhere; it computes nothing new.

import { API_VERSION } from '../shared/contracts.ts'
import type { CellBundle, CellBundleVariable, CellSeries, CellTrend, DataStatus } from '../shared/contracts.ts'

/** Collects the per-variable parts while buildApi walks the variables, then returns one bundle per cell. */
export class CellBundleCollector {
  private readonly cells = new Map<string, Record<string, CellBundleVariable>>()

  /** Add one variable's series for one cell, with that cell's row of the variable's trend layer (or null). */
  add(series: CellSeries, trend: CellTrend | null): void {
    const variables = this.cells.get(series.cellId) ?? {}
    // Yearly values only: the monthly points stay in the series file, which the viewer loads on demand.
    variables[series.variableId] = { units: series.units, annual: series.annual, trend }
    this.cells.set(series.cellId, variables)
  }

  /** One bundle per cell. Variables follow `variableOrder` (the manifest order); unknown ids go last. */
  bundles(dataStatus: DataStatus, variableOrder: string[]): CellBundle[] {
    const rank = (id: string) => {
      const i = variableOrder.indexOf(id)
      return i < 0 ? variableOrder.length : i
    }
    return [...this.cells.entries()].map(([cellId, variables]) => ({
      apiVersion: API_VERSION,
      cellId,
      dataStatus,
      variables: Object.fromEntries(Object.entries(variables).sort(([a], [b]) => rank(a) - rank(b))),
    }))
  }
}
