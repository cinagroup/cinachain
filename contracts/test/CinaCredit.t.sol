// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CinaCredit} from "../src/CinaCredit.sol";

contract CinaCreditTest is Test {
    CinaCredit credit;
    address owner = address(this);
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant RATE = 1_000_000; // 1 ETH = 1,000,000 credit
    uint256 constant FEE_BPS = 200; // 2%

    function setUp() public {
        credit = new CinaCredit(owner, RATE, treasury, FEE_BPS);
    }

    // ── Constructor ──

    function test_Constructor_SetsState() public view {
        assertEq(credit.ethToCreditRate(), RATE);
        assertEq(credit.treasury(), treasury);
        assertEq(credit.platformFeeBps(), FEE_BPS);
        assertEq(credit.name(), "CinaCredit");
        assertEq(credit.symbol(), "CINA-C");
        assertEq(credit.decimals(), 18);
        assertFalse(credit.redeemEnabled());
    }

    function test_Revert_Constructor_ZeroRate() public {
        vm.expectRevert(CinaCredit.ZeroRate.selector);
        new CinaCredit(owner, 0, treasury, FEE_BPS);
    }

    function test_Revert_Constructor_ZeroTreasury() public {
        vm.expectRevert(CinaCredit.ZeroTreasury.selector);
        new CinaCredit(owner, RATE, address(0), FEE_BPS);
    }

    function test_Revert_Constructor_FeeTooHigh() public {
        vm.expectRevert(CinaCredit.FeeTooHigh.selector);
        new CinaCredit(owner, RATE, treasury, 1001); // max 10% = 1000 bps
    }

    // ── mintWithEth ──

    function test_MintWithEth_MintsNetAfterFeeAndForwardsEth() public {
        vm.deal(alice, 1 ether);
        uint256 treasuryBefore = treasury.balance;
        // gross = 0.001e18 * 1e6 = 1e21, fee 2% = 2e19, net = 9.8e20
        uint256 net = 0.001 ether * RATE * 9800 / 10000;

        vm.expectEmit(true, true, true, true);
        emit CinaCredit.CreditMinted(alice, net, 1);
        vm.prank(alice);
        credit.mintWithEth{value: 0.001 ether}();

        assertEq(credit.balanceOf(alice), net);
        assertEq(credit.totalMintedOf(alice), net);
        assertEq(treasury.balance - treasuryBefore, 0.001 ether);
    }

    function test_MintWithEth_ZeroFeeMintsFullAmount() public {
        credit.setPlatformFee(0);
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        credit.mintWithEth{value: 0.001 ether}();

        assertEq(credit.balanceOf(alice), 0.001 ether * RATE);
    }

    function test_MintWithEth_AppliesUpdatedRateAndFee() public {
        credit.setRate(2_000_000);
        credit.setPlatformFee(1000); // 10%
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        credit.mintWithEth{value: 0.001 ether}();

        // gross = 2e21, fee 10% = 2e20, net = 1.8e21
        assertEq(credit.balanceOf(alice), 1.8e21);
    }

    function test_MintWithEth_ForwardsToUpdatedTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        credit.setTreasury(newTreasury);
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        credit.mintWithEth{value: 0.001 ether}();

        assertEq(newTreasury.balance, 0.001 ether);
        assertEq(treasury.balance, 0);
    }

    function test_Revert_MintWithEth_NoEthSent() public {
        vm.prank(alice);
        vm.expectRevert(CinaCredit.NoEthSent.selector);
        credit.mintWithEth{value: 0}();
    }

    function test_Revert_MintWithEth_WhenPaused() public {
        credit.pause();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(); // Pausable.EnforcedPause
        credit.mintWithEth{value: 0.001 ether}();
    }

    // ── mintTo ──

    function test_MintTo_MintsFullAmount() public {
        vm.expectEmit(true, true, true, true);
        emit CinaCredit.CreditMinted(bob, 500, 2);
        credit.mintTo(bob, 500);

        assertEq(credit.balanceOf(bob), 500);
        assertEq(credit.totalMintedOf(bob), 500);
    }

    function test_Revert_MintTo_NotOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(); // Ownable.OwnableUnauthorizedAccount
        credit.mintTo(alice, 500);
        vm.stopPrank();
    }

    function test_Revert_MintTo_ZeroAmount() public {
        vm.expectRevert(CinaCredit.ZeroAmount.selector);
        credit.mintTo(bob, 0);
    }

    // ── redeem ──

    function test_Redeem_RefundsEthAtRateAndBurns() public {
        credit.mintTo(alice, 2 ether * RATE); // worth 2 ETH
        credit.setRedeemEnabled(true);
        vm.deal(address(credit), 2 ether);
        uint256 aliceBefore = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit CinaCredit.CreditRedeemed(alice, 1 ether * RATE);
        vm.prank(alice);
        credit.redeem(1 ether * RATE);

        assertEq(alice.balance - aliceBefore, 1 ether);
        assertEq(credit.balanceOf(alice), 1 ether * RATE);
        assertEq(credit.totalBurnedOf(alice), 1 ether * RATE);
    }

    function test_Redeem_DisabledByDefault() public {
        credit.mintTo(alice, 1 ether * RATE);
        vm.startPrank(alice);
        vm.expectRevert(CinaCredit.RedeemDisabled.selector);
        credit.redeem(1 ether * RATE);
        vm.stopPrank();
    }

    function test_Redeem_DustBurnedInFullFloorEthRefunded() public {
        // 1.5 ETH worth + 123 dust credit: full amount burned, 1.5 ETH refunded
        uint256 amount = 1.5 ether * RATE + 123;
        credit.mintTo(alice, amount);
        credit.setRedeemEnabled(true);
        vm.deal(address(credit), 2 ether);
        uint256 aliceBefore = alice.balance;

        vm.prank(alice);
        credit.redeem(amount);

        assertEq(alice.balance - aliceBefore, 1.5 ether);
        assertEq(credit.balanceOf(alice), 0);
        assertEq(credit.totalBurnedOf(alice), amount);
    }

    function test_Revert_Redeem_ZeroEthOut() public {
        credit.mintTo(alice, RATE - 1); // less than 1 ETH worth
        credit.setRedeemEnabled(true);
        vm.startPrank(alice);
        vm.expectRevert(CinaCredit.NoEthSent.selector);
        credit.redeem(RATE - 1);
        vm.stopPrank();
    }

    function test_Revert_Redeem_ZeroAmount() public {
        credit.setRedeemEnabled(true);
        vm.prank(alice);
        vm.expectRevert(CinaCredit.NoEthSent.selector);
        credit.redeem(0);
    }

    function test_Revert_Redeem_InsufficientTreasury() public {
        credit.mintTo(alice, 1 ether * RATE);
        credit.setRedeemEnabled(true);
        vm.deal(address(credit), 0.5 ether); // contract underfunded
        vm.startPrank(alice);
        vm.expectRevert(CinaCredit.InsufficientTreasury.selector);
        credit.redeem(1 ether * RATE);
        vm.stopPrank();
    }

    function test_Revert_Redeem_InsufficientBalance() public {
        credit.setRedeemEnabled(true);
        vm.deal(address(credit), 1 ether);
        vm.startPrank(alice);
        vm.expectRevert(); // ERC20InsufficientBalance
        credit.redeem(1 ether * RATE);
        vm.stopPrank();
    }

    function test_Revert_Redeem_WhenPaused() public {
        credit.mintTo(alice, 1 ether * RATE);
        credit.setRedeemEnabled(true);
        vm.deal(address(credit), 1 ether);
        credit.pause();
        vm.startPrank(alice);
        vm.expectRevert(); // Pausable.EnforcedPause
        credit.redeem(1 ether * RATE);
        vm.stopPrank();
    }

    // ── Admin setters ──

    function test_Admin_SettersValidateAndEmit() public {
        vm.expectEmit(true, true, true, true);
        emit CinaCredit.RateUpdated(RATE, 2_000_000);
        credit.setRate(2_000_000);
        assertEq(credit.ethToCreditRate(), 2_000_000);

        vm.expectEmit(true, true, true, true);
        emit CinaCredit.TreasuryUpdated(treasury, bob);
        credit.setTreasury(bob);
        assertEq(credit.treasury(), bob);

        vm.expectEmit(true, true, true, true);
        emit CinaCredit.PlatformFeeUpdated(FEE_BPS, 300);
        credit.setPlatformFee(300);
        assertEq(credit.platformFeeBps(), 300);

        vm.expectEmit(true, true, true, true);
        emit CinaCredit.RedeemToggled(true);
        credit.setRedeemEnabled(true);
        assertTrue(credit.redeemEnabled());
    }

    function test_Revert_Admin_SettersRejectInvalidValues() public {
        vm.expectRevert(CinaCredit.ZeroRate.selector);
        credit.setRate(0);

        vm.expectRevert(CinaCredit.ZeroTreasury.selector);
        credit.setTreasury(address(0));

        vm.expectRevert(CinaCredit.FeeTooHigh.selector);
        credit.setPlatformFee(1001);
    }

    function test_Revert_Admin_NotOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(); // Ownable.OwnableUnauthorizedAccount
        credit.setRate(1);
        vm.expectRevert(); // Ownable.OwnableUnauthorizedAccount
        credit.pause();
        vm.stopPrank();
    }

    function test_Admin_PauseUnpauseRoundTrip() public {
        credit.pause();
        assertTrue(credit.paused());
        credit.unpause();
        assertFalse(credit.paused());

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        credit.mintWithEth{value: 0.001 ether}(); // works again
        assertGt(credit.balanceOf(alice), 0);
    }

    function test_Revert_RenounceOwnership_Blocked() public {
        vm.expectRevert("renounce blocked");
        credit.renounceOwnership();
    }
}
