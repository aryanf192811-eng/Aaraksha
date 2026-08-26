// src/i18n/config.ts
// English, Hindi, and Assamese — Assamese chosen as the one NE-India
// regional language since Assam is this app's de facto gateway state and
// has the region's most mature Unicode/font support. Imported once, before
// the app renders (see main.tsx) — react-i18next reads the singleton
// `i18next` instance via context, no provider setup needed beyond that
// import happening first.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en'
import hi from './locales/hi'
import as from './locales/as'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'as', label: 'অসমীয়া' },
] as const

// Catches a locale file silently missing a key (falls back to the raw key
// string at runtime instead of English text) before it ships, rather than
// discovering it by spotting "profile.title" rendered literally in a demo.
if (import.meta.env.DEV) {
  const flatten = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
    )
  const enKeys = new Set(flatten(en))
  for (const [code, resource] of [['hi', hi], ['as', as]] as const) {
    const keys = new Set(flatten(resource))
    const missing = [...enKeys].filter(k => !keys.has(k))
    const extra = [...keys].filter(k => !enKeys.has(k))
    if (missing.length) console.warn(`[i18n] "${code}" is missing keys:`, missing)
    if (extra.length) console.warn(`[i18n] "${code}" has extra keys not in en:`, extra)
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      as: { translation: as },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'as'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aaraksha_lang',
    },
  })

// Keeps <html lang> in sync for screen readers / browser find-in-page —
// index.html hardcodes lang="en" as the pre-hydration default only.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
