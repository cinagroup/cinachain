import { describe, expect, it } from "vitest"

import {
  DEPLOYMENT_STAGE,
  EXPLORER_API_URL,
  EXPLORER_LINK,
  getBlockExplorerUrl,
  PRIMARY_CHAIN,
  PRIMARY_CHAIN_ID,
  PRIMARY_NETWORK_ENVIRONMENT,
  PRIMARY_NETWORK_LABEL,
  PRIMARY_NETWORK_NAME,
} from "../deployment"
import { chains, transports } from "../networks"

describe("primary network metadata", () => {
  it("identifies the current deployment as Base Sepolia beta", () => {
    expect(PRIMARY_CHAIN_ID).toBe(84532)
    expect(PRIMARY_NETWORK_NAME).toBe("Base Sepolia")
    expect(PRIMARY_NETWORK_ENVIRONMENT).toBe("Testnet")
    expect(PRIMARY_NETWORK_LABEL).toBe("Base Sepolia Testnet")
    expect(DEPLOYMENT_STAGE).toBe("Beta")
    expect(EXPLORER_LINK).toBe("https://sepolia.basescan.org")
    expect(EXPLORER_API_URL).toBe("https://api-sepolia.basescan.org/api")
  })

  it("uses the same primary chain for wagmi and AppKit consumers", () => {
    expect(chains).toEqual([PRIMARY_CHAIN])
    expect(chains[0].id).toBe(PRIMARY_CHAIN_ID)
    expect(Object.keys(transports)).toEqual([String(PRIMARY_CHAIN_ID)])
  })

  it("builds explorer links from the configured explorer", () => {
    expect(getBlockExplorerUrl("tx", "0xabc")).toBe(
      "https://sepolia.basescan.org/tx/0xabc"
    )
    expect(
      getBlockExplorerUrl("token", "0xdef", { a: 42n, ignored: undefined })
    ).toBe("https://sepolia.basescan.org/token/0xdef?a=42")
  })
})
