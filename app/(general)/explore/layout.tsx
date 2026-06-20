import { ReactNode } from "react"

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return <div className="container mx-auto px-4 py-12">{children}</div>
}
