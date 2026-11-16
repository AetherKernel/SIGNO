// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15 (monthly values loaded on demand, same day).
// Reviewed and owned by team AETHER.
// 2026-11-15: tree cover loss is one row (2011-2025) with the method-change tip; "Tree cover" is Hansen only. Every row follows the
// "clear or not" rule: a clear trend reads direction, slope and 95 % CI (the tip holds p); one that is not clear reads its slope and
// a "?" tip; a square that was not tested reads "—". Drift years of NDVI, EVI and temperature are greyed in the chart.
//
// "Trends in this area" of the cell viewer: one line per measure in plain language (direction, slope per decade, tested
// years, and whether the team's test calls it a clear trend after correcting for many squares at once). Each line opens
// to the yearly chart of that measure. "Significant" is only what the backend decided (false discovery rate 5 %); the
// browser never tests, fits or averages. Hansen tree cover is listed as not tested (it can only go down).

import { useState } from 'react'
import type { CellYearlySeries, SenLine, Variable } from '../../shared/contracts.ts'
import type { Slot } from '../hooks/useCellProfile.ts'
import { useCellSeries } from '../hooks/useSignoData.ts'
import { annualByYear, describeTrend, formatNumber, formatValue, seriesRow, type TrendEntry } from '../lib/cellView.ts'
import { methodChangeText, useHansenInfo } from '../lib/hansen.ts'
import { useLang } from '../lib/i18n.ts'
import { driftStartOf } from '../lib/trendWords.ts'
import { InfoTip } from './InfoTip.tsx'
import { SeriesChart } from './SeriesChart.tsx'
import { ViewLink } from './ViewLink.tsx'
import { YearChart, type ChartSeries, type PointKind } from './YearChart.tsx'

interface Props {
  entries: TrendEntry[]
  variables: Variable[]
  series: Record<string, Slot<CellYearlySeries>>
  from: number
  to: number
  onRetry: () => void
  /** km2 in 1 % of this square (for the burned-area units tip); null when the cover layer is not loaded. */
  km2PerPercent?: number | null
}

const ICON: Record<TrendEntry['status'], string> = { falling: '↓', rising: '↑', none: '–', untested: '?', loading: '…', error: '!' }

/** Yearly chart of a monthly variable in this square: tested years shaded, incomplete years hollow, later years muted. */
function SeriesTrendChart({ variable, series, slot, from, to, sen, significant }: { variable: Variable; series: CellYearlySeries; slot: Slot<CellYearlySeries>; from: number; to: number; sen?: SenLine; significant: boolean }) {
  const { t } = useLang()
  const [monthly, setMonthly] = useState(false)
  // The monthly points are not in the per-cell file: the series file loads only when the reader asks for it.
  const monthlySeries = useCellSeries(monthly ? variable.id : null, series.cellId)
  const row = seriesRow(variable, slot, t)
  const annual = annualByYear(series)
  const years = [...annual.keys()]
  const tested: [number, number] | null = variable.trendYears ? [variable.trendYears.start, variable.trendYears.end] : null
  const kinds: PointKind[] = years.map((year) => {
    const a = annual.get(year)
    if (!a?.complete) return 'hollow'
    return tested && (year < tested[0] || year > tested[1]) ? 'outside' : 'ok'
  })
  const drift = driftStartOf(variable)
  const chartSeries: ChartSeries = {
    id: variable.id,
    label: variable.name,
    values: years.map((year) => annual.get(year)?.value ?? null),
    kinds,
    notes: years.map((year) => row.reading(year).note),
  }
  const sum = variable.semesterAggregation === 'sum'
  const product = variable.product
  return (
    <div className="cv-trend-body">
      {years.length === 0 ? (
        <p className="muted small">{t('Yearly values are not published yet.', 'Los valores anuales aún no se publican.')}</p>
      ) : (
        <YearChart
          years={years}
          type={sum ? 'bars' : 'line'}
          series={[chartSeries]}
          format={(v) => formatValue(row, v)}
          tick={(v) => formatNumber(v, 'auto')}
          tone={variable.id === 'burned_area' ? 'burned' : 'plain'}
          from={from}
          to={to}
          tested={tested}
          sen={sen}
          significant={significant}
          label={t(
            `${variable.name}, yearly ${sum ? 'total' : 'mean'}, for this area`,
            `${variable.name}, ${sum ? 'total' : 'media'} anual, para esta área`,
          )}
          caption={t(
            `${tested ? `Shaded: the years of the trend (${tested[0]}–${tested[1]}). ` : ''}${drift !== null ? 'Greyed: shown, not in the trend (hover a year for why). ' : ''}Hollow: incomplete year.${sen ? ' Line: Sen trend (solid: clear).' : ''} Source: NASA ${product.shortName} v${product.version} (${product.provider}).`,
            `${tested ? `Sombreado: los años de la tendencia (${tested[0]}–${tested[1]}). ` : ''}${drift !== null ? 'Gris: se muestra, pero no entra en la tendencia (pasa sobre un año para ver por qué). ' : ''}Hueco: año incompleto.${sen ? ' Línea: tendencia de Sen (continua: clara).' : ''} Fuente: NASA ${product.shortName} v${product.version} (${product.provider}).`,
          )}
        />
      )}
      <button type="button" className="cv-link" aria-expanded={monthly} onClick={() => setMonthly((on) => !on)}>
        {monthly ? t('Hide monthly values', 'Ocultar valores mensuales') : t('Show monthly values', 'Mostrar valores mensuales')}
      </button>
      {monthly && monthlySeries.data && <SeriesChart series={monthlySeries.data} variable={variable} compare={null} />}
      {monthly && monthlySeries.loading && <p className="muted small">{t('Loading the monthly values…', 'Cargando los valores mensuales…')}</p>}
      {monthly && monthlySeries.error && (
        <p className="error small">
          {t('Could not load the monthly values.', 'No se pudieron cargar los valores mensuales.')} {monthlySeries.error}
        </p>
      )}
    </div>
  )
}

