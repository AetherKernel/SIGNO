// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "Exact values" of the cell viewer: every published yearly value of this square in one scrollable table (years A and B
// highlighted), and the result of each trend test (change per decade, raw p-value, whether it is significant after the
// false discovery rate correction). Values are the backend's, written as they are.

import { formatNumber, slopeText, type MeasureRow, type TrendEntry } from '../lib/cellView.ts'
import { formatPValue } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'

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
  return r.status === 'incomplete' ? `${text}*` : r.status === 'suspect' ? `${text} ⚑` : text
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
                  <td key={r.id}>{cellText(r, year)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {t(
          '* incomplete year (left out of differences and tests) · ⚑ suspect value · – no value. Yearly values of the monthly measures are the mean (NDVI, EVI, temperature) or the total (rain, burned share) of the 12 months.',
          '* año incompleto (fuera de las diferencias y de los tests) · ⚑ valor dudoso · – sin valor. Los valores anuales de las medidas mensuales son la media (NDVI, EVI, temperatura) o el total (lluvia, fracción quemada) de los 12 meses.',
        )}
      </p>

      <h4 className="subhead">{t('Trend test results', 'Resultados del test de tendencia')}</h4>
      <div className="cv-scroll" tabIndex={0} role="region" aria-label={t('Trend test results of this area', 'Resultados del test de tendencia de esta área')}>
        <table className="cv-table cv-exact">
          <caption className="sr-only">{t('Trend test result of each measure in this area', 'Resultado del test de tendencia de cada medida en esta área')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Measure', 'Medida')}</th>
              <th scope="col">{t('Years tested', 'Años probados')}</th>
              <th scope="col">{t('Months used', 'Meses usados')}</th>
              <th scope="col">{t('Change per decade', 'Cambio por década')}</th>
              <th scope="col">{t('p-value (raw)', 'Valor p (sin corregir)')}</th>
              <th scope="col">{t('Significant after FDR', 'Significativo tras FDR')}</th>
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
                <td>{e.result ? formatPValue(e.result.pValue) : '–'}</td>
                <td>{e.status === 'falling' || e.status === 'rising' ? t('Yes', 'Sí') : e.status === 'none' ? t('No', 'No') : '–'}</td>
                <td>{t(...VERDICT[e.status])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {t('Mann-Kendall test on yearly values, Sen slope per decade', 'Test de Mann-Kendall sobre valores anuales, pendiente de Sen por década')}
        {alpha !== null ? `, α = ${alpha}` : ''}.{' '}
        {t(
          'The p-value is the raw one; “significant” is decided after correcting for the many squares tested at once (Benjamini-Hochberg false discovery rate). Hansen tree cover is not tested: it can only go down.',
          'El valor p es el original; “significativo” se decide tras corregir por los muchos cuadros probados a la vez (tasa de falsos descubrimientos de Benjamini-Hochberg). La cobertura de Hansen no se prueba: solo puede bajar.',
        )}
      </p>
    </div>
  )
}
