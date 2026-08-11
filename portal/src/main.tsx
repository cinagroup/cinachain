import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// Design tokens first (shared with the DApp), then the Tailwind entry.
import "../design-tokens.css"
import "./styles.css"

import { App } from "./App"

const container = document.getElementById("root")
if (!container) {
  throw new Error("Root container #root not found")
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
