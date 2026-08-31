"use client"

import Link from "next/link"
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa"

import { siteConfig } from "@/config/site"
import { useI18n } from "@/lib/i18n"

export function DashboardFooter() {
  const { t } = useI18n()

  return (
    <footer className="mt-auto flex flex-col border-t pb-6 pr-2 pt-4">
      <h3 className="font-display text-sm">{siteConfig.title}</h3>
      <Link
        href="/"
        className="w-fit py-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("footer.builtBy")}
      </Link>
      <div className="mt-2 flex items-center space-x-3">
        <Link
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("footer.githubAria")}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FaGithub className="size-4" />
        </Link>
        <Link
          href={siteConfig.links.twitter}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("footer.xAria")}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FaTwitter className="size-4" />
        </Link>
        <Link
          href={siteConfig.links.discord}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("footer.discordAria")}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FaDiscord className="size-4" />
        </Link>
      </div>
    </footer>
  )
}
