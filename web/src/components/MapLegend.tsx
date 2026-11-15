// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15; clipped trend ends ("≤", "≥") and the real
// range of the coloured squares added 2026-11-15. Reviewed and owned by team AETHER.
//
// Legend of the map, one per map type. The title is a sentence with its units; below it one swatch row, end labels and
// the extra keys (no data, none, dotted). Colour is never the only cue: the labels, the dots and the hatch carry the
// meaning too. `compact` is the phone version: the swatch row and its end labels only.

import { useId, type ReactNode } from 'react'
import { BURNED_BREAKS, COVER_BREAKS, COVER_CLASSES, LOSS_BREAKS } from '../lib/cover.ts'
import { formatSigned, legendBreaks, slopeUnitsLabel, SLOPE_CLASSES } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'
import type { MapType } from '../lib/viewState.ts'
import { ViewLink } from './ViewLink.tsx'

export interface TrendLegendInfo {
  /** Display name of the measure, e.g. "Vegetation greenness (NDVI)". */
  name: string
  /** Units of the slope, already "per decade" (Variable.slopeUnits). */
  slopeUnits: string
  /** End of the colour scale (90th percentile of |significant slopes|): the classes are symmetric around zero. */
  maxAbs: number
  /** Real lowest and highest slope of the coloured squares; slopes beyond ±maxAbs take the end colour. */
  range: { min: number; max: number } | null
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
  const { t } = useLang()
  const titleId = `legend-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (mapType === 'cover') {
    return (
      <section className={compact ? 'legend compact' : 'legend'} aria-labelledby={titleId}>
        <h3 id={titleId} className="legend-title">
          {t(`Tree cover in ${year} (% of the square)`, `Cobertura arbórea en ${year} (% del cuadro)`)}
        </h3>
        <div
          className="legend-bar"
          role="img"
          aria-label={t(
            `Six green classes of tree cover: ${COVER_BREAKS.join(', ')} percent of the square`,
            `Seis clases verdes de cobertura: ${COVER_BREAKS.join(', ')} por ciento del cuadro`,
          )}
        >
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
            <Key icon={<Hatch />}>{t('No data', 'Sin datos')}</Key>
            <p className="small muted">
              {t('Hansen counts loss but not regrowth, so this can only go down.', 'Hansen cuenta la pérdida pero no el rebrote, así que esto solo puede bajar.')}
            </p>
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
          {`${isLoss ? t(`Tree cover lost in ${year}`, `Cobertura perdida en ${year}`) : t(`Area burned in ${year}`, `Superficie quemada en ${year}`)} ${t('(km² per square)', '(km² por cuadro)')}`}
        </h3>
        <AmountBar
          prefix={isLoss ? 'loss' : 'burn'}
          breaks={isLoss ? LOSS_BREAKS : BURNED_BREAKS}
          label={t(
            `Five colour classes of ${isLoss ? 'tree cover lost' : 'area burned'}, in square kilometres per square`,
            `Cinco clases de color de ${isLoss ? 'cobertura perdida' : 'superficie quemada'}, en kilómetros cuadrados por cuadro`,
          )}
        />
        {!compact && (
          <>
            <Key icon={<Transparent />}>{t('None: transparent', 'Nada: transparente')}</Key>
            <Key icon={<Hatch />}>{t('No data', 'Sin datos')}</Key>
            {isLoss && (
              <p className="small muted">
                {t(
                  'Loss includes fire, logging, mining and clearing; it is not only deforestation.',
                  'La pérdida incluye fuego, tala, minería y desbroce; no es solo deforestación.',
                )}
              </p>
            )}
          </>
        )}
      </section>
    )
  }

  // Trend
  const maxAbs = trend?.maxAbs ?? 0
  const breaks = legendBreaks(maxAbs)
  const name = trend?.name ?? t('the measure', 'la medida')
  const units = trend ? slopeUnitsLabel(trend.slopeUnits, t) : t('per decade', 'por década')
  // The scale ends at ±maxAbs so typical slopes show; say so when real squares go beyond it ("≤ −428.03").
  const range = trend?.range ?? null
  const clippedLow = range !== null && range.min < -maxAbs
  const clippedHigh = range !== null && range.max > maxAbs
  return (
    <section className={compact ? 'legend compact' : 'legend'} aria-labelledby={titleId}>
      <h3 id={titleId} className="legend-title">
        {`${t('Change per decade', 'Cambio por década')}, ${name}${trend ? ` (${units})` : ''}`}
      </h3>
      <div className="legend-ends">
        <span>{t('Falling', 'Baja')}</span>
        <span>{t('Rising', 'Sube')}</span>
      </div>
      <div
        className="legend-bar"
        role="img"
        aria-label={t(
          `Six colour classes from ${clippedLow ? 'at most ' : ''}${formatSigned(-maxAbs)} to ${clippedHigh ? 'at least ' : ''}${formatSigned(maxAbs)} ${units}: orange falls, purple rises`,
          `Seis clases de color de ${clippedLow ? 'como mucho ' : ''}${formatSigned(-maxAbs)} a ${clippedHigh ? 'al menos ' : ''}${formatSigned(maxAbs)} ${units}: naranja baja, morado sube`,
        )}
      >
        {Array.from({ length: SLOPE_CLASSES }, (_, k) => (
          <i key={k} style={{ background: `var(--puor-${k})` }} />
        ))}
      </div>
      <div className="legend-ticks" aria-hidden="true">
        {/* One string per label, so a page translator cannot leave an old value behind (lib/translationGuard.ts). */}
        <span>{`${clippedLow ? '≤ ' : ''}${formatSigned(breaks[0])}`}</span>
        <span>0</span>
        <span>{`${clippedHigh ? '≥ ' : ''}${formatSigned(breaks[SLOPE_CLASSES])}`}</span>
      </div>
      {!compact && (
        <>
          {range && (
            <p className="small muted">
              {t(
                `Coloured squares range from ${formatSigned(range.min)} to ${formatSigned(range.max)} (same units).`,
                `Los cuadros coloreados van de ${formatSigned(range.min)} a ${formatSigned(range.max)} (mismas unidades).`,
              )}
              {(clippedLow || clippedHigh) &&
                t(' Squares beyond the ends of the scale take the end colour.', ' Los cuadros más allá de los extremos de la escala toman el color del extremo.')}
            </p>
          )}
          {!trend?.pending && <Key icon={<Dotted />}>{t('Dotted: no significant trend', 'Punteado: sin tendencia significativa')}</Key>}
          <Key icon={<Hatch />}>{t('Hatched: not tested', 'Rayado: sin probar')}</Key>
          <p className="small muted">
            {t('Mann-Kendall test on yearly values, false discovery rate 5 %.', 'Test de Mann-Kendall sobre valores anuales, tasa de falsos descubrimientos del 5 %.')}{' '}
            <ViewLink view="method" hash="trend-test">
              {t('How the test works', 'Cómo funciona el test')}
            </ViewLink>
          </p>
        </>
      )}
    </section>
  )
}

/** The "outlined: the area you opened" key, shown once under the legend. */
export function SelectedKey() {
  const { t } = useLang()
  return <Key icon={<Selected />}>{t('Outlined: the area you opened', 'Contorneado: el área que abriste')}</Key>
}
