import { type ReactNode } from "react"
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Code,
  Coins,
  Globe,
  Layers,
  Lock,
  Server,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react"
import { FaDiscord, FaGithub } from "react-icons/fa"

import { cn } from "@/lib/cn"
import { useI18n } from "@/lib/i18n"
import {
  dapp,
  DEPLOYMENT_STAGE,
  edgeApi,
  links,
  PRIMARY_NETWORK_LABEL,
  PRIMARY_NETWORK_NAME,
} from "@/lib/site"
import { buttonVariants } from "@/components/ui/button"
import { BrandMark, BrandName } from "@/components/brand-mark"
import { HeroStats } from "@/components/home/hero-stats"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"

/**
 * CinaChain brand portal (cinachain.com) — homepage.
 *
 * Ported section-for-section from the NFT DApp homepage
 * (app/(general)/page.tsx). The visual structure, spacing, tokens and
 * component styling are identical; only the link targets differ (the portal
 * is the brand front door, so CTAs point out to the DApp, docs and socials).
 */
export function App() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-sm bg-foreground px-4 py-3 text-sm font-medium text-background transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {t("common.skipToContent")}
      </a>
      <SiteHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* ═══════════════ Hero ═══════════════ */}
        <section className="relative overflow-hidden">
          {/* Mesh gradient at hero scale (DESIGN.md: the brand's only
              decorative chrome — never miniaturised, never reduced to a
              single stop). */}
          <div
            className="mesh-gradient absolute inset-x-0 -top-40 h-[560px] opacity-20 blur-3xl"
            aria-hidden="true"
          />

          <div className="container mx-auto max-w-[960px] px-6 pb-20 pt-32 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 shadow-vercel-sm">
              <span className="text-xs font-medium text-foreground/60">
                {t("hero.buildingOn", { network: PRIMARY_NETWORK_LABEL })}
              </span>
              <span className="bg-violet/10 inline-flex h-4 items-center rounded-full px-2 text-[10px] font-semibold text-violet">
                {t("status.beta")}
              </span>
            </div>

            <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
              <BrandName />
              <span className="text-muted-foreground">.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-lg leading-8 text-muted-foreground">
              {t("hero.description", { network: PRIMARY_NETWORK_LABEL })}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={dapp.explore}
                className={cn(buttonVariants({ size: "lg" }), "btn-pill")}
              >
                <Sparkles className="mr-2 size-4" />
                {t("hero.explore")}
              </a>
              <a
                href={dapp.mint}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "btn-pill"
                )}
              >
                {t("hero.mint")}
              </a>
              <a
                href={dapp.dashboard}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "btn-pill"
                )}
              >
                {t("hero.dashboard")}
              </a>
            </div>

            <HeroStats />
          </div>
        </section>

        {/* ═══════════════ Products ═══════════════ */}
        <section className="content-auto-section border-t border-border">
          <div className="container mx-auto max-w-[1400px] px-6 py-24">
            <SectionHeader
              eyebrow={t("products.eyebrow")}
              title={t("products.title")}
              description={t("products.description")}
            />

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <ProductCard
                icon={<Layers className="size-6" />}
                name="CinaChain NFT"
                tag="ERC-721"
                description={t("product.nft.description")}
                href={dapp.explore}
                cta={t("product.nft.cta")}
                status={DEPLOYMENT_STAGE}
                statusLabel={t("status.beta")}
              />
              <ProductCard
                icon={<Award className="size-6" />}
                name="CinaBadge"
                tag="ERC-1155"
                description={t("product.badge.description")}
                href={dapp.badges}
                cta={t("product.badge.cta")}
                status={DEPLOYMENT_STAGE}
                statusLabel={t("status.beta")}
              />
              <ProductCard
                icon={<Coins className="size-6" />}
                name="CinaMega"
                tag="ERC-1155"
                description={t("product.mega.description")}
                href={dapp.collections}
                cta={t("product.mega.cta")}
                status="Beta"
                statusLabel={t("status.beta")}
              />
              <ProductCard
                icon={<Zap className="size-6" />}
                name={t("product.gasless.name")}
                tag="CDP Paymaster"
                description={t("product.gasless.description")}
                href={dapp.mint}
                cta={t("product.gasless.cta")}
                status="Beta"
                statusLabel={t("status.beta")}
              />
              <ProductCard
                icon={<Server className="size-6" />}
                name="Edge API"
                tag="Cloudflare Workers"
                description={t("product.edge.description")}
                href={edgeApi.whitelist}
                cta={t("product.edge.cta")}
                status={DEPLOYMENT_STAGE}
                statusLabel={t("status.beta")}
                external
              />
            </div>
          </div>
        </section>

        {/* ═══════════════ Tech Stack ═══════════════ */}
        <section className="content-auto-section border-t border-border bg-card/50">
          <div className="container mx-auto max-w-[1400px] px-6 py-24">
            <SectionHeader
              eyebrow={t("infrastructure.eyebrow")}
              title={t("infrastructure.title")}
              description={t("infrastructure.description")}
            />

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TechCard
                icon={<Shield className="size-5" />}
                title={PRIMARY_NETWORK_NAME}
                description={t("tech.base.description")}
              />
              <TechCard
                icon={<Globe className="size-5" />}
                title="IPFS"
                description={t("tech.ipfs.description")}
              />
              <TechCard
                icon={<Wallet className="size-5" />}
                title={t("tech.wallet.title")}
                description={t("tech.wallet.description")}
              />
              <TechCard
                icon={<Code className="size-5" />}
                title="Cloudflare"
                description={t("tech.cloudflare.description")}
              />
            </div>
          </div>
        </section>

        {/* ═══════════════ Roadmap ═══════════════ */}
        <section className="content-auto-section border-t border-border">
          <div className="container mx-auto max-w-[1400px] px-6 py-24">
            <SectionHeader
              eyebrow={t("roadmap.eyebrow")}
              title={t("roadmap.title")}
              description={t("roadmap.description")}
            />

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <RoadmapCard
                phase="01"
                title={t("roadmap.phase1.title")}
                status="done"
                items={[
                  t("roadmap.phase1.item1"),
                  t("roadmap.phase1.item2"),
                  t("roadmap.phase1.item3"),
                ]}
              />
              <RoadmapCard
                phase="02"
                title={t("roadmap.phase2.title")}
                status="done"
                items={[
                  t("roadmap.phase2.item1"),
                  t("roadmap.phase2.item2"),
                  t("roadmap.phase2.item3"),
                ]}
              />
              <RoadmapCard
                phase="03"
                title={t("roadmap.phase3.title")}
                status="done"
                items={[
                  t("roadmap.phase3.item1"),
                  t("roadmap.phase3.item2"),
                  t("roadmap.phase3.item3"),
                ]}
              />
              <RoadmapCard
                phase="04"
                title={t("roadmap.phase4.title")}
                status="active"
                items={[
                  t("roadmap.phase4.item1"),
                  t("roadmap.phase4.item2"),
                  t("roadmap.phase4.item3"),
                  t("roadmap.phase4.item4"),
                ]}
              />
            </div>
          </div>
        </section>

        {/* ═══════════════ Team ═══════════════ */}
        <section className="content-auto-section border-t border-border bg-card/50">
          <div className="container mx-auto max-w-[1400px] px-6 py-24">
            <SectionHeader
              eyebrow={t("team.eyebrow")}
              title={t("team.title")}
              description={t("team.description")}
            />

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TeamCard
                icon={<Users className="size-8" />}
                name="cinagroup"
                role={t("team.coreRole")}
              />
              <TeamCard
                icon={<BrandMark size={40} />}
                name="CinaChain"
                role={t("team.brandRole")}
              />
              <TeamCard
                icon={<FaGithub className="size-8" />}
                name={t("team.openSource")}
                role={t("team.openSourceRole")}
              />
            </div>
          </div>
        </section>

        {/* ═══════════════ CTA Footer — dark polarity band ═══════════════ */}
        <section className="content-auto-section band-dark border-t border-border">
          <div className="container mx-auto max-w-[960px] px-6 py-24 text-center">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              {t("cta.title")}
              <span className="text-white/50">.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-base text-white/60">
              {t("cta.description")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={dapp.mint}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "btn-pill bg-white text-[#171717]"
                )}
              >
                {t("cta.mint")}
                <ArrowRight className="ml-2 size-4" />
              </a>
              <a
                href={links.discord}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-base font-medium text-white transition-opacity hover:opacity-90"
              >
                <FaDiscord className="size-4" />
                {t("cta.discord")}
              </a>
            </div>

            <div className="mt-16 flex items-center justify-center gap-6">
              <a
                href={links.github}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("aria.github")}
                className="flex size-11 items-center justify-center text-white/50 transition-colors hover:text-white"
              >
                <FaGithub className="size-5" />
              </a>
              <a
                href={links.discord}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("aria.discord")}
                className="flex size-11 items-center justify-center text-white/50 transition-colors hover:text-white"
              >
                <FaDiscord className="size-5" />
              </a>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/50">
              <Lock className="size-3" />
              <span>
                {t("cta.powered", { network: PRIMARY_NETWORK_LABEL })}
              </span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

