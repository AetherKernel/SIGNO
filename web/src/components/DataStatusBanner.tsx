// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.

import type { DataStatus } from '../../shared/contracts.ts'

export function DataStatusBanner({ status }: { status: DataStatus }) {
  if (status === 'real') return null
  return (
    <p className="banner" role="note">
      <strong>Sample data.</strong> This preview shows synthetic data while the team processes the NASA datasets. The
      map and numbers are not real results yet.
    </p>
  )
}
