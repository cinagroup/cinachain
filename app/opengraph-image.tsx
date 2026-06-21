import { ImageResponse } from "next/og"

import { siteConfig } from "@/config/site"

export const runtime = "edge"

export const alt = "CinaChain Logo"
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          backgroundImage:
            "linear-gradient(to bottom right, #FFF 25%, #FFF0CA 75%)",
        }}
      >
        <img
          alt="CinaChain Logo"
          src={new URL(
            "../public/logo-gradient.png",
            import.meta.url
          ).toString()}
          style={{ width: "80px", height: "80px", marginBottom: "16px", opacity: 0.95 }}
        />
        <h1
          style={{
            fontSize: "72px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 800,
            background:
              "linear-gradient(to bottom right, #000000 21.66%, #78716c 86.47%)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: "5rem",
            letterSpacing: "-0.02em",
            margin: 0,
            padding: 0,
          }}
        >
          {siteConfig.name}
        </h1>
        <h3
          style={{
            fontSize: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background:
              "linear-gradient(to bottom right, #000000 21.66%, #78716c 86.47%)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: "5rem",
            letterSpacing: "-0.02em",
            margin: 0,
            padding: 0,
            textAlign: "center",
            maxWidth: "800px",
          }}
        >
          {siteConfig.description}
        </h3>
      </div>
    ),
    {
      ...size,
    }
  )
}
