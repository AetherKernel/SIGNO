// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Trends view (?view=trends&zone=&var=): how the whole Amazon and its Brazilian and Peruvian parts changed, from the yearly
// zone values and tests of zones.json. Headline cards, a table with one row per measure that selects the detail chart, the
// detail with a plain-language reading, and "How the test works and how we checked it". It shows the pipeline's slopes, p-values,
// significance flags and counts as they are: nothing is tested, averaged or counted here. Zone tests are one test per zone and
// measure and are NOT corrected for multiple tests; the counts of squares are (false discovery rate). It never claims a cause.
// Lazy-loaded by App and mounted inside <main>; keep the named export and the props.
// 2026-11-15: no MODIS measure; tree cover loss has one trend (2011-2025: Hansen reprocessed loss from 2011; 2001-2010 are shown,
// greyed, not tested); caveats (satellite drift, test end, method change, zone vs squares) are InfoTips next to the short fact.
// "Clear or not" rule: a clear trend shows direction, slope and 95 % CI (p in the tag's tip); one that is not clear shows its slope
// and a "?" tip; a measure that is not tested shows "—".
// 2026-11-15 (review): the tips of one card/row are merged into ONE InfoTip (CardTip); loss in the Brazilian/Peruvian parts gets the
// borderline tip and the whole-Amazon loss the "higher level from 2016" tip (by zone id); the squares tip adds the independence caveat.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Manifest, Zone, ZonesReport, ZoneVariable } from '../../shared/contracts.ts'
import { useZones } from '../hooks/useZones.ts'
import { useMediaQuery } from '../hooks/useMediaQuery.ts'
import { useValidation } from '../hooks/useSignoData.ts'
import { useUrlParams } from '../hooks/useUrlParam.ts'
import { localizeUnits } from '../lib/format.ts'
import { methodChangeText, useHansenInfo, type HansenInfo } from '../lib/hansen.ts'
import { useLang, type Tr } from '../lib/i18n.ts'
import { borderlineLossTip, ciInline, clearTip, lossLevelTip, pPhrase, unclearTip } from '../lib/trendWords.ts'
import {
  defaultYear,
  directionOfTrend,
  directionWord,
  formatSignedNumber,
  formatValue,
  MEASURES,
  measureFor,
  measureName,
  measureNote,
  measuresOf,
  orderedZoneIds,
  periodOf,
  rangeSentence,
  slopeParts,
  slopeSentence,
  testEndNote,
  unitParts,
  zoneHeading,
  zoneSelectorLabel,
  type Direction,
  type Measure,
} from '../lib/zoneTrends.ts'
import { InfoTip } from './InfoTip.tsx'
import { Sparkline, ZoneChart } from './ZoneChart.tsx'
import { TrendMethod } from './TrendMethod.tsx'
import { ViewLink } from './ViewLink.tsx'
import './trends.css'

export interface TrendsViewProps {
  manifest: Manifest
}

/** The measures of the four headline cards. */
const KPI_KEYS = ['hansenTreeCover', 'lossKm2', 'lst_day', 'precip']

