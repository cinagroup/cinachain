import { privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"

import {
  normalizePrivateKey,
  readPublicEnvValue,
  verifyCinaTokenSigner,
} from "../verify-cinatoken-signer.mjs"

const privateKey = `0x${"11".repeat(32)}`
const signer = privateKeyToAccount(privateKey).address
const deployer = privateKeyToAccount(`0x${"33".repeat(32)}`).address
const badge = "0x0000000000000000000000000000000000000001"
const credit = "0x0000000000000000000000000000000000000002"

function fixtureReceipt() {
  return {
    chainId: 84532,
    deployer,
    contracts: { CinaBadge: badge, CinaCredit: credit },
  }
}

function fixtureClient({
  chainId = 84532,
  badgeOwner = signer,
  hasMinter = true,
} = {}) {
  return {
    getChainId: async () => chainId,
    getBytecode: async () => "0x6000",
    readContract: async ({ address, functionName } = {}) => {
      if (address === badge && functionName === "owner") return badgeOwner
      if (address === credit && functionName === "MINTER_ROLE") {
        return `0x${"ab".repeat(32)}`
      }
      if (address === credit && functionName === "hasRole") return hasMinter
      throw new Error(`unexpected readContract call: ${functionName}`)
    },
  }
}

describe("CinaToken signer provisioning preflight", () => {
  it("parses public dotenv values without expansion", () => {
    expect(
      readPublicEnvValue("A=one\nRPC='https://example.test'\n", "RPC")
    ).toBe("https://example.test")
  })

  it("normalizes a raw private key without logging it", () => {
    expect(normalizePrivateKey("11".repeat(32))).toBe(privateKey)
    expect(() => normalizePrivateKey("not-a-key")).toThrow(/malformed/u)
  })

  it("accepts a dedicated non-deployer signer with only required live authority", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient(),
      })
    ).resolves.toEqual({ signer, chainId: 84532 })

    await expect(
      verifyCinaTokenSigner({
        privateKey: `0x${"22".repeat(32)}`,
        receipt: fixtureReceipt(),
        client: fixtureClient(),
      })
    ).rejects.toThrow(/dedicated signer/u)
  })

  it("rejects a wrong chain or changed contract owner", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient({ chainId: 1 }),
      })
    ).rejects.toThrow(/RPC chain ID/u)

    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient({
          badgeOwner: "0x0000000000000000000000000000000000000003",
        }),
      })
    ).rejects.toThrow(/CinaBadge owner/u)
  })

  it("rejects a signer without CinaCredit MINTER_ROLE", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient({ hasMinter: false }),
      })
    ).rejects.toThrow(/lacks MINTER_ROLE/u)
  })

  it("rejects reuse of the deployment private key", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey: `0x${"33".repeat(32)}`,
        receipt: fixtureReceipt(),
        client: fixtureClient(),
      })
    ).rejects.toThrow(/must not reuse the deployment signer/u)
  })
})
