"use client"

import Link from "next/link"
import { FaDiscord, FaGithub } from "react-icons/fa"
import { Shield, Zap, Globe, Layers } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { hasNftContract } from "@/lib/contracts/addresses"

export default function HomePage() {
  const { mintedCount, maxCount, remaining, paused } = useContractStats()

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
              NFT Platform on Base
            </span>
            <span className="inline-flex h-4 items-center rounded-full bg-violet/10 px-2 text-[10px] font-semibold text-violet">
              {paused ? "Paused" : "Live"}
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
              href={siteConfig.links.discord}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#7289da] px-6 text-base font-medium text-white transition-opacity hover:opacity-90"
            >
              <FaDiscord className="h-4 w-4" />
              Discord
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

          {/* Live Stats */}
          {hasNftContract && mintedCount > 0 && (
            <div className="mx-auto mt-12 flex max-w-[640px] items-center justify-center gap-8 rounded-lg border border-border bg-card px-6 py-4 shadow-vercel-sm">
              <Stat label="Minted" value={mintedCount.toLocaleString()} />
              <Divider />
              <Stat label="Total Supply" value={maxCount.toLocaleString()} />
              <Divider />
              <Stat label="Remaining" value={remaining.toLocaleString()} />
            </div>
          )}
        </div>
      </section>

      {/* Feature Cards */}
      <section className="container max-w-[1200px] px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Globe className="h-5 w-5" />}
            eyebrow="COLLECT"
            title="Browse the gallery."
            description="Explore the full CinaChain NFT collection with multi-gateway IPFS fallback for reliable image loading."
            href="/explore"
            cta="View Gallery"
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            eyebrow="MINT"
            title="Mint your NFT."
            description="Whitelist and public mint phases with Merkle proof verification. Real-time transaction feedback."
            href="/mint"
            cta="Start Minting"
          />
          <FeatureCard
            icon={<Layers className="h-5 w-5" />}
            eyebrow="MANAGE"
            title="Track your holdings."
            description="Dashboard with live balance, owned NFTs, favorites, and collection statistics."
            href="/dashboard"
            cta="Open Dashboard"
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-card/50">
        <div className="container max-w-[1200px] px-6 py-20">
          <div className="mb-12 text-center">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              How It Works
            </span>
            <h2 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Three steps to own a CinaChain NFT<span className="text-muted-foreground">.</span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              step="01"
              title="Connect Wallet"
              description="Connect your Ethereum wallet via MetaMask, WalletConnect, or Coinbase Wallet."
            />
            <StepCard
              step="02"
              title="Check Eligibility"
              description="The DApp checks your whitelist status automatically and shows your mint phase."
            />
            <StepCard
              step="03"
              title="Mint & Collect"
              description="Mint your NFT. Metadata is stored on IPFS with multi-gateway fallback."
            />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container max-w-[1200px] px-6 py-20">
        <div className="mb-12 text-center">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Built With
          </span>
          <h2 className="font-display mt-3 text-3xl tracking-tight text-foreground">
            Production-grade infrastructure<span className="text-muted-foreground">.</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TechCard icon={<Shield className="h-5 w-5" />} title="ERC-721" description="Standard-compliant NFT contract with enumerable support" />
          <TechCard icon={<Globe className="h-5 w-5" />} title="IPFS" description="Decentralized metadata storage with 3-gateway fallback" />
          <TechCard icon={<Layers className="h-5 w-5" />} title="Cloudflare" description="Edge-deployed on Cloudflare Pages with Workers API" />
          <TechCard icon={<Zap className="h-5 w-5" />} title="Multi-chain RPC" description="Resilient RPC with automatic failover" />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl text-foreground">{value}</p>
      <p className="font-mono-tech text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function Divider() {
  return <div className="h-8 w-px bg-border" />
}

function FeatureCard({
  icon,
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-6 shadow-vercel-card transition-shadow hover:shadow-vercel-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-foreground">
          {icon}
        </div>
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
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

function StepCard({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-6 shadow-vercel-card">
      <span className="font-display absolute right-4 top-4 text-3xl text-muted-foreground/20">
        {step}
      </span>
      <h3 className="font-display text-lg tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function TechCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-vercel-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}
