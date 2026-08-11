import { useCallback, useEffect, useState } from "react"

import {
  type ResolvedTheme,
  type ThemePreference,
  applyResolvedTheme,
  currentResolvedTheme,
  getStoredTheme,
  resolveTheme,
  setTheme as commitTheme,
} from "./theme"

interface UseTheme {
  /** The user's chosen preference (may be "system"). */
  preference: ThemePreference
  /** The concrete theme currently applied to the page. */
  resolved: ResolvedTheme
  /** Persist + apply a new preference. */
  setTheme: (preference: ThemePreference) => void
}

/**
 * React binding for the theme manager. Initial state is read from the DOM
 * (which the pre-paint script in index.html has already set), so the first
 * paint never flashes. While the preference is "system", OS changes are
 * followed live.
 */
export function useTheme(): UseTheme {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getStoredTheme(),
  )
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    currentResolvedTheme(),
  )

  useEffect(() => {
    if (!("matchMedia" in window)) return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      // Only re-resolve when the user hasn't picked an explicit theme.
      if (getStoredTheme() !== "system") return
      const next = resolveTheme("system")
      applyResolvedTheme(next)
      setResolved(next)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next)
    setResolved(commitTheme(next))
  }, [])

  return { preference, resolved, setTheme }
}
