// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Method & sources view (?view=method): how the verdict is reached, where every number comes from, and what the
// data cannot say. It is the former drawer (Method, Sources, Limits tabs) as one reading page. Everything shown comes
// from the API (method, products, region) or from the team's decisions in .ai-context/01-logic.md. The statistical
// method is the team's (P-002): this page never describes a method the data does not state.

import { useEffect } from 'react'
import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { Manifest } from '../../shared/contracts.ts'
import { useTrendLayer } from '../hooks/useSignoData.ts'
import { formatPeriod, formatYears, isTrendTestPending } from '../lib/format.ts'

export interface MethodViewProps {
  manifest: Manifest
  /** Plain-language method of the cover trends (CoverLayer.trendMethod), when the cover layer is loaded. */
  coverTrendMethod: string | null
}

export function MethodView({ manifest, coverTrendMethod }: MethodViewProps) {
  const layer = useTrendLayer(manifest.variables[0]?.id ?? null).data
  const firstVariable = manifest.variables[0]
  const hasCover = manifest.extras.cover
  const testPending = layer ? isTrendTestPending(layer) : false
  const cellSize = layer ? `${layer.cellSizeDeg}°` : '1°'

  // Scroll to the anchor of the link ("#trend-test") once the page is on screen.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [layer])

  return (
    <div className="page page-method">
      <h1>Method and sources</h1>
      <nav className="page-toc" aria-label="On this page">
        <a href="#trend-test">How the verdict is reached</a>
        <a href="#sources">Sources</a>
        <a href="#limits">Limits</a>
      </nav>

      <section id="trend-test" className="page-section" aria-labelledby="h-method">
        <h2 id="h-method">How the verdict is reached</h2>
        <dl className="facts">
          <div>
            <dt>Method</dt>
            <dd>{layer?.method.name ?? 'Loading…'}</dd>
          </div>
          <div>
            <dt>Description{firstVariable ? ` (for ${firstVariable.name})` : ''}</dt>
            <dd>{layer?.method.description ?? '…'}</dd>
          </div>
          <div>
            <dt>Years tested, by variable</dt>
            <dd>
              {manifest.variables
                .map((v) => `${v.name}: ${v.trendYears ? `${v.trendYears.start}–${v.trendYears.end}` : formatYears(v.period)}`)
                .join('; ')}
              . The description above is the one published for {firstVariable?.name ?? 'the first variable'}; the other variables
              use the same test on their own years.
            </dd>
          </div>
          {!testPending && (
            <>
              <div>
                <dt>Significance level</dt>
                <dd className="mono">α = {layer?.method.alpha ?? '…'}</dd>
              </div>
              <div>
                <dt>What “significant” means here</dt>
                <dd>
                  Each square carries a verdict decided by the team’s method, including the correction for testing many
                  squares at once (false discovery rate). The map shows that verdict as it is; this site never
                  recomputes it.
                </dd>
              </div>
            </>
          )}
          {coverTrendMethod && (
            <div>
              <dt>Tree cover loss and MODIS tree cover</dt>
              <dd>{coverTrendMethod}</dd>
            </div>
          )}
          <div>
            <dt>Status</dt>
            <dd>
              {manifest.dataStatus === 'mock' ? 'Sample data (synthetic). ' : 'Real NASA data (pipeline export). '}
              {testPending ? 'The statistical test has not been applied to this export yet.' : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section id="sources" className="page-section" aria-labelledby="h-sources">
        <h2 id="h-sources">Sources</h2>
        <div className="sources-list">
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
          {hasCover && (
            <>
              <div className="source">
                <strong>Tree cover and loss (Hansen)</strong>
                <span className="mono small">Global Forest Change · Hansen/UMD/Google/USGS/NASA · Landsat 30 m</span>
                <span className="small muted">
                  Hansen et al. 2013, Science 342, 850–853. Canopy of 2000 minus canopy lost since 2001; regrowth is not
                  counted.
                </span>
                <a className="small" href="https://doi.org/10.1126/science.1244693">
                  doi:10.1126/science.1244693
                </a>
              </div>
              <div className="source">
                <strong>Tree cover, independent check (MODIS)</strong>
                <span className="mono small">MOD44B v061 · LP DAAC · satellite observation · 250 m</span>
                <span className="small muted">Vegetation Continuous Fields, yearly. Product year Y runs March Y to March Y+1.</span>
                <a className="small" href="https://doi.org/10.5067/MODIS/MOD44B.061">
                  doi:10.5067/MODIS/MOD44B.061
                </a>
              </div>
            </>
          )}
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
            <strong>Country borders</strong>
            <span className="small">
              Borders: <a href="https://www.naturalearthdata.com">Natural Earth</a> (public domain)
            </span>
            <span className="small muted">Drawn for orientation only. They are not part of the analysed data.</span>
          </div>
          <div className="source">
            <strong>Base map</strong>
            <span className="small">NASA GIBS imagery (Blue Marble, MODIS true color, MODIS NDVI)</span>
            <span className="small muted">
              Imagery from NASA GIBS, part of NASA EOSDIS. Context only: it is not the analysed data.
            </span>
          </div>
          <div className="source">
            <strong>Data (API)</strong>
            <a className="small" href={`${API_BASE_PATH}/${apiPaths.manifest()}`} target="_blank" rel="noreferrer">
              {API_BASE_PATH}/{apiPaths.manifest()}
            </a>
            <span className="small muted">Every number on this site is a file of this API, one per map, series or report.</span>
          </div>
        </div>
        <p className="small muted">
          Data status: {manifest.dataStatus === 'mock' ? 'synthetic sample data' : 'produced by the team pipeline'} ·
          generated {manifest.generatedAt.slice(0, 10)}
        </p>
      </section>

      <section id="limits" className="page-section" aria-labelledby="h-limits">
        <h2 id="h-limits">Limits</h2>
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
              Trends are computed on {cellSize} squares. Zooming the base map does not add detail to the trends.
            </dd>
          </div>
          {hasCover && (
            <>
              <div>
                <dt>Loss is not deforestation</dt>
                <dd>
                  Hansen tree cover loss is stand-replacing loss of canopy: fire, logging, mining and clearing. The data
                  do not say which cause acted in a place.
                </dd>
              </div>
              <div>
                <dt>Same place is not the same cause</dt>
                <dd>Loss and burned area in the same square show where the two coincide, not that one caused the other.</dd>
              </div>
              <div>
                <dt>Two sources, two levels</dt>
                <dd>
                  MODIS reads about 22 points lower than Hansen over dense forest and is noisier from year to year (1–2
                  points per zone). Use it to confirm where tree cover changed, not how much there is. Years flagged as
                  suspect are drawn hollow and noted next to the charts.
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>One region, borders for orientation</dt>
            <dd>
              The Amazon is treated as one natural region, across the nine countries it spans. Country borders are drawn
              for orientation only.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
