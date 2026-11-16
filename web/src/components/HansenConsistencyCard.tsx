// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
//
// Cross-checks card "Hansen loss vs official deforestation (INPE PRODES)": how well Hansen's yearly loss in the Brazilian
// Amazon follows the official PRODES series, compared in the two periods 2001-2010 and 2011-2025 (Hansen reprocessed its loss
// data from 2011; only 2011-2025 is tested as a trend). Each period leads with what agrees (the trend of Hansen loss and of
// PRODES, from the published zone tests); the correlation and the Hansen/PRODES ratio are a second line with a tip. A two-line
// chart of the yearly values marks 2011. Everything comes from validation.json (trendChecks.hansenConsistency) and zones.json;
// the only derived thing is the list of the three years with the highest Hansen/PRODES ratio, read from those two files.
// 2026-11-15: leads with the agreement per period; "Why the trend starts in 2011" replaces "Why we never test across 2011".

import type { HansenConsistency, HansenConsistencySegment, ZonesReport } from '../../shared/contracts.ts'
import { formatRatio, methodChangeText, useHansenInfo } from '../lib/hansen.ts'
import { useLang } from '../lib/i18n.ts'
import { formatNumber, niceTicks } from '../lib/zoneTrends.ts'
import { InfoTip } from './InfoTip.tsx'
import { MethodChangeNote } from './MethodChangeNote.tsx'

const W = 640
const H = 200
const PAD = { left: 52, right: 12, top: 14, bottom: 24 }

type Trend = 'increasing' | 'decreasing' | 'none'

function trendWord(trend: Trend, t: (en: string, es: string) => string): string {
  return trend === 'increasing' ? t('rising', 'sube') : trend === 'decreasing' ? t('falling', 'baja') : t('no clear trend', 'sin tendencia clara')
}

/** The trend as an adjective for a sentence ("rising", "al alza"). */
function trendAdj(trend: Trend, t: (en: string, es: string) => string): string {
  return trend === 'increasing' ? t('rising', 'al alza') : trend === 'decreasing' ? t('falling', 'a la baja') : t('flat', 'plana')
}

const ZONES: { id: string; en: string; es: string }[] = [
  { id: 'amazon', en: 'Whole Amazon', es: 'Toda la Amazonía' },
  { id: 'amazon_brazil', en: 'Brazilian Amazon', es: 'Amazonía brasileña' },
  { id: 'amazon_peru', en: 'Peruvian Amazon', es: 'Amazonía peruana' },
]

/** What the two series do in one period, in one sentence: "both rise", "both fall", "neither shows a clear trend" or each one's own. */
function agreement(hansen: Trend | undefined, prodes: Trend | undefined, t: (en: string, es: string) => string): string {
  if (!hansen || !prodes) return t('Not compared in this period.', 'No se comparan en este periodo.')
  if (hansen === prodes && hansen !== 'none')
    return hansen === 'increasing'
      ? t('Hansen loss and PRODES both rise.', 'La pérdida de Hansen y PRODES suben las dos.')
      : t('Hansen loss and PRODES both fall.', 'La pérdida de Hansen y PRODES bajan las dos.')
  if (hansen === 'none' && prodes === 'none') return t('Neither shows a clear trend.', 'Ninguna muestra una tendencia clara.')
  return t(
    `Hansen loss: ${trendWord(hansen, t)}. PRODES: ${trendWord(prodes, t)}.`,
    `Pérdida de Hansen: ${trendWord(hansen, t)}. PRODES: ${trendWord(prodes, t)}.`,
  )
}

