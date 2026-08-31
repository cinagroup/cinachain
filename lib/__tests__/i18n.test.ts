import { describe, expect, it } from "vitest"

import {
  LOCALE_OPTIONS,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "../i18n/config"
import { dictionaries } from "../i18n/dictionaries"
import { loadDictionary } from "../i18n/load-dictionary"

describe("internationalization", () => {
  it("publishes the requested locales in the intended order", () => {
    expect(SUPPORTED_LOCALES).toEqual([
      "zh",
      "en",
      "ja",
      "ko",
      "ru",
      "es",
      "pt",
      "fr",
    ])
    expect(LOCALE_OPTIONS.map(({ code }) => code)).toEqual(SUPPORTED_LOCALES)
    expect(new Set(LOCALE_OPTIONS.map(({ htmlLang }) => htmlLang)).size).toBe(8)
  })

  it("keeps every locale dictionary aligned with English", () => {
    const sourceKeys = Object.keys(dictionaries.en).sort()

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(dictionaries[locale]).sort(), locale).toEqual(
        sourceKeys
      )
      expect(dictionaries[locale]["language.switch"], locale).not.toBe("")
      expect(dictionaries[locale]["home.heroDescription"], locale).not.toBe("")

      for (const key of sourceKeys) {
        const value = dictionaries[locale][key]
        expect(value.trim(), `${locale}:${key}`).not.toBe("")
        expect(value, `${locale}:${key}`).not.toMatch(
          /CINA(?:ITEM|END)|ZXCVPARAM/i
        )

        const sourceParams = [...dictionaries.en[key].matchAll(/\{(\w+)\}/g)]
          .map((match) => match[1])
          .sort()
        const localeParams = [...value.matchAll(/\{(\w+)\}/g)]
          .map((match) => match[1])
          .sort()
        expect(localeParams, `${locale}:${key}`).toEqual(sourceParams)
      }
    }
  })

  it("loads every runtime dictionary on demand", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      await expect(loadDictionary(locale)).resolves.toBe(dictionaries[locale])
    }
  })

  it.each([
    ["zh-CN", "zh"],
    ["en-US", "en"],
    ["ja-JP", "ja"],
    ["ko-KR", "ko"],
    ["ru-RU", "ru"],
    ["es-MX", "es"],
    ["pt-BR", "pt"],
    ["fr-CA", "fr"],
    ["pt_BR", "pt"],
    ["de-DE", "en"],
    [null, "en"],
  ])("resolves browser language %s to %s", (browserLanguage, expected) => {
    expect(resolveLocale(browserLanguage)).toBe(expected)
  })
})
