// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "Cross-checks" tab of the drawer: how far the independent tree cover datasets agree, and where loss and fire
// coincide. Everything is descriptive and comes from the validation report: r values carry no p-value, there is no
// significance wording, and co-location with fire is never presented as a cause.

import { useState } from 'react'
import type { Hotspot, ValidationCase, ValidationReport, ValidationZone } from '../../shared/contracts.ts'
import { formatCoordinates, formatPercent, formatPoints, formatShare } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'
import { ViewLink } from './ViewLink.tsx'
import { BarChart, CoverChart } from './CoverCharts.tsx'

export interface ValidationPanelProps {
  report: ValidationReport | null
  loading: boolean
  error: string | null
  /** Years of the MODIS series the API flags as suspect, drawn hollow in the case charts. */
  flaggedModisYears: number[]
  onShowHotspot: (hotspot: Hotspot) => void
  onShowCase: (place: ValidationCase, peakYear: number) => void
}

const DOI_LABEL: Record<string, string> = {
  MOD44B: 'NASA MOD44B v061, MODIS tree cover',
  HANSEN: 'Hansen/UMD Global Forest Change (Hansen et al. 2013)',
  MCD64A1: 'NASA MCD64A1 v061, MODIS burned area',
}

/** "MAAP #233 (Sep 2025), https://…" -> the text and the link, so the link can be a real anchor. */
function splitReference(reference: string): { text: string; url: string | null } {
  const url = /https?:\/\/\S+/.exec(reference)?.[0] ?? null
  return { text: reference.replace(url ?? '', '').replace(/[,\s]+$/, ''), url }
}

/** Year of the highest value of a yearly series (where the case is shown on the map). */
function peakYear(years: number[], values: (number | null)[]): number {
  let best = years[years.length - 1]
  let max = -Infinity
  values.forEach((v, i) => {
    if (v !== null && v > max) {
      max = v
      best = years[i]
    }
  })
  return best
}

