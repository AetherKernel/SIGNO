// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Method & sources view (?view=method): how the verdict is reached, where every number comes from, and what the
// data cannot say. It is the former drawer (Method, Sources, Limits tabs) as one reading page. Everything shown comes
// from the API (method, products, region) or from the team's decisions in .ai-context/01-logic.md. The statistical
// method is the team's (P-002): this page never describes a method the data does not state.

import { useEffect } from 'react'
import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { Manifest } from '../../shared/contracts.ts'
import { useTrendLayer } from '../hooks/useSignoData.ts'
import { formatPeriod, formatYears, isTrendTestPending, plainMethodText } from '../lib/format.ts'
import { useLang } from '../lib/i18n.ts'

export interface MethodViewProps {
  manifest: Manifest
  /** Plain-language method of the cover trends (CoverLayer.trendMethod), when the cover layer is loaded. */
  coverTrendMethod: string | null
}

export function MethodView({ manifest, coverTrendMethod }: MethodViewProps) {
  const { t } = useLang()
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
        <p className="small muted">
          {t(
            'The method text below is published by the data pipeline in English.',
            'El texto del método que sigue lo publica el pipeline de datos en inglés.',
          )}
        </p>
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
          {coverTrendMethod && (
            <div>
              <dt>{t('Tree cover loss and MODIS tree cover', 'Pérdida de cobertura y cobertura MODIS')}</dt>
              <dd>{coverTrendMethod}</dd>
            </div>
          )}
          <div>
            <dt>{t('Status', 'Estado')}</dt>
            <dd>
              {manifest.dataStatus === 'mock'
                ? t('Sample data (synthetic). ', 'Datos de muestra (sintéticos). ')
                : t('Real NASA data (pipeline export). ', 'Datos reales de la NASA (export del pipeline). ')}
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
                <strong>{t('Tree cover, independent check (MODIS)', 'Cobertura, contraste independiente (MODIS)')}</strong>
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
          <div className="source">
            <strong>{t('Region', 'Región')}</strong>
            <span className="small">
              {manifest.region.name} · {t('bounding box', 'recuadro')} {manifest.region.bbox.join(', ')}
            </span>
            <span className="small muted">
              {t('Boundary source', 'Fuente del límite')}:{' '}
              {manifest.region.boundarySource ?? t('pending team decision (P-008)', 'pendiente de decisión del equipo (P-008)')}
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
                <dt>{t('Two sources, two levels', 'Dos fuentes, dos niveles')}</dt>
                <dd>
                  {t(
                    'MODIS reads about 22 points lower than Hansen over dense forest and is noisier from year to year (1–2 points per zone). Use it to confirm where tree cover changed, not how much there is. Years flagged as suspect are drawn hollow and noted next to the charts.',
                    'MODIS marca unos 22 puntos menos que Hansen en bosque denso y es más ruidoso de un año a otro (1–2 puntos por zona). Úsalo para confirmar dónde cambió la cobertura, no cuánta hay. Los años marcados como dudosos se dibujan huecos y se anotan junto a los gráficos.',
                  )}
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
