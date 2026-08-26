"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Lightweight i18n for a statically exported Next.js app — no server
// dependency, no heavy library. React context + JSON dictionaries +
// localStorage persistence.
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export type Locale = "en" | "zh"

const STORAGE_KEY = "cinachain.locale"

/** Type-safe dictionary shape: flat keys → strings. */
export type Dictionary = Record<string, string>

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
}

// ─── Context ────────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// ─── Dictionary loading (static import, no async) ──────────────────────────

import { en } from "./locales/en"
import { zh } from "./locales/zh"

const dictionaries: Record<Locale, Dictionary> = { en, zh }

// ─── Interpolation ──────────────────────────────────────────────────────────

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match,
  )
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  // Restore from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "en" || stored === "zh") {
        setLocaleState(stored)
      } else if (typeof navigator !== "undefined") {
        // Fall back to browser language
        const lang = navigator.language?.toLowerCase() ?? ""
        if (lang.startsWith("zh")) setLocaleState("zh")
      }
    } catch {
      // localStorage unavailable (SSR/preview) — default en
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // non-persistent (private mode)
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = dictionaries[locale] ?? dictionaries.en
      const value = dict[key] ?? dictionaries.en[key] ?? key
      return interpolate(value, params)
    },
    [locale],
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
