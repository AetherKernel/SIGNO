// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// 2026-11-15: no MODIS column or suspect mark; one loss trend row (2011-2025; earlier loss years are greyed in the table); notes in
// InfoTips. The trend table keeps the raw p-value and alpha (transparency: a p below alpha can still be "not clear" after the
// correction for the squares tested at once) and adds the 95 % CI.
//
// "Exact values" of the cell viewer: every published yearly value of this square in one scrollable table (years A and B
// highlighted), and the result of each trend test (change per decade, raw p-value, whether it is significant after the
// false discovery rate correction). Values are the backend's, written as they are.

import { formatNumber, slopeText, type MeasureRow, type TrendEntry } from '../lib/cellView.ts'
import { formatPValue } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'
import { ciBounds } from '../lib/trendWords.ts'
import { InfoTip } from './InfoTip.tsx'

interface Props {
  rows: MeasureRow[]
  years: number[]
  from: number
  to: number
  entries: TrendEntry[]
  alpha: number | null
}

function cellText(row: MeasureRow, year: number): string {
  const r = row.reading(year)
  if (r.value === null || r.status === 'none') return '–'
  const text = formatNumber(r.value, row.digits)
  return r.status === 'incomplete' ? `${text}*` : text
}

const VERDICT: Record<TrendEntry['status'], [string, string]> = {
  falling: ['Falling', 'Baja'],
  rising: ['Rising', 'Sube'],
  none: ['No clear trend', 'Sin tendencia clara'],
  untested: ['Not tested', 'Sin probar'],
  loading: ['Loading', 'Cargando'],
  error: ['Could not load', 'No se pudo cargar'],
}

export function CellValues({ rows, years, from, to, entries, alpha }: Props) {
  const { t } = useLang()
  const squares = entries.find((e) => e.squares !== null)?.squares ?? null
  const ready = rows.filter((r) => r.state === 'ready' && !r.message)
  return (
    <div className="cv-values">
      <div className="cv-scroll" tabIndex={0} role="region" aria-label={t('Yearly values of this area', 'Valores anuales de esta área')}>
        <table className="cv-table cv-exact">
          <caption className="sr-only">{t('Every yearly value of this area', 'Todos los valores anuales de esta área')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Year', 'Año')}</th>
              {ready.map((r) => (
                <th key={r.id} scope="col">
                  {r.column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className={year === from || year === to ? 'current' : undefined}>
                <th scope="row">{year}</th>
                {ready.map((r) => (
                  <td key={r.id} className={r.reading(year).muted ? 'faded' : undefined}>
                    {cellText(r, year)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {t(
          '* incomplete year (left out of differences and tests) · grey: shown, not in the trend · – no value.',
          '* año incompleto (fuera de las diferencias y de los tests) · gris: se muestra, pero no entra en la tendencia · – sin valor.',
        )}
        <InfoTip>
          {t(
            'Yearly values of the monthly measures are the mean (NDVI, EVI, temperature) or the total (rain) of the 12 months. Grey values are real data: the Terra overpass drift (NDVI, EVI, temperature, from 2021) or the earlier Hansen method (loss before 2011) keeps them out of the trend.',
            'Los valores anuales de las medidas mensuales son la media (NDVI, EVI, temperatura) o el total (lluvia) de los 12 meses. Los valores en gris son datos reales: la deriva de la órbita de Terra (NDVI, EVI, temperatura, desde 2021) o el método anterior de Hansen (pérdida antes de 2011) los deja fuera de la tendencia.',
          )}
        </InfoTip>
      </p>

      <h4 className="subhead">{t('Trend test results', 'Resultados del test de tendencia')}</h4>
      <div className="cv-scroll" tabIndex={0} role="region" aria-label={t('Trend test results of this area', 'Resultados del test de tendencia de esta área')}>
        <table className="cv-table cv-exact">
          <caption className="sr-only">{t('Trend test result of each measure in this area', 'Resultado del test de tendencia de cada medida en esta área')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Measure', 'Medida')}</th>
              <th scope="col">{t('Years tested', 'Años probados')}</th>
              <th scope="col">{t('Months with data (whole series)', 'Meses con dato (serie completa)')}</th>
              <th scope="col">{t('Change per decade', 'Cambio por década')}</th>
              <th scope="col">{t('95 % CI', 'IC 95 %')}</th>
              <th scope="col">
                {t('p-value', 'Valor p')}
                <InfoTip>
                  {t(
                    `p of the Mann-Kendall test for this square alone. 'Clear' also requires passing the correction for the ${squares ?? 'many'} squares tested at once (false discovery rate 5 %), so a p below 0.05 can still be 'not clear'. The interval is for this square alone, before the correction, so it can exclude 0 while the trend is not clear.`,
                    `p del test de Mann-Kendall solo para este cuadro. 'Clara' exige además pasar la corrección por los ${squares ?? 'muchos'} cuadros probados a la vez (tasa de falsos descubrimientos del 5 %); por eso un p menor que 0,05 puede seguir siendo 'no clara'. El intervalo es solo de este cuadro, antes de la corrección; puede excluir el 0 aunque la tendencia no sea clara.`,
                  )}
                </InfoTip>
              </th>
              <th scope="col">{t('Clear after correction?', '¿Clara tras la corrección?')}</th>
              <th scope="col">{t('Direction', 'Dirección')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.name}</th>
                <td>
                  {e.years[0]}–{e.years[1]}
                </td>
                <td>{e.validMonths ?? '–'}</td>
                <td>{slopeText(e, t) || '–'}</td>
                <td>{ciBounds(e.result?.slopeCi95, t) ?? '–'}</td>
                <td>{e.result ? formatPValue(e.result.pValue, t) : '–'}</td>
                <td>{e.status === 'falling' || e.status === 'rising' ? t('Yes', 'Sí') : e.status === 'none' ? t('No', 'No') : '–'}</td>
                <td>{t(...VERDICT[e.status])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {/* One string: alpha arrives after loading, and must replace whole under a page translator. */}
        <span>{`${t('Mann-Kendall, Sen slope', 'Mann-Kendall, pendiente de Sen')}${alpha !== null ? `, α = ${alpha}` : ''}`}</span>
        <InfoTip>
          {t(
            'Mann-Kendall test on yearly values, Sen slope per decade with its 95 % confidence interval. The p-value is the raw one; “clear” is decided after correcting for the many squares tested at once (Benjamini-Hochberg false discovery rate). Hansen tree cover is not tested: it can only go down.',
            'Test de Mann-Kendall sobre valores anuales, pendiente de Sen por década con su intervalo de confianza del 95 %. El valor p es el original; “clara” se decide tras corregir por los muchos cuadros probados a la vez (tasa de falsos descubrimientos de Benjamini-Hochberg). La cobertura de Hansen no se prueba: solo puede bajar.',
          )}
        </InfoTip>
      </p>
    </div>
  )
}
