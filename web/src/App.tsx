// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Single route ("/"). View state (variable, selected cell) lives in the query string via useUrlParam.
// Data comes only from hooks (src/hooks) → service (src/services) → API v1 (published by server/).

import { useState } from 'react'
import { CellDetails } from './components/CellDetails.tsx'
import { DataStatusBanner } from './components/DataStatusBanner.tsx'
import { TrendMap } from './components/TrendMap.tsx'
import { TrendSummaryPanel } from './components/TrendSummaryPanel.tsx'
import { VariablePicker } from './components/VariablePicker.tsx'
import { useManifest, useTrendLayer } from './hooks/useSignoData.ts'
import { useUrlParam } from './hooks/useUrlParam.ts'

function App() {
  const manifest = useManifest()
  const [variableParam, setVariableParam] = useUrlParam('variable')
  const [cellParam, setCellParam] = useUrlParam('cell')
  const [hideNonSignificant, setHideNonSignificant] = useState(false)

  const variables = manifest.data?.variables ?? []
  const variable = variables.find((v) => v.id === variableParam) ?? variables[0] ?? null
  const layer = useTrendLayer(variable?.id ?? null)
  const cell = layer.data?.cells.find((c) => c.cellId === cellParam) ?? null

  const chooseVariable = (variableId: string) => {
    setVariableParam(variableId)
    setCellParam(null)
  }

  return (
    <main className="page">
      <header>
        <p className="eyebrow">NASA Space Apps Challenge 2026 · Be An Earth System Trend Detective!</p>
        <h1>SIGNO</h1>
        <p className="lead">
          Is the Amazon forest really losing greenness and warming, or is it just noise? Pick a variable, look at the
          map, and open any area to see the monthly data behind it.
        </p>
      </header>

      {manifest.loading && <p className="muted">Loading…</p>}
      {manifest.error && <p className="error">{manifest.error}</p>}

      {manifest.data && variable && (
        <>
          <DataStatusBanner status={manifest.data.dataStatus} />
          <VariablePicker variables={variables} value={variable.id} onChange={chooseVariable} />

          <section className="results">
            <div className="results-head">
              <h2>2. Where is it changing? · {variable.name}</h2>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={hideNonSignificant}
                  onChange={(event) => setHideNonSignificant(event.target.checked)}
                />
                Show only significant changes
              </label>
            </div>
            {layer.loading && <p className="muted">Loading map…</p>}
            {layer.error && <p className="error">{layer.error}</p>}
            {layer.data && (
              <>
                <TrendMap
                  layer={layer.data}
                  region={manifest.data.region}
                  variable={variable}
                  selectedCellId={cell?.cellId ?? null}
                  hideNonSignificant={hideNonSignificant}
                  onSelect={setCellParam}
                />
                <TrendSummaryPanel layer={layer.data} />
              </>
            )}
          </section>

          <section className="results">
            <h2>3. What happened in one area?</h2>
            {cell ? (
              <CellDetails cell={cell} variable={variable} />
            ) : (
              <p className="muted">Select an area on the map to see its monthly values.</p>
            )}
          </section>
        </>
      )}

      <footer className="muted">
        Team AETHER · Data: NASA Earthdata ·{' '}
        <a href="https://github.com/AetherKernel/SIGNO">Source code on GitHub</a>
      </footer>
    </main>
  )
}

export default App
