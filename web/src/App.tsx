// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// One working screen (the journey approved by José on 2026-11-14): top bar, "Case file" panel, map, "Area file" panel.
// View state lives in the query string (?variable=&cell=&filter=&z=&lat=&lon=&base=&compare=) so any view is a link.
// Data comes only from hooks (src/hooks) → service (src/services) → API v1 (published by server/).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TrendLayer } from '../shared/contracts.ts'
import { CaseBrief } from './components/CaseBrief.tsx'
import { CaseFilePanel } from './components/CaseFilePanel.tsx'
import { CellDetails } from './components/CellDetails.tsx'
import { MethodDrawer } from './components/MethodDrawer.tsx'
import { TopBar, type DrawerTab } from './components/TopBar.tsx'
import { TrendMap } from './components/TrendMap.tsx'
import { useManifest, useTrendLayer } from './hooks/useSignoData.ts'
import { useUrlParam } from './hooks/useUrlParam.ts'
import { basemaps as listBasemaps, isBasemapId } from './lib/basemaps.ts'
import { parseFilter, parseView, type CellFilter, type MapView } from './lib/viewState.ts'

function App() {
  const manifest = useManifest()
  const [variableParam, setVariableParam] = useUrlParam('variable')
  const [cellParam, setCellParam] = useUrlParam('cell')
  const [filterParam, setFilterParam] = useUrlParam('filter')
  const [baseParam, setBaseParam] = useUrlParam('base')
  const [compareParam, setCompareParam] = useUrlParam('compare')
  const [zParam, setZParam] = useUrlParam('z')
  const [latParam, setLatParam] = useUrlParam('lat')
  const [lonParam, setLonParam] = useUrlParam('lon')

  // Read once: the map only uses the URL view to start; afterwards the map owns its view and writes it back.
  const [initialView] = useState<MapView | null>(() => parseView(zParam, latParam, lonParam))
  const [briefOpen, setBriefOpen] = useState(() => !variableParam && !cellParam)
  const [drawer, setDrawer] = useState<{ open: boolean; tab: DrawerTab }>({ open: false, tab: 'method' })
  const [present, setPresent] = useState(false)

  const basemaps = useMemo(() => listBasemaps(), [])
  const basemap = basemaps.find((b) => b.id === (isBasemapId(baseParam) ? baseParam : 'bluemarble')) ?? basemaps[0]
  const filter = parseFilter(filterParam)
  const compare = compareParam === '1'

  const variables = manifest.data?.variables ?? []
  const variable = variables.find((v) => v.id === variableParam) ?? variables[0] ?? null
  const layer = useTrendLayer(variable?.id ?? null)
  // Keep showing the previous layer while the next one loads, so the map (and its zoom) is never torn down.
  const [lastLayer, setLastLayer] = useState<TrendLayer | null>(null)
  if (layer.data && layer.data !== lastLayer) setLastLayer(layer.data)
  const shownLayer = layer.data ?? lastLayer
  const cell = shownLayer?.cells.find((c) => c.cellId === cellParam) ?? null

  useEffect(() => {
    document.documentElement.classList.toggle('present', present)
  }, [present])

  const closeBrief = useCallback(() => setBriefOpen(false), [])
  const openDrawer = (tab: DrawerTab) => setDrawer({ open: true, tab })

  // The selected area is kept when the variable changes, so greenness and temperature can be compared in one place.
  const chooseVariable = (variableId: string) => {
    setVariableParam(variableId)
    setBriefOpen(false)
  }
  const chooseFilter = (next: CellFilter) => setFilterParam(next === 'all' ? null : next)
  const chooseCell = (cellId: string) => {
    setCellParam(cellId)
    setBriefOpen(false)
  }
  const onViewChange = useCallback(
    (view: MapView) => {
      setZParam(String(Number(view.zoom.toFixed(1))))
      setLatParam(view.lat.toFixed(2))
      setLonParam(view.lon.toFixed(2))
    },
    [setZParam, setLatParam, setLonParam],
  )

  const period = shownLayer?.period ?? variable?.period ?? null

  return (
    <div className="app">
      <TopBar
        manifest={manifest.data}
        period={period}
        present={present}
        onTogglePresent={() => setPresent((p) => !p)}
        onOpenDrawer={openDrawer}
      />

      {manifest.loading && <p className="muted" style={{ padding: 24 }}>Loading the case…</p>}
      {manifest.error && (
        <p className="error" style={{ padding: 24 }}>
          {manifest.error}
        </p>
      )}

      {manifest.data && variable && (
        <main className={cell ? 'workspace with-area' : 'workspace'}>
          <CaseFilePanel
            variables={variables}
            variable={variable}
            layer={shownLayer}
            layerError={layer.error}
            filter={filter}
            compare={compare}
            basemaps={basemaps}
            basemap={basemap}
            regionName={manifest.data.region.name}
            onVariable={chooseVariable}
            onFilter={chooseFilter}
            onCompare={(on) => setCompareParam(on ? '1' : null)}
            onBasemap={(id) => setBaseParam(id === 'bluemarble' ? null : id)}
            onOpenMethod={() => openDrawer('method')}
          />

          <div className="map-wrap">
            {shownLayer ? (
              <TrendMap
                layer={shownLayer}
                region={manifest.data.region}
                variable={variable}
                basemap={basemap}
                filter={filter}
                selectedCellId={cell?.cellId ?? null}
                initialView={initialView}
                onSelect={chooseCell}
                onViewChange={onViewChange}
              />
            ) : (
              <p className="map-overlay map-status">{layer.error ?? 'Loading the trend map…'}</p>
            )}
            {briefOpen && <CaseBrief layer={shownLayer} dataStatus={manifest.data.dataStatus} onClose={closeBrief} />}
          </div>

          {cell && shownLayer && (
            <CellDetails
              cell={cell}
              variable={variable}
              layer={shownLayer}
              compare={compare}
              onClose={() => setCellParam(null)}
              onOpenMethod={() => openDrawer('method')}
            />
          )}

          <MethodDrawer
            open={drawer.open}
            tab={drawer.tab}
            manifest={manifest.data}
            layer={shownLayer}
            basemap={basemap}
            onTab={(tab) => setDrawer({ open: true, tab })}
            onClose={() => setDrawer((d) => ({ ...d, open: false }))}
          />
        </main>
      )}
    </div>
  )
}

export default App
