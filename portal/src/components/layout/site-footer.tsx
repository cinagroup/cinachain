import { type ReactNode } from "react"
import { FaDiscord, FaGithub } from "react-icons/fa"

import { cn } from "@/lib/cn"
import { useI18n } from "@/lib/i18n"
import { dapp, edgeApi, links } from "@/lib/site"
import { BrandMark, BrandName } from "@/components/brand-mark"

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

function FooterCol({
  title,
  items,
}: {
  title: string
  items: ReadonlyArray<FooterLink>
}) {
  return (
    <div>
      <h3 className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              {...(item.external
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialLink({
  href,
  ariaLabel,
  children,
}: {
  href: string
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground",
        "transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {children}
    </a>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()
  const { t } = useI18n()

  return (
    <footer className="border-t border-border bg-background">
      <div className="container max-w-screen-ultra py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <a
              href="/"
              aria-label={t("aria.home")}
              className="flex min-h-11 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BrandMark size={28} />
              <BrandName className="text-base" />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              {t("footer.description")}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <SocialLink href={links.github} ariaLabel={t("aria.github")}>
                <FaGithub className="size-4" />
              </SocialLink>
              <SocialLink href={links.discord} ariaLabel={t("aria.discord")}>
                <FaDiscord className="size-4" />
              </SocialLink>
            </div>
          </div>

          <FooterCol
            title={t("footer.products")}
            items={[
              { label: "CinaChain NFT", href: dapp.explore, external: true },
              { label: "CinaBadge", href: dapp.badges, external: true },
              { label: "CinaMega", href: dapp.collections, external: true },
              {
                label: t("footer.exchange"),
                href: dapp.exchange,
                external: true,
              },
            ]}
          />

          <FooterCol
            title={t("footer.resources")}
            items={[
              { label: t("nav.docs"), href: links.docs, external: true },
              { label: t("footer.mint"), href: dapp.mint, external: true },
              {
                label: t("footer.dashboard"),
                href: dapp.dashboard,
                external: true,
              },
              {
                label: t("footer.apiStatus"),
                href: edgeApi.whitelist,
                external: true,
              },
            ]}
          />

          <FooterCol
            title={t("footer.community")}
            items={[
              { label: "GitHub", href: links.github, external: true },
              { label: "Discord", href: links.discord, external: true },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {year} cinagroup · {t("footer.builtOn")}{" "}
            <a
              href="https://base.org"
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-foreground"
            >
              Base
            </a>{" "}
            · {t("footer.poweredBy")}{" "}
            <a
              href="https://cloudflare.com"
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-foreground"
            >
              Cloudflare
            </a>
          </p>
          <p>{t("footer.stage")}</p>
        </div>
      </div>
    </footer>
  )
}
