"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  HTML_LANG_BY_LOCALE,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Dictionary,
  type Locale,
} from "./config"
import { getDefaultDictionary, loadDictionary } from "./load-dictionary"

export {
  LOCALE_LABELS,
  LOCALE_OPTIONS,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Dictionary,
  type Locale,
  type LocaleOption,
} from "./config"

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Lightweight i18n for a statically exported Next.js app — no server
// dependency, no heavy library. React context + JSON dictionaries +
// localStorage persistence.
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const STORAGE_KEY = "cinachain.locale"

// ─── Context ────────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// ─── Interpolation ──────────────────────────────────────────────────────────

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  )
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")
  const [dictionary, setDictionary] = useState<Dictionary>(getDefaultDictionary)
  const localeRequestRef = useRef(0)

  const activateLocale = useCallback((next: Locale, persist: boolean) => {
    const requestId = ++localeRequestRef.current

    void loadDictionary(next)
      .then((nextDictionary) => {
        if (requestId !== localeRequestRef.current) return

        setDictionary(nextDictionary)
        setLocaleState(next)
        if (!persist) return

        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // non-persistent (private mode)
        }
      })
      .catch((error) => {
        if (requestId !== localeRequestRef.current) return
        console.warn(`[i18n] Failed to load the ${next} dictionary.`, error)
      })
  }, [])

  // Restore from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (SUPPORTED_LOCALES.includes(stored as Locale)) {
        activateLocale(stored as Locale, false)
      } else if (typeof navigator !== "undefined") {
        activateLocale(resolveLocale(navigator.language), false)
      }
    } catch {
      // localStorage unavailable (SSR/preview) — default en
    }
  }, [activateLocale])

  useEffect(() => {
    document.documentElement.lang = HTML_LANG_BY_LOCALE[locale]
  }, [locale])

  const setLocale = useCallback(
    (next: Locale) => activateLocale(next, true),
    [activateLocale]
  )

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = dictionary[key] ?? getDefaultDictionary()[key] ?? key
      return interpolate(value, params)
    },
    [dictionary]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within <I18nProvider>")
  }
  return ctx
}
