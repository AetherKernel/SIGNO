// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// Always-visible notice in the top bar while the API serves synthetic data (dataStatus "mock").

import type { DataStatus } from '../../shared/contracts.ts'

export function DataStatusBanner({ status }: { status: DataStatus }) {
  if (status === 'real') return null
  return (
    <p className="status-pill" role="note" title="The map and numbers are synthetic while the team processes NASA data">
      <strong>Sample data</strong>
      <span className="sr-only">: </span> · not real results
    </p>
  )
}
