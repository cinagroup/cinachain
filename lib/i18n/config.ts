export const SUPPORTED_LOCALES = [
  "zh",
  "en",
  "ja",
  "ko",
  "ru",
  "es",
  "pt",
  "fr",
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type Dictionary = Record<string, string>

export interface LocaleOption {
  code: Locale
  shortLabel: string
  nativeLabel: string
  htmlLang: string
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "zh", shortLabel: "中", nativeLabel: "中文", htmlLang: "zh-CN" },
  { code: "en", shortLabel: "EN", nativeLabel: "English", htmlLang: "en" },
  { code: "ja", shortLabel: "日", nativeLabel: "日本語", htmlLang: "ja" },
  { code: "ko", shortLabel: "한", nativeLabel: "한국어", htmlLang: "ko" },
  { code: "ru", shortLabel: "RU", nativeLabel: "Русский", htmlLang: "ru" },
  { code: "es", shortLabel: "ES", nativeLabel: "Español", htmlLang: "es" },
  { code: "pt", shortLabel: "PT", nativeLabel: "Português", htmlLang: "pt" },
  { code: "fr", shortLabel: "FR", nativeLabel: "Français", htmlLang: "fr" },
]

export const LOCALE_LABELS = Object.fromEntries(
  LOCALE_OPTIONS.map(({ code, nativeLabel }) => [code, nativeLabel])
) as Record<Locale, string>

export const HTML_LANG_BY_LOCALE = Object.fromEntries(
  LOCALE_OPTIONS.map(({ code, htmlLang }) => [code, htmlLang])
) as Record<Locale, string>

export function resolveLocale(language?: string | null): Locale {
  const normalized = language?.trim().toLowerCase().replace("_", "-") ?? ""
  const base = normalized.split("-")[0]
  return SUPPORTED_LOCALES.includes(base as Locale) ? (base as Locale) : "en"
}