function SegmentBlock({ segment, peaks }: { segment: HansenConsistencySegment; peaks: number[] }) {
  const { t } = useLang()
  const hansenInfo = useHansenInfo()
  const [y0, y1] = segment.years
  // The years before the method change are compared with PRODES only: the site publishes no trend for them.
  const early = y1 < hansenInfo.year
  const { r, ratio } = segment.hansenBrazilVsProdes
  const modis = segment.modisCheck.r
  const prodes = segment.zoneTrends.prodes
  const brazil = segment.zoneTrends.amazon_brazil
  const n = y1 - y0 + 1
  const peakList = peaks.length > 1 ? `${peaks.slice(0, -1).join(', ')} ${t('and', 'y')} ${peaks[peaks.length - 1]}` : peaks.join('')
  return (
    <article className="hc-segment" aria-labelledby={`hc-${y0}`}>
      <h4 id={`hc-${y0}`}>
        {y0}–{y1}
      </h4>
      <p className="hc-lead">{agreement(brazil?.trend, prodes?.trend, t)}</p>
      <p className="small muted">
        {r !== null ? `r = ${r.toFixed(2)}` : '—'}
        {ratio !== null && (
          <>
            {' · '}
            {t(`Hansen counts ${formatRatio(ratio, t)} times PRODES`, `Hansen cuenta ${formatRatio(ratio, t)} veces PRODES`)}
          </>
        )}
        <InfoTip label={t('What r says here', 'Qué dice r aquí')}>
          {r !== null && r < 0.5 && peakList
            ? t(
                `r over ${n} yearly values. It is low because Hansen also counts canopy lost to fire and degradation (peaks in ${peakList}), which PRODES does not count as deforestation.`,
                `r sobre ${n} valores anuales. Es bajo porque Hansen también cuenta el dosel perdido por fuego y degradación (picos en ${peakList}), que PRODES no cuenta como deforestación.`,
              )
            : t(`r over ${n} yearly values: the two series move together.`, `r sobre ${n} valores anuales: las dos series se mueven juntas.`)}
        </InfoTip>
      </p>
      <dl className="hc-facts">
        <div>
          <dt>
            {early
              ? t('Trend of Hansen loss (comparison only, earlier method; not a published trend)', 'Tendencia de la pérdida de Hansen (solo comparación, método anterior; no es una tendencia publicada)')
              : t('Trend of Hansen loss', 'Tendencia de la pérdida de Hansen')}
          </dt>
          <dd>
            {ZONES.filter((z) => segment.zoneTrends[z.id]).map((z) => (
              <span key={z.id} className="hc-line">
                {t(z.en, z.es)}: {trendWord(segment.zoneTrends[z.id].trend, t)}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>{t('Trend of PRODES (official)', 'Tendencia de PRODES (oficial)')}</dt>
          <dd>{prodes ? trendWord(prodes.trend, t) : '—'}</dd>
        </div>
        <div>
          <dt>{t('MODIS confirms where loss happened', 'MODIS confirma dónde hubo pérdida')}</dt>
          <dd>
            {modis !== null ? `r = ${modis.toFixed(2)}` : '—'}
            <InfoTip label={t('What this check measures', 'Qué mide esta comprobación')}>
              {t(
                `Across the ${segment.cells.tested.toLocaleString('en-US')} squares: Hansen loss summed over ${y0}–${y1} as a share of the square, against the change in MODIS tree cover over the same years. A negative r means MODIS tree cover falls where Hansen sees more loss.`,
                `En los ${segment.cells.tested.toLocaleString('es-PE')} cuadros: la pérdida de Hansen sumada en ${y0}–${y1} como parte del cuadro, frente al cambio de la cobertura MODIS en los mismos años. Un r negativo significa que la cobertura MODIS baja donde Hansen ve más pérdida.`,
              )}
            </InfoTip>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function CompareChart({ consistency, zones }: { consistency: HansenConsistency; zones: ZonesReport }) {
  const { t } = useLang()
  const hansenInfo = useHansenInfo()
  const brazil = zones.zones.amazon_brazil?.variables.lossKm2?.annual
  const years = consistency.prodes.years
  if (!brazil) return null
  const hansen = years.map((year) => brazil.find((p) => p.year === year)?.value ?? null)
  const prodes = consistency.prodes.km2
  const all = [...hansen.filter((v): v is number => v !== null), ...prodes]
  const ticks = niceTicks(0, Math.max(...all) * 1.05, 4)
  const top = Math.max(ticks[ticks.length - 1] ?? 0, ...all) || 1
  const n = years.length
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom)
  const line = (values: (number | null)[]) =>
    values.reduce((d, v, i) => (v === null ? d : `${d}${d && values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`), '')
  const mi = years.indexOf(hansenInfo.year)
  const label = t(
    `Yearly loss of Hansen in the Brazilian Amazon and official PRODES deforestation, ${years[0]} to ${years[n - 1]}, in square kilometres`,
    `Pérdida anual de Hansen en la Amazonía brasileña y deforestación oficial de PRODES, ${years[0]} a ${years[n - 1]}, en kilómetros cuadrados`,
  )
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="tick" x={PAD.left - 6} y={y(tick) + 3} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {years.map((year, i) =>
          year % 5 === 0 ? (
            <text key={year} className="tick" x={x(i)} y={H - 6} textAnchor="middle">
              {year}
            </text>
          ) : null,
        )}
        {mi > 0 && (
          <g>
            <line className="hc-method" x1={x(mi - 0.5)} x2={x(mi - 0.5)} y1={PAD.top} y2={H - PAD.bottom} />
            <text className="tick" x={x(mi - 0.5) + 3} y={PAD.top + 9}>
              {hansenInfo.year}
            </text>
          </g>
        )}
        <path className="line line-prodes" d={line(prodes)} />
        <path className="line line-hansen" d={line(hansen)} />
      </svg>
      <figcaption>
        <span className="key-line solid" /> {t('Hansen loss, Brazilian Amazon', 'Pérdida de Hansen, Amazonía brasileña')} · <span className="key-line dashed prodes" />{' '}
        {t('PRODES (official deforestation)', 'PRODES (deforestación oficial)')} · km²
      </figcaption>
      <MethodChangeNote className="small muted" />
      <details className="values-table">
        <summary>{t('Show values', 'Mostrar valores')}</summary>
        <table>
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Year', 'Año')}</th>
              <th scope="col">{t('Hansen loss (km²)', 'Pérdida de Hansen (km²)')}</th>
              <th scope="col">PRODES (km²)</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year, i) => (
              <tr key={year}>
                <th scope="row">{year}</th>
                <td className="mono">{hansen[i] === null ? '—' : Math.round(hansen[i] as number).toLocaleString('en-US')}</td>
                <td className="mono">{prodes[i].toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/**
 * The three years of a period in which Hansen loss in the Brazilian Amazon is the largest multiple of PRODES (the fire and degradation
 * peaks), in order. Read from zones.json and the published PRODES series; empty when either is missing.
 */
function peaksOf(segment: HansenConsistencySegment, consistency: HansenConsistency, zones: ZonesReport | null): number[] {
  const hansen = zones?.zones.amazon_brazil?.variables.lossKm2?.annual
  if (!hansen) return []
  const ratios = consistency.prodes.years
    .filter((year) => year >= segment.years[0] && year <= segment.years[1])
    .flatMap((year) => {
      const h = hansen.find((p) => p.year === year)?.value
      const p = consistency.prodes.km2[consistency.prodes.years.indexOf(year)]
      return h !== null && h !== undefined && p > 0 ? [{ year, ratio: h / p }] : []
    })
  return ratios
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((r) => r.year)
    .sort((a, b) => a - b)
}

export function HansenConsistencyCard({ consistency, zones }: { consistency: HansenConsistency; zones: ZonesReport | null }) {
  const { t } = useLang()
  const hansenInfo = useHansenInfo()
  const across = consistency.acrossBreak
  const amazon = across.zoneTrends.amazon
  const prodes = across.zoneTrends.prodes
  return (
    <section className="vcard" aria-labelledby="v-hansen">
      <h3 id="v-hansen">{t('Hansen loss vs official deforestation (INPE PRODES)', 'Pérdida de Hansen frente a la deforestación oficial (INPE PRODES)')}</h3>
      <p className="small">
        {t(
          'PRODES is the official yearly deforestation count of the Brazilian Amazon. Hansen loss counts any loss of tree cover, so they are not expected to match exactly.',
          'PRODES es el conteo oficial anual de deforestación de la Amazonía brasileña. La pérdida de Hansen cuenta cualquier pérdida de cobertura arbórea, así que no se espera que coincidan del todo.',
        )}
        <InfoTip label={t(`Why the trend starts in ${hansenInfo.year}`, `Por qué la tendencia empieza en ${hansenInfo.year}`)}>
          {t(
            'PRODES counts clear-cuts of primary forest (polygons of 6.25 ha or more). Hansen loss counts any stand-replacing loss (fire, logging, mining, clearing). ',
            'PRODES cuenta talas rasas de bosque primario (polígonos de 6,25 ha o más). La pérdida de Hansen cuenta cualquier pérdida total (fuego, tala, minería, desbroce). ',
          ) + methodChangeText(hansenInfo, t)}
        </InfoTip>
      </p>
      <div className="hc-segments">
        {consistency.segments.map((segment) => (
          <SegmentBlock key={segment.years.join('-')} segment={segment} peaks={peaksOf(segment, consistency, zones)} />
        ))}
      </div>
      {zones && <CompareChart consistency={consistency} zones={zones} />}
      <p className="small">
        <strong>{t(`Why the trend starts in ${hansenInfo.year}.`, `Por qué la tendencia empieza en ${hansenInfo.year}.`)}</strong>{' '}
        {amazon && prodes
          ? t(
              `One test across ${across.years[0]}–${across.years[1]} would show a ${trendAdj(amazon.trend, t)} Amazon trend while PRODES is ${trendAdj(prodes.trend, t)}: a false signal from the method change.`,
              `Un solo test de ${across.years[0]} a ${across.years[1]} mostraría una tendencia ${trendAdj(amazon.trend, t)} en la Amazonía mientras PRODES va ${trendAdj(prodes.trend, t)}: una señal falsa del cambio de método.`,
            )
          : t('A single test across the method change would mix two methods.', 'Un solo test a través del cambio de método mezclaría dos métodos.')}
      </p>
      <p className="small muted">
        {t('Sources', 'Fuentes')}:{' '}
        <a href={consistency.hansenNotes.url} target="_blank" rel="noreferrer">
          {consistency.hansenNotes.title}
        </a>
        {' · '}
        <a href={consistency.prodes.url} target="_blank" rel="noreferrer">
          {consistency.prodes.title}
        </a>
        .
      </p>
    </section>
  )
}
