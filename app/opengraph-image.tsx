import { ImageResponse } from "next/og"

import { siteConfig } from "@/config/site"

export const runtime = "edge"

export const alt = "CinaChain Logo"
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function Image() {
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
          backgroundColor: "#060a12",
          backgroundImage:
            "radial-gradient(circle at 50% 15%, rgba(80, 227, 194, 0.22), transparent 42%)",
        }}
      >
        <img
          alt="CinaChain Logo"
          src={new URL("../public/favicon.ico", import.meta.url).toString()}
          style={{ width: "96px", height: "96px", marginBottom: "24px" }}
        />
        <h1
          style={{
            fontSize: "72px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: "5rem",
            letterSpacing: "-0.02em",
            margin: 0,
            padding: 0,
          }}
        >
          <span>Cina</span>
          <span style={{ color: "#50e3c2" }}>Chain</span>
        </h1>
        <h3
          style={{
            fontSize: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#94a3b8",
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
