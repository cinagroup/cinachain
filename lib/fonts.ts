import localFont from "next/font/local"

// Self-hosted fonts (Inter + Roboto Mono, latin subset WOFF2).
//
// next/font/google downloads fonts at BUILD time from fonts.googleapis.com,
// which intermittently blocks GitHub Actions runner IPs — that took the CI
// build down twice in a row. Self-hosting makes the build hermetic AND
// removes the third-party font CDN from production requests.
// Working set per DESIGN.md: Inter 400/500/600, mono 400.
export const fontSans = localFont({
  src: [
    { path: "./fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
})

export const fontMono = localFont({
  src: [
    { path: "./fonts/RobotoMono-Regular.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
})