export function TrendsView({ manifest }: TrendsViewProps) {
  const { t } = useLang()
  const zonesPublished = manifest.extras.zones === true
  const zones = useZones(zonesPublished)
  const validation = useValidation(manifest.extras.validation)

  if (!zonesPublished) {
    return (
      <div className="page page-trends">
        <h1>{t('How has the Amazon changed since 2001?', '¿Cómo ha cambiado la Amazonía desde 2001?')}</h1>
        <p className="muted">
          {t('Zone trends are not published yet. The map and the cross-checks work:', 'Las tendencias por zona aún no se publican. El mapa y los contrastes funcionan:')}{' '}
          <ViewLink view="map">{t('open the map', 'abre el mapa')}</ViewLink> {t('or', 'o')}{' '}
          <ViewLink view="checks">{t('see the cross-checks', 'mira los contrastes')}</ViewLink>.
        </p>
      </div>
    )
  }
  if (zones.error) {
    return (
      <div className="page page-trends">
        <h1>{t('How has the Amazon changed since 2001?', '¿Cómo ha cambiado la Amazonía desde 2001?')}</h1>
        <p className="error" role="alert">
          {t('Could not load the zone trends', 'No se pudieron cargar las tendencias por zona')} ({zones.error}).
        </p>
        <p>
          <button type="button" className="btn" onClick={zones.retry}>
            {t('Try again', 'Reintentar')}
          </button>
        </p>
      </div>
    )
  }
  if (!zones.data) {
    return (
      <div className="page page-trends" aria-busy="true">
        <h1>{t('How has the Amazon changed since 2001?', '¿Cómo ha cambiado la Amazonía desde 2001?')}</h1>
        <div className="tr-skeleton" style={{ height: 96 }} />
        <div className="tr-skeleton" style={{ height: 384 }} />
        <div className="tr-skeleton" style={{ height: 280 }} />
        <p className="sr-only" role="status">
          {t('Loading the zone trends…', 'Cargando las tendencias por zona…')}
        </p>
      </div>
    )
  }
  // The method panel treats a null validation as "check results not published".
  return <TrendsDashboard report={zones.data} validation={manifest.extras.validation ? validation : null} />
}

// Dashboard

