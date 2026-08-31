import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Languages } from "lucide-react"

import { cn } from "@/lib/cn"
import { LOCALE_OPTIONS, useI18n } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const current =
    LOCALE_OPTIONS.find((option) => option.code === locale) ?? LOCALE_OPTIONS[1]

  useEffect(() => {
    if (!open) return

    const selectedIndex = Math.max(
      LOCALE_OPTIONS.findIndex(({ code }) => code === locale),
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
  }, [locale, open])

  const focusItem = (index: number) => {
    const normalized = (index + LOCALE_OPTIONS.length) % LOCALE_OPTIONS.length
    itemRefs.current[normalized]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${t("language.switch")}: ${current.nativeLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "language-menu" : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 min-w-14 items-center justify-center gap-1 rounded-full px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-wide">
          {current.shortLabel}
        </span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id="language-menu"
          role="menu"
          aria-label={t("language.select")}
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
              focusItem(LOCALE_OPTIONS.length - 1)
            }
          }}
          className="absolute right-0 z-[60] mt-2 w-52 overflow-hidden rounded-md border border-border bg-card p-1 shadow-vercel-md"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            {t("language.select")}
          </p>
          {LOCALE_OPTIONS.map((option, index) => (
            <button
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              key={option.code}
              type="button"
              role="menuitemradio"
              aria-checked={locale === option.code}
              onClick={() => {
                setLocale(option.code)
                setOpen(false)
                triggerRef.current?.focus()
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                locale === option.code
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <span className="w-7 text-xs font-semibold text-muted-foreground">
                {option.shortLabel}
              </span>
              <span className="flex-1 text-left">{option.nativeLabel}</span>
              {locale === option.code ? (
                <Check className="size-4" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
