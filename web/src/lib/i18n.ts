// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Interface language (José, 2026-11-15): English by default (the Space Apps submission is in English) and Spanish on
// request, from the switch in the top bar. The choice lives in the URL (?lang=es) so a shared link keeps it. No
// detection by browser, IP or location for now: those options are recorded as future work in .ai-context/05.
//
// Each sentence is written in both languages where it is used: t('Open the map', 'Abrir el mapa'). Numbers keep the
// decimal point in both languages (scientific convention of the NASA data; a comma would mix with coordinate lists).
// Variable names and descriptions come from the API in English and are not translated yet (future work with Alexis).

import { createContext, useContext } from 'react'

export type Lang = 'en' | 'es'

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'es', label: 'ES', name: 'Español' },
]

/** The `lang` parameter: Spanish only when asked for, English otherwise. */
export function parseLang(value: string | null): Lang {
  return value === 'es' ? 'es' : 'en'
}

/** A translator: returns the English or the Spanish text. */
export type Tr = (en: string, es: string) => string

/** The English translator: the default of every lib function that builds sentences. */
export const EN: Tr = (en) => en

export const LangContext = createContext<Lang>('en')

/** The current language and a translator: t(english, spanish). */
export function useLang(): { lang: Lang; t: Tr } {
  const lang = useContext(LangContext)
  return { lang, t: (en: string, es: string) => (lang === 'es' ? es : en) }
}

/** Translator for code outside React components (labels built from constants). */
export function translator(lang: Lang): Tr {
  return (en: string, es: string) => (lang === 'es' ? es : en)
}
