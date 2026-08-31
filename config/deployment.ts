// Public deployment metadata. This module intentionally has no wagmi
// transports or client-only state so it is safe to import from metadata,
// server components, static pages, and tests.
//
// Do not import the `viem/chains` barrel here. It eagerly traverses every
// bundled chain definition, including Tempo's optional worker-mining runtime,
// even though CinaChain only supports Base Sepolia. Building the chain from
// viem's public OP Stack config preserves Base transaction formatting without
// pulling unrelated chain implementations into every metadata page.
import { defineChain } from "viem"
import { chainConfig } from "viem/op-stack"

const SOURCE_CHAIN_ID = 11_155_111

export const PRIMARY_CHAIN = defineChain({
  ...chainConfig,
  id: 84_532,
  network: "base-sepolia",
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Basescan",
      url: "https://sepolia.basescan.org",
      apiUrl: "https://api-sepolia.basescan.org/api",
    },
  },
  contracts: {
    ...chainConfig.contracts,
    disputeGameFactory: {
      [SOURCE_CHAIN_ID]: {
        address: "0xd6E6dBf4F7EA0ac412fD8b65ED297e64BB7a06E1",
      },
    },
    l2OutputOracle: {
      [SOURCE_CHAIN_ID]: {
        address: "0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254",
      },
    },
    portal: {
      [SOURCE_CHAIN_ID]: {
        address: "0x49f53e41452c74589e85ca1677426ba426459e85",
        blockCreated: 4_446_677,
      },
    },
    l1StandardBridge: {
      [SOURCE_CHAIN_ID]: {
        address: "0xfd0Bf71F60660E2f608ed56e1659C450eB113120",
        blockCreated: 4_446_677,
      },
    },
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1_059_647,
    },
  },
  testnet: true,
  sourceId: SOURCE_CHAIN_ID,
})
export const PRIMARY_CHAIN_ID = PRIMARY_CHAIN.id

export const PRIMARY_NETWORK_NAME = PRIMARY_CHAIN.name
export const PRIMARY_NETWORK_ENVIRONMENT = PRIMARY_CHAIN.testnet
  ? "Testnet"
  : "Mainnet"
export const PRIMARY_NETWORK_LABEL = `${PRIMARY_NETWORK_NAME} ${PRIMARY_NETWORK_ENVIRONMENT}`
export const DEPLOYMENT_STAGE = PRIMARY_CHAIN.testnet ? "Beta" : "Live"

export const EXPLORER_LINK = PRIMARY_CHAIN.blockExplorers.default.url
export const EXPLORER_NAME = PRIMARY_CHAIN.blockExplorers.default.name
export const EXPLORER_API_URL =
  PRIMARY_CHAIN.blockExplorers.default.apiUrl ??
  "https://api-sepolia.basescan.org/api"

// Kept for compatibility with the original config export. Prefer
// EXPLORER_API_URL for new API consumers and EXPLORER_LINK for public links.
export const EXPLORER_URL = new URL(EXPLORER_API_URL).origin

export type ExplorerResource = "address" | "token" | "tx"

/** Build a public explorer link for data that belongs to the primary chain. */
export function getBlockExplorerUrl(
  resource: ExplorerResource,
  identifier: string,
  query?: Readonly<Record<string, string | number | bigint | undefined>>
): string {
  const base = `${EXPLORER_LINK}/${resource}/${encodeURIComponent(identifier)}`
  if (!query) return base

  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })

  const serialized = search.toString()
  return serialized ? `${base}?${serialized}` : base
}
