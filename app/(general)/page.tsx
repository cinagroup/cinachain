import Link from "next/link"
import { FaDiscord, FaGithub } from "react-icons/fa"
import { LuBook } from "react-icons/lu"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ExampleDemos } from "@/components/shared/example-demos"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Mesh Gradient Background */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -20%, #7928ca 0%, #ff0080 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 80% 50%, #007cf0 0%, #00dfd8 50%, transparent 70%)",
            }}
          />
        </div>

        <div className="container max-w-[960px] px-6 pt-24 pb-16 text-center">
          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-vercel-sm">
            <span className="text-xs font-medium text-foreground/60">
              NFT Platform on Ethereum
            </span>
            <span className="inline-flex h-4 items-center rounded-full bg-violet/10 px-2 text-[10px] font-semibold text-violet">
              Live
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Mint, collect, and trade
            <br />
            <span className="bg-gradient-to-r from-[#7928ca] via-[#ff0080] to-[#ff4d4d] bg-clip-text text-transparent">
              NFTs on CinaChain
            </span>
            <span className="text-foreground">.</span>
          </h1>

          {/* Body */}
          <p className="mx-auto mt-6 max-w-[560px] text-lg leading-7 text-foreground/60">
            {siteConfig.description}
          </p>

          {/* CTA Row */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/explore"
              className="btn-pill inline-flex h-12 items-center justify-center bg-foreground px-6 text-base font-medium text-background transition-opacity hover:opacity-90"
            >
              Explore Collection
            </Link>
            <Link
              href="/mint"
              className="btn-pill inline-flex h-12 items-center justify-center border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Mint NFT
            </Link>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-12 items-center gap-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
            >
              <FaGithub className="h-4 w-4" />
              GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="container max-w-[1200px] px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            eyebrow="COLLECT"
            title="Browse the gallery."
            description="Explore the full CinaChain NFT collection with multi-gateway IPFS fallback."
            href="/explore"
            cta="View Gallery"
          />
          <FeatureCard
            eyebrow="MINT"
            title="Mint your NFT."
            description="Whitelist and public mint phases with Merkle proof verification."
            href="/mint"
            cta="Start Minting"
          />
          <FeatureCard
            eyebrow="MANAGE"
            title="Track your holdings."
            description="Dashboard with balance, favorites, and collection statistics."
            href="/dashboard"
            cta="Open Dashboard"
          />
        </div>
      </section>

      {/* Demo Section */}
      <section className="container max-w-[1200px] px-6 pb-24">
        <ExampleDemos />
      </section>
    </div>
  )
}

function FeatureCard({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow: string
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-6 shadow-vercel-card transition-shadow hover:shadow-vercel-md">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </span>
      <h3 className="mt-3 font-display text-xl tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-foreground/60">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link transition-colors hover:text-link-deep"
      >
        {cta}
        <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
