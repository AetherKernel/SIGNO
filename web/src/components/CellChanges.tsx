// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "What changed from A to B" of the cell viewer: one row per measure with its value in year A, in year B, the difference
// (B minus A, the only arithmetic the browser does) and a small yearly line. A year that is incomplete, suspect or missing
// is shown as such, with the reason, and is never part of a difference. On a phone each row becomes a small card.

import { formatChange, formatValue, sparkValues, type MeasureRow, type YearReading } from '../lib/cellView.ts'
import { useLang } from '../lib/i18n.ts'
import { Sparkline } from './YearChart.tsx'

interface Props {
  rows: MeasureRow[]
  years: number[]
  from: number
  to: number
  onRetry: () => void
}

function Reading({ row, reading }: { row: MeasureRow; reading: YearReading }) {
  const { t } = useLang()
  const shown = reading.value !== null && reading.status !== 'none'
  return (
    <>
      <span className={`cv-value mono${reading.status === 'ok' ? '' : ' faded'}`}>{shown ? formatValue(row, reading.value as number) : '—'}</span>
      {reading.status === 'suspect' && <span className="cv-tag">{t('suspect', 'dudoso')}</span>}
      {reading.drift && <span className="cv-tag">{t('drift year', 'año con deriva')}</span>}
      {reading.note && <span className="cv-note">{reading.note}</span>}
    </>
  )
}

export function CellChanges({ rows, years, from, to, onRetry }: Props) {
  const { t } = useLang()
  return (
    <table className="cv-table cv-changes">
      <caption className="sr-only">
        {t(`Measures of this area in ${from} and ${to}, and the change between them`, `Medidas de esta área en ${from} y ${to}, y el cambio entre ambos`)}
      </caption>
      <thead>
        <tr>
          <th scope="col">{t('Measure', 'Medida')}</th>
          <th scope="col">{from}</th>
          <th scope="col">{to}</th>
          <th scope="col">{t('Change', 'Cambio')}</th>
          <th scope="col" className="cv-spark-col">
            <span className="sr-only">{t('Yearly line', 'Línea anual')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          if (row.state !== 'ready') {
            return (
              <tr key={row.id} className="cv-row-pending">
                <th scope="row">{row.label}</th>
                <td colSpan={4}>
                  {row.state === 'loading' ? (
                    <span className="cv-skeleton" role="status">
                      <span className="sr-only">
                        {t('Loading', 'Cargando')} {row.label}
                      </span>
                    </span>
                  ) : (
                    <span className="error small">
                      {t('Could not load', 'No se pudo cargar')} {row.label}.{' '}
                      <button type="button" className="cv-link" onClick={onRetry}>
                        {t('Retry', 'Reintentar')}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            )
          }
          if (row.message) {
            return (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td colSpan={4} className="muted small">
                  {row.message}
                </td>
              </tr>
            )
          }
          const a = row.reading(from)
          const b = row.reading(to)
          const change = formatChange(row, a, b, t)
          return (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td data-label={String(from)}>
                <Reading row={row} reading={a} />
              </td>
              <td data-label={String(to)}>
                <Reading row={row} reading={b} />
              </td>
              <td data-label={t('Change', 'Cambio')}>
                <span className={`cv-value mono${change === null ? ' faded' : ''}`}>{change ?? '—'}</span>
              </td>
              <td className="cv-spark-col">
                <Sparkline years={years} values={sparkValues(row, years)} from={from} to={to} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