function AgreementCard({ zone }: { zone: ValidationZone }) {
  const { t } = useLang()
  const a = zone.agreement2000
  return (
    <section className="vcard" aria-labelledby="v-agree">
      <h3 id="v-agree">{t('Do the two tree cover datasets agree? (year 2000)', '¿Coinciden los dos datos de cobertura arbórea? (año 2000)')}</h3>
      <p className="small">
        {t(
          `Across ${a.cells.toLocaleString('en-US')} small cells, MODIS and Hansen agree on where tree cover is dense and where it is sparse${a.r !== null ? ` (r = ${a.r.toFixed(2)}, a descriptive measure with no p-value)` : ''}. But MODIS reads ${Math.abs(a.biasPp).toFixed(1)} points ${a.biasPp < 0 ? 'lower' : 'higher'} than Hansen on average (typical gap ${a.rmsePp.toFixed(1)} points). That is why SIGNO uses MODIS to confirm where change happened, not how much tree cover there is.`,
          `En ${a.cells.toLocaleString('en-US')} celdas pequeñas, MODIS y Hansen coinciden en dónde la cobertura es densa y dónde es escasa${a.r !== null ? ` (r = ${a.r.toFixed(2)}, una medida descriptiva sin valor p)` : ''}. Pero MODIS marca ${Math.abs(a.biasPp).toFixed(1)} puntos ${a.biasPp < 0 ? 'menos' : 'más'} que Hansen en promedio (diferencia típica de ${a.rmsePp.toFixed(1)} puntos). Por eso SIGNO usa MODIS para confirmar dónde hubo cambio, no cuánta cobertura hay.`,
        )}
      </p>
      <table className="vtable">
        <caption className="sr-only">{t('Mean tree cover by Hansen class, Hansen and MODIS', 'Cobertura media por clase de Hansen, Hansen y MODIS')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('Hansen class (% tree cover)', 'Clase de Hansen (% de cobertura)')}</th>
            <th scope="col">{t('Cells', 'Celdas')}</th>
            <th scope="col">Hansen</th>
            <th scope="col">MODIS</th>
          </tr>
        </thead>
        <tbody>
          {a.byHansenClass.map((c) => (
            <tr key={c.hansenRange.join('-')}>
              <th scope="row">
                {c.hansenRange[0]}–{c.hansenRange[1]} %
              </th>
              <td className="mono">{c.cells.toLocaleString('en-US')}</td>
              <td>
                <span className="mono">{formatPercent(c.hansenMean)}</span>
                <span className="hbar" aria-hidden="true">
                  <i className="hansen" style={{ width: `${c.hansenMean}%` }} />
                </span>
              </td>
              <td>
                <span className="mono">{formatPercent(c.modisMean)}</span>
                <span className="hbar" aria-hidden="true">
                  <i className="modis" style={{ width: `${c.modisMean}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ChangeCard({ zone }: { zone: ValidationZone }) {
  const { t } = useLang()
  const c = zone.changeVsLoss
  const maxAbs = Math.max(1, ...c.byLossDecile.map((d) => Math.abs(d.modisChangePpMean)))
  return (
    <section className="vcard" aria-labelledby="v-change">
      <h3 id="v-change">{t('Does MODIS see change where Hansen sees loss?', '¿Ve MODIS cambio donde Hansen ve pérdida?')}</h3>
      <p className="small">
        {t(
          `Cells are sorted into ten groups by the share of their area Hansen lost since 2001 (group 1 lost the least, group 10 the most). Bars show how much MODIS tree cover changed in each group (${c.definition}).`,
          `Las celdas se ordenan en diez grupos según la parte de su área que Hansen registró como perdida desde 2001 (el grupo 1 perdió lo menos, el 10 lo más). Las barras muestran cuánto cambió la cobertura MODIS en cada grupo (${c.definition}).`,
        )}
        {c.r !== null ? t(` Across cells r = ${c.r.toFixed(2)} (descriptive, no p-value).`, ` Entre celdas r = ${c.r.toFixed(2)} (descriptivo, sin valor p).`) : ''}{' '}
        {t(
          'This change is the mean 2024–25 minus the mean 2001–02 and includes the MODIS 2025 year flagged as suspect. This confirms where tree cover changed, not by how much.',
          'Este cambio es la media 2024–25 menos la media 2001–02 e incluye el año 2025 de MODIS marcado como dudoso. Confirma dónde cambió la cobertura, no cuánto.',
        )}
      </p>
      <table className="vtable">
        <caption className="sr-only">{t('MODIS tree cover change by group of Hansen loss', 'Cambio de cobertura MODIS por grupo de pérdida de Hansen')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('Group', 'Grupo')}</th>
            <th scope="col">{t('Hansen loss (share of area)', 'Pérdida de Hansen (parte del área)')}</th>
            <th scope="col">{t('MODIS change (points)', 'Cambio MODIS (puntos)')}</th>
          </tr>
        </thead>
        <tbody>
          {c.byLossDecile.map((d) => (
            <tr key={d.decile}>
              <th scope="row">{d.decile}</th>
              <td className="mono">{formatShare(d.hansenLossShareMean)}</td>
              <td>
                <span className="mono">{formatPoints(d.modisChangePpMean)}</span>
                <span className="dbar" aria-hidden="true">
                  <i
                    className={d.modisChangePpMean < 0 ? 'down' : 'up'}
                    style={{ width: `${(Math.abs(d.modisChangePpMean) / maxAbs) * 50}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const SW = 640
const SH = 180
const SPAD = { left: 44, right: 10, top: 10, bottom: 24 }

function FireCard({ zone }: { zone: ValidationZone }) {
  const { t } = useLang()
  const years = zone.lossWithFire.years
  const n = years.length
  const step = (SW - SPAD.left - SPAD.right) / Math.max(1, n)
  const y = (share: number) => SPAD.top + (1 - share) * (SH - SPAD.top - SPAD.bottom)
  const mostWithoutFire = n > 0 && years.every((year) => year.share < 0.5)
  return (
    <section className="vcard" aria-labelledby="v-fire">
      <h3 id="v-fire">{t('Is the loss where fire was detected?', '¿Está la pérdida donde se detectó fuego?')}</h3>
      <p>
        <strong>{t('Same place is not the same cause.', 'Mismo lugar no es misma causa.')}</strong>
        {mostWithoutFire &&
          t(
            ` In ${zone.label} most loss happens without fire: in every year, more than half of the loss was in cells with no burned area.`,
            ` En ${zone.label} la mayor parte de la pérdida ocurre sin fuego: en todos los años, más de la mitad de la pérdida estuvo en celdas sin área quemada.`,
          )}
      </p>
      <p className="small">
        {t(
          'Bars: the share of each year’s tree cover loss that fell in cells where burned area was also detected. Ticks: the share of all cells in the zone that burned that year or the year before (the base rate). Loss and fire in the same place show where the two coincide. They do not show that fire caused the loss, or the other way round.',
          'Barras: la parte de la pérdida de cada año que cayó en celdas donde también se detectó área quemada. Marcas: la parte de todas las celdas de la zona que se quemó ese año o el anterior (la tasa base). Pérdida y fuego en el mismo lugar muestran dónde coinciden. No muestran que el fuego causó la pérdida, ni al revés.',
        )}
      </p>
      <figure className="chart">
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          role="img"
          aria-label={t(
            `Share of yearly tree cover loss in cells with burned area, ${years[0]?.year} to ${years[n - 1]?.year}, for ${zone.label}, with the share of cells burned as a base rate`,
            `Parte de la pérdida anual en celdas con área quemada, ${years[0]?.year} a ${years[n - 1]?.year}, para ${zone.label}, con la parte de celdas quemadas como tasa base`,
          )}
        >
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line className="grid" x1={SPAD.left} x2={SW - SPAD.right} y1={y(tick)} y2={y(tick)} />
              <text className="tick" x={SPAD.left - 6} y={y(tick) + 3} textAnchor="end">
                {tick * 100} %
              </text>
            </g>
          ))}
          {years.map((year, i) => (
            <g key={year.year}>
              <rect
                className="bar bar-burned"
                x={SPAD.left + step * i + step * 0.12}
                width={step * 0.76}
                y={y(year.share)}
                height={Math.max(0, SH - SPAD.bottom - y(year.share))}
              >
                <title>
                  {t(
                    `${year.year}: ${formatShare(year.share)} of the loss in cells with burned area; ${formatShare(year.zoneShareOfCellsBurned)} of cells burned`,
                    `${year.year}: ${formatShare(year.share)} de la pérdida en celdas con área quemada; ${formatShare(year.zoneShareOfCellsBurned)} de celdas quemadas`,
                  )}
                </title>
              </rect>
              <line
                className="base-rate"
                x1={SPAD.left + step * i + step * 0.04}
                x2={SPAD.left + step * (i + 1) - step * 0.04}
                y1={y(year.zoneShareOfCellsBurned)}
                y2={y(year.zoneShareOfCellsBurned)}
              />
              {year.year % 5 === 0 && (
                <text className="tick" x={SPAD.left + step * (i + 0.5)} y={SH - 6} textAnchor="middle">
                  {year.year}
                </text>
              )}
            </g>
          ))}
        </svg>
        <figcaption>
          {t('Bars: loss in cells with fire · black ticks: cells with fire (base rate)', 'Barras: pérdida en celdas con fuego · marcas negras: celdas con fuego (tasa base)')}
        </figcaption>
      </figure>
      <details className="values-table">
        <summary>{t('Show values', 'Mostrar valores')}</summary>
        <table>
          <caption className="sr-only">{t('Tree cover loss in cells with burned area by year', 'Pérdida de cobertura en celdas con área quemada por año')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Year', 'Año')}</th>
              <th scope="col">{t('Loss (km²)', 'Pérdida (km²)')}</th>
              <th scope="col">{t('Loss in burned cells (km²)', 'Pérdida en celdas quemadas (km²)')}</th>
              <th scope="col">{t('Share', 'Proporción')}</th>
              <th scope="col">{t('Base rate', 'Tasa base')}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year.year}>
                <th scope="row">{year.year}</th>
                <td className="mono">{year.lossKm2.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="mono">{year.lossInBurnedCellsKm2.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="mono">{formatShare(year.share)}</td>
                <td className="mono">{formatShare(year.zoneShareOfCellsBurned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="small muted">{zone.lossWithFire.definition}</p>
    </section>
  )
}

function CasesCard({
  zone,
  cases,
  flaggedModisYears,
  onShowHotspot,
  onShowCase,
}: {
  zone: ValidationZone
  cases: ValidationCase[]
  flaggedModisYears: number[]
  onShowHotspot: (hotspot: Hotspot) => void
  onShowCase: (place: ValidationCase, peakYear: number) => void
}) {
  const { t } = useLang()
  return (
    <section className="vcard" aria-labelledby="v-places">
      <h3 id="v-places">{t('Hotspots of tree cover loss and documented places', 'Puntos críticos de pérdida y lugares documentados')}</h3>
      <p className="small">
        {t(
          'Select a place to open it on the map, in the tree cover view at its year of largest loss.',
          'Elige un lugar para abrirlo en el mapa, en la vista de cobertura y en su año de mayor pérdida.',
        )}
      </p>
      <ol className="hotspots" aria-label={t(`Hotspots in ${zone.label}`, `Puntos críticos en ${zone.label}`)}>
        {zone.hotspots.map((h, i) => (
          <li key={`${h.apiCellId}-${h.lat}-${h.lon}-${i}`}>
            <button type="button" className="hotspot" onClick={() => onShowHotspot(h)}>
              <span className="mono">
                {formatCoordinates(h.lat, h.lon, 2)} · {h.apiCellId}
              </span>
              <span className="small">
                {t(
                  `Largest loss in ${h.peakLossYear} (${formatShare(h.peakLossShare)} of the local area). Lost since 2001: ${formatShare(h.hansenLossShare)}. Tree cover in 2000: ${formatPercent(h.hansenTreeCover2000)}. MODIS change: ${formatPoints(h.modisChangePp)} (mean 2024–25 minus mean 2001–02, includes the MODIS 2025 year flagged as suspect).`,
                  `Mayor pérdida en ${h.peakLossYear} (${formatShare(h.peakLossShare)} del área local). Perdido desde 2001: ${formatShare(h.hansenLossShare)}. Cobertura en 2000: ${formatPercent(h.hansenTreeCover2000)}. Cambio MODIS: ${formatPoints(h.modisChangePp).replace('points', 'puntos')} (media 2024–25 menos media 2001–02, incluye el año 2025 de MODIS marcado como dudoso).`,
                )}
              </span>
              <span className="small muted">
                {h.burnedYears.length === 0
                  ? t('No burned area detected here', 'No se detectó área quemada aquí')
                  : t(
                      `Burned area detected in ${h.burnedYears.length} year${h.burnedYears.length === 1 ? '' : 's'}`,
                      `Área quemada detectada en ${h.burnedYears.length} ${h.burnedYears.length === 1 ? 'año' : 'años'}`,
                    )}
              </span>
              <span className="small action">{t('Show on the map', 'Ver en el mapa')}</span>
            </button>
          </li>
        ))}
      </ol>

      {cases.map((place) => {
        const ref = splitReference(place.reference)
        const peak = peakYear(place.lossYears, place.hansenLossShare)
        return (
          <article key={place.id} className="case-card" aria-labelledby={`case-${place.id}`}>
            <h4 id={`case-${place.id}`}>{place.label}</h4>
            <p className="small muted mono">
              {formatCoordinates(place.lat, place.lon, 2)} · {t('cell', 'celda')} {place.apiCellId}
            </p>
            {place.id === 'la_pampa' && (
              <p className="small">
                {t(
                  'In the data, Hansen loss here starts in 2012, jumps in 2014, pauses in 2020–21 and resumes in 2023. Gold mining in La Pampa is documented by',
                  'En los datos, la pérdida de Hansen aquí empieza en 2012, salta en 2014, se detiene en 2020–21 y vuelve en 2023. La minería de oro en La Pampa está documentada por',
                )}{' '}
                {ref.text}
                {ref.url && (
                  <>
                    {' '}
                    (
                    <a href={ref.url} target="_blank" rel="noreferrer">
                      {t('source', 'fuente')}
                    </a>
                    )
                  </>
                )}
                .{' '}
                {t(
                  'SIGNO’s data do not identify causes: they show where and when the tree cover changed.',
                  'Los datos de SIGNO no identifican causas: muestran dónde y cuándo cambió la cobertura.',
                )}
              </p>
            )}
            {place.id !== 'la_pampa' && (
              <p className="small">
                {t('Reference', 'Referencia')}: {ref.text}
                {ref.url && (
                  <>
                    {' '}
                    (
                    <a href={ref.url} target="_blank" rel="noreferrer">
                      {t('source', 'fuente')}
                    </a>
                    )
                  </>
                )}
                .
              </p>
            )}
            <CoverChart
              years={place.years}
              hansen={place.hansenTreeCover}
              modis={place.modisTreeCover}
              selectedYear={null}
              flaggedModisYears={flaggedModisYears}
              label={t(
                `Tree cover at ${place.label}, Hansen and MODIS, ${place.years[0]} to ${place.years[place.years.length - 1]}`,
                `Cobertura en ${place.label}, Hansen y MODIS, ${place.years[0]} a ${place.years[place.years.length - 1]}`,
              )}
            />
            <h5 className="subhead">{t('Share of the area lost each year (Hansen)', 'Parte del área perdida cada año (Hansen)')}</h5>
            <BarChart
              years={place.lossYears}
              values={place.hansenLossShare}
              selectedYear={null}
              tone="loss"
              unit="percent"
              label={t(
                `Share of the area lost each year at ${place.label}, ${place.lossYears[0]} to ${place.lossYears[place.lossYears.length - 1]}`,
                `Parte del área perdida cada año en ${place.label}, ${place.lossYears[0]} a ${place.lossYears[place.lossYears.length - 1]}`,
              )}
            />
            <p className="small">
              {t('Months with burned area detected here', 'Meses con área quemada detectada aquí')} ({place.burnedPeriod}):{' '}
              <strong>{place.burnedMonths}</strong>
              {place.burnedMonths > 0 ? ` (${place.burnedMonthsList.join(', ')})` : ''}.
            </p>
            <button type="button" className="btn" onClick={() => onShowCase(place, peak)}>
              {t('Show on the map', 'Ver en el mapa')}
            </button>
          </article>
        )
      })}
    </section>
  )
}

export function ValidationPanel({ report, loading, error, flaggedModisYears, onShowHotspot, onShowCase }: ValidationPanelProps) {
  const { t } = useLang()
  const [zoneId, setZoneId] = useState<string | null>(null)
  if (loading) return <p className="muted small">{t('Loading the cross-checks…', 'Cargando los contrastes…')}</p>
  if (error) return <p className="error small">{error}</p>
  if (!report) return null
  const zone = report.zones.find((z) => z.zoneId === zoneId) ?? report.zones[0]
  if (!zone) return <p className="muted small">{t('The report has no zones.', 'El informe no tiene zonas.')}</p>

  return (
    <section id="panel-validation" role="tabpanel" aria-labelledby="tab-validation" className="validation">
      <p className="small">
        {t(
          'Cross-checks of the tree cover data against an independent dataset and against fire. They are descriptive: they do not test trends, and none of them says why tree cover changed. The trend test and its own checks are in',
          'Contrastes de los datos de cobertura con un dato independiente y con el fuego. Son descriptivos: no prueban tendencias, y ninguno dice por qué cambió la cobertura. El test de tendencia y sus propias comprobaciones están en',
        )}{' '}
        <ViewLink view="trends" hash="how-it-works">
          {t('How the test works', 'Cómo funciona el test')}
        </ViewLink>{' '}
        ({t('Trends view', 'vista Tendencias')}).
      </p>
      <div className="zone-pick">
        <label htmlFor="zone-select" className="kicker">
          {t('Zone', 'Zona')}
        </label>
        <select id="zone-select" className="select" value={zone.zoneId} onChange={(event) => setZoneId(event.target.value)}>
          {report.zones.map((z) => (
            <option key={z.zoneId} value={z.zoneId}>
              {z.label}
            </option>
          ))}
        </select>
      </div>

      <AgreementCard zone={zone} />
      <ChangeCard zone={zone} />
      <FireCard zone={zone} />
      <CasesCard
        zone={zone}
        cases={report.cases}
        flaggedModisYears={flaggedModisYears}
        onShowHotspot={onShowHotspot}
        onShowCase={onShowCase}
      />

      <div className="source">
        <strong>{t('Sources', 'Fuentes')}</strong>
        <ul className="plain">
          {Object.entries(report.meta.sources).map(([name, doi]) => (
            <li key={name} className="small">
              {DOI_LABEL[name] ?? name} ·{' '}
              <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                doi:{doi}
              </a>
            </li>
          ))}
        </ul>
        <span className="small muted">{report.meta.note}</span>
        <span className="small muted">{report.meta.aiDisclosure}</span>
      </div>
    </section>
  )
}
