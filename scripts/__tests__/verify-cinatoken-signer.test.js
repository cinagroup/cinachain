import { describe, expect, it } from "vitest"
import { privateKeyToAccount } from "viem/accounts"

import {
  normalizePrivateKey,
  readPublicEnvValue,
  verifyCinaTokenSigner,
} from "../verify-cinatoken-signer.mjs"

const privateKey = `0x${"11".repeat(32)}`
const signer = privateKeyToAccount(privateKey).address
const badge = "0x0000000000000000000000000000000000000001"
const credit = "0x0000000000000000000000000000000000000002"

function fixtureReceipt() {
  return {
    chainId: 84532,
    deployer: signer,
    contracts: { CinaBadge: badge, CinaCredit: credit },
  }
}

function fixtureClient({ chainId = 84532, owner = signer } = {}) {
  return {
    getChainId: async () => chainId,
    getBytecode: async () => "0x6000",
    readContract: async () => owner,
  }
}

describe("CinaToken signer provisioning preflight", () => {
  it("parses public dotenv values without expansion", () => {
    expect(readPublicEnvValue("A=one\nRPC='https://example.test'\n", "RPC")).toBe(
      "https://example.test",
    )
  })

  it("normalizes a raw private key without logging it", () => {
    expect(normalizePrivateKey("11".repeat(32))).toBe(privateKey)
    expect(() => normalizePrivateKey("not-a-key")).toThrow(/malformed/u)
  })

  it("accepts only the receipt signer that owns both live contracts", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient(),
      }),
    ).resolves.toEqual({ signer, chainId: 84532 })

    await expect(
      verifyCinaTokenSigner({
        privateKey: `0x${"22".repeat(32)}`,
        receipt: fixtureReceipt(),
        client: fixtureClient(),
      }),
    ).rejects.toThrow(/does not match the deployment receipt owner/u)
  })

  it("rejects a wrong chain or changed contract owner", async () => {
    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient({ chainId: 1 }),
      }),
    ).rejects.toThrow(/RPC chain ID/u)

    await expect(
      verifyCinaTokenSigner({
        privateKey,
        receipt: fixtureReceipt(),
        client: fixtureClient({ owner: "0x0000000000000000000000000000000000000003" }),
      }),
    ).rejects.toThrow(/owner does not match/u)
  })
})
