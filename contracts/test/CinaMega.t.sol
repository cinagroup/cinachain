// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CinaMega} from "../src/CinaMega.sol";

contract CinaMegaTest is Test {
    CinaMega mega;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant UCINA = 1;
    uint256 constant MCINA = 2;
    uint256 constant CINA = 3;

    function setUp() public {
        mega = new CinaMega(owner, 1000);
    }

    // ── Unit math ──

    function test_UnitMath_FixedRate() public view {
        assertEq(mega.typeUnits(UCINA), 1);
        assertEq(mega.typeUnits(MCINA), 1000);
        assertEq(mega.typeUnits(CINA), 1000000);
    }

    function test_UnitMath_InvalidTypeReverts() public {
        vm.expectRevert(CinaMega.InvalidTokenType.selector);
        mega.typeUnits(4);
    }

    // ── Free ucina mint ──

    function test_MintUcina_Success() public {
        vm.prank(alice);
        mega.mintUcina(500);
        assertEq(mega.balanceOf(alice, UCINA), 500);
        assertEq(mega.ucinaMinted(alice), 500);
    }

    function test_MintUcina_CapEnforced() public {
        vm.startPrank(alice);
        mega.mintUcina(1000);
        vm.expectRevert(CinaMega.MintCapExceeded.selector);
        mega.mintUcina(1);
        vm.stopPrank();
    }

    function test_MintUcina_CapIsPerAddress() public {
        vm.prank(alice);
        mega.mintUcina(1000);
        vm.prank(bob);
        mega.mintUcina(1000); // bob's own cap
        assertEq(mega.balanceOf(bob, UCINA), 1000);
    }

    function test_MintUcina_ZeroAmountReverts() public {
        vm.expectRevert(CinaMega.ZeroAmount.selector);
        mega.mintUcina(0);
    }

    // ── Exchange ──

    function test_Exchange_UcinaToCina() public {
        vm.startPrank(alice);
        mega.mintUcina(1000000);
        mega.exchange(UCINA, CINA, 1000000);
        assertEq(mega.balanceOf(alice, CINA), 1);
        assertEq(mega.balanceOf(alice, UCINA), 0);
        vm.stopPrank();
    }

    function test_Exchange_CinaToMcina() public {
        vm.startPrank(alice);
        mega.mintUcina(1000000);
        mega.exchange(UCINA, CINA, 1000000);
        mega.exchange(CINA, MCINA, 1);
        assertEq(mega.balanceOf(alice, MCINA), 1000);
        assertEq(mega.balanceOf(alice, CINA), 0);
        vm.stopPrank();
    }

    function test_Exchange_McinaToUcina_RoundTrip() public {
        vm.startPrank(alice);
        mega.mintUcina(1000000);
        mega.exchange(UCINA, MCINA, 1000000);
        assertEq(mega.balanceOf(alice, MCINA), 1000);
        mega.exchange(MCINA, UCINA, 1000);
        assertEq(mega.balanceOf(alice, UCINA), 1000000);
        assertEq(mega.balanceOf(alice, MCINA), 0);
        vm.stopPrank();
    }

    function test_Exchange_DustBurned() public {
        vm.startPrank(alice);
        mega.mintUcina(1500);
        mega.exchange(UCINA, MCINA, 1500);
        // floor(1500 * 1 / 1000) = 1; 500 units burned on the source side
        assertEq(mega.balanceOf(alice, MCINA), 1);
        assertEq(mega.balanceOf(alice, UCINA), 0);
        vm.stopPrank();
    }

    function test_Exchange_TooSmallRevertsAndBurnsNothing() public {
        vm.prank(alice);
        mega.mintUcina(999);
        vm.expectRevert(CinaMega.ExchangeTooSmall.selector);
        mega.exchange(UCINA, CINA, 999);
        assertEq(mega.balanceOf(alice, UCINA), 999);
    }

    function test_Exchange_SameTypeReverts() public {
        vm.expectRevert(CinaMega.SameTokenType.selector);
        mega.exchange(UCINA, UCINA, 1);
    }

    function test_Exchange_InvalidTypeReverts() public {
        vm.expectRevert(CinaMega.InvalidTokenType.selector);
        mega.exchange(UCINA, 4, 1);
    }

    function test_Exchange_ZeroAmountReverts() public {
        vm.expectRevert(CinaMega.ZeroAmount.selector);
        mega.exchange(UCINA, MCINA, 0);
    }

    function test_Exchange_InsufficientBalanceReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // ERC1155InsufficientBalance
        mega.exchange(UCINA, MCINA, 1);
    }

    // ── Template initialization + lock ──

    function test_InitTemplate_ThenLock() public {
        mega.initTemplate(UCINA, bytes("svg1"), "QmUcina");
        mega.initTemplate(MCINA, bytes("svg2"), "QmMcina");
        mega.initTemplate(CINA, bytes("svg3"), "QmCina");
        mega.lockTemplates();

        assertTrue(mega.svgLocked());
        assertEq(mega.uri(UCINA), "ipfs://QmUcina/metadata.json");
        assertEq(mega.getBackupSvgRaw(MCINA), bytes("svg2"));

        vm.expectRevert(CinaMega.TemplatesLockedError.selector);
        mega.initTemplate(UCINA, bytes("x"), "QmX");
    }

    function test_LockTemplates_RequiresAllTypes() public {
        mega.initTemplate(UCINA, bytes("svg1"), "QmUcina");
        mega.initTemplate(MCINA, bytes("svg2"), "QmMcina");
        // CINA missing → lock must revert
        vm.expectRevert();
        mega.lockTemplates();
    }

    function test_InitTemplate_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        mega.initTemplate(UCINA, bytes("svg"), "QmX");
    }

    function test_SetMintCap_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        mega.setMintCap(10);
    }

    function test_RenounceOwnership_Reverts() public {
        vm.expectRevert(CinaMega.OwnershipRenounceBlocked.selector);
        mega.renounceOwnership();
    }

    // ── Pausable ──

    function test_Paused_BlocksMintAndExchange() public {
        mega.initTemplate(UCINA, bytes("s"), "QmU");
        mega.initTemplate(MCINA, bytes("s"), "QmM");
        mega.initTemplate(CINA, bytes("s"), "QmC");
        mega.lockTemplates();
        mega.pause();

        vm.prank(alice);
        vm.expectRevert();
        mega.mintUcina(1);

        vm.prank(alice);
        vm.expectRevert();
        mega.exchange(UCINA, MCINA, 1);
    }
}
