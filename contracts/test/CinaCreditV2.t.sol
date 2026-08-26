// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CinaCreditV2} from "../src/CinaCreditV2.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract CinaCreditV2Test is Test {
    CinaCreditV2 credit;
    address admin = makeAddr("admin"); // cold multisig (backup minter)
    address minter = makeAddr("minter"); // chain-worker hot wallet
    address pauser = makeAddr("pauser");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant ADMIN_ROLE = 0x00; // AccessControl.DEFAULT_ADMIN_ROLE
    bytes32 MINTER_ROLE;
    bytes32 PAUSER_ROLE;

    // EIP-712 domain for permit (name "CinaCredit", version "1")
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    uint256 constant ALICE_PK = 0xA11CE; // dedicated test key for permit signatures

    function setUp() public {
        credit = new CinaCreditV2(admin, minter, pauser);
        MINTER_ROLE = credit.MINTER_ROLE();
        PAUSER_ROLE = credit.PAUSER_ROLE();
    }

    // ── Constructor / roles ──

    function test_Constructor_GrantsRoles() public view {
        assertTrue(credit.hasRole(ADMIN_ROLE, admin));
        assertTrue(credit.hasRole(MINTER_ROLE, admin)); // backup minter
        assertTrue(credit.hasRole(MINTER_ROLE, minter));
        assertTrue(credit.hasRole(PAUSER_ROLE, pauser));
        assertFalse(credit.hasRole(MINTER_ROLE, alice));
        assertFalse(credit.hasRole(PAUSER_ROLE, admin)); // admin ≠ pauser by default
    }

    function test_Constructor_TokenIdentity() public view {
        assertEq(credit.name(), "CinaCredit");
        assertEq(credit.symbol(), "CINA-C");
        assertEq(credit.decimals(), 18);
        assertEq(credit.totalSupply(), 0);
        assertEq(credit.nonces(alice), 0);
    }

    function test_Revert_Constructor_ZeroAdmin() public {
        vm.expectRevert(CinaCreditV2.ZeroAddress.selector);
        new CinaCreditV2(address(0), minter, pauser);
    }

    function test_Revert_Constructor_ZeroMinter() public {
        vm.expectRevert(CinaCreditV2.ZeroAddress.selector);
        new CinaCreditV2(admin, address(0), pauser);
    }

    function test_Revert_Constructor_ZeroPauser() public {
        vm.expectRevert(CinaCreditV2.ZeroAddress.selector);
        new CinaCreditV2(admin, minter, address(0));
    }

    function test_Admin_ManagesRoles() public {
        vm.prank(admin);
        credit.grantRole(MINTER_ROLE, bob);
        assertTrue(credit.hasRole(MINTER_ROLE, bob));

        vm.prank(admin);
        credit.revokeRole(MINTER_ROLE, bob);
        assertFalse(credit.hasRole(MINTER_ROLE, bob));
    }

    function test_Revert_RoleGrant_NotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, ADMIN_ROLE));
        credit.grantRole(MINTER_ROLE, alice);
    }

    // ── mintTo (chain-worker settlement path) ──

    function test_MintTo_ByMinter() public {
        vm.expectEmit(true, true, true, true);
        emit CinaCreditV2.Minted(alice, 1 ether, minter);
        vm.prank(minter);
        credit.mintTo(alice, 1 ether);

        assertEq(credit.balanceOf(alice), 1 ether);
        assertEq(credit.totalSupply(), 1 ether);
        assertEq(credit.nonces(alice), 0); // mint is not a permit
    }

    function test_MintTo_ByAdminBackupMinter() public {
        vm.prank(admin);
        credit.mintTo(bob, 5 ether);
        assertEq(credit.balanceOf(bob), 5 ether);
    }

    function test_Revert_MintTo_NotMinter() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, MINTER_ROLE)
        );
        credit.mintTo(alice, 1 ether);
    }

    function test_Revert_MintTo_ZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert(CinaCreditV2.ZeroAddress.selector);
        credit.mintTo(address(0), 1 ether);
    }

    function test_Revert_MintTo_ZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(CinaCreditV2.ZeroAmount.selector);
        credit.mintTo(alice, 0);
    }

    function test_Revert_MintTo_WhenPaused() public {
        vm.prank(pauser);
        credit.pause();
        vm.prank(minter);
        vm.expectRevert(); // Pausable.EnforcedPause
        credit.mintTo(alice, 1 ether);
    }

    // ── Transfers & pause containment ──

    function test_Transfer_Standard() public {
        vm.prank(minter);
        credit.mintTo(alice, 10 ether);

        vm.prank(alice);
        credit.transfer(bob, 4 ether);
        assertEq(credit.balanceOf(alice), 6 ether);
        assertEq(credit.balanceOf(bob), 4 ether);
    }

    function test_Pause_BlocksTransferAndUnpauseRestores() public {
        vm.prank(minter);
        credit.mintTo(alice, 1 ether);

        vm.prank(pauser);
        credit.pause();
        assertTrue(credit.paused());

        vm.prank(alice);
        vm.expectRevert(); // Pausable.EnforcedPause
        credit.transfer(bob, 1 ether);

        vm.prank(pauser);
        credit.unpause();
        vm.prank(alice);
        credit.transfer(bob, 1 ether);
        assertEq(credit.balanceOf(bob), 1 ether);
    }

    function test_Revert_Pause_NotPauser() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, PAUSER_ROLE)
        );
        credit.pause();
    }

    function test_Revert_Pause_AdminWithoutPauserRole() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, admin, PAUSER_ROLE)
        );
        credit.pause();
    }

    // ── Burn (self-burn only) ──

    function test_Burn_Self() public {
        vm.prank(minter);
        credit.mintTo(alice, 3 ether);
        vm.prank(alice);
        credit.burn(1 ether);
        assertEq(credit.balanceOf(alice), 2 ether);
        assertEq(credit.totalSupply(), 2 ether);
    }

    function test_BurnFrom_WithAllowance() public {
        vm.prank(minter);
        credit.mintTo(alice, 3 ether);
        vm.prank(alice);
        credit.approve(bob, 2 ether);
        vm.prank(bob);
        credit.burnFrom(alice, 2 ether);
        assertEq(credit.balanceOf(alice), 1 ether);
        assertEq(credit.allowance(alice, bob), 0);
    }

    function test_Revert_Burn_ExceedsBalance() public {
        vm.prank(minter);
        credit.mintTo(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(); // ERC20InsufficientBalance
        credit.burn(2 ether);
    }

    function test_Revert_Burn_WhenPaused() public {
        vm.prank(minter);
        credit.mintTo(alice, 1 ether);
        vm.prank(pauser);
        credit.pause();
        vm.prank(alice);
        vm.expectRevert(); // Pausable.EnforcedPause
        credit.burn(1 ether);
    }

    // ── Permit (EIP-2612) ──

    function _domainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    keccak256(bytes("CinaCredit")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(credit)
                )
            );
    }

    function _signPermit(uint256 pk, address owner, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, credit.nonces(owner), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function test_Permit_SetsAllowanceInOneSignature() public {
        address owner = vm.addr(ALICE_PK);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ALICE_PK, owner, bob, 5 ether, deadline);

        credit.permit(owner, bob, 5 ether, deadline, v, r, s);
        assertEq(credit.allowance(owner, bob), 5 ether);
        assertEq(credit.nonces(owner), 1);
    }

    function test_Permit_AllowsSpendFrom() public {
        address owner = vm.addr(ALICE_PK);
        vm.prank(minter);
        credit.mintTo(owner, 10 ether);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ALICE_PK, owner, bob, 5 ether, deadline);
        credit.permit(owner, bob, 5 ether, deadline, v, r, s);

        vm.prank(bob);
        credit.transferFrom(owner, bob, 5 ether);
        assertEq(credit.balanceOf(owner), 5 ether);
    }

    function test_Revert_Permit_ExpiredDeadline() public {
        address owner = vm.addr(ALICE_PK);
        uint256 deadline = block.timestamp - 1;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ALICE_PK, owner, bob, 5 ether, deadline);
        vm.expectRevert(); // ERC2612ExpiredSignature
        credit.permit(owner, bob, 5 ether, deadline, v, r, s);
    }

    function test_Revert_Permit_WrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        // signed by ALICE_PK but claimed for bob as owner
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(ALICE_PK, bob, alice, 5 ether, deadline);
        vm.expectRevert(); // ERC2612InvalidSigner
        credit.permit(bob, alice, 5 ether, deadline, v, r, s);
    }
}
