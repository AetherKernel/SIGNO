// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Method & sources view (?view=method): how the verdict is reached, where every number comes from, and what the
// data cannot say. It is the former drawer (Method, Sources, Limits tabs) as one reading page. Everything shown comes
// from the API (method, products, region) or from the team's decisions in .ai-context/01-logic.md. The statistical
// method is the team's (P-002): this page never describes a method the data does not state.
// 2026-11-15: one tree cover; one loss trend (2011-2025) with the Hansen method change and its sources; MODIS described only as the
// independent check of where Hansen sees loss (Cross-checks). Also: no internal codes; the region is named in plain words (RAISG
// outline not drawn); a "Code and reproduction" block (repository, how to re-run the test) and the rainfall cross-check.

import { useEffect } from 'react'
import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { CoverLayer, Manifest } from '../../shared/contracts.ts'
import { useTrendLayer, useValidation } from '../hooks/useSignoData.ts'
import { formatPeriod, formatYears, isTrendTestPending, plainMethodText } from '../lib/format.ts'
import { hansenInfoOf, methodChangeText } from '../lib/hansen.ts'
import { lossTrendYears } from '../lib/trendMap.ts'
import { useLang } from '../lib/i18n.ts'
import { InfoTip } from './InfoTip.tsx'
import { ViewLink } from './ViewLink.tsx'

const REPO_URL = 'https://github.com/AetherKernel/SIGNO'

export interface MethodViewProps {
  manifest: Manifest
  /** The yearly cover layer, when loaded: gives the loss segments and the year Hansen changed its method. */
  cover: CoverLayer | null
}

