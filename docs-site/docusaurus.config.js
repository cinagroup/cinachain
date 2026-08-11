// @ts-check
import { themes as prismThemes } from "prism-react-renderer"

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "CinaChain Docs",
  tagline: "Architecture, deployment, and integration guides",
  favicon: "img/favicon.ico",
  future: {
    v4: true,
  },
  url: "https://docs.cinachain.com",
  baseUrl: "/",
  organizationName: "cinagroup",
  projectName: "cinachain",
  onBrokenLinks: "throw",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          editUrl:
            "https://github.com/cinagroup/cinachain/edit/main/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/og-image.png",
      colorMode: {
        defaultMode: "light",
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: "CinaChain Docs",
        logo: {
          alt: "CinaChain logo",
          src: "img/favicon.ico",
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "docsSidebar",
            position: "left",
            label: "Guides",
          },
          {
            href: "https://nft.cinachain.com",
            label: "DApp",
            position: "right",
          },
          {
            href: "https://github.com/cinagroup/cinachain",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              { label: "Introduction", to: "/docs/intro" },
              { label: "Architecture", to: "/docs/architecture" },
              { label: "Deployment", to: "/docs/deployment" },
            ],
          },
          {
            title: "Products",
            items: [
              { label: "CinaChain Portal", href: "https://cinachain.com" },
              { label: "CinaChain DApp", href: "https://nft.cinachain.com" },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Base Sepolia Explorer",
                href: "https://sepolia.basescan.org",
              },
              {
                label: "GitHub",
                href: "https://github.com/cinagroup/cinachain",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} cinagroup. CinaChain runs on Base Sepolia Testnet.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
}

export default config
