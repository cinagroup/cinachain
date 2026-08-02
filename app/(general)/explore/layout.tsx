import { type ReactNode } from "react"

/**
 * Explore layout — passthrough wrapper.
 * The explore page provides its own container.
 */
export default function ExploreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container max-w-[1200px] px-6 py-12">{children}</div>
  )
}