export function MethodView({ manifest, cover }: MethodViewProps) {
  const { t, lang } = useLang()
  const validation = useValidation(manifest.extras.validation === true).data
  const hansen = hansenInfoOf(cover, validation)
  const consistency = validation?.trendChecks?.hansenConsistency
  const lossYears = cover ? lossTrendYears(cover) : null
  const layer = useTrendLayer(manifest.variables[0]?.id ?? null).data
  const firstVariable = manifest.variables[0]
  const hasCover = manifest.extras.cover
  const testPending = layer ? isTrendTestPending(layer) : false
  const cellSize = layer ? `${layer.cellSizeDeg}°` : '1°'

  // Scroll to the anchor of the link ("#trend-test") once the page is on screen.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [layer])

  return (
    <div className="page page-method">
      <h1>{t('Method and sources', 'Método y fuentes')}</h1>
      <nav className="page-toc" aria-label={t('On this page', 'En esta página')}>
        <a href="#trend-test">{t('How the verdict is reached', 'Cómo se llega al veredicto')}</a>
        <a href="#sources">{t('Sources', 'Fuentes')}</a>
        <a href="#limits">{t('Limits', 'Límites')}</a>
      </nav>

      <section id="trend-test" className="page-section" aria-labelledby="h-method">
        <h2 id="h-method">{t('How the verdict is reached', 'Cómo se llega al veredicto')}</h2>
        {lang === 'es' && <p className="small muted">El texto del método que sigue está publicado en inglés.</p>}
        <dl className="facts">
          <div>
            <dt>{t('Method', 'Método')}</dt>
            <dd>{layer?.method.name ?? t('Loading…', 'Cargando…')}</dd>
          </div>
          <div>
            <dt>
              {t('Description', 'Descripción')}
              {firstVariable ? t(` (for ${firstVariable.name})`, ` (para ${firstVariable.name})`) : ''}
            </dt>
            <dd>{layer ? plainMethodText(layer.method.description) : '…'}</dd>
          </div>
          <div>
            <dt>{t('Years tested, by variable', 'Años probados, por variable')}</dt>
            <dd>
              {manifest.variables
                .map((v) => `${v.name}: ${v.trendYears ? `${v.trendYears.start}–${v.trendYears.end}` : formatYears(v.period)}`)
                .join('; ')}
              .{' '}
              {t(
                `The description above is the one published for ${firstVariable?.name ?? 'the first variable'}; the other variables use the same test on their own years.`,
                `La descripción de arriba es la publicada para ${firstVariable?.name ?? 'la primera variable'}; las demás variables usan el mismo test en sus propios años.`,
              )}
            </dd>
          </div>
          {!testPending && (
            <>
              <div>
                <dt>{t('Significance level', 'Nivel de significancia')}</dt>
                <dd className="mono">{`α = ${layer?.method.alpha ?? '…'}`}</dd>
              </div>
              <div>
                <dt>{t('What “significant” means here', 'Qué significa “significativo” aquí')}</dt>
                <dd>
                  {t(
                    'Each square carries a verdict decided by the team’s method, including the correction for testing many squares at once (false discovery rate). The map shows that verdict as it is; this site never recomputes it.',
                    'Cada cuadro lleva un veredicto decidido por el método del equipo, incluida la corrección por probar muchos cuadros a la vez (tasa de falsos descubrimientos). El mapa muestra ese veredicto tal cual; este sitio nunca lo recalcula.',
                  )}
                </dd>
              </div>
            </>
          )}
          {hasCover && (
            <>
              <div>
                <dt>{t('Tree cover loss', 'Pérdida de cobertura arbórea')}</dt>
                <dd>
                  {lossYears
                    ? t(
                        `One trend over ${lossYears[0]}–${lossYears[1]}; all the years are shown. `,
                        `Una tendencia sobre ${lossYears[0]}–${lossYears[1]}; se muestran todos los años. `,
                      )
                    : t('Loss is tested over its yearly values. ', 'La pérdida se prueba sobre sus valores anuales. ')}
                  {t(
                    'Each square gets a Mann-Kendall test and a Sen slope, corrected for the many squares tested at once (false discovery rate).',
                    'Cada cuadro recibe un test de Mann-Kendall y una pendiente de Sen, corregidos por los muchos cuadros probados a la vez (tasa de falsos descubrimientos).',
                  )}
                  <InfoTip label={t('Why tree cover itself is not tested', 'Por qué la cobertura arbórea no se prueba')}>
                    {t(
                      'Tree cover itself is not tested: it can only go down, because regrowth is not counted.',
                      'La cobertura arbórea no se prueba: solo puede bajar, porque no cuenta el rebrote.',
                    )}
                  </InfoTip>
                </dd>
              </div>
              <div id="hansen-method-change">
                <dt>{t(`Why the loss trend starts in ${hansen.year}`, `Por qué la tendencia de pérdida empieza en ${hansen.year}`)}</dt>
                <dd>
                  {t(
                    `Hansen's team reprocessed loss from ${hansen.year} onward and not before, so a test across ${hansen.year} would mix two methods.`,
                    `El equipo de Hansen reprocesó la pérdida desde ${hansen.year} y no antes, así que un test a través de ${hansen.year} mezclaría dos métodos.`,
                  )}
                  <InfoTip label={t('More about the method change', 'Más sobre el cambio de método')}>{methodChangeText(hansen, t)}</InfoTip>{' '}
                  <ViewLink view="checks">{t('See the comparison with PRODES', 'Ver la comparación con PRODES')}</ViewLink>.
                </dd>
              </div>
              <div>
                <dt>{t('MODIS, the independent check', 'MODIS, el contraste independiente')}</dt>
                <dd>
                  {t(
                    'MODIS tree cover is not mapped or tested as a trend. It is an independent satellite check (NASA MODIS) used to confirm where Hansen sees loss, in the Cross-checks.',
                    'La cobertura MODIS no se mapea ni se prueba como tendencia. Es un contraste satelital independiente (NASA MODIS) que se usa para confirmar dónde ve pérdida Hansen, en los Contrastes.',
                  )}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>{t('Status', 'Estado')}</dt>
            <dd>
              {manifest.dataStatus === 'mock'
                ? t('Sample data (synthetic). ', 'Datos de muestra (sintéticos). ')
                : t('Real data from NASA and partners (Hansen/UMD). ', 'Datos reales de la NASA y de socios (Hansen/UMD). ')}
              {testPending ? t('The statistical test has not been applied to this export yet.', 'El test estadístico aún no se aplicó a este export.') : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section id="sources" className="page-section" aria-labelledby="h-sources">
        <h2 id="h-sources">{t('Sources', 'Fuentes')}</h2>
        <div className="sources-list">
          {manifest.variables.map((v) => (
            <div key={v.id} className="source">
              <strong>{v.name}</strong>
              <span className="mono small">
                {v.product.shortName} v{v.product.version} · {v.product.provider} ·{' '}
                {v.product.kind === 'satellite' ? t('satellite observation', 'observación satelital') : t('model output', 'salida de modelo')}
              </span>
              <span className="small muted">
                {formatPeriod(v.period)}, {v.temporalResolution}
              </span>
              {v.product.doi && (
                <a className="small" href={`https://doi.org/${v.product.doi}`}>
                  doi:{v.product.doi}
                </a>
              )}
              {v.id === 'precip' && (
                <span className="small muted">
                  {t(
                    'Checked against NASA GLDAS rainfall: r = 0.991 (monthly zone values; see pipeline/README).',
                    'Contrastada con la lluvia de NASA GLDAS: r = 0,991 (valores mensuales por zona; ver pipeline/README).',
                  )}
                </span>
              )}
            </div>
          ))}
          {hasCover && (
            <>
              <div className="source">
                <strong>{t('Tree cover and loss (Hansen)', 'Cobertura y pérdida (Hansen)')}</strong>
                <span className="mono small">Global Forest Change · Hansen/UMD/Google/USGS/NASA · Landsat 30 m</span>
                <span className="small muted">
                  {t(
                    'Hansen et al. 2013, Science 342, 850–853. Canopy of 2000 minus canopy lost since 2001; regrowth is not counted.',
                    'Hansen et al. 2013, Science 342, 850–853. Dosel de 2000 menos el dosel perdido desde 2001; no cuenta el rebrote.',
                  )}
                </span>
                <a className="small" href="https://doi.org/10.1126/science.1244693">
                  doi:10.1126/science.1244693
                </a>
              </div>
              <div className="source">
                <strong>{t('Independent check of loss (NASA MODIS tree cover)', 'Contraste independiente de la pérdida (cobertura de NASA MODIS)')}</strong>
                <span className="mono small">MOD44B v061 · LP DAAC · {t('satellite observation', 'observación satelital')} · 250 m</span>
                <span className="small muted">
                  {t(
                    'Vegetation Continuous Fields, yearly. Product year Y runs March Y to March Y+1.',
                    'Vegetation Continuous Fields, anual. El año de producto Y va de marzo de Y a marzo de Y+1.',
                  )}
                </span>
                <a className="small" href="https://doi.org/10.5067/MODIS/MOD44B.061">
                  doi:10.5067/MODIS/MOD44B.061
                </a>
              </div>
            </>
          )}
          {consistency && (
            <div className="source">
              <strong>{t('Official deforestation (INPE PRODES)', 'Deforestación oficial (INPE PRODES)')}</strong>
              <a className="small" href={consistency.prodes.url} target="_blank" rel="noreferrer">
                {consistency.prodes.title}
              </a>
              <span className="small muted">
                {t(
                  'Used only to compare with Hansen loss in the Brazilian Amazon (Cross-checks).',
                  'Se usa solo para comparar con la pérdida de Hansen en la Amazonía brasileña (Contrastes).',
                )}
              </span>
              <a className="small" href={consistency.hansenNotes.url} target="_blank" rel="noreferrer">
                {consistency.hansenNotes.title}
              </a>
            </div>
          )}
          <div className="source">
            <strong>{t('Region', 'Región')}</strong>
            <span className="small">
              {t('Amazon biome (RAISG 2025)', 'Bioma amazónico (RAISG 2025)')}
              <InfoTip>
                {t(
                  "Squares that lie in RAISG's Amazon biome. The outline is not drawn because RAISG's terms do not allow redistributing it.",
                  'Cuadros que caen en el bioma amazónico de RAISG. El contorno no se dibuja porque los términos de RAISG no permiten redistribuirlo.',
                )}
              </InfoTip>
            </span>
            <span className="small muted">
              {t('bounding box', 'recuadro')} {manifest.region.bbox.join(', ')}
            </span>
          </div>
          <div className="source">
            <strong>{t('Country borders', 'Fronteras de países')}</strong>
            <span className="small">
              {t('Borders', 'Fronteras')}: <a href="https://www.naturalearthdata.com">Natural Earth</a> ({t('public domain', 'dominio público')})
            </span>
            <span className="small muted">
              {t('Drawn for orientation only. They are not part of the analysed data.', 'Se dibujan solo para orientarse. No forman parte de los datos analizados.')}
            </span>
          </div>
          <div className="source">
            <strong>{t('Base map', 'Mapa base')}</strong>
            <span className="small">
              {t('NASA GIBS imagery (Blue Marble, MODIS true color, MODIS NDVI)', 'Imágenes de NASA GIBS (Blue Marble, MODIS color real, MODIS NDVI)')}
            </span>
            <span className="small muted">
              {t(
                'Imagery from NASA GIBS, part of NASA EOSDIS. Context only: it is not the analysed data.',
                'Imágenes de NASA GIBS, parte de NASA EOSDIS. Solo contexto: no son los datos analizados.',
              )}
            </span>
          </div>
          <div className="source" id="code">
            <strong>{t('Code and reproduction', 'Código y reproducción')}</strong>
            <a className="small" href={REPO_URL} target="_blank" rel="noreferrer">
              {t('Repository', 'Repositorio')}: {REPO_URL}
            </a>
            <span className="small muted">
              {t(
                'Re-run the trend test in minutes: python -m pipeline.trends, then python -m pipeline.verify (compares every output with the published files).',
                'Repite el test de tendencia en minutos: python -m pipeline.trends, luego python -m pipeline.verify (compara cada salida con los archivos publicados).',
              )}
            </span>
          </div>
          <div className="source">
            <strong>{t('Data (API)', 'Datos (API)')}</strong>
            <a className="small" href={`${API_BASE_PATH}/${apiPaths.manifest()}`} target="_blank" rel="noreferrer">
              {API_BASE_PATH}/{apiPaths.manifest()}
            </a>
            <span className="small muted">
              {t(
                'Every number on this site is a file of this API, one per map, series or report.',
                'Cada cifra de este sitio es un archivo de esta API, uno por mapa, serie o informe.',
              )}
            </span>
          </div>
        </div>
        <p className="small muted">
          {t('Data status', 'Estado de los datos')}:{' '}
          {manifest.dataStatus === 'mock'
            ? t('synthetic sample data', 'datos de muestra sintéticos')
            : t('produced by the team pipeline', 'producidos por el pipeline del equipo')}{' '}
          · {t('generated', 'generados el')} {manifest.generatedAt.slice(0, 10)}
        </p>
      </section>

      <section id="limits" className="page-section" aria-labelledby="h-limits">
        <h2 id="h-limits">{t('Limits', 'Límites')}</h2>
        <dl className="facts">
          <div>
            <dt>{t('Where to look, not why', 'Dónde mirar, no por qué')}</dt>
            <dd>
              {t(
                'A downward trend in greenness shows where to look. It does not prove deforestation, and it does not establish a cause.',
                'Una tendencia a la baja en el verdor muestra dónde mirar. No prueba deforestación ni establece una causa.',
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Resolution', 'Resolución')}</dt>
            <dd>
              {t(
                `Trends are computed on ${cellSize} squares. Zooming the base map does not add detail to the trends.`,
                `Las tendencias se calculan en cuadros de ${cellSize}. Acercar el mapa base no añade detalle a las tendencias.`,
              )}
            </dd>
          </div>
          {hasCover && (
            <>
              <div>
                <dt>{t('Loss is not deforestation', 'Pérdida no es deforestación')}</dt>
                <dd>
                  {t(
                    'Hansen tree cover loss is stand-replacing loss of canopy: fire, logging, mining and clearing. The data do not say which cause acted in a place.',
                    'La pérdida de Hansen es la pérdida del dosel completo: fuego, tala, minería y desbroce. Los datos no dicen qué causa actuó en un lugar.',
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Same place is not the same cause', 'Mismo lugar no es misma causa')}</dt>
                <dd>
                  {t(
                    'Loss and burned area in the same square show where the two coincide, not that one caused the other.',
                    'Pérdida y área quemada en el mismo cuadro muestran dónde coinciden, no que una causó la otra.',
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('Loss is not the official deforestation', 'Pérdida no es la deforestación oficial')}</dt>
                <dd>
                  {t(
                    'Hansen loss in the Brazilian Amazon is several times the official INPE PRODES deforestation, because it also counts canopy killed by fire and degradation.',
                    'La pérdida de Hansen en la Amazonía brasileña es varias veces la deforestación oficial de INPE PRODES, porque también cuenta el dosel muerto por incendios y la degradación.',
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('MODIS reads lower', 'MODIS marca menos')}</dt>
                <dd>
                  {t('MODIS confirms where tree cover changed, not how much there is.', 'MODIS confirma dónde cambió la cobertura, no cuánta hay.')}
                  <InfoTip>
                    {t(
                      'In the cross-checks, MODIS reads about 22 points lower than Hansen over dense forest and is noisier from year to year (1–2 points per zone).',
                      'En los contrastes, MODIS marca unos 22 puntos menos que Hansen en bosque denso y es más ruidoso de un año a otro (1–2 puntos por zona).',
                    )}
                  </InfoTip>
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>{t('One region, borders for orientation', 'Una región, fronteras para orientarse')}</dt>
            <dd>
              {t(
                'The Amazon is treated as one natural region, across the nine countries it spans. Country borders are drawn for orientation only.',
                'La Amazonía se trata como una sola región natural, a través de los nueve países que abarca. Las fronteras se dibujan solo para orientarse.',
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
