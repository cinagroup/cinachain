"use client"

import Link from "next/link"
import {
  FaDiscord,
  FaGithub,
  FaTwitter,
} from "react-icons/fa"
import {
  Zap,
  Shield,
  Globe,
  Layers,
  Award,
  Wallet,
  Code,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Server,
  Lock,
} from "lucide-react"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useContractStats } from "@/lib/hooks/use-contract-stats"

export default function HomePage() {
  const { mintedCount, maxCount, isLoading } = useContractStats()

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════ Hero ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -20%, #7928ca 0%, #ff0080 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 80% 50%, #007cf0 0%, #00dfd8 50%, transparent 70%)",
            }}
          />
        </div>

        <div className="container mx-auto max-w-[960px] px-6 pb-20 pt-32 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-vercel-sm">
            <span className="text-xs font-medium text-foreground/60">
              Building on Base L2
            </span>
            <span className="bg-violet/10 inline-flex h-4 items-center rounded-full px-2 text-[10px] font-semibold text-violet">
              Live
            </span>
          </div>

          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            CinaChain
            <span className="text-muted-foreground">.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[600px] text-lg leading-8 text-muted-foreground">
            A full-stack Web3 ecosystem on Base — NFT platform, badge system,
            gasless transactions, and edge-deployed infrastructure.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/explore"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-pill"
              )}
            >
              <Sparkles className="mr-2 size-4" />
              Explore NFT DApp
            </Link>
            <Link
              href="/mint"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "btn-pill"
              )}
            >
              Mint NFT
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "btn-pill"
              )}
            >
              Dashboard
            </Link>
          </div>

          {/* Live Stats */}
          {!isLoading && mintedCount > 0 && (
            <div className="mx-auto mt-12 flex max-w-screen-sm items-center justify-center gap-8 rounded-lg border border-border bg-card px-6 py-4 shadow-vercel-sm">
              <HeroStat label="NFTs Minted" value={mintedCount.toLocaleString()} />
              <Divider />
              <HeroStat label="Max Supply" value={maxCount.toLocaleString()} />
              <Divider />
              <HeroStat label="Network" value="Base L2" />
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════ Products ═══════════════ */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-[1200px] px-6 py-20">
          <SectionHeader
            eyebrow="Products"
            title="A growing ecosystem."
            description="Four products built on shared infrastructure, designed to work together."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <ProductCard
              icon={<Layers className="size-6" />}
              name="CinaChain NFT"
              tag="ERC-721"
              description="10,000 unique collectibles with whitelist + public mint phases. Full enumerable support for dashboard integration."
              href="/explore"
              cta="View Collection"
              status="Live"
            />
            <ProductCard
              icon={<Award className="size-6" />}
              name="CinaBadge"
              tag="ERC-1155"
              description="Soulbound achievement badges, event tickets, and membership tiers. Batch minting and airdrop support."
              href="/dashboard/badges"
              cta="View Badges"
              status="Live"
            />
            <ProductCard
              icon={<Zap className="size-6" />}
              name="Gasless Minting"
              tag="CDP Paymaster"
              description="Coinbase Smart Wallet integration with passkey-based onboarding. Users mint without holding ETH."
              href="/mint"
              cta="Try Gasless"
              status="Beta"
            />
            <ProductCard
              icon={<Server className="size-6" />}
              name="Edge API"
              tag="Cloudflare Workers"
              description="Whitelist verification and paymaster proxy running on Cloudflare's global edge network."
              href="https://cinachain-whitelist-api.cinagroup.workers.dev/health"
              cta="API Status"
              status="Live"
              external
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ Tech Stack ═══════════════ */}
      <section className="border-t border-border bg-card/50">
        <div className="container mx-auto max-w-[1200px] px-6 py-20">
          <SectionHeader
            eyebrow="Infrastructure"
            title="Production-grade stack."
            description="Every layer chosen for security, scalability, and user experience."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TechCard
              icon={<Shield className="size-5" />}
              title="Base L2"
              description="Coinbase's Ethereum L2. 100-500x lower gas than mainnet."
            />
            <TechCard
              icon={<Globe className="size-5" />}
              title="IPFS"
              description="Decentralized metadata with 3-gateway fallback for reliability."
            />
            <TechCard
              icon={<Wallet className="size-5" />}
              title="Smart Wallet"
              description="Passkey-based wallets. No seed phrases. Gasless transactions."
            />
            <TechCard
              icon={<Code className="size-5" />}
              title="Cloudflare"
              description="Edge-deployed Pages + Workers. Sub-50ms global latency."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ Roadmap ═══════════════ */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-[1200px] px-6 py-20">
          <SectionHeader
            eyebrow="Roadmap"
            title="Built incrementally."
            description="Each phase shipped to production before the next begins."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <RoadmapCard
              phase="01"
              title="Infrastructure"
              status="done"
              items={["Cloudflare Pages deploy", "Custom IPFS gateways", "RPC proxy worker"]}
            />
            <RoadmapCard
              phase="02"
              title="NFT Platform"
              status="done"
              items={["ERC-721 contract deployed", "Mint + whitelist system", "Dashboard & explore"]}
            />
            <RoadmapCard
              phase="03"
              title="Admin & Badges"
              status="done"
              items={["Admin control panel", "ERC-1155 badge system", "Gasless minting (CDP)"]}
            />
            <RoadmapCard
              phase="04"
              title="Scale & Expand"
              status="active"
              items={["USDC Paymaster integration", "Mainnet deployment", "Marketplace integration"]}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ Team ═══════════════ */}
      <section className="border-t border-border bg-card/50">
        <div className="container mx-auto max-w-[1200px] px-6 py-20">
          <SectionHeader
            eyebrow="Team"
            title="Built by cinagroup."
            description="A team focused on shipping real products on-chain."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TeamCard name="cinagroup" role="Core Team" />
            <TeamCard name="CinaChain" role="Brand & Community" />
            <TeamCard name="Open Source" role="Powered by the community" />
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA Footer ═══════════════ */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-[960px] px-6 py-24 text-center">
          <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            Start building on CinaChain<span className="text-muted-foreground">.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-base text-muted-foreground">
            Mint your first NFT, earn badges, and join the ecosystem.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/mint"
              className={cn(buttonVariants({ size: "lg" }), "btn-pill")}
            >
              Mint Your First NFT
              <ArrowRight className="ml-2 size-4" />
            </Link>
            <Link
              href={siteConfig.links.discord}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#7289da] px-6 text-base font-medium text-white transition-opacity hover:opacity-90"
            >
              <FaDiscord className="size-4" />
              Join Discord
            </Link>
          </div>

          <div className="mt-16 flex items-center justify-center gap-6">
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaGithub className="size-5" />
            </Link>
            <Link
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaTwitter className="size-5" />
            </Link>
            <Link
              href={siteConfig.links.discord}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaDiscord className="size-5" />
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3" />
            <span>Built on Base · Powered by Cloudflare</span>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Components ───

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl text-foreground">{value}</p>
      <p className="font-mono-tech text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function Divider() {
  return <div className="h-8 w-px bg-border" />
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </span>
      <h2 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[560px] text-base text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function ProductCard({
  icon,
  name,
  tag,
  description,
  href,
  cta,
  status,
  external,
}: {
  icon: React.ReactNode
  name: string
  tag: string
  description: string
  href: string
  cta: string
  status: "Live" | "Beta" | "Coming Soon"
  external?: boolean
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="group block rounded-xl border border-border bg-card p-6 shadow-vercel-card transition-all hover:-translate-y-0.5 hover:shadow-vercel-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-foreground">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono-tech rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tag}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              status === "Live" && "bg-[#50e3c2]/20 text-[#29bc9b]",
              status === "Beta" && "bg-violet/10 text-violet",
              status === "Coming Soon" && "bg-secondary text-muted-foreground"
            )}
          >
            {status}
          </span>
        </div>
      </div>
      <h3 className="font-display mt-4 text-xl tracking-tight text-foreground">
        {name}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link transition-colors hover:text-link-deep">
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-vercel-sm">
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function RoadmapCard({
  phase,
  title,
  status,
  items,
}: {
  phase: string
  title: string
  status: "done" | "active"
  items: string[]
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-5 shadow-vercel-card">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl text-muted-foreground/20">
          {phase}
        </span>
        {status === "done" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-[#29bc9b]">
            <CheckCircle2 className="size-3.5" />
            Done
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-violet">
            <Sparkles className="size-3.5" />
            In Progress
          </span>
        )}
      </div>
      <h3 className="font-display mt-2 text-lg tracking-tight text-foreground">
        {title}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "mt-1 size-1 shrink-0 rounded-full",
                status === "done" ? "bg-[#29bc9b]" : "bg-violet"
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TeamCard({ name, role }: { name: string; role: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-vercel-sm">
      <div className="font-display mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#7928ca] to-[#0070f3] text-xl text-white">
        {name.charAt(0)}
      </div>
      <h3 className="font-display mt-4 text-base tracking-tight text-foreground">
        {name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{role}</p>
    </div>
  )
}
