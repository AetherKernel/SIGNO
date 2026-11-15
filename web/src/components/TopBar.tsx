// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15; language switch added 2026-11-15. Reviewed
// and owned by team AETHER.
//
// Top bar: the name, the four views (?view=map|trends|checks|method) as real links, the sample-data notice and the
// language switch (English by default, Spanish on request; ?lang=es). For the pitch, use the browser zoom (Ctrl +).
// A click on a view pushes one history entry (so Back and Forward work); the app then moves focus to <main>.
// On phones the views take a second row that scrolls sideways.
// The name is the team's logo (SignoLogo, generated with Gemini; see that file), 2026-11-15.

import { IconLanguage } from '@tabler/icons-react'
import type { MouseEvent } from 'react'
import type { Manifest } from '../../shared/contracts.ts'
import { LANGS, useLang, type Lang } from '../lib/i18n.ts'
import { APP_VIEWS, type AppView } from '../lib/viewState.ts'
import { DataStatusBanner } from './DataStatusBanner.tsx'
import { SignoLogo } from './SignoLogo.tsx'

interface Props {
  manifest: Manifest | null
  view: AppView
  /** Link target of a view, so "open in a new tab" and copy link work. */
  hrefFor: (view: AppView) => string
  onNavigate: (view: AppView) => void
  onLang: (lang: Lang) => void
}

export function TopBar({ manifest, view, hrefFor, onNavigate, onLang }: Props) {
  const { lang, t } = useLang()
  const go = (event: MouseEvent<HTMLAnchorElement>, target: AppView) => {
    // Let the browser handle new-tab and new-window clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(target)
  }
  return (
    <header className="topbar">
      <div className="brand">
        <p className="logo">
          <SignoLogo />
        </p>
        <span className="case-title">
          {t('Amazon vegetation, fire and climate, 2001–2025', 'Vegetación, fuego y clima de la Amazonía, 2001–2025')}
        </span>
      </div>
      <nav className="viewnav" aria-label={t('Views', 'Vistas')}>
        {APP_VIEWS.map((v) => (
          <a
            key={v.id}
            href={hrefFor(v.id)}
            className="viewlink"
            aria-current={v.id === view ? 'page' : undefined}
            onClick={(event) => go(event, v.id)}
          >
            {t(v.label, v.labelEs)}
          </a>
        ))}
      </nav>
      <div className="topactions">
        {manifest && <DataStatusBanner status={manifest.dataStatus} />}
        <div className="langswitch" role="group" aria-label={t('Language', 'Idioma')}>
          <IconLanguage size={18} stroke={1.75} aria-hidden="true" />
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              lang={l.id}
              className="langbtn"
              aria-pressed={lang === l.id}
              aria-label={`${l.label} - ${l.name}`}
              title={l.name}
              onClick={() => onLang(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
