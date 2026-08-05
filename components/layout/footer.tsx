import { HTMLAttributes } from "react"
import Link from "next/link"
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

export function Footer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  const classes = cn(className, "border-t border-border bg-background")

  const columns = [
    {
      title: "Product",
      links: [
        { label: "Explore", href: "/explore" },
        { label: "Mint", href: "/mint" },
        { label: "Collections", href: "/collections" },
        { label: "Exchange", href: "/exchange" },
        { label: "Dashboard", href: "/dashboard" },
        { label: "API Keys", href: "/settings" },
      ],
    },
    {
      title: "Integrations",
      links: [
        { label: "ERC-20", href: "/integration/erc20" },
        { label: "ERC-721", href: "/integration/erc721" },
        { label: "ERC-1155", href: "/integration/erc1155" },
        { label: "Sign-In With Ethereum", href: "/integration/sign-in-with-ethereum" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: siteConfig.links.docs },
        { label: "GitHub", href: siteConfig.links.github },
      ],
    },
    {
      title: "Community",
      links: [
        { label: "Discord", href: siteConfig.links.discord },
        { label: "Twitter", href: siteConfig.links.twitter },
      ],
    },
  ]

  return (
    <footer className={classes} {...props}>
      <div className="container max-w-[1200px] px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full bg-foreground" />
              <span className="font-display text-sm tracking-tight text-foreground">CinaChain</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              NFT Platform built on Ethereum with Cloudflare Web3 infrastructure.
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
            &copy; {new Date().getFullYear()} cinagroup. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href={siteConfig.links.github} className="text-muted-foreground transition-colors hover:text-foreground">
              <FaGithub className="size-4" />
            </Link>
            <Link href={siteConfig.links.twitter} className="text-muted-foreground transition-colors hover:text-foreground">
              <FaTwitter className="size-4" />
            </Link>
            <Link href={siteConfig.links.discord} className="text-muted-foreground transition-colors hover:text-foreground">
              <FaDiscord className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
