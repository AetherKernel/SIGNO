// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Top bar: case name, sample-data notice, and the actions that work from anywhere (method, sources, raw data,
// presentation mode). On phones, "Case file" jumps to the controls under the map.

import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { Manifest, Period } from '../../shared/contracts.ts'
import { formatYears } from '../lib/format.ts'
import { DataStatusBanner } from './DataStatusBanner.tsx'

export type DrawerTab = 'method' | 'sources' | 'limits'

interface Props {
  manifest: Manifest | null
  period: Period | null
  present: boolean
  onTogglePresent: () => void
  onOpenDrawer: (tab: DrawerTab) => void
}

export function TopBar({ manifest, period, present, onTogglePresent, onOpenDrawer }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <h1 className="logo">SIGNO</h1>
        <span className="case-title">
          Open case · {manifest?.region.name.replace(/\s*\(.*\)$/, '') ?? 'Amazon'} greenness and heat
          {period ? `, ${formatYears(period)}` : ''}
        </span>
      </div>
      {manifest && <DataStatusBanner status={manifest.dataStatus} />}
      <nav className="topnav" aria-label="Case tools">
        <a className="btn ghost only-mobile" href="#case-file">
          Case file
        </a>
        <button type="button" className="btn ghost" onClick={() => onOpenDrawer('method')}>
          Method
        </button>
        <button type="button" className="btn ghost" onClick={() => onOpenDrawer('sources')}>
          Sources
        </button>
        <a className="btn ghost" href={`${API_BASE_PATH}/${apiPaths.manifest()}`} target="_blank" rel="noreferrer">
          Data
        </a>
        <button type="button" className="btn ghost" aria-pressed={present} onClick={onTogglePresent}>
          Present
        </button>
      </nav>
    </header>
  )
}
