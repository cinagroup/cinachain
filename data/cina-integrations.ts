export const integrationCategories = ["general", "protocols"] as const

interface CinaIntegration {
  name: string
  href: string
  url: string
  description: string
  imgLight: string
  imgDark: string
  category: (typeof integrationCategories)[number]
}

export const cinaIntegrations = {
  siwe: {
    name: "SIWE",
    href: "/integration/sign-in-with-ethereum",
    url: "https://login.xyz/",
    description:
      "Sign-In with Ethereum is Web3 authentication using an Ethereum account.",
    imgLight: "/integrations/siwe.svg",
    imgDark: "/integrations/siwe.svg",
    category: "general",
  },
  erc20: {
    name: "ERC20",
    href: "/integration/erc20",
    url: "https://eips.ethereum.org/EIPS/eip-20",
    description: "ERC20 is a standard for fungible tokens on EVM chains",
    imgLight: "/integrations/erc20.png",
    imgDark: "/integrations/erc20.png",
    category: "protocols",
  },
  erc721: {
    name: "ERC721",
    href: "/integration/erc721",
    url: "https://eips.ethereum.org/EIPS/eip-721",
    description: "ERC721 is a standard for non-fungible tokens on EVM chains",
    imgLight: "/integrations/erc721-icon.png",
    imgDark: "/integrations/erc721-icon.png",
    category: "protocols",
  },
  erc1155: {
    name: "ERC1155",
    href: "/integration/erc1155",
    url: "https://eips.ethereum.org/EIPS/eip-1155",
    description: "ERC1155 is a multi-token standard on EVM chains",
    imgLight: "/integrations/erc1155-icon.png",
    imgDark: "/integrations/erc1155-icon.png",
    category: "protocols",
  },
  starter: {
    name: "Starter Template",
    href: "/integration/starter",
    url: "https://docs.cinachain.com",
    description:
      "Use this template to get started building integrations with CinaChain.",
    imgLight: "/logo-gradient.png",
    category: "general",
    imgDark: "/logo-gradient.png",
  },
} as const
