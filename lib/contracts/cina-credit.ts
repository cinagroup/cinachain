export const CINA_CREDIT_ABI = [
  { name: "mintWithEth", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "mintTo", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
  { name: "setRate", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "newRate", type: "uint256" } ], outputs: [] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [
    { name: "account", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
  { name: "ethToCreditRate", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "platformFeeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "setRedeemEnabled", type: "function", stateMutability: "nonpayable", inputs: [{ name: "enabled", type: "bool" }], outputs: [] },
] as const
