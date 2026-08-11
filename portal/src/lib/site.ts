// Public site metadata for the brand portal (cinachain.com).
//
// These mirror the DApp's config/deployment.ts + config/site.ts constants.
// The portal is the brand front door — every action links out to the DApp,
// docs, or social channels rather than to itself.

export const PRIMARY_NETWORK_NAME = "Base Sepolia"
export const PRIMARY_NETWORK_ENVIRONMENT = "Testnet"
export const PRIMARY_NETWORK_LABEL = `${PRIMARY_NETWORK_NAME} ${PRIMARY_NETWORK_ENVIRONMENT}`
export const DEPLOYMENT_STAGE = "Beta" as const

export const links = {
  dapp: "https://nft.cinachain.com",
  docs: "https://docs.cinachain.com",
  discord: "https://discord.gg/cinachain",
  github: "https://github.com/cinagroup",
} as const

/** Absolute DApp routes used by portal CTAs. */
export const dapp = {
  home: links.dapp,
  explore: `${links.dapp}/explore`,
  mint: `${links.dapp}/mint`,
  mintBatch: `${links.dapp}/mint-batch`,
  dashboard: `${links.dapp}/dashboard`,
  collections: `${links.dapp}/collections`,
  badges: `${links.dapp}/dashboard/badges`,
  exchange: `${links.dapp}/exchange`,
  keys: `${links.dapp}/keys`,
  integration: `${links.dapp}/integration`,
} as const

export const edgeApi = {
  whitelist: "https://whitelist-api.cinachain.com/health",
  billing: "https://billing-api.cinachain.com/health",
}