function TrendsDashboard({ report, validation }: { report: ZonesReport; validation: ReturnType<typeof useValidation> | null }) {
  const { t } = useLang()
  const [params, setParams] = useUrlParams()
  const compact = useMediaQuery('(max-width: 767px)')
  const detailRef = useRef<HTMLElement>(null)
  const [picked, setPicked] = useState<{ key: string; year: number } | null>(null)

  const zoneIds = orderedZoneIds(Object.keys(report.zones))
  const zoneParam = params.get('zone')
  const zoneId = zoneParam !== null && zoneIds.includes(zoneParam) ? zoneParam : (zoneIds[0] ?? 'amazon')
  const zone: Zone | undefined = report.zones[zoneId]
  if (!zone) return <p className="muted page-status">{t('This report has no zones.', 'Este informe no tiene zonas.')}</p>

  const rows = measuresOf(zone)
  const asked = measureFor(params.get('var'))
  const selected =
    rows.find((r) => asked !== null && r.measure.key === asked.key) ?? rows.find((r) => r.variable.zoneTrend) ?? rows[0]
  const heading = zoneHeading(zoneId, zone.label, t)
  const notAvailable = MEASURES.map((m) => m.key).filter((key) => !zone.variables[key])
  const missing = notAvailable.length > 0

  const select = (measure: Measure) => {
    setParams({ var: measure.id })
    detailRef.current?.scrollIntoView({ block: 'nearest' })
  }

  const yearKey = selected ? `${zoneId}/${selected.measure.key}` : ''
  const year =
    selected === undefined ? null : picked?.key === yearKey ? picked.year : defaultYear(selected.variable, selected.measure)

  return (
    <div className="page page-trends tr">
      <header className="tr-head">
        <div>
          <h1>{t(`How has the ${heading} changed since 2001?`, `¿Cómo ha cambiado la ${heading} desde 2001?`)}</h1>
          <p className="muted tr-lead">
            <span>
              {`${t(
                'Yearly values and a trend test for each measure: Mann-Kendall test on yearly values, Sen slope per decade',
                'Valores anuales y un test de tendencia por medida: test de Mann-Kendall sobre valores anuales, pendiente de Sen por década',
              )}, α = ${report.alpha}.`}
            </span>{' '}
            <a href="#how-it-works">{t('How the test works and how we checked it', 'Cómo funciona el test y cómo lo comprobamos')}</a>
          </p>
          {report.dataStatus === 'mock' && (
            <p className="tr-small muted">{t('Sample data: these numbers are synthetic.', 'Datos de muestra: estas cifras son sintéticas.')}</p>
          )}
        </div>
        <ZoneSelector
          ids={zoneIds}
          labels={Object.fromEntries(zoneIds.map((id) => [id, zoneSelectorLabel(id, report.zones[id].label, t)]))}
          value={zoneId}
          compact={compact}
          onChange={(id) => setParams({ zone: id })}
        />
      </header>

      <section aria-label={t('Headline numbers', 'Cifras principales')}>
        <ul className="tr-kpis">
          {KPI_KEYS.map((key) => {
            const row = rows.find((r) => r.measure.key === key)
            return row ? (
              <li key={key}>
                <Kpi zoneId={zoneId} measure={row.measure} variable={row.variable} selected={selected?.measure.key === key} onSelect={() => select(row.measure)} />
              </li>
            ) : null
          })}
        </ul>
        <p className="tr-small muted">
          {t('“Clear trend” here is one test for the whole zone.', '“Tendencia clara” aquí es un test para toda la zona.')}
          <InfoTip>
            {t(
              `One test for this zone and measure. Zone results are not corrected for multiple tests. 18 are shown (3 zones × 6 measures; Brazil and Peru are parts of the whole Amazon). With a Benjamini–Hochberg correction over the 18, 8 of the 10 clear results stay clear; Hansen loss in Brazil and in Peru would not. The counts of squares are corrected (false discovery rate ${Math.round(report.alpha * 100)} %).`,
              `Un test para esta zona y medida. Los resultados por zona no se corrigen por pruebas múltiples. Se muestran 18 (3 zonas × 6 medidas; Brasil y Perú son partes de la Amazonía entera). Con una corrección de Benjamini-Hochberg sobre las 18, 8 de los 10 resultados claros siguen siéndolo; la pérdida de Hansen en Brasil y en Perú, no. Los conteos de cuadros sí se corrigen (tasa de falsos descubrimientos del ${Math.round(report.alpha * 100)} %).`,
            )}
          </InfoTip>
        </p>
      </section>

      <section aria-labelledby="tr-table-title" className="tr-section">
        <h2 id="tr-table-title">{t('Every measure, one row each', 'Cada medida, una fila')}</h2>
        <div className="tr-table-scroll tr-measures-wrap">
          <table className="tr-measures">
            <caption className="sr-only">
              {t(
                `Trend of each measure in the ${heading}. Choose a measure to show its chart below the table.`,
                `Tendencia de cada medida en la ${heading}. Elige una medida para ver su gráfico debajo de la tabla.`,
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Measure', 'Medida')}</th>
                <th scope="col">{t('Years tested', 'Años probados')}</th>
                <th scope="col">{t('Direction', 'Dirección')}</th>
                <th scope="col">{t('Change per decade', 'Cambio por década')}</th>
                <th scope="col">
                  {t('Clear trend?', '¿Tendencia clara?')} <span className="tr-colnote">{t('zone-level test', 'test por zona')}</span>
                </th>
                <th scope="col">
                  {t('Squares falling | rising', 'Cuadros que bajan | suben')}
                  <InfoTip>{squaresScaleTip(t)}</InfoTip>
                </th>
                <th scope="col">{t('Yearly values', 'Valores anuales')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ measure, variable }) => (
                <MeasureRow
                  key={measure.key}
                  zoneId={zoneId}
                  measure={measure}
                  variable={variable}
                  selected={selected?.measure.key === measure.key}
                  onSelect={() => select(measure)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="tr-small muted">
          {t(
            'Squares: 1° squares with a clear fall or rise (corrected for testing many), out of those tested.',
            'Cuadros: cuadros de 1° con una bajada o subida clara (corregido por probar muchos), del total probado.',
          )}
          {missing &&
            notAvailable.length > 0 &&
            t(
              ` Not available for the ${heading}: ${notAvailable.map((k) => { const m = measureFor(k); return m ? measureName(m, t) : k }).join(', ')}.`,
              ` No disponible para la ${heading}: ${notAvailable.map((k) => { const m = measureFor(k); return m ? measureName(m, t) : k }).join(', ')}.`,
            )}
        </p>
      </section>

      {selected && (
        <section ref={detailRef} aria-labelledby="tr-detail-title" className="tr-section tr-detail">
          <div className="tr-detail-chart">
            <h2 id="tr-detail-title">
              {`${measureName(selected.measure, t)}, ${heading}`}
            </h2>
            <p className="tr-small muted tr-units">
              {selected.variable.units === 'unitless'
                ? t('Yearly mean, no units', 'Media anual, sin unidades')
                : t(`Yearly values in ${selected.variable.units}`, `Valores anuales en ${localizeUnits(selected.variable.units, t)}`)}
            </p>
            <ZoneChart
              key={yearKey}
              zoneId={zoneId}
              variable={selected.variable}
              measure={selected.measure}
              year={year}
              onYear={(y) => setPicked({ key: yearKey, year: y })}
            />
            <p className="tr-small muted">
              {`${t('Source', 'Fuente')}: ${selected.measure.source}`}
            </p>
          </div>
          <aside className="tr-detail-text" aria-labelledby="tr-means-title">
            <h3 id="tr-means-title">{t('What this means', 'Qué significa')}</h3>
            <Meaning zoneId={zoneId} report={report} heading={heading} measure={selected.measure} variable={selected.variable} year={year} />
            {selected.measure.map && (
              <p>
                <ViewLink view="map" params={selected.measure.map} className="btn primary">
                  {t('See it on the map', 'Verlo en el mapa')}
                </ViewLink>
              </p>
            )}
          </aside>
        </section>
      )}

      {selected && <TrendMethod report={report} validation={validation} measure={selected.measure} />}

      <footer className="tr-foot tr-small muted">
        <p>
          {t(
            'Sources: NASA MODIS MOD13C2, MOD11C3 and MCD64A1 (LP DAAC), NASA GPM IMERG (GES DISC) and Hansen/UMD/Google/USGS/NASA Global Forest Change. Zone values are area-weighted means of the 1° squares. The Brazilian and Peruvian parts hold the squares that lie mostly inside each country.',
            'Fuentes: NASA MODIS MOD13C2, MOD11C3 y MCD64A1 (LP DAAC), NASA GPM IMERG (GES DISC) y Hansen/UMD/Google/USGS/NASA Global Forest Change. Los valores por zona son medias ponderadas por área de los cuadros de 1°. Las partes brasileña y peruana reúnen los cuadros que quedan mayormente dentro de cada país.',
          )}
        </p>
        <p>{report.aiDisclosure}</p>
        <p>
          <ViewLink view="checks">{t('Cross-checks', 'Contrastes')}</ViewLink> ·{' '}
          <ViewLink view="method" hash="trend-test">
            {t('Method and sources', 'Método y fuentes')}
          </ViewLink>
        </p>
      </footer>
    </div>
  )
}

// Zone selector

interface ZoneSelectorProps {
  ids: string[]
  labels: Record<string, string>
  value: string
  compact: boolean
  onChange: (id: string) => void
}

function ZoneSelector({ ids, labels, value, compact, onChange }: ZoneSelectorProps) {
  const { t } = useLang()
  if (compact) {
    return (
      <div className="tr-zone-select">
        <label htmlFor="tr-zone">{t('Zone', 'Zona')}</label>
        <select id="tr-zone" value={value} onChange={(e) => onChange(e.target.value)}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {labels[id]}
            </option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <fieldset className="tr-seg">
      <legend>{t('Zone', 'Zona')}</legend>
      {ids.map((id) => (
        <label key={id}>
          <input type="radio" name="tr-zone" value={id} checked={id === value} onChange={() => onChange(id)} />
          <span>{labels[id]}</span>
        </label>
      ))}
    </fieldset>
  )
}

// Direction and counts

function DirectionIcon({ direction }: { direction: Direction }) {
  const path =
    direction === 'falling' ? 'M2 4 L12 12 M12 12 L12 6 M12 12 L6 12' : direction === 'rising' ? 'M2 12 L12 4 M12 4 L12 10 M12 4 L6 4' : 'M2 8 L12 8'
  return (
    <svg className={`tr-dir tr-dir-${direction}`} width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" focusable="false">
      {direction === 'untested' ? <path d="M3 8 L11 8" strokeDasharray="2 2" /> : <path d={path} />}
    </svg>
  )
}

function SquareBar({ tested, down, up }: { tested: number; down: number; up: number }) {
  // The bar widths are CSS ratios of the backend's counts; nothing is divided in the browser.
  return (
    <span className="tr-sqbar" style={{ '--n-total': tested, '--n-down': down, '--n-up': up } as CSSProperties} aria-hidden="true">
      <span className="tr-sq-down" />
      <span className="tr-sq-up" />
    </span>
  )
}

/** Why a zone answer and the count of squares can differ: each is true at its own scale. */
function squaresScaleTip(t: Tr): string {
  return t(
    "The zone test uses the zone's yearly average. Rises in some squares and falls in others can cancel out, and a change in part of the zone may not move the average. Both answers are true, each at its own scale. Squares are not independent: neighbours share the same weather years, so the count is not that many separate proofs. Read the zone result and its interval first; the count shows where the change is.",
    'El test de la zona usa el promedio anual de la zona. Subidas en unos cuadros y bajadas en otros pueden compensarse, y un cambio en una parte puede no mover el promedio. Ambas respuestas son ciertas, cada una a su escala. Los cuadros no son independientes: los vecinos comparten los mismos años de clima, así que el conteo no equivale a tantas pruebas separadas. Lee primero el resultado de la zona y su intervalo; el conteo muestra dónde está el cambio.',
  )
}

function squaresText(variable: ZoneVariable, t: Tr): string | null {
  const c = variable.cellSummary
  if (!c) return null
  return t(
    `${c.significantDecreasing} falling and ${c.significantIncreasing} rising, of ${c.tested} squares tested`,
    `${c.significantDecreasing} bajan y ${c.significantIncreasing} suben, de ${c.tested} cuadros probados`,
  )
}

/** The slope with its units, and what the rule adds: "(95 % CI a to b)" for a clear trend, a "?" tip for one that is not clear. */
function SlopeWithRule({ trend, units, block = false }: { trend: NonNullable<ZoneVariable['zoneTrend']>; units: string; block?: boolean }) {
  const { t } = useLang()
  if (trend.slopePerDecade === null) return <>—</>
  const { value, unit } = slopeParts(trend.slopePerDecade, units, t)
  const ci = ciInline(trend.slopeCi95, t)
  return (
    <>
      <span className="mono">
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
      {!trend.significant && <InfoTip mark="question">{unclearTip({ p: trend.pValue, ci: trend.slopeCi95 }, t)}</InfoTip>}
      {block && <span className="tr-small muted tr-block">{t('per decade', 'por década')}</span>}
      {trend.significant && ci && <span className="tr-small muted tr-block">{ci}</span>}
    </>
  )
}

/** One InfoTip for several short notes (the notes that are null are left out); nothing is shown when there are none. */
function CardTip({ notes, label }: { notes: (string | null | undefined | false)[]; label?: string }) {
  const shown = notes.filter((n): n is string => typeof n === 'string' && n !== '')
  return shown.length > 0 ? <InfoTip label={label}>{shown.join(' ')}</InfoTip> : null
}

/** The notes of a measure's zone result, in one list: the p-value, the borderline and level notes of loss, why the test ends or starts there. */
function resultNotes(zoneId: string, measure: Measure, trend: NonNullable<ZoneVariable['zoneTrend']>, hansenInfo: HansenInfo, t: Tr): (string | null)[] {
  const hansen = measure.key === 'lossKm2' ? methodChangeText(hansenInfo, t) : null
  return [
    trend.significant ? clearTip({ p: trend.pValue, ci: trend.slopeCi95 }, t) : null,
    borderlineLossTip(zoneId, measure.key, trend.significant, t),
    lossLevelTip(zoneId, measure.key, t),
    measure.drift ? testEndNote(trend.years[1], t) : null,
    hansen,
  ]
}

/** The tag "Clear trend" or "Not clear"; the notes of the result (p-value, caveats) go in ONE tip after it. */
function ClearTag({ zoneId, measure, trend, withNotes = true }: { zoneId: string; measure: Measure; trend: NonNullable<ZoneVariable['zoneTrend']>; withNotes?: boolean }) {
  const { t } = useLang()
  const hansen = useHansenInfo()
  return (
    <>
      <span className={trend.significant ? 'tr-tag is-clear' : 'tr-tag'}>
        {trend.significant ? t('Clear trend', 'Tendencia clara') : t('Not clear', 'No es clara')}
      </span>
      {withNotes && <CardTip notes={resultNotes(zoneId, measure, trend, hansen, t)} />}
    </>
  )
}

// Table row

function MeasureRow({ zoneId, measure, variable, selected, onSelect }: { zoneId: string; measure: Measure; variable: ZoneVariable; selected: boolean; onSelect: () => void }) {
  const { t } = useLang()
  const trend = variable.zoneTrend
  const cells = variable.cellSummary
  const direction = directionOfTrend(trend)
  const hansen = useHansenInfo()
  return (
    <tr className={selected ? 'is-selected' : undefined}>
      <th scope="row" data-label={t('Measure', 'Medida')}>
        <button type="button" className="tr-rowbtn" aria-pressed={selected} onClick={onSelect}>
          {measureName(measure, t)}
        </button>
        <span className="tr-small muted tr-units">{variable.units === 'unitless' ? t('no units', 'sin unidades') : localizeUnits(variable.units, t)}</span>
      </th>
      <td data-label={t('Years tested', 'Años probados')}>
        {trend ? periodOf(trend) : '—'}
        {trend && (measure.drift || measure.key === 'lossKm2') && (
          <CardTip
            label={measure.drift ? t('Why the test ends there', 'Por qué el test termina ahí') : undefined}
            notes={[measure.drift ? testEndNote(trend.years[1], t) : null, measure.key === 'lossKm2' ? methodChangeText(hansen, t) : null]}
          />
        )}
      </td>
      <td data-label={t('Direction', 'Dirección')}>
        <span className="tr-dirtext">
          <DirectionIcon direction={direction} />
          {directionWord(direction, t)}
        </span>
      </td>
      <td data-label={t('Change per decade', 'Cambio por década')} className="tr-num">
        {trend ? <SlopeWithRule trend={trend} units={variable.units} block /> : '—'}
      </td>
      <td data-label={t('Clear trend?', '¿Tendencia clara?')}>
        {trend ? <ClearTag zoneId={zoneId} measure={measure} trend={trend} withNotes={false} /> : <span className="muted">{t('Not tested', 'Sin probar')}</span>}
        {trend && <CardTip notes={[trend.significant ? clearTip({ p: trend.pValue, ci: trend.slopeCi95 }, t) : null, borderlineLossTip(zoneId, measure.key, trend.significant, t), lossLevelTip(zoneId, measure.key, t)]} />}
      </td>
      <td data-label={t('Squares falling | rising', 'Cuadros que bajan | suben')}>
        {cells ? (
          <>
            <span className="tr-squares">
              <span className="tr-sq-n">{cells.significantDecreasing}</span>
              <SquareBar tested={cells.tested} down={cells.significantDecreasing} up={cells.significantIncreasing} />
              <span className="tr-sq-n">{cells.significantIncreasing}</span>
            </span>
            <span className="tr-small muted tr-block" aria-hidden="true">
              {t(`of ${cells.tested} tested`, `de ${cells.tested} probados`)}
            </span>
            <span className="sr-only">{squaresText(variable, t)}</span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td data-label={t('Yearly values', 'Valores anuales')}>
        <Sparkline variable={variable} measure={measure} />
      </td>
    </tr>
  )
}

// Headline cards

function Kpi({ zoneId, measure, variable, selected, onSelect }: { zoneId: string; measure: Measure; variable: ZoneVariable; selected: boolean; onSelect: () => void }) {
  const { t } = useLang()
  const trend = variable.zoneTrend
  const cells = variable.cellSummary
  let body: ReactNode

  if (!trend) {
    // Tree cover: first and last year with a value, and their difference (B minus A)
    const known = variable.annual.filter((p) => p.value !== null)
    const first = known[0]
    const last = known[known.length - 1]
    body =
      first && last ? (
        <>
          <p className="tr-kpi-value mono">
            {formatValue(first.value as number, variable.units)} → {formatValue(last.value as number, variable.units)}
          </p>
          <p className="tr-small">
            {first.year} → {last.year}: {formatSignedNumber((last.value as number) - (first.value as number))} {t('points', 'puntos')}.
          </p>
          <p className="tr-small muted">
            {t('— Not tested.', '— Sin probar.')}
            <InfoTip label={t('Why it is not tested', 'Por qué no se prueba')}>
              {t('It can only go down, because regrowth is not counted.', 'Solo puede bajar, porque no cuenta el rebrote.')}
            </InfoTip>
          </p>
        </>
      ) : (
        <p className="muted">{t('No values.', 'Sin valores.')}</p>
      )
  } else {
    const direction = directionOfTrend(trend)
    const { value, unit } = trend.slopePerDecade === null ? { value: '—', unit: '' } : slopeParts(trend.slopePerDecade, variable.units, t)
    const ci = ciInline(trend.slopeCi95, t)
    body = (
      <>
        <p className="tr-kpi-dir">
          <DirectionIcon direction={direction} />
          {directionWord(direction, t)}
        </p>
        <p className="tr-kpi-value mono">
          {value}
          {unit && <small> {unit}</small>}
          {!trend.significant && trend.slopePerDecade !== null && <InfoTip mark="question">{unclearTip({ p: trend.pValue, ci: trend.slopeCi95 }, t)}</InfoTip>}
        </p>
        <p className="tr-small">
          {t('per decade', 'por década')}, {periodOf(trend)}.{' '}
          <ClearTag zoneId={zoneId} measure={measure} trend={trend} />
        </p>
        {trend.significant && ci && <p className="tr-small muted">{ci}</p>}
        {cells && (
          <p className="tr-small muted">
            {t(
              `${cells.significantDecreasing} squares falling, ${cells.significantIncreasing} rising, of ${cells.tested} tested.`,
              `${cells.significantDecreasing} cuadros bajan, ${cells.significantIncreasing} suben, de ${cells.tested} probados.`,
            )}
            <InfoTip>{squaresScaleTip(t)}</InfoTip>
          </p>
        )}
      </>
    )
  }

  return (
    <div className={selected ? 'tr-kpi is-selected' : 'tr-kpi'}>
      <p className="tr-kpi-label">{measureName(measure, t)}</p>
      {body}
      <button type="button" className="tr-link" aria-pressed={selected} onClick={onSelect}>
        {t('Show the chart', 'Ver el gráfico')}
      </button>
    </div>
  )
}

// Plain-language reading

function Meaning({ zoneId, report, heading, measure, variable, year }: { zoneId: string; report: ZonesReport; heading: string; measure: Measure; variable: ZoneVariable; year: number | null }) {
  const { t } = useLang()
  const hansen = useHansenInfo()
  const trend = variable.zoneTrend
  const cells = variable.cellSummary
  const zone = t(`the ${heading}`, `la ${heading}`)
  const name = measureName(measure, t)
  const range = year === null ? null : rangeSentence(variable, year, t)
  const known = variable.annual.filter((p) => p.value !== null)
  const first = known[0]
  const last = known[known.length - 1]

  const sentence = (): string => {
    if (!trend || trend.slopePerDecade === null) return ''
    const size = slopeSentence(Math.abs(trend.slopePerDecade), variable.units, t).replace(/^\+/, '')
    const [y0, y1] = trend.years
    const falling = trend.slopePerDecade < 0
    if (trend.significant && trend.slopePerDecade === 0)
      return t(
        `${name} in ${zone} shows a clear order from ${y0} to ${y1} but no measurable slope, so we do not call it a trend.`,
        `${name} en ${zone} muestra un orden claro de ${y0} a ${y1}, pero sin pendiente medible, así que no lo llamamos tendencia.`,
      )
    if (trend.significant) {
      const p = pPhrase(trend.pValue)
      const ci = ciInline(trend.slopeCi95, t)
      return t(
        `${name} in ${zone} ${falling ? 'fell' : 'rose'} by about ${size} from ${y0} to ${y1} ${ci}${p ? ` (${p}, α = ${report.alpha})` : ''}.`,
        `${name} en ${zone} ${falling ? 'bajó' : 'subió'} unos ${size} de ${y0} a ${y1} ${ci}${p ? ` (${p}, α = ${report.alpha})` : ''}.`,
      ).replace(/\s+\./, '.')
    }
    return t(
      `${name} in ${zone}: ${falling ? 'down' : 'up'} by about ${size} from ${y0} to ${y1}, not a clear trend.`,
      `${name} en ${zone}: ${falling ? 'a la baja' : 'al alza'} unos ${size} de ${y0} a ${y1}, sin tendencia clara.`,
    )
  }

  return (
    <div className="tr-meaning">
      {!trend ? (
        <p>
          {first && last
            ? t(
                `${name} in ${zone} went from ${formatValue(first.value as number, variable.units)} in ${first.year} to ${formatValue(last.value as number, variable.units)} in ${last.year}. Not tested.`,
                `${name} en ${zone} pasó de ${formatValue(first.value as number, variable.units)} en ${first.year} a ${formatValue(last.value as number, variable.units)} en ${last.year}. Sin probar.`,
              )
            : t(`${name} has no values for ${zone}.`, `${name} no tiene valores para ${zone}.`)}
          <InfoTip label={t('Why it is not tested', 'Por qué no se prueba')}>
            {t('It can only go down, because regrowth is not counted.', 'Solo puede bajar, porque no cuenta el rebrote.')}
          </InfoTip>
        </p>
      ) : (
        <p>
          <span>{sentence()}</span>
          {!trend.significant && trend.slopePerDecade !== null && <InfoTip mark="question">{unclearTip({ p: trend.pValue, ci: trend.slopeCi95 }, t)}</InfoTip>}
          <CardTip
            notes={[
              borderlineLossTip(zoneId, measure.key, trend.significant, t),
              lossLevelTip(zoneId, measure.key, t),
              measure.key === 'lossKm2' ? methodChangeText(hansen, t) : null,
            ]}
          />
        </p>
      )}
      {range && <p>{range}</p>}
      {cells && (
        <p>
          {t(
            `Of the ${cells.tested} squares tested, ${cells.significantDecreasing} fell and ${cells.significantIncreasing} rose clearly.`,
            `De los ${cells.tested} cuadros probados, ${cells.significantDecreasing} bajaron y ${cells.significantIncreasing} subieron con claridad.`,
          )}
          <InfoTip>{squaresScaleTip(t)}</InfoTip>
        </p>
      )}
      {measure.note && <p className="tr-small muted">{measureNote(measure, t)}</p>}
      <p className="tr-small muted">
        {t('A trend describes a pattern in measurements. It does not say what caused it.', 'Una tendencia describe un patrón en las mediciones. No dice qué lo causó.')}
      </p>
      {unitParts(variable.units).value === '' && measure.kind === 'line' && (
        <p className="tr-small muted">
          {t(
            'The index has no units: it is a ratio of satellite readings, higher means greener.',
            'El índice no tiene unidades: es un cociente de lecturas del satélite; más alto significa más verde.',
          )}
        </p>
      )}
    </div>
  )
}
