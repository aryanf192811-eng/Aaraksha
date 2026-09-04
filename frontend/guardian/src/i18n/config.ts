// src/i18n/config.ts
// Guardian Portal i18n — English, Hindi, and Assamese.
// Matches the configuration and key-parity check pattern of frontend/tourist.
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

if (import.meta.env.DEV) {
  const flatten = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
    )
  const enKeys = new Set(flatten(en))
  for (const [code, resource] of [['hi', hi], ['as', as]] as const) {
    const keys = new Set(flatten(resource))
    const missing = [...enKeys].filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !enKeys.has(k))
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
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'aaraksha_lang',
    },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