// ─── Components ───

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
  statusLabel,
  external,
}: {
  icon: ReactNode
  name: string
  tag: string
  description: string
  href: string
  cta: string
  status: "Live" | "Beta" | "Coming soon"
  statusLabel: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="group block rounded-lg border border-border bg-card p-6 shadow-vercel-card transition-all hover:-translate-y-0.5 hover:shadow-vercel-md"
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
              // Live keeps the brand cyan accent; Beta uses violet (both
              // spec palette); success semantics use the success token.
              status === "Live" && "bg-cyan/20 text-cyan-deep",
              status === "Beta" && "bg-violet/10 text-violet",
              status === "Coming soon" && "bg-secondary text-muted-foreground"
            )}
          >
            {statusLabel}
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
    </a>
  )
}

function TechCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-vercel-sm">
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-medium tracking-tight text-foreground">
        {title}
      </h3>
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
  const { t } = useI18n()

  return (
    <div className="relative rounded-lg border border-border bg-card p-5 shadow-vercel-card">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl text-muted-foreground/20">
          {phase}
        </span>
        {status === "done" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            {t("status.done")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-violet">
            <Sparkles className="size-3.5" />
            {t("status.inProgress")}
          </span>
        )}
      </div>
      <h3 className="font-display mt-2 text-lg tracking-tight text-foreground">
        {title}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <span
              className={cn(
                "mt-1 size-1 shrink-0 rounded-full",
                status === "done" ? "bg-success" : "bg-violet"
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TeamCard({
  icon,
  name,
  role,
}: {
  icon: ReactNode
  name: string
  role: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center shadow-vercel-sm">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted text-foreground">
        {icon}
      </div>
      <h3 className="font-display mt-4 text-base tracking-tight text-foreground">
        {name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{role}</p>
    </div>
  )
}
