// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The case brief shown over the map on a first visit: the team's question, the period and three counts.
// The question is the team's problem statement (.ai-context/01-logic.md); the counts come from the backend summary.

import { useEffect } from 'react'
import type { DataStatus, TrendLayer } from '../../shared/contracts.ts'
import { formatYears } from '../lib/format.ts'

interface Props {
  layer: TrendLayer | null
  dataStatus: DataStatus
  onClose: () => void
}

export function CaseBrief({ layer, dataStatus, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section className="map-overlay brief" aria-labelledby="brief-title">
      <span className="kicker">Open case · Amazon{layer ? `, ${formatYears(layer.period)}` : ''}</span>
      <h2 id="brief-title">Where is the Amazon losing greenness and warming, and is it more than noise?</h2>
      <p className="small muted">
        Monthly NASA satellite data on a grid of {layer ? `${layer.cellSizeDeg}°` : ''} cells. Each cell carries a trend
        and a significance verdict. Open any cell to see the evidence behind it.
      </p>
      {layer && (
        <dl className="brief-stats">
          <div className="stat">
            <dt>Cells</dt>
            <dd>{layer.summary.cellsTotal}</dd>
          </div>
          <div className="stat">
            <dt>Significant</dt>
            <dd>{layer.summary.cellsSignificant}</dd>
          </div>
          <div className="stat">
            <dt>Decreasing</dt>
            <dd>{layer.summary.significantDecreasing}</dd>
          </div>
        </dl>
      )}
      {dataStatus === 'mock' && (
        <p className="small" style={{ color: 'var(--warn)' }}>
          These are synthetic sample values while the team processes the NASA data.
        </p>
      )}
      <button type="button" className="btn primary" style={{ justifySelf: 'start' }} onClick={onClose}>
        Open the map
      </button>
    </section>
  )
}
