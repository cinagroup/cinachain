// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ════════════════════════════════════════════════════════════════════════════
// CinaNFT — ERC-721 NFT Contract for CinaChain DApp
// ════════════════════════════════════════════════════════════════════════════
// Features:
//   • ERC-721 + ERC-721Enumerable (for dashboard token listing)
//   • Pausable (emergency stop)
//   • Ownable (admin access control)
//   • ReentrancyGuard (mint protection)
//   • Public mint (paid) + Whitelist mint (free, Merkle proof)
//   • On-chain metadata (base64 JSON) with optional IPFS baseURI override
//   • Withdraw funds to owner
// ════════════════════════════════════════════════════════════════════════════

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract CinaNFT is
    ERC721Enumerable,
    ERC721URIStorage,
    Pausable,
    Ownable,
    ReentrancyGuard
{
    using Strings for uint256;

    // ─────────────────────────── State ───────────────────────────

    /// @notice Price per NFT for public mint (in wei)
    uint256 public mintPrice;

    /// @notice Maximum total supply of NFTs
    uint256 public immutable maxSupply;

    /// @notice Merkle root for whitelist verification
    bytes32 public merkleRoot;

    /// @notice Base URI for metadata (if set, overrides on-chain generation)
    string private baseTokenURI;

    /// @notice Max NFTs a single address can mint (public)
    uint256 public constant MAX_PER_ADDRESS = 10;

    /// @notice Max NFTs a whitelisted address can mint
    uint256 public constant MAX_WHITELIST_PER_ADDRESS = 3;

    /// @dev Tracking mints per address
    mapping(address => uint256) private _mintedPublic;
    mapping(address => uint256) private _mintedWhitelist;

    // ─────────────────────────── Events ───────────────────────────

    event PublicMint(address indexed minter, uint256 quantity, uint256 totalPrice);
    event WhitelistMint(address indexed minter, uint256 quantity);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event BaseURIUpdated(string newBaseURI);
    event MerkleRootUpdated(bytes32 newRoot);
    event Withdrawn(address indexed to, uint256 amount);

    // ─────────────────────────── Errors ───────────────────────────

    error MintNotStarted();
    error MintPaused();
    error MaxSupplyExceeded();
    error PriceMismatch(uint256 expected, uint256 sent);
    error MaxPerAddressExceeded();
    error InvalidProof();
    error ZeroQuantity();
    error WithdrawFailed();
    error OwnershipRenounceBlocked();

    // ─────────────────────────── Constructor ───────────────────────────

    /// @param _name Token name (e.g. "CinaChain NFT")
    /// @param _symbol Token symbol (e.g. "CINA")
    /// @param _maxSupply Maximum NFT supply (e.g. 10000)
    /// @param _mintPrice Mint price in wei (e.g. 0.05 ETH = 50000000000000000)
    /// @param _initialOwner Owner address (becomes admin)
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _initialOwner
    ) ERC721(_name, _symbol) Ownable(_initialOwner) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
    }

    // ─────────────────────────── Minting ───────────────────────────

    /// @notice Public paid mint
    /// @param quantity Number of NFTs to mint (1-10)
    function mintPublic(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (quantity == 0) revert ZeroQuantity();
        if (_totalMinted() + quantity > maxSupply) revert MaxSupplyExceeded();

        uint256 totalPrice = mintPrice * quantity;
        if (msg.value != totalPrice) revert PriceMismatch(totalPrice, msg.value);

        if (_mintedPublic[msg.sender] + quantity > MAX_PER_ADDRESS) {
            revert MaxPerAddressExceeded();
        }

        _mintedPublic[msg.sender] += quantity;

        uint256 firstId = _totalMinted() + 1;
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(msg.sender, firstId + i);
        }

        emit PublicMint(msg.sender, quantity, totalPrice);
    }

    /// @notice Free whitelist mint with Merkle proof verification
    /// @param proof Merkle proof for msg.sender
    /// @param quantity Number of NFTs to mint (1-3)
    function mintWhitelist(bytes32[] calldata proof, uint256 quantity)
        external
        nonReentrant
        whenNotPaused
    {
        if (quantity == 0) revert ZeroQuantity();
        if (_totalMinted() + quantity > maxSupply) revert MaxSupplyExceeded();

        // Verify Merkle proof: leaf = keccak256(abi.encodePacked(msg.sender))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        if (_mintedWhitelist[msg.sender] + quantity > MAX_WHITELIST_PER_ADDRESS) {
            revert MaxPerAddressExceeded();
        }

        _mintedWhitelist[msg.sender] += quantity;

        uint256 firstId = _totalMinted() + 1;
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(msg.sender, firstId + i);
        }

        emit WhitelistMint(msg.sender, quantity);
    }

    // ─────────────────────────── Views ───────────────────────────

    /// @dev Internal helper — same as totalSupply() but explicit
    function _totalMinted() internal view returns (uint256) {
        return totalSupply();
    }

    /// @notice Public mint count for an address
    function mintedByAddress(address account) external view returns (uint256) {
        return _mintedPublic[account];
    }

    /// @notice Whitelist mint count for an address
    function whitelistMintedByAddress(address account) external view returns (uint256) {
        return _mintedWhitelist[account];
    }

    /// @notice Returns remaining mintable supply
    function remainingSupply() external view returns (uint256) {
        return maxSupply > totalSupply() ? maxSupply - totalSupply() : 0;
    }

    // ─────────────────────────── Metadata ───────────────────────────

    /// @notice Returns token URI — on-chain JSON or IPFS if baseURI set
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        _requireOwned(tokenId);

        // If baseTokenURI is set, use it (IPFS mode)
        bytes memory b = bytes(baseTokenURI);
        if (b.length > 0) {
            return string(abi.encodePacked(baseTokenURI, tokenId.toString()));
        }

        // Otherwise generate on-chain metadata
        return _generateOnChainMetadata(tokenId);
    }

    /// @dev Generates base64-encoded JSON metadata on-chain (with embedded SVG image)
    function _generateOnChainMetadata(uint256 tokenId) internal pure returns (string memory) {
        string memory name = string(abi.encodePacked("CinaChain NFT #", tokenId.toString()));
        string memory description = "CinaChain NFT - a collectible on the Base network.";
        string memory image = _generateSvgImage(tokenId);

        string memory json = string(
            abi.encodePacked(
                '{"name":"', name, '",',
                '"description":"', description, '",',
                '"image":"', image, '",',
                '"attributes":[',
                    '{"trait_type":"Collection","value":"CinaChain"},',
                    '{"trait_type":"Token ID","value":', tokenId.toString(), '}',
                ']'
                '}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /// @dev Deterministic SVG artwork as a data URI. Single-quoted XML attributes
    ///      keep the SVG free of double quotes, so it embeds in JSON unescaped.
    ///      Hue varies with tokenId so every NFT is visually distinct.
    ///      Built in two parts to keep stack depth safe for legacy codegen.
    function _generateSvgImage(uint256 tokenId) internal pure returns (string memory) {
        uint256 hue = (tokenId * 47 + 13) % 360;
        uint256 hue2 = (hue + 40) % 360;

        string memory part1 = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'>",
                "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>",
                "<stop offset='0%' stop-color='hsl(",
                hue.toString(),
                ",70%,24%)'/>",
                "<stop offset='100%' stop-color='hsl(",
                hue2.toString(),
                ",65%,44%)'/>",
                "</linearGradient></defs>",
                "<rect width='800' height='800' fill='url(#g)'/>"
            )
        );

        string memory part2 = string(
            abi.encodePacked(
                "<circle cx='660' cy='120' r='230' fill='rgba(255,255,255,0.07)'/>",
                "<circle cx='90' cy='720' r='170' fill='rgba(0,0,0,0.15)'/>",
                "<text x='60' y='440' font-family='monospace' font-size='104' font-weight='700' fill='rgba(255,255,255,0.95)'>CinaChain</text>",
                "<text x='60' y='540' font-family='monospace' font-size='72' font-weight='600' fill='rgba(255,255,255,0.85)'>#",
                tokenId.toString(),
                "</text>",
                "<text x='60' y='726' font-family='monospace' font-size='28' fill='rgba(255,255,255,0.55)'>Built on Base</text>",
                "</svg>"
            )
        );

        string memory svg = string(abi.encodePacked(part1, part2));
        return string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg)))
        );
    }

    // ─────────────────────────── Admin ───────────────────────────

    /// @notice Pause all minting (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume minting
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Update mint price (in wei)
    function setMintPrice(uint256 newPrice) external onlyOwner {
        emit PriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    /// @notice Set base URI for IPFS metadata (pass empty string to revert to on-chain)
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Update Merkle root for whitelist
    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /// @notice Withdraw all ETH balance to owner
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();

        emit Withdrawn(owner(), balance);
    }

    /// @dev Prevent accidental renouncement — ownership is required to withdraw
    ///      collected mint funds. Once renounced, the funds would be stuck forever.
    function renounceOwnership() public override onlyOwner {
        revert OwnershipRenounceBlocked();
    }

    // ─────────────────────────── Overrides ───────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
}