export function CellTrends({ entries, variables, series, from, to, onRetry, km2PerPercent = null }: Props) {
  const { t } = useLang()
  const hansen = useHansenInfo()
  return (
    <ul className="cv-trends">
      {entries.map((entry) => {
        const { headline, tip, mark } = describeTrend(entry, t)
        const variable = entry.kind === 'series' ? variables.find((v) => v.id === entry.id) : undefined
        const slot = series[entry.id]
        return (
          <li key={entry.id}>
            <details className={`cv-trend ${entry.status}`}>
              <summary>
                <span className="cv-trend-icon" aria-hidden="true">
                  {ICON[entry.status]}
                </span>
                {/* Each text in its own element: React then replaces it whole, even if a page translator rewrote it. */}
                <span>
                  <span>{headline}</span>
                  {tip && <InfoTip mark={mark}>{tip}</InfoTip>}
                </span>
              </summary>
              {variable && slot?.state === 'ready' && <SeriesTrendChart variable={variable} series={slot.data} slot={slot} from={from} to={to} sen={entry.result?.line} significant={entry.result?.significant ?? false} />}
              {variable && slot?.state === 'loading' && <p className="muted small">{t('Loading the yearly values…', 'Cargando los valores anuales…')}</p>}
              {variable && slot?.state === 'error' && (
                <p className="error small">
                  {t('Could not load the yearly values.', 'No se pudieron cargar los valores anuales.')}{' '}
                  <button type="button" className="cv-link" onClick={onRetry}>
                    {t('Retry', 'Reintentar')}
                  </button>
                </p>
              )}
              {entry.kind === 'cover' && (
                <p className="muted small">
                  {t('The yearly values of this measure are in the charts above.', 'Los valores anuales de esta medida están en los gráficos de arriba.')}{' '}
                  {t(`The trend covers ${entry.years[0]}–${entry.years[1]}.`, `La tendencia cubre ${entry.years[0]}–${entry.years[1]}.`)}
                  <InfoTip label={t(`Why the trend starts in ${hansen.year}`, `Por qué la tendencia empieza en ${hansen.year}`)}>{methodChangeText(hansen, t)}</InfoTip>
                </p>
              )}
              {entry.id === 'burned_area' && km2PerPercent !== null && (
                <p className="muted small">
                  {t('Slope in % of the square per year, per decade.', 'Pendiente en % del cuadro por año, por década.')}
                  <InfoTip label={t('What 1 % means here', 'Qué significa 1 % aquí')}>
                    {t(
                      `1 % of this square is about ${Math.round(km2PerPercent).toLocaleString('en-US')} km².`,
                      `1 % de este cuadro son unos ${Math.round(km2PerPercent).toLocaleString('es-PE')} km².`,
                    )}
                  </InfoTip>
                </p>
              )}
              <p className="small">
                <ViewLink view="trends" params={{ var: entry.id }}>
                  {t(`See ${entry.name} trends for the whole zone`, `Ver las tendencias de ${entry.name} en toda la zona`)}
                </ViewLink>
              </p>
            </details>
          </li>
        )
      })}
      <li>
        <p className="cv-trend static">
          <span className="cv-trend-icon" aria-hidden="true">
            –
          </span>
          <span>
            {t('Tree cover: — not tested.', 'Cobertura arbórea: — sin probar.')}
            <InfoTip>{t('It can only go down, because regrowth is not counted.', 'Solo puede bajar, porque no cuenta el rebrote.')}</InfoTip>
          </span>
        </p>
      </li>
    </ul>
  )
}
