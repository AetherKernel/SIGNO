// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Method, sources and limits in a side drawer (native <dialog>: focus stays inside, Escape closes it). Everything
// shown comes from the API (method, products, region) or from the team's decisions in .ai-context/01-logic.md.
// The statistical method is the team's decision (P-002): this drawer never describes a method the data does not state.

import { useEffect, useRef } from 'react'
import type { Manifest, TrendLayer } from '../../shared/contracts.ts'
import type { Basemap } from '../lib/basemaps.ts'
import { formatPeriod } from '../lib/format.ts'
import type { DrawerTab } from './TopBar.tsx'

interface Props {
  open: boolean
  tab: DrawerTab
  manifest: Manifest
  layer: TrendLayer | null
  basemap: Basemap
  onTab: (tab: DrawerTab) => void
  onClose: () => void
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'method', label: 'Method' },
  { id: 'sources', label: 'Sources' },
  { id: 'limits', label: 'Limits' },
]

export function MethodDrawer({ open, tab, manifest, layer, basemap, onTab, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="drawer-title" onClose={onClose}>
      <div className="drawer-inner">
        <div className="drawer-head">
          <div>
            <span className="kicker">Case file</span>
            <h2 id="drawer-title">How the verdict is reached</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="Method, sources and limits">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'method' && (
          <section id="panel-method" role="tabpanel" aria-labelledby="tab-method">
            <dl className="facts">
              <div>
                <dt>Method</dt>
                <dd>{layer?.method.name ?? 'Loading…'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{layer?.method.description ?? '…'}</dd>
              </div>
              <div>
                <dt>Significance level</dt>
                <dd className="mono">α = {layer?.method.alpha ?? '…'}</dd>
              </div>
              <div>
                <dt>What “significant” means here</dt>
                <dd>
                  Each cell carries a verdict decided by the team’s method, including any correction for testing many
                  cells at once. The map shows that verdict as it is; this site never recomputes it.
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>The statistical test is still being decided by the team. Until then the values are synthetic.</dd>
              </div>
            </dl>
          </section>
        )}

        {tab === 'sources' && (
          <section id="panel-sources" role="tabpanel" aria-labelledby="tab-sources" style={{ display: 'grid', gap: 12 }}>
            {manifest.variables.map((v) => (
              <div key={v.id} className="source">
                <strong>{v.name}</strong>
                <span className="mono small">
                  {v.product.shortName} v{v.product.version} · {v.product.provider} ·{' '}
                  {v.product.kind === 'satellite' ? 'satellite observation' : 'model output'}
                </span>
                <span className="small muted">
                  {formatPeriod(v.period)}, {v.temporalResolution}
                </span>
                {v.product.doi && (
                  <a className="small" href={`https://doi.org/${v.product.doi}`}>
                    doi:{v.product.doi}
                  </a>
                )}
              </div>
            ))}
            <div className="source">
              <strong>Region</strong>
              <span className="small">
                {manifest.region.name} · bounding box {manifest.region.bbox.join(', ')}
              </span>
              <span className="small muted">
                Boundary source: {manifest.region.boundarySource ?? 'pending team decision (P-008)'}
              </span>
            </div>
            <div className="source">
              <strong>Base map</strong>
              <span className="small">{basemap.url ? basemap.label : 'No imagery selected'}</span>
              <span className="small muted">
                Imagery from NASA GIBS, part of NASA EOSDIS. Context only: it is not the analysed data.
              </span>
            </div>
            <p className="small muted">
              Data status: {manifest.dataStatus === 'mock' ? 'synthetic sample data' : 'produced by the team pipeline'} ·
              generated {manifest.generatedAt.slice(0, 10)}
            </p>
          </section>
        )}

        {tab === 'limits' && (
          <section id="panel-limits" role="tabpanel" aria-labelledby="tab-limits">
            <dl className="facts">
              <div>
                <dt>Where to look, not why</dt>
                <dd>
                  A downward trend in greenness shows where to look. It does not prove deforestation, and it does not
                  establish a cause.
                </dd>
              </div>
              <div>
                <dt>Resolution</dt>
                <dd>
                  Trends are computed on {layer ? `${layer.cellSizeDeg}°` : 'coarse'} cells. Zooming the base map does
                  not add detail to the trends.
                </dd>
              </div>
              <div>
                <dt>One region, no borders</dt>
                <dd>The Amazon is treated as one natural region, across the nine countries it spans.</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </dialog>
  )
}
