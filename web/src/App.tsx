// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15; views (?view=) added 2026-11-15.
// Reviewed and owned by team AETHER.
//
// The shell: top bar, four views and the data every view shares. The view lives in the query string (?view=map|trends|checks|
// method), so any view is a link; changing view pushes one history entry (Back and Forward work) and moves focus to <main>.
// Map is the default, also for old links without ?view=. Trends, Cross-checks and Method are loaded on demand.
// Data comes only from hooks (src/hooks) → service (src/services) → API v1 (published by server/).

import { lazy, Suspense, useEffect, useRef } from 'react'
import type { Hotspot, ValidationCase } from '../shared/contracts.ts'
import { MapScreen } from './components/MapScreen.tsx'
import { TopBar } from './components/TopBar.tsx'
import { useCover, useManifest, useValidation } from './hooks/useSignoData.ts'
import { useUrlParams } from './hooks/useUrlParam.ts'
import { LangContext, parseLang, translator, type Lang } from './lib/i18n.ts'
import { APP_VIEWS, parseAppView, type AppView } from './lib/viewState.ts'

const TrendsView = lazy(() => import('./components/TrendsView.tsx').then((m) => ({ default: m.TrendsView })))
const ChecksView = lazy(() => import('./components/ChecksView.tsx').then((m) => ({ default: m.ChecksView })))
const MethodView = lazy(() => import('./components/MethodView.tsx').then((m) => ({ default: m.MethodView })))

function App() {
  const manifest = useManifest()
  const [params, setParams] = useUrlParams()
  const view = parseAppView(params.get('view'))
  const lang = parseLang(params.get('lang'))
  const t = translator(lang)
  const mainRef = useRef<HTMLElement>(null)
  const shownView = useRef(view)

  // Shared by the views: the yearly layer (map, cross-checks) and the cross-check report (hint, cell viewer, cross-checks).
  const extras = manifest.data?.extras
  const cover = useCover(extras?.cover === true)
  const validation = useValidation(extras?.validation === true)

  // A new view: move focus to <main> so keyboard and screen reader users start at its content, and name the page.
  useEffect(() => {
    const current = APP_VIEWS.find((v) => v.id === view)
    document.title = `SIGNO · ${current ? t(current.label, current.labelEs) : t('Map', 'Mapa')}`
    if (shownView.current !== view) {
      shownView.current = view
      mainRef.current?.focus({ preventScroll: true })
    }
  }, [view, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // The page language, for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // English is the default: drop the parameter instead of writing ?lang=en.
  const chooseLang = (next: Lang) => setParams({ lang: next === 'en' ? null : next })

  const hrefFor = (target: AppView) => {
    const next = new URLSearchParams(params)
    next.set('view', target)
    if (target !== 'map') for (const key of ['cell', 'from', 'to']) next.delete(key)
    return `?${next.toString()}`
  }
  const navigate = (target: AppView) =>
    setParams(target === 'map' ? { view: target } : { view: target, cell: null, from: null, to: null }, { push: true })

  // A hotspot or documented place chosen in the cross-checks: show it on the loss map, in its year, with its square open.
  const showOnMap = (place: { lat: number; lon: number; cellId: string; year: number }) =>
    setParams(
      {
        view: 'map',
        map: 'loss',
        year: String(place.year),
        cell: place.cellId,
        z: '6',
        lat: place.lat.toFixed(2),
        lon: place.lon.toFixed(2),
        from: null,
        to: null,
      },
      { push: true },
    )
  const flaggedModisYears = (cover.data?.flags ?? []).filter((f) => f.source.toLowerCase() === 'modis').map((f) => f.year)

  return (
    <LangContext.Provider value={lang}>
    <div className="app">
      <TopBar
        manifest={manifest.data}
        view={view}
        hrefFor={hrefFor}
        onNavigate={navigate}
        onLang={chooseLang}
      />

      <main id="main" ref={mainRef} tabIndex={-1} className={`view view-${view}`}>
        {manifest.loading && <p className="muted page-status">{t('Loading…', 'Cargando…')}</p>}
        {manifest.error && <p className="error page-status">{manifest.error}</p>}

        {manifest.data && view === 'map' && <MapScreen manifest={manifest.data} cover={cover} validation={validation} />}

        {manifest.data && view !== 'map' && (
          <Suspense fallback={<p className="muted page-status">{t('Loading…', 'Cargando…')}</p>}>
            {view === 'trends' && <TrendsView manifest={manifest.data} />}
            {view === 'checks' && (
              <ChecksView
                manifest={manifest.data}
                validation={validation}
                flaggedModisYears={flaggedModisYears}
                onShowHotspot={(h: Hotspot) => showOnMap({ lat: h.lat, lon: h.lon, cellId: h.apiCellId, year: h.peakLossYear })}
                onShowCase={(place: ValidationCase, peakYear: number) =>
                  showOnMap({ lat: place.lat, lon: place.lon, cellId: place.apiCellId, year: peakYear })
                }
              />
            )}
            {view === 'method' && <MethodView manifest={manifest.data} coverTrendMethod={cover.data?.trendMethod ?? null} />}
          </Suspense>
        )}
      </main>
    </div>
    </LangContext.Provider>
  )
}

export default App
