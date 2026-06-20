import { MerkleTree } from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"

export interface Env {
  CINA_WHITELIST_KV?: KVNamespace
}

interface WhitelistData {
  merkleRoot: string
  addresses: string[]
  mintLimit: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const address = url.pathname.split("/")[2]?.toLowerCase()

    // CORS 头
    const headers = {
      "Access-Control-Allow-Origin": "https://nft.cinachain.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers })
    }

    // 验证地址格式
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return new Response(
        JSON.stringify({ error: "Invalid address" }),
        { status: 400, headers }
      )
    }

    // 检查 KV 是否配置
    if (!env.CINA_WHITELIST_KV) {
      return new Response(
        JSON.stringify({ error: "KV namespace not configured" }),
        { status: 500, headers }
      )
    }

    // 从 KV 获取白名单数据
    const whitelistData = await env.CINA_WHITELIST_KV.get(
      "whitelist:current",
      "json"
    )
    if (!whitelistData) {
      return new Response(
        JSON.stringify({ error: "Whitelist not configured" }),
        { status: 500, headers }
      )
    }

    const { addresses, mintLimit } = whitelistData as WhitelistData

    // 检查地址是否在白名单中
    const normalizedAddress = address.toLowerCase()
    const normalizedAddresses = addresses.map((a) => a.toLowerCase())
    const isInWhitelist = normalizedAddresses.includes(normalizedAddress)

    if (!isInWhitelist) {
      return Response.json(
        { eligible: false, proof: null, mintLimit: 0 },
        { headers }
      )
    }

    // 生成 Merkle Proof
    const leaves = addresses.map((addr) =>
      solidityKeccak256(["address"], [addr])
    )
    const tree = new MerkleTree(leaves, keccak256)
    const leafIndex = normalizedAddresses.indexOf(normalizedAddress)
    const proof = tree
      .getProof(leaves[leafIndex])
      .map((p) => "0x" + p.data.toString("hex"))
    const merkleRoot = "0x" + tree.getRoot().toString("hex")

    return Response.json(
      {
        eligible: true,
        proof,
        merkleRoot,
        mintLimit: mintLimit || 3,
      },
      { headers }
    )
  },
}
