// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CinaBadge} from "../src/CinaBadge.sol";

contract CinaBadgeTest is Test {
    CinaBadge badge;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        badge = new CinaBadge("ipfs://QmTest/{id}.json", owner);
    }

    // ── Constructor ──

    function test_Constructor_CreatesStandardBadges() public view {
        CinaBadge.BadgeType memory earlyMinter = badge.getBadgeType(1);
        assertEq(earlyMinter.name, "Early Minter");
        assertTrue(earlyMinter.soulbound);
        assertEq(earlyMinter.maxSupply, 1000);

        CinaBadge.BadgeType memory whitelist = badge.getBadgeType(2);
        assertEq(whitelist.name, "Whitelist Member");
        assertTrue(whitelist.soulbound);

        CinaBadge.BadgeType memory vip = badge.getBadgeType(5);
        assertEq(vip.name, "VIP Member");
        assertFalse(vip.soulbound);
        assertEq(vip.maxSupply, 500);
    }

    // ── Minting ──

    function test_Mint_Success() public {
        badge.mint(alice, 1, 1);
        assertEq(badge.balanceOf(alice, 1), 1);
        assertTrue(badge.hasBadge(alice, 1));
    }

    function test_MintBatch_Airdrop() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = address(0x1234);

        badge.mintBatch(recipients, 2, 1);

        assertEq(badge.balanceOf(alice, 2), 1);
        assertEq(badge.balanceOf(bob, 2), 1);
        assertEq(badge.balanceOf(address(0x1234), 2), 1);
    }

    function test_MintToAddress_MultipleTypes() public {
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 4;
        ids[2] = 5;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 2;
        amounts[2] = 1;

        badge.mintToAddress(alice, ids, amounts);

        assertEq(badge.balanceOf(alice, 1), 1);
        assertEq(badge.balanceOf(alice, 4), 2);
        assertEq(badge.balanceOf(alice, 5), 1);
    }

    function test_Revert_Mint_NonExistentBadge() public {
        vm.expectRevert(CinaBadge.BadgeTypeNotFound.selector);
        badge.mint(alice, 999, 1);
    }

    function test_Revert_Mint_NonOwner() public {
        vm.startPrank(alice);
        vm.expectRevert();
        badge.mint(bob, 1, 1);
        vm.stopPrank();
    }

    function test_Revert_Mint_MaxSupply() public {
        // Badge 1 has maxSupply 1000
        badge.mint(alice, 1, 1000);
        vm.expectRevert(CinaBadge.MaxSupplyReached.selector);
        badge.mint(bob, 1, 1);
    }

    function test_Revert_Mint_ZeroAmount() public {
        vm.expectRevert(CinaBadge.ZeroAmount.selector);
        badge.mint(alice, 1, 0);
    }

    // ── Soulbound ──

    function test_Soulbound_TransferBlocked() public {
        // Mint soulbound badge 1 to alice
        badge.mint(alice, 1, 1);

        vm.startPrank(alice);
        vm.expectRevert(CinaBadge.SoulboundTransferBlocked.selector);
        badge.safeTransferFrom(alice, bob, 1, 1, "");
        vm.stopPrank();
    }

    function test_NonSoulbound_TransferWorks() public {
        // Mint non-soulbound badge 4 (event ticket) to alice
        badge.mint(alice, 4, 2);

        vm.startPrank(alice);
        badge.safeTransferFrom(alice, bob, 4, 1, "");
        vm.stopPrank();

        assertEq(badge.balanceOf(alice, 4), 1);
        assertEq(badge.balanceOf(bob, 4), 1);
    }

    function test_Soulbound_BatchTransferBlocked() public {
        badge.mint(alice, 1, 1);
        badge.mint(alice, 2, 1);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.startPrank(alice);
        vm.expectRevert(CinaBadge.SoulboundTransferBlocked.selector);
        badge.safeBatchTransferFrom(alice, bob, ids, amounts, "");
        vm.stopPrank();
    }

    // ── Custom Badge Creation ──

    function test_CreateBadgeType() public {
        uint256 newId = badge.createBadgeType("Test Badge", "A test", false, 100);
        assertEq(newId, 100);

        CinaBadge.BadgeType memory newBadge = badge.getBadgeType(100);
        assertEq(newBadge.name, "Test Badge");
        assertEq(newBadge.maxSupply, 100);
        assertFalse(newBadge.soulbound);
    }

    function test_CreateMultipleBadgeTypes() public {
        uint256 id1 = badge.createBadgeType("Badge A", "Desc A", true, 50);
        uint256 id2 = badge.createBadgeType("Badge B", "Desc B", false, 0);

        assertEq(id1, 100);
        assertEq(id2, 101);
    }

    function test_Mint_CustomBadge() public {
        uint256 id = badge.createBadgeType("Custom", "Custom badge", false, 10);
        badge.mint(alice, id, 5);
        assertEq(badge.balanceOf(alice, id), 5);
    }

    // ── URI ──

    function test_URI() public {
        badge.setURI("ipfs://NewCID/");
        string memory uri = badge.uri(1);
        // Should end with /1.json
        assertGt(bytes(uri).length, 10);
    }

    function test_Revert_URI_NonExistentBadge() public {
        vm.expectRevert(CinaBadge.BadgeTypeNotFound.selector);
        badge.uri(999);
    }

    // ── Pause ──

    function test_Pause_BlocksMint() public {
        badge.pause();
        vm.expectRevert(); // Pausable.EnforcedPause
        badge.mint(alice, 1, 1);
    }

    function test_Unpause_AllowsMint() public {
        badge.pause();
        badge.unpause();
        badge.mint(alice, 1, 1);
        assertEq(badge.balanceOf(alice, 1), 1);
    }

    // ── Views ──

    function test_HasBadge() public {
        assertFalse(badge.hasBadge(alice, 1));
        badge.mint(alice, 1, 1);
        assertTrue(badge.hasBadge(alice, 1));
    }

    function test_GetStandardBadgeIds() public view {
        uint256[] memory ids = badge.getStandardBadgeIds();
        assertEq(ids.length, 5);
        assertEq(ids[0], 1);
        assertEq(ids[4], 5);
    }

    function test_BadgeTypeCount() public view {
        // 5 standard badges, 0 custom yet
        assertEq(badge.badgeTypeCount(), 5);

        badge.createBadgeType("Custom", "Test", false, 0);
        assertEq(badge.badgeTypeCount(), 6);
    }

    // ── Total Minted Tracking ──

    function test_TotalMinted() public {
        badge.mint(alice, 1, 10);
        badge.mintBatch({recipients: _addrArray(bob), tokenId: 1, amountPerUser: 5});

        CinaBadge.BadgeType memory bt = badge.getBadgeType(1);
        assertEq(bt.totalMinted, 15);
    }

    function _addrArray(address a) internal pure returns (address[] memory) {
        address[] memory arr = new address[](1);
        arr[0] = a;
        return arr;
    }
}
