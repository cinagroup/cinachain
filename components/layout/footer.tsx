"use client"

import { HTMLAttributes } from "react"
import Link from "next/link"
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa"

import { DEPLOYMENT_STAGE, PRIMARY_NETWORK_LABEL } from "@/config/deployment"
import { siteConfig } from "@/config/site"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { BrandMark, BrandName } from "@/components/brand/brand-mark"

export function Footer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  const { t } = useI18n()
  const classes = cn(className, "border-t border-border bg-background")

  const columns = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.explore"), href: "/explore" },
        { label: t("nav.mint"), href: "/mint" },
        { label: t("nav.collections"), href: "/collections" },
        { label: t("nav.exchange"), href: "/exchange" },
        { label: t("nav.dashboard"), href: "/dashboard" },
        { label: t("footer.apiKeys"), href: "/settings" },
      ],
    },
    {
      title: t("footer.integrations"),
      links: [
        { label: "ERC-20", href: "/integration/erc20" },
        { label: "ERC-721", href: "/integration/erc721" },
        { label: "ERC-1155", href: "/integration/erc1155" },
        {
          label: t("footer.signInWithEthereum"),
          href: "/integration/sign-in-with-ethereum",
        },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("nav.documentation"), href: siteConfig.links.docs },
        { label: "GitHub", href: siteConfig.links.github },
      ],
    },
    {
      title: t("footer.community"),
      links: [
        { label: "Discord", href: siteConfig.links.discord },
        { label: "Twitter", href: siteConfig.links.twitter },
      ],
    },
  ]

  return (
    <footer className={classes} {...props}>
      <div className="container max-w-screen-wide px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <Link
              href="/"
              aria-label={t("nav.homeAria")}
              className="inline-flex items-center gap-2"
            >
              <BrandMark size={24} />
              <BrandName className="text-sm" />
            </Link>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {t("footer.tagline", {
                network: PRIMARY_NETWORK_LABEL,
                stage: t(`status.${DEPLOYMENT_STAGE.toLowerCase()}`),
              })}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/60 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} cinagroup.{" "}
            {t("footer.allRightsReserved")}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={siteConfig.links.github}
              aria-label={t("footer.githubAria")}
              className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaGithub className="size-4" />
            </Link>
            <Link
              href={siteConfig.links.twitter}
              aria-label={t("footer.xAria")}
              className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaTwitter className="size-4" />
            </Link>
            <Link
              href={siteConfig.links.discord}
              aria-label={t("footer.discordAria")}
              className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <FaDiscord className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
