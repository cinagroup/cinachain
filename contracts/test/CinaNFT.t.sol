// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {CinaNFT} from "../src/CinaNFT.sol";

contract CinaNFTTest is Test {
    CinaNFT nft;
    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant PRICE = 0.05 ether;

    function setUp() public {
        nft = new CinaNFT("CinaChain NFT", "CINA", 10_000, PRICE, owner);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ── Constructor ──

    function test_Constructor() public view {
        assertEq(nft.name(), "CinaChain NFT");
        assertEq(nft.symbol(), "CINA");
        assertEq(nft.maxSupply(), 10_000);
        assertEq(nft.mintPrice(), PRICE);
        assertEq(nft.owner(), owner);
        assertEq(nft.totalSupply(), 0);
        assertFalse(nft.paused());
    }

    // ── Public Mint ──

    function test_MintPublic_Success() public {
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE}(1);

        assertEq(nft.totalSupply(), 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(alice), 1);
        vm.stopPrank();
    }

    function test_MintPublic_Multiple() public {
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE * 3}(3);
        assertEq(nft.balanceOf(alice), 3);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.ownerOf(3), alice);
        vm.stopPrank();
    }

    function test_Revert_MintPublic_WrongPrice() public {
        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                CinaNFT.PriceMismatch.selector,
                PRICE,
                0.01 ether
            )
        );
        nft.mintPublic{value: 0.01 ether}(1);
        vm.stopPrank();
    }

    function test_Revert_MintPublic_ZeroQuantity() public {
        vm.startPrank(alice);
        vm.expectRevert(CinaNFT.ZeroQuantity.selector);
        nft.mintPublic{value: 0}(0);
        vm.stopPrank();
    }

    function test_Revert_MintPublic_ExceedsMaxPerAddress() public {
        vm.startPrank(alice);
        // Mint 10 (max allowed)
        nft.mintPublic{value: PRICE * 10}(10);
        // 11th should fail
        vm.expectRevert(CinaNFT.MaxPerAddressExceeded.selector);
        nft.mintPublic{value: PRICE}(1);
        vm.stopPrank();
    }

    function test_Revert_MintPublic_Paused() public {
        nft.pause();
        vm.startPrank(alice);
        vm.expectRevert(); // Pausable.EnforcedPause
        nft.mintPublic{value: PRICE}(1);
        vm.stopPrank();
    }

    // ── Whitelist Mint ──

    function test_MintWhitelist_Success() public {
        // Build a simple Merkle tree: root = leaf (single element)
        bytes32 leaf = keccak256(abi.encodePacked(alice));
        bytes32 root = leaf; // Single-element tree
        nft.setMerkleRoot(root);

        bytes32[] memory proof = new bytes32[](0); // Empty proof for single-element tree

        vm.startPrank(alice);
        nft.mintWhitelist(proof, 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(alice), 1);
        vm.stopPrank();
    }

    function test_Revert_MintWhitelist_InvalidProof() public {
        bytes32 leaf = keccak256(abi.encodePacked(alice));
        nft.setMerkleRoot(leaf);

        // Bob tries with alice's proof
        bytes32[] memory proof = new bytes32[](0);
        vm.startPrank(bob);
        vm.expectRevert(CinaNFT.InvalidProof.selector);
        nft.mintWhitelist(proof, 1);
        vm.stopPrank();
    }

    function test_Revert_MintWhitelist_ExceedsMaxPerAddress() public {
        bytes32 leaf = keccak256(abi.encodePacked(alice));
        nft.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);
        vm.startPrank(alice);
        // Mint 3 (max whitelist)
        nft.mintWhitelist(proof, 3);
        // 4th should fail
        vm.expectRevert(CinaNFT.MaxPerAddressExceeded.selector);
        nft.mintWhitelist(proof, 1);
        vm.stopPrank();
    }

    // ── Pausable ──

    function test_PauseUnpause() public {
        nft.pause();
        assertTrue(nft.paused());

        nft.unpause();
        assertFalse(nft.paused());

        // Mint works after unpause
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE}(1);
        assertEq(nft.ownerOf(1), alice);
        vm.stopPrank();
    }

    function test_Revert_Pause_NonOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        nft.pause();
        vm.stopPrank();
    }

    // ── Admin Functions ──

    function test_SetMintPrice() public {
        nft.setMintPrice(0.1 ether);
        assertEq(nft.mintPrice(), 0.1 ether);
    }

    function test_SetBaseURI() public {
        nft.setBaseURI("ipfs://QmTest/");
        // Mint and check tokenURI uses baseURI
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE}(1);
        assertEq(nft.tokenURI(1), "ipfs://QmTest/1");
        vm.stopPrank();
    }

    function test_SetMerkleRoot() public {
        bytes32 root = keccak256("test");
        nft.setMerkleRoot(root);
        assertEq(nft.merkleRoot(), root);
    }

    function test_Revert_SetMintPrice_NonOwner() public {
        vm.startPrank(alice);
        vm.expectRevert();
        nft.setMintPrice(0.1 ether);
        vm.stopPrank();
    }

    // ── Withdraw ──

    function test_Withdraw() public {
        // Alice mints, sending ETH to contract
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE}(1);
        vm.stopPrank();

        uint256 ownerBalBefore = owner.balance;
        uint256 contractBal = address(nft).balance;
        assertEq(contractBal, PRICE);

        nft.withdraw();

        assertEq(address(nft).balance, 0);
        assertEq(owner.balance, ownerBalBefore + PRICE);
    }

    function test_Revert_Withdraw_NonOwner() public {
        vm.startPrank(alice);
        vm.expectRevert();
        nft.withdraw();
        vm.stopPrank();
    }

    // ── Enumerable ──

    function test_TokenOfOwnerByIndex() public {
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE * 5}(5);
        assertEq(nft.tokenOfOwnerByIndex(alice, 0), 1);
        assertEq(nft.tokenOfOwnerByIndex(alice, 1), 2);
        assertEq(nft.tokenOfOwnerByIndex(alice, 4), 5);
        vm.stopPrank();
    }

    // ── On-chain Metadata ──

    function test_TokenURI_OnChain() public {
        vm.startPrank(alice);
        nft.mintPublic{value: PRICE}(1);
        string memory uri = nft.tokenURI(1);
        // Should start with data:application/json;base64,
        assertGt(bytes(uri).length, 50);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
        vm.stopPrank();
    }

    // ── Max Supply ──

    function test_Revert_MaxSupplyExceeded() public {
        // Deploy with tiny max supply
        CinaNFT small = new CinaNFT("Test", "TST", 2, PRICE, owner);
        vm.deal(alice, 100 ether);

        vm.startPrank(alice);
        small.mintPublic{value: PRICE}(2);
        vm.expectRevert(CinaNFT.MaxSupplyExceeded.selector);
        small.mintPublic{value: PRICE}(1);
        vm.stopPrank();
    }

    // ── Helpers ──

    function _startsWith(string memory str, string memory prefix)
        internal
        pure
        returns (bool)
    {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }

    // Allow receiving ETH (for withdraw test)
    receive() external payable {}
}
