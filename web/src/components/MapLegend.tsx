// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Legend of the map, one per map type. The title is a sentence with its units; below it one swatch row, end labels and
// the extra keys (no data, none, dotted). Colour is never the only cue: the labels, the dots and the hatch carry the
// meaning too. `compact` is the phone version: the swatch row and its end labels only.

import { useId, type ReactNode } from 'react'
import { BURNED_BREAKS, COVER_BREAKS, COVER_CLASSES, LOSS_BREAKS } from '../lib/cover.ts'
import { formatSigned, legendBreaks, SLOPE_CLASSES } from '../lib/format.ts'
import type { MapType } from '../lib/viewState.ts'
import { ViewLink } from './ViewLink.tsx'

export interface TrendLegendInfo {
  /** Display name of the measure, e.g. "Vegetation greenness (NDVI)". */
  name: string
  /** Units of the slope, already "per decade" (Variable.slopeUnits). */
  slopeUnits: string
  /** Largest |slope|: the classes are symmetric around zero. */
  maxAbs: number
  /** The trend test has no result for any square. */
  pending: boolean
}

interface Props {
  mapType: MapType
  year: number
  trend: TrendLegendInfo | null
  compact?: boolean
}

const SWATCH = { width: 28, height: 18 }

function Hatch() {
  return (
    <svg {...SWATCH} aria-hidden="true">
      <rect {...SWATCH} fill="none" style={{ stroke: 'var(--line)' }} />
      {[-6, 2, 10, 18, 26].map((x) => (
        <line key={x} x1={x} y1="18" x2={x + 18} y2="0" strokeWidth="1.4" style={{ stroke: 'var(--cell-empty)' }} />
      ))}
    </svg>
  )
}

function Dotted() {
  return (
    <svg {...SWATCH} aria-hidden="true">
      <rect {...SWATCH} style={{ fill: 'var(--surface)', fillOpacity: 0.55 }} />
      {[5, 14, 23].flatMap((x) => [5, 13].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#fff" stroke="rgb(0 0 0 / 0.5)" strokeWidth="0.5" />))}
    </svg>
  )
}

function Transparent() {
  return (
    <svg {...SWATCH} aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="17" fill="none" strokeDasharray="3 2" style={{ stroke: 'var(--muted)' }} />
    </svg>
  )
}

function Selected() {
  return (
    <svg {...SWATCH} aria-hidden="true">
      <rect x="2" y="2" width="24" height="14" fill="none" strokeWidth="3" style={{ stroke: 'var(--accent)' }} />
    </svg>
  )
}

function Key({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="legend-key">
      {icon}
      {children}
    </div>
  )
}

/** Five colour classes of an amount map, the class labels under them. */
function AmountBar({ prefix, breaks, label }: { prefix: 'loss' | 'burn'; breaks: number[]; label: string }) {
  const names = [`0–${breaks[0]}`, `${breaks[0]}–${breaks[1]}`, `${breaks[1]}–${breaks[2]}`, `${breaks[2]}–${breaks[3]}`, `≥ ${breaks[3]}`]
  return (
    <>
      <div className="legend-bar five" role="img" aria-label={label}>
        {names.map((_, k) => (
          <i key={k} style={{ background: `var(--${prefix}-${k + 1})` }} />
        ))}
      </div>
      <div className="legend-classes" aria-hidden="true">
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </>
  )
}

export function MapLegend({ mapType, year, trend, compact = false }: Props) {
  const titleId = `legend-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (mapType === 'cover') {
    return (
      <section className={compact ? 'legend compact' : 'legend'} aria-labelledby={titleId}>
        <h3 id={titleId} className="legend-title">
          Tree cover in {year} (% of the square)
        </h3>
        <div className="legend-bar" role="img" aria-label={`Six green classes of tree cover: ${COVER_BREAKS.join(', ')} percent of the square`}>
          {Array.from({ length: COVER_CLASSES }, (_, k) => (
            <i key={k} style={{ background: `var(--green-${k})` }} />
          ))}
        </div>
        <div className="legend-ticks" aria-hidden="true">
          {COVER_BREAKS.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </div>
        {!compact && (
          <>
            <Key icon={<Hatch />}>No data</Key>
            <p className="small muted">Hansen counts loss but not regrowth, so this can only go down.</p>
          </>
        )}
      </section>
    )
  }

  if (mapType === 'loss' || mapType === 'burned') {
    const isLoss = mapType === 'loss'
    return (
      <section className={compact ? 'legend compact' : 'legend'} aria-labelledby={titleId}>
        <h3 id={titleId} className="legend-title">
          {isLoss ? `Tree cover lost in ${year}` : `Area burned in ${year}`} (km² per square)
        </h3>
        <AmountBar
          prefix={isLoss ? 'loss' : 'burn'}
          breaks={isLoss ? LOSS_BREAKS : BURNED_BREAKS}
          label={`Five colour classes of ${isLoss ? 'tree cover lost' : 'area burned'}, in square kilometres per square`}
        />
        {!compact && (
          <>
            <Key icon={<Transparent />}>None: transparent</Key>
            <Key icon={<Hatch />}>No data</Key>
            {isLoss && (
              <p className="small muted">Loss includes fire, logging, mining and clearing; it is not only deforestation.</p>
            )}
          </>
        )}
      </section>
    )
  }

  // Trend
  const maxAbs = trend?.maxAbs ?? 0
  const breaks = legendBreaks(maxAbs)
  const name = trend?.name ?? 'the measure'
  const units = trend?.slopeUnits ?? 'per decade'
  return (
    <section className={compact ? 'legend compact' : 'legend'} aria-labelledby={titleId}>
      <h3 id={titleId} className="legend-title">
        Change per decade, {name}
        {trend ? ` (${units})` : ''}
      </h3>
      <div className="legend-ends">
        <span>Falling</span>
        <span>Rising</span>
      </div>
      <div
        className="legend-bar"
        role="img"
        aria-label={`Six colour classes from ${formatSigned(-maxAbs)} to ${formatSigned(maxAbs)} ${units}: orange falls, purple rises`}
      >
        {Array.from({ length: SLOPE_CLASSES }, (_, k) => (
          <i key={k} style={{ background: `var(--puor-${k})` }} />
        ))}
      </div>
      <div className="legend-ticks" aria-hidden="true">
        <span>{formatSigned(breaks[0])}</span>
        <span>0</span>
        <span>{formatSigned(breaks[SLOPE_CLASSES])}</span>
      </div>
      {!compact && (
        <>
          {!trend?.pending && <Key icon={<Dotted />}>Dotted: no significant trend</Key>}
          <Key icon={<Hatch />}>Hatched: not tested</Key>
          <p className="small muted">
            Mann-Kendall test on yearly values, false discovery rate 5 %.{' '}
            <ViewLink view="method" hash="trend-test">
              How the test works
            </ViewLink>
          </p>
        </>
      )}
    </section>
  )
}

/** The "outlined: the area you opened" key, shown once under the legend. */
export function SelectedKey() {
  return <Key icon={<Selected />}>Outlined: the area you opened</Key>
}
