import type { Dictionary, Locale } from "./config"
import { en } from "./locales/en"
import { es } from "./locales/es"
import { fr } from "./locales/fr"
import { ja } from "./locales/ja"
import { ko } from "./locales/ko"
import { pt } from "./locales/pt"
import { ru } from "./locales/ru"
import { zh } from "./locales/zh"

/**
 * Complete dictionary set for build-time validation and tooling.
 *
 * Runtime code deliberately uses load-dictionary.ts so non-English locales
 * remain separate chunks instead of inflating every page's initial bundle.
 */
export const dictionaries: Record<Locale, Dictionary> = {
  zh,
  en,
  ja,
  ko,
  ru,
  es,
  pt,
  fr,
}
