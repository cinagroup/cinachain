// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Site
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
interface SiteConfig {
  name: string
  title: string
  emoji: string
  description: string
  localeDefault: string
  links: {
    docs: string
    discord: string
    twitter: string
    github: string
  }
}

export const siteConfig: SiteConfig = {
  name: "CinaChain",
  title: "CinaChain - NFT DApp",
  emoji: "🔗",
  description:
    "CinaChain NFT platform built on Base L2 with Cloudflare Web3 infrastructure.",
  localeDefault: "en",
  links: {
    docs: "https://docs.cinachain.com",
    discord: "https://discord.gg/cinachain",
    twitter: "https://x.com/cinachain",
    github: "https://github.com/cinagroup",
  },
}

export const DEPLOY_URL =
  "https://dash.cloudflare.com/sign-up?pt=f&redirect_url=https%3A%2F%2Fpages.cloudflare.com"
