// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "How the test works and how we checked it" (Trends view): the method in plain words and the trust checks of
// validation.json (trendChecks) as short findings. All numbers come from the report; nothing is recomputed here. The text
// never claims a cause: a trend is a pattern in measurements.

import type { ValidationReport, ZonesReport } from '../../shared/contracts.ts'
import type { Remote } from '../hooks/useSignoData.ts'
import { useLang } from '../lib/i18n.ts'
import { formatShare, MEASURES, measureName, slopeSentence, type Measure } from '../lib/zoneTrends.ts'
import { ViewLink } from './ViewLink.tsx'

export interface TrendMethodProps {
  report: ZonesReport
  validation: Remote<ValidationReport> | null
  /** The measure selected in the table, for the numbers read in the findings. */
  measure: Measure
}

const DIRECTION_WORD = {
  increasing: ['rising', 'al alza'],
  decreasing: ['falling', 'a la baja'],
  none: ['no clear direction', 'sin dirección clara'],
} as const

export function TrendMethod({ report, validation, measure }: TrendMethodProps) {
  const { t } = useLang()
  const name = measureName(measure, t)
  const dir = (d: keyof typeof DIRECTION_WORD) => t(DIRECTION_WORD[d][0], DIRECTION_WORD[d][1])
  const checks = validation?.data?.trendChecks
  const design = checks?.design
  const alpha = report.alpha
  const falseAlarm = checks?.v1FalsePositives[measure.key]
  const detection = checks?.v2Detection[measure.key]
  const pampa = checks?.v3KnownPlaces.find((p) => p.kind === 'case' && p.caseId === 'la_pampa')
  const pampaReference = validation?.data?.cases.find((c) => c.id === 'la_pampa')?.reference
  const drift = checks?.d1Drift
  const driftNdvi = drift?.variables.ndvi
  // Headings follow the published numbers: "No" only if no measure flags more than alpha of the shuffled squares.
  const maxFalse = checks ? Math.max(0, ...Object.values(checks.v1FalsePositives).map((v) => v.maxShareSignificant)) : 0
  const noInvented = maxFalse < alpha
  const pampaFound = pampa?.lossKm2 != null && pampa.lossKm2.significant && pampa.lossKm2.direction === 'increasing'
  const percent = (share: number) => `${Math.round(share * 100)} %`

  return (
    <section id="how-it-works" className="tr-panel" aria-labelledby="tr-how-title">
      <h2 id="tr-how-title">{t('How the test works and how we checked it', 'Cómo funciona el test y cómo lo comprobamos')}</h2>

      <div className="tr-method-grid">
        <div>
          <h3>{t('How the test works', 'Cómo funciona el test')}</h3>
          <ol className="tr-steps">
            <li>
              <strong>{t('One value per year.', 'Un valor por año.')}</strong>{' '}
              {t(
                'Each year becomes a single number: the average of its 12 months, or the total for rain and burned area. Only complete years count, so the yearly rise and fall of the seasons does not enter the test.',
                'Cada año se resume en un solo número: el promedio de sus 12 meses, o el total para la lluvia y el área quemada. Solo cuentan los años completos, así que la subida y bajada de las estaciones no entra en el test.',
              )}
            </li>
            <li>
              <strong>{t('Mann-Kendall test.', 'Test de Mann-Kendall.')}</strong>{' '}
              {t(
                `It asks whether the yearly values tend to go up or down over the years more than chance would explain. It gives a p-value; we call a trend clear when p is below ${alpha} (squares: after the correction in step 4).`,
                `Pregunta si los valores anuales tienden a subir o bajar con los años más de lo que explicaría el azar. Da un valor p; llamamos clara a una tendencia cuando p es menor que ${alpha} (cuadros: tras la corrección del paso 4).`,
              )}
            </li>
            <li>
              <strong>{t('Sen slope.', 'Pendiente de Sen.')}</strong>{' '}
              {t(
                'The size of the change per decade: the middle one of all the slopes between pairs of years. A few odd years barely move it.',
                'El tamaño del cambio por década: la mediana de todas las pendientes entre pares de años. Unos pocos años raros apenas la mueven.',
              )}
            </li>
            <li>
              <strong>{t('Many squares at once.', 'Muchos cuadros a la vez.')}</strong>{' '}
              {t(
                `The map tests every 1° square. With hundreds of tests some would look clear by luck, so for squares we apply the Benjamini-Hochberg correction (false discovery rate ${Math.round(alpha * 100)} %). The zone results on this page are one test per zone and measure, so they are`,
                `El mapa prueba cada cuadro de 1°. Con cientos de tests algunos parecerían claros por azar, así que para los cuadros aplicamos la corrección de Benjamini-Hochberg (tasa de falsos descubrimientos del ${Math.round(alpha * 100)} %). Los resultados por zona de esta página son un test por zona y medida, así que`,
              )}{' '}
              <strong>{t('not corrected for multiple tests', 'no se corrigen por pruebas múltiples')}</strong>.
            </li>
            <li>
              <strong>{t('Rules fixed before looking.', 'Reglas fijadas antes de mirar.')}</strong>{' '}
              {design
                ? t(
                    `A square needs at least ${percent(design.minCompleteShare)} of its years complete. If more than ${percent(design.autocorrelationRuleThreshold)} of the squares of a measure show year-to-year memory, a variant of the test that allows for it is used. `,
                    `Un cuadro necesita al menos ${percent(design.minCompleteShare)} de sus años completos. Si más del ${percent(design.autocorrelationRuleThreshold)} de los cuadros de una medida muestra memoria de un año a otro, se usa una variante del test que la tiene en cuenta. `,
                  )
                : ''}
              {t(
                'If the satellite’s overpass time drifts along with a measure, its test stops in 2020.',
                'Si la hora de paso del satélite deriva junto con una medida, su test se detiene en 2020.',
              )}
            </li>
          </ol>
          <p className="tr-small muted">
            {t(
              '“Clear trend” means the pattern is larger than year-to-year variation. It does not say why it happens. “Loss” is tree cover lost to any cause (fire, logging, mining, clearing), not only deforestation. Hansen tree cover is not tested: it cannot rise, because regrowth is not counted.',
              '“Tendencia clara” significa que el patrón es mayor que la variación de un año a otro. No dice por qué ocurre. “Pérdida” es cobertura arbórea perdida por cualquier causa (fuego, tala, minería, desbroce), no solo deforestación. La cobertura de Hansen no se prueba: no puede subir, porque no cuenta el rebrote.',
            )}
          </p>
          <details className="tr-details">
            <summary>{t('Technical wording', 'Redacción técnica')}</summary>
            <p className="tr-small">
              {design?.text ?? t('The technical description is published with the cross-checks.', 'La descripción técnica se publica con los contrastes.')}
            </p>
            <p className="tr-small muted">{report.note}</p>
          </details>
        </div>

        <div>
          <h3>{t('How we checked it', 'Cómo lo comprobamos')}</h3>
          {!validation && <p className="muted">{t('Check results are not published yet.', 'Los resultados de las comprobaciones aún no se publican.')}</p>}
          {validation?.loading && <p className="muted">{t('Loading the check results…', 'Cargando los resultados de las comprobaciones…')}</p>}
          {validation?.error && (
            <p className="error">
              {t('Could not load the check results', 'No se pudieron cargar los resultados de las comprobaciones')} ({validation.error}).
            </p>
          )}
          {validation && !validation.loading && !validation.error && !checks && (
            <p className="muted">{t('Check results are not published yet.', 'Los resultados de las comprobaciones aún no se publican.')}</p>
          )}

          {checks && (
            <ul className="tr-findings">
              <li>
                <h4>
                  {noInvented ? t('Does it invent trends? No.', '¿Inventa tendencias? No.') : t('Does it invent trends? Sometimes.', '¿Inventa tendencias? A veces.')}
                </h4>
                <p>
                  {t(
                    `We shuffled the years of every square at random, ${design?.permutations ?? 'many'} times, and ran the whole procedure again. With no real order in time the test should flag almost nothing.`,
                    `Barajamos al azar los años de cada cuadro, ${design?.permutations ?? 'muchas'} veces, y repetimos todo el procedimiento. Sin un orden real en el tiempo, el test casi no debería marcar nada.`,
                  )}
                  {falseAlarm
                    ? t(
                        ` For ${name} it flagged ${formatShare(falseAlarm.meanShareSignificant)} of the squares on average, and ${formatShare(falseAlarm.maxShareSignificant)} in the worst run.`,
                        ` Para ${name} marcó el ${formatShare(falseAlarm.meanShareSignificant)} de los cuadros en promedio, y el ${formatShare(falseAlarm.maxShareSignificant)} en la peor ronda.`,
                      )
                    : t(' The numbers for every measure are in the table below.', ' Las cifras de cada medida están en la tabla de abajo.')}
                </p>
              </li>
              <li>
                <h4>{t('Does it find a real change? Often, but not always.', '¿Encuentra un cambio real? A menudo, pero no siempre.')}</h4>
                <p>
                  {t('Then we added a made-up trend of the typical size to the shuffled series.', 'Luego añadimos una tendencia inventada de tamaño típico a las series barajadas.')}
                  {detection
                    ? t(
                        ` For ${name} the test found it in ${percent(detection.meanShareDetected)} of the squares on average (${percent(detection.minShareDetected)} in the weakest run).`,
                        ` Para ${name} el test la encontró en el ${percent(detection.meanShareDetected)} de los cuadros en promedio (${percent(detection.minShareDetected)} en la ronda más débil).`,
                      )
                    : null}{' '}
                  {t(
                    'So the test is careful: it can miss a real change, and “no clear trend” means “not shown beyond doubt”, not “nothing happened”.',
                    'Así que el test es prudente: puede pasar por alto un cambio real, y “sin tendencia clara” significa “no demostrado sin duda”, no “no pasó nada”.',
                  )}
                </p>
              </li>
              {pampa && (
                <li>
                  <h4>
                    {pampaFound
                      ? t('Does it find a documented place? Yes, in La Pampa.', '¿Encuentra un lugar documentado? Sí, en La Pampa.')
                      : t('Does it find a documented place? Not clearly in La Pampa.', '¿Encuentra un lugar documentado? No con claridad en La Pampa.')}
                  </h4>
                  <p>
                    {t(
                      'La Pampa (Madre de Dios, Peru) is a gold-mining area documented by independent sources',
                      'La Pampa (Madre de Dios, Perú) es una zona de minería de oro documentada por fuentes independientes',
                    )}
                    {pampaReference ? ` (${pampaReference})` : ''}. {t('There the test found tree cover loss', 'Ahí el test encontró una pérdida de cobertura')}{' '}
                    {pampa.lossKm2 && pampa.lossKm2.slopePerDecade !== null
                      ? `${dir(pampa.lossKm2.direction)} (${slopeSentence(pampa.lossKm2.slopePerDecade, 'km² per year', t)}${pampa.lossKm2.significant ? t(', clear after the correction', ', clara tras la corrección') : t(', not clear', ', no clara')})`
                      : t('not tested', 'sin probar')}
                    {pampa.modisTreeCover && pampa.modisTreeCover.slopePerDecade !== null
                      ? t(
                          ` and MODIS tree cover ${dir(pampa.modisTreeCover.direction)} (${slopeSentence(pampa.modisTreeCover.slopePerDecade, '%', t)}${pampa.modisTreeCover.significant ? ', clear' : ', not clear'})`,
                          ` y una cobertura MODIS ${dir(pampa.modisTreeCover.direction)} (${slopeSentence(pampa.modisTreeCover.slopePerDecade, '%', t)}${pampa.modisTreeCover.significant ? ', clara' : ', no clara'})`,
                        )
                      : ''}
                    . {t('The other documented places are in the', 'Los otros lugares documentados están en los')}{' '}
                    <ViewLink view="checks">{t('cross-checks', 'contrastes')}</ViewLink>.
                  </p>
                </li>
              )}
              {drift && driftNdvi && (
                <li>
                  <h4>{t('Can the satellite itself bend a trend? Yes, so we stop in 2020.', '¿Puede el propio satélite torcer una tendencia? Sí, por eso paramos en 2020.')}</h4>
                  <p>
                    {t(
                      `The Terra satellite crosses the equator earlier and earlier: about ${drift.overpassHoursFirstYear.toFixed(1)} h in ${drift.years[0]} and ${drift.overpassHoursLastYear.toFixed(1)} h in ${drift.years[1]}. The yearly greenness follows that drift (correlation r = ${driftNdvi.r.toFixed(2)}, ${driftNdvi.n} years), which may be a measurement effect rather than a change on the ground. By our rule (set before looking at the results, D1) the test of NDVI and EVI stops in 2020. Temperature also ends in 2020, but by a separate team rule (B1) because of the orbit drift; rainfall ends in 2024 and burned area uses 2001–2025. The 2021–2025 values of NDVI, EVI and temperature are shown greyed as “satellite drift years”.`,
                      `El satélite Terra cruza el ecuador cada vez más temprano: unas ${drift.overpassHoursFirstYear.toFixed(1)} h en ${drift.years[0]} y ${drift.overpassHoursLastYear.toFixed(1)} h en ${drift.years[1]}. El verdor anual sigue esa deriva (correlación r = ${driftNdvi.r.toFixed(2)}, ${driftNdvi.n} años), lo que puede ser un efecto de la medición y no un cambio en el terreno. Por nuestra regla (fijada antes de ver los resultados, D1), el test de NDVI y EVI se detiene en 2020. La temperatura también termina en 2020, pero por otra regla del equipo (B1), por la deriva de la órbita; la lluvia termina en 2024 y el área quemada usa 2001–2025. Los valores 2021–2025 de NDVI, EVI y temperatura se muestran en gris como “años con deriva del satélite”.`,
                    )}
                  </p>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {checks && (
        <details className="tr-details">
          <summary>{t('Check numbers for every measure', 'Cifras de las comprobaciones por medida')}</summary>
          <div className="tr-table-scroll">
            <table className="tr-values">
              <caption className="sr-only">
                {t('Results of the shuffling and made-up trend checks for each measure', 'Resultados de las comprobaciones con años barajados y tendencias inventadas, por medida')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('Measure', 'Medida')}</th>
                  <th scope="col">{t('Flagged after shuffling (mean)', 'Marcados tras barajar (media)')}</th>
                  <th scope="col">{t('Flagged after shuffling (worst run)', 'Marcados tras barajar (peor ronda)')}</th>
                  <th scope="col">{t('Made-up trend found (mean)', 'Tendencia inventada encontrada (media)')}</th>
                  <th scope="col">{t('Made-up trend found (weakest run)', 'Tendencia inventada encontrada (ronda más débil)')}</th>
                </tr>
              </thead>
              <tbody>
                {MEASURES.filter((m) => checks.v1FalsePositives[m.key]).map((m) => {
                  const fp = checks.v1FalsePositives[m.key]
                  const det = checks.v2Detection[m.key]
                  return (
                    <tr key={m.key}>
                      <th scope="row">{measureName(m, t)}</th>
                      <td>{formatShare(fp.meanShareSignificant)}</td>
                      <td>{formatShare(fp.maxShareSignificant)}</td>
                      <td>{det ? percent(det.meanShareDetected) : '—'}</td>
                      <td>{det ? percent(det.minShareDetected) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
