import { type ReactNode } from "react"
import { SiteHeader } from "@/components/layout/site-header"
import { Footer } from "@/components/layout/footer"

export default function CollectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container max-w-screen-ultra flex-1 px-6 py-12">
        {children}
      </main>
      <Footer />
    </div>
  )
}
