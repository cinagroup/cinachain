// Lightweight theme manager — the portal's equivalent of next-themes.
//
// Three-state preference ("light" | "dark" | "system"), persisted to
// localStorage. The applied value on <html data-theme> is always a resolved
// "light" | "dark" (never "system"), which is what the Tailwind dark variant
// and design tokens key off of.

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "cinachain-theme"

function isPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

/** The stored preference, or "system" when unset / unreadable. */
export function getStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (isPreference(value)) return value
  } catch {
    /* localStorage unavailable */
  }
  return "system"
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* localStorage unavailable */
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    "matchMedia" in window &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

/** Resolve a preference to the concrete theme that should be applied. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark()
      ? "dark"
      : "light"
    : preference
}

/** Write the resolved theme onto <html data-theme>. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", resolved)
}

/** Read the currently-applied theme from the DOM. */
export function currentResolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light"
}

/** Persist + apply a preference, returning the resolved theme. */
export function setTheme(preference: ThemePreference): ResolvedTheme {
  setStoredTheme(preference)
  const resolved = resolveTheme(preference)
  applyResolvedTheme(resolved)
  return resolved
}
