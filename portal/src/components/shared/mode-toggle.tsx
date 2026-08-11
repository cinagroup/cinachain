import { useEffect, useRef, useState } from "react"
import { LuLaptop, LuMoon, LuSun } from "react-icons/lu"

import { cn } from "@/lib/cn"
import { type ThemePreference } from "@/lib/theme"
import { useTheme } from "@/lib/use-theme"

const OPTIONS: ReadonlyArray<{
  value: ThemePreference
  label: string
  icon: typeof LuSun
}> = [
  { value: "light", label: "Light", icon: LuSun },
  { value: "dark", label: "Dark", icon: LuMoon },
  { value: "system", label: "System", icon: LuLaptop },
]

/**
 * Light / Dark / System theme switcher — mirrors the DApp's ModeToggle.
 * A custom dropdown (no Radix) with click-outside + Escape to close. The
 * trigger icon cross-fades between sun and moon based on the resolved theme.
 */
export function ModeToggle() {
  const { preference, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return

    const selectedIndex = Math.max(
      OPTIONS.findIndex(({ value }) => value === preference),
      0
    )
    const focusFrame = window.requestAnimationFrame(() => {
      itemRefs.current[selectedIndex]?.focus()
    })

    const onMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, preference])

  const focusItem = (index: number) => {
    const normalizedIndex = (index + OPTIONS.length) % OPTIONS.length
    itemRefs.current[normalizedIndex]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Toggle theme"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "theme-menu" : undefined}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <LuSun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <LuMoon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </button>

      {open && (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Select theme"
          onKeyDown={(event) => {
            const currentIndex = itemRefs.current.findIndex(
              (item) => item === document.activeElement
            )

            if (event.key === "ArrowDown") {
              event.preventDefault()
              focusItem(currentIndex + 1)
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              focusItem(currentIndex - 1)
            } else if (event.key === "Home") {
              event.preventDefault()
              focusItem(0)
            } else if (event.key === "End") {
              event.preventDefault()
              focusItem(OPTIONS.length - 1)
            }
          }}
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-md border border-border bg-card p-1 shadow-vercel-md"
        >
          {OPTIONS.map(({ value, label, icon: Icon }, index) => (
            <button
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === value}
              onClick={() => {
                setTheme(value)
                setOpen(false)
                triggerRef.current?.focus()
              }}
              className={cn(
                "flex min-h-11 w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                preference === value
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="mr-2 size-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
