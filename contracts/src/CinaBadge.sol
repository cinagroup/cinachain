// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ════════════════════════════════════════════════════════════════════════════
// CinaBadge — ERC-1155 Auxiliary Token Contract for CinaChain
// ════════════════════════════════════════════════════════════════════════════
// Purpose: Semi-fungible badges, achievements, tickets, and membership tiers
// that complement the main ERC-721 CinaNFT collection.
//
// Token IDs (by convention):
//   1 = Early Minter Badge     (awarded to first 1000 minters)
//   2 = Whitelist Badge        (awarded to whitelist participants)
//   3 = Diamond Holder Badge   (awarded to holders of 5+ NFTs)
//   4 = Event Ticket           (minted for special events)
//   5 = VIP Membership         (transferable membership tiers)
//   6+ = Custom badges (owner can create new types)
//
// Features:
//   • ERC-1155 with URI metadata (IPFS template)
//   • Owner-only minting (single + batch)
//   • Non-transferable badges (soulbound option per token type)
//   • Event-based emission tracking
//   • Pausable for emergencies
// ════════════════════════════════════════════════════════════════════════════

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract CinaBadge is ERC1155, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // ─────────────────────────── State ───────────────────────────

    /// @notice Base URI for metadata (IPFS template with {id} substitution)
    /// e.g. "ipfs://QmBadges/{id}.json"
    string private baseMetadataURI;

    /// @notice Token type information
    struct BadgeType {
        string name;
        string description;
        bool soulbound; // if true, cannot be transferred after minting
        uint256 maxSupply; // 0 = unlimited
        uint256 totalMinted;
        bool exists;
    }

    /// @dev token ID => BadgeType metadata
    mapping(uint256 => BadgeType) private _badgeTypes;

    /// @dev token ID => owner => whether they hold (for soulbound tracking)
    mapping(uint256 => mapping(address => bool)) private _soulboundHolders;

    /// @dev Next available custom badge ID (starts at 100 for custom)
    uint256 public nextCustomBadgeId = 100;

    // ─────────────────────────── Events ───────────────────────────

    event BadgeTypeCreated(uint256 indexed tokenId, string name, bool soulbound, uint256 maxSupply);
    event BadgeMinted(uint256 indexed tokenId, address indexed to, uint256 amount);
    event BadgeBatchMinted(address indexed to, uint256[] tokenIds, uint256[] amounts);

    // ─────────────────────────── Errors ───────────────────────────

    error BadgeTypeNotFound();
    error MaxSupplyReached();
    error SoulboundTransferBlocked();
    error ZeroAmount();
    error ZeroAddress();
    error OwnershipRenounceBlocked();

    // ─────────────────────────── Constructor ───────────────────────────

    /// @param _uri Base metadata URI (e.g. "ipfs://QmBadges/{id}.json")
    /// @param _initialOwner Owner address (admin)
    constructor(
        string memory _uri,
        address _initialOwner
    ) ERC1155(_uri) Ownable(_initialOwner) {
        baseMetadataURI = _uri;

        // Pre-define standard badge types
        _createBadgeType(1, "Early Minter", "Awarded to the first 1000 CinaChain minters", true, 1000);
        _createBadgeType(2, "Whitelist Member", "Verified whitelist participant", true, 0);
        _createBadgeType(3, "Diamond Holder", "Holds 5 or more CinaChain NFTs", true, 0);
        _createBadgeType(4, "Event Ticket", "Special event access pass", false, 0);
        _createBadgeType(5, "VIP Member", "Transferable VIP membership", false, 500);
    }

    // ─────────────────────────── Minting ───────────────────────────

    /// @notice Mint a single badge to one address
    /// @param to Recipient address
    /// @param tokenId Badge type ID
    /// @param amount Quantity to mint
    function mint(address to, uint256 tokenId, uint256 amount) external onlyOwner whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!_badgeTypes[tokenId].exists) revert BadgeTypeNotFound();

        BadgeType storage badge = _badgeTypes[tokenId];
        if (badge.maxSupply > 0 && badge.totalMinted + amount > badge.maxSupply) {
            revert MaxSupplyReached();
        }

        badge.totalMinted += amount;
        if (badge.soulbound) {
            _soulboundHolders[tokenId][to] = true;
        }

        _mint(to, tokenId, amount, "");

        emit BadgeMinted(tokenId, to, amount);
    }

    /// @notice Mint a badge to multiple addresses (airdrop)
    /// @param recipients Array of addresses
    /// @param tokenId Badge type ID
    /// @param amountPerUser Quantity per recipient
    function mintBatch(
        address[] calldata recipients,
        uint256 tokenId,
        uint256 amountPerUser
    ) external onlyOwner whenNotPaused nonReentrant {
        if (amountPerUser == 0) revert ZeroAmount();
        if (!_badgeTypes[tokenId].exists) revert BadgeTypeNotFound();

        BadgeType storage badge = _badgeTypes[tokenId];
        uint256 totalToMint = recipients.length * amountPerUser;
        if (badge.maxSupply > 0 && badge.totalMinted + totalToMint > badge.maxSupply) {
            revert MaxSupplyReached();
        }
        badge.totalMinted += totalToMint;

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (badge.soulbound) {
                _soulboundHolders[tokenId][recipients[i]] = true;
            }
            _mint(recipients[i], tokenId, amountPerUser, "");
        }

        emit BadgeMinted(tokenId, address(0), totalToMint);
    }

    /// @notice Mint multiple badge types to one address (batch mint)
    /// @param to Recipient address
    /// @param tokenIds Array of badge type IDs
    /// @param amounts Array of quantities (parallel to tokenIds)
    function mintToAddress(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyOwner whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        require(tokenIds.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!_badgeTypes[tokenIds[i]].exists) revert BadgeTypeNotFound();
            if (amounts[i] == 0) revert ZeroAmount();

            BadgeType storage badge = _badgeTypes[tokenIds[i]];
            if (badge.maxSupply > 0 && badge.totalMinted + amounts[i] > badge.maxSupply) {
                revert MaxSupplyReached();
            }
            badge.totalMinted += amounts[i];
            if (badge.soulbound) {
                _soulboundHolders[tokenIds[i]][to] = true;
            }
        }

        _mintBatch(to, tokenIds, amounts, "");

        emit BadgeBatchMinted(to, tokenIds, amounts);
    }

    // ─────────────────────────── Soulbound Enforcement ───────────────────────────

    /// @dev Override safeTransferFrom to block soulbound badge transfers and
    ///      respect the emergency pause (transfer of any badge is paused)
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override whenNotPaused {
        if (_badgeTypes[id].soulbound && _soulboundHolders[id][from]) {
            revert SoulboundTransferBlocked();
        }
        super.safeTransferFrom(from, to, id, amount, data);
    }

    /// @dev Override safeBatchTransferFrom to block soulbound badge transfers and
    ///      respect the emergency pause
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override whenNotPaused {
        for (uint256 i = 0; i < ids.length; i++) {
            if (_badgeTypes[ids[i]].soulbound && _soulboundHolders[ids[i]][from]) {
                revert SoulboundTransferBlocked();
            }
        }
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    // ─────────────────────────── Views ───────────────────────────

    /// @notice Returns metadata URI for a token ID (ERC-1155 standard)
    /// @dev Handles "{id}" placeholder substitution per EIP-1155 (64-char
    ///      zero-padded lowercase hex). Without a placeholder, appends
    ///      "{id}.json". Unknown badge types return "" per the spec.
    function uri(uint256 tokenId) public view override returns (string memory) {
        if (!_badgeTypes[tokenId].exists) return "";

        bytes memory base = bytes(baseMetadataURI);
        if (base.length == 0) return "";

        uint256 ph = _findPlaceholder(base);
        if (ph != type(uint256).max) {
            return _replacePlaceholder(base, ph, _toPaddedHex(tokenId));
        }
        return _appendId(base, _toHex(tokenId));
    }

    /// @dev Locate "{id}" in the base URI (returns type(uint256).max if absent)
    function _findPlaceholder(bytes memory base) internal pure returns (uint256) {
        for (uint256 i = 0; i + 3 < base.length; i++) {
            if (
                base[i] == 0x7B && // {
                base[i + 1] == 0x69 && // i
                base[i + 2] == 0x64 && // d
                base[i + 3] == 0x7D // }
            ) {
                return i;
            }
        }
        return type(uint256).max;
    }

    /// @dev EIP-1155 id encoding: 64-char zero-padded lowercase hex (no 0x)
    function _toPaddedHex(uint256 value) internal pure returns (bytes memory) {
        bytes memory raw = bytes(_toHex(value));
        bytes memory padded = new bytes(64);
        for (uint256 i = 0; i < 64; i++) padded[i] = "0";
        uint256 offset = 64 - raw.length;
        for (uint256 i = 0; i < raw.length; i++) padded[offset + i] = raw[i];
        return padded;
    }

    /// @dev Replace the "{id}" placeholder with the encoded id
    function _replacePlaceholder(
        bytes memory base,
        uint256 ph,
        bytes memory id
    ) internal pure returns (string memory) {
        bytes memory result = new bytes(base.length - 4 + id.length);
        uint256 j = 0;
        for (uint256 i = 0; i < ph; i++) result[j++] = base[i];
        for (uint256 i = 0; i < id.length; i++) result[j++] = id[i];
        for (uint256 i = ph + 4; i < base.length; i++) result[j++] = base[i];
        return string(result);
    }

    /// @dev Append "{id}.json" to the base URI (no placeholder case)
    function _appendId(
        bytes memory base,
        string memory rawHex
    ) internal pure returns (string memory) {
        bytes memory suffix = abi.encodePacked(rawHex, ".json");
        bool endsWithSlash = base[base.length - 1] == "/";
        bytes memory result = new bytes(base.length + (endsWithSlash ? 0 : 1) + suffix.length);
        uint256 j = 0;
        for (uint256 i = 0; i < base.length; i++) result[j++] = base[i];
        if (!endsWithSlash) result[j++] = "/";
        for (uint256 i = 0; i < suffix.length; i++) result[j++] = suffix[i];
        return string(result);
    }

    /// @dev Lowercase hex string without 0x prefix
    function _toHex(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bytes memory digits = "0123456789abcdef";
        uint256 len = 0;
        uint256 tmp = value;
        while (tmp > 0) {
            len++;
            tmp >>= 4;
        }
        bytes memory out = new bytes(len);
        for (uint256 i = len; i > 0; i--) {
            out[i - 1] = digits[value & 0xf];
            value >>= 4;
        }
        return string(out);
    }

    /// @notice Get badge type information
    function getBadgeType(uint256 tokenId) external view returns (BadgeType memory) {
        return _badgeTypes[tokenId];
    }

    /// @notice Check if an address holds a specific badge
    function hasBadge(address account, uint256 tokenId) external view returns (bool) {
        return balanceOf(account, tokenId) > 0;
    }

    /// @notice Get all standard badge IDs (1-5)
    function getStandardBadgeIds() external pure returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](5);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;
        ids[3] = 4;
        ids[4] = 5;
        return ids;
    }

    /// @notice Total distinct badge types created
    function badgeTypeCount() external view returns (uint256) {
        return nextCustomBadgeId - 100 + 5; // 5 standard + custom
    }

    // ─────────────────────────── Admin ───────────────────────────

    /// @notice Create a new custom badge type
    function createBadgeType(
        string calldata name,
        string calldata description,
        bool soulbound,
        uint256 maxSupply
    ) external onlyOwner returns (uint256) {
        uint256 newId = nextCustomBadgeId++;
        _createBadgeType(newId, name, description, soulbound, maxSupply);
        return newId;
    }

    /// @notice Update metadata base URI
    function setURI(string calldata newURI) external onlyOwner {
        _setURI(newURI);
        baseMetadataURI = newURI;
    }

    /// @notice Pause all transfers/mints
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Prevent accidental renouncement — ownership controls badge types
    ///      and minting; renouncing would lock the system permanently.
    function renounceOwnership() public override onlyOwner {
        revert OwnershipRenounceBlocked();
    }

    // ─────────────────────────── Internal ───────────────────────────

    function _createBadgeType(
        uint256 tokenId,
        string memory name,
        string memory description,
        bool soulbound,
        uint256 maxSupply
    ) internal {
        _badgeTypes[tokenId] = BadgeType({
            name: name,
            description: description,
            soulbound: soulbound,
            maxSupply: maxSupply,
            totalMinted: 0,
            exists: true
        });
        emit BadgeTypeCreated(tokenId, name, soulbound, maxSupply);
    }
}
