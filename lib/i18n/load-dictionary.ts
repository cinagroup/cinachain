import type { Dictionary, Locale } from "./config"
import { en } from "./locales/en"

const dictionaryCache: Partial<Record<Locale, Dictionary>> = { en }

const dictionaryLoaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => Promise.resolve(en),
  zh: () => import("./locales/zh").then(({ zh }) => zh),
  ja: () => import("./locales/ja").then(({ ja }) => ja),
  ko: () => import("./locales/ko").then(({ ko }) => ko),
  ru: () => import("./locales/ru").then(({ ru }) => ru),
  es: () => import("./locales/es").then(({ es }) => es),
  pt: () => import("./locales/pt").then(({ pt }) => pt),
  fr: () => import("./locales/fr").then(({ fr }) => fr),
}

export function getDefaultDictionary() {
  return en
}

export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cached = dictionaryCache[locale]
  if (cached) return cached

  const dictionary = await dictionaryLoaders[locale]()
  dictionaryCache[locale] = dictionary
  return dictionary
}
