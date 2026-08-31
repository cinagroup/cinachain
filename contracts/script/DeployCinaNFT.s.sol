// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CinaNFT} from "../src/CinaNFT.sol";

/// @title DeployCinaNFT
/// @notice Deployment script for CinaNFT on Base / Base Sepolia
///
/// Usage (Base Sepolia testnet):
///   forge script script/DeployCinaNFT.s.sol \
///     --rpc-url $BASE_SEPOLIA_RPC_URL \
///     --account cinachain-deployer \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $BASESCAN_API_KEY \
///     --chain-id 84532 \
///     -vvv
///
/// Usage (Base Mainnet):
///   forge script script/DeployCinaNFT.s.sol \
///     --rpc-url $BASE_RPC_URL \
///     --account cinachain-deployer \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $BASESCAN_API_KEY \
///     --chain-id 8453 \
///     -vvv
contract DeployCinaNFT is Script {
    // ── Configuration ──
    string constant NAME = "CinaChain NFT";
    string constant SYMBOL = "CINA";
    uint256 constant MAX_SUPPLY = 10_000;
    // 0.001 ETH = 1000000000000000 wei (Base L2 pricing)
    uint256 constant MINT_PRICE = 0.001 ether;

    function run() external {
        // OWNER is public configuration; the broadcaster is supplied through
        // Foundry's encrypted keystore via --account.
        address owner = vm.envAddress("OWNER");

        vm.startBroadcast();

        console2.log("Deploying CinaNFT to Base...");
        console2.log("  Name:      ", NAME);
        console2.log("  Symbol:    ", SYMBOL);
        console2.log("  MaxSupply: ", MAX_SUPPLY);
        console2.log("  Price:     ", MINT_PRICE);
        console2.log("  Owner:     ", owner);

        CinaNFT nft = new CinaNFT(NAME, SYMBOL, MAX_SUPPLY, MINT_PRICE, owner);

        console2.log("CinaNFT deployed at:", address(nft));

        vm.stopBroadcast();

        // Print for easy copy-paste into .env.local
        console2.log("");
        console2.log("=== Add to .env.local ===");
        console2.log("NEXT_PUBLIC_CINA_NFT_CONTRACT=", address(nft));
        console2.log("==========================");
    }
}
