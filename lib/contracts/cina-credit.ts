// CinaCreditV2 surface used by the DApp (settlement token, ops-issued:
// no ETH top-up/redeem — see docs/superpowers/specs/2026-08-26-cinacredit-v2-design.md).
// The full role/permit surface stays off the frontend; the admin page only
// needs the minter/pauser entrypoints.
export const CINA_CREDIT_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [
    { name: "account", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "mintTo", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const
