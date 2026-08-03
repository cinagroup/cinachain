// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CinaNFT} from "../src/CinaNFT.sol";

/// @title DeployCinaNFT
/// @notice Deployment script for CinaNFT on Sepolia / Mainnet
///
/// Usage:
///   forge script script/DeployCinaNFT.s.sol \
///     --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify \
///     -vvv
contract DeployCinaNFT is Script {
    // ── Configuration (edit before deploying) ──
    string constant NAME = "CinaChain NFT";
    string constant SYMBOL = "CINA";
    uint256 constant MAX_SUPPLY = 10_000;
    uint256 constant MINT_PRICE = 0.05 ether; // 50000000000000000 wei

    // Owner is read from the deploying wallet (msg.sender in broadcast)
    // Override with OWNER env var if different
    address owner;

    function run() external {
        // Get owner from env or use deployer
        owner = vm.envOr("OWNER", vm.addr(vm.envUint("PRIVATE_KEY")));

        vm.startBroadcast();

        console2.log("Deploying CinaNFT...");
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
