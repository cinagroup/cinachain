const { fontFamily } = require("tailwindcss/defaultTheme")

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
        warning: "var(--color-warning)",
        "warning-soft": "var(--color-warning-soft)",
        violet: "var(--color-violet)",
        cyan: "var(--color-cyan)",
        "highlight-pink": "var(--color-highlight-pink)",
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
        pill: "100px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
      },
      spacing: {
        "xxs": "var(--spacing-xxs)",
        "nav": "var(--spacing-sm)",
        "section": "var(--spacing-5xl)",
      },
      boxShadow: {
        "vercel-sm": "0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.08)",
        "vercel-md": "0 2px 2px rgba(0,0,0,0.08), 0 8px 8px -8px rgba(0,0,0,0.08)",
        "vercel-lg": "0 2px 2px rgba(0,0,0,0.08), 0 8px 16px -4px rgba(0,0,0,0.08)",
        "vercel-card": "0 0 0 1px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.08)",
        "vercel-modal": "0 1px 1px rgba(0,0,0,0.04), 0 8px 16px -4px rgba(0,0,0,0.08), 0 24px 32px -8px rgba(0,0,0,0.12)",
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
