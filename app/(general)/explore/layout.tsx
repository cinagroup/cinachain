import { ReactNode } from "react"

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return <div className="container max-w-[1200px] px-6 py-12">{children}</div>
}
