const { fontFamily } = require("tailwindcss/defaultTheme")
const tokens = require("./design/tokens.json")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "integrations/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Vercel brand colors
        link: "var(--color-link)",
        "link-deep": "var(--color-link-deep)",
        "link-bg-soft": "var(--color-link-bg-soft)",
        body: "var(--color-body)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        "warning-soft": "var(--color-warning-soft)",
        "warning-deep": "var(--color-warning-deep)",
        violet: "var(--color-violet)",
        "violet-soft": "var(--color-violet-soft)",
        cyan: "var(--color-cyan)",
        "cyan-soft": "var(--color-cyan-soft)",
        "cyan-deep": "var(--color-cyan-deep)",
        "highlight-pink": "var(--color-highlight-pink)",
      },
      borderRadius: {
        none: tokens.radius.none,
        xs: tokens.radius.xs,
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl,
        "pill-sm": tokens.radius.pillSm,
        pill: tokens.radius.pill,
        full: tokens.radius.full,
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      spacing: {
        xxs: "var(--spacing-xxs)",
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2xl": "var(--spacing-2xl)",
        "3xl": "var(--spacing-3xl)",
        "4xl": "var(--spacing-4xl)",
        "5xl": "var(--spacing-5xl)",
        "6xl": "var(--spacing-6xl)",
        nav: "var(--spacing-sm)",
        section: "var(--spacing-section)",
      },
      screens: {
        tablet: tokens.breakpoint.tablet,
        desktop: tokens.breakpoint.desktop,
        wide: tokens.breakpoint.wide,
        ultra: tokens.breakpoint.ultra,
      },
      boxShadow: {
        "vercel-sm": "var(--shadow-level-2)",
        "vercel-md": "var(--shadow-level-3)",
        "vercel-lg": "var(--shadow-level-4)",
        "vercel-card": "var(--shadow-level-2)",
        "vercel-modal": "var(--shadow-level-5)",
        "elevation-1": "var(--shadow-level-1)",
        "elevation-2": "var(--shadow-level-2)",
        "elevation-3": "var(--shadow-level-3)",
        "elevation-4": "var(--shadow-level-4)",
        "elevation-5": "var(--shadow-level-5)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
