// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CinaBadge} from "../src/CinaBadge.sol";

/// @title DeployCinaBadge
/// @notice Deployment script for CinaBadge (ERC-1155) on Base
///
/// Usage:
///   forge script script/DeployCinaBadge.s.sol \
///     --rpc-url $BASE_SEPOLIA_RPC_URL \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify \
///     --etherscan-api-key $BASESCAN_API_KEY -vvv
contract DeployCinaBadge is Script {
    // Base metadata URI for badge JSON files
    // Each badge type gets {id}.json at this base path
    // Leave empty for on-chain fallback (you can update later via setURI)
    string constant METADATA_URI = "ipfs://YOUR_BADGE_CID/";

    function run() external {
        address owner = vm.envOr("OWNER", vm.addr(vm.envUint("PRIVATE_KEY")));

        vm.startBroadcast();

        console2.log("Deploying CinaBadge (ERC-1155)...");
        console2.log("  Metadata URI:", METADATA_URI);
        console2.log("  Owner:        ", owner);

        CinaBadge badge = new CinaBadge(METADATA_URI, owner);

        console2.log("CinaBadge deployed at:", address(badge));

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Add to .env.local ===");
        console2.log("NEXT_PUBLIC_CINA_ERC1155_CONTRACT=", address(badge));
        console2.log("==========================");
    }
}
