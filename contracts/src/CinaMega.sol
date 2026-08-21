// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ════════════════════════════════════════════════════════════════════════════
// CinaMega — ERC-1155 Mega-Collection + Fixed-Rate Exchange for CinaChain
// ════════════════════════════════════════════════════════════════════════════
// Purpose: Three template-based mega-collections with billions of possible
// copies each, plus a fixed bidirectional exchange between them.
//
// Token types (by convention):
//   1 = ucina  (base unit — 1 ucina = 1 unit)
//   2 = mcina  (1 mcina = 1,000 units)
//   3 = cina   (1 cina = 1,000,000 units)
//
// Exchange rate (fixed, enforced by unit math):
//   1 cina = 1,000 mcina = 1,000,000 ucina
//
// Economy:
//   • ucina is the entry point — anyone can mint it for free (per-address
//     cap, anti-sybil).
//   • mcina and cina are obtained ONLY by exchanging up from ucina
//     (burn from-type → mint to-type atomically). Floor division burns
//     the dust on the source side, so no value is created or destroyed.
//
// Storage (Attachment-2 architecture):
//   • Each token type carries an immutable IPFS CID (lightweight uri())
//     AND the raw SVG bytes on-chain as the ultimate disaster fallback.
//   • After initialization the template setter locks forever — metadata
//     trust base cannot be tampered with.
// ════════════════════════════════════════════════════════════════════════════

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CinaMega is ERC1155, Ownable, Pausable, ReentrancyGuard {
    // ─────────────────────────── Constants ───────────────────────────

    uint256 public constant UCINA = 1;
    uint256 public constant MCINA = 2;
    uint256 public constant CINA = 3;

    /// @dev Value of one token of each type in base units (ucina = 1).
    /// 1 cina = 1,000,000 units = 1,000 mcina = 1,000,000 ucina.
    uint256 public constant UCINA_UNITS = 1;
    uint256 public constant MCINA_UNITS = 1_000;
    uint256 public constant CINA_UNITS = 1_000_000;

    // ─────────────────────────── State ───────────────────────────

    /// @dev tokenType => raw SVG bytes stored on-chain (disaster fallback).
    mapping(uint256 => bytes) public typeRawSvg;

    /// @dev tokenType => immutable IPFS CID (uri() returns ipfs://<cid>/metadata.json).
    mapping(uint256 => string) public typeCid;

    /// @dev Per-address mint cap for the free ucina public mint (anti-sybil).
    uint256 public mintCapPerAddress;

    /// @dev address => ucina minted via mintUcina.
    mapping(address => uint256) public ucinaMinted;

    /// @dev Once true, initTemplate is permanently disabled.
    bool public svgLocked;

    // ─────────────────────────── Events ───────────────────────────

    event TemplateInitialized(uint256 indexed tokenType, string cid);
    event TemplatesLocked();
    event MintCapUpdated(uint256 cap);
    event Exchanged(
        address indexed account,
        uint256 indexed fromType,
        uint256 indexed toType,
        uint256 amount,
        uint256 toAmount
    );

    // ─────────────────────────── Errors ───────────────────────────

    error InvalidTokenType();
    error SameTokenType();
    error ZeroAmount();
    error ZeroAddress();
    error MintCapExceeded();
    error TemplatesLockedError();
    error ExchangeTooSmall();
    error OwnershipRenounceBlocked();

    // ─────────────────────────── Constructor ───────────────────────────

    /// @param _initialOwner Owner address (admin).
    /// @param _mintCapPerAddress Initial per-address ucina mint cap.
    constructor(address _initialOwner, uint256 _mintCapPerAddress)
        ERC1155("")
        Ownable(_initialOwner)
    {
        if (_initialOwner == address(0)) revert ZeroAddress();
        if (_mintCapPerAddress == 0) revert ZeroAmount();
        mintCapPerAddress = _mintCapPerAddress;
    }

    // ─────────────────────────── Views ───────────────────────────

    /// @dev Unit value of one token of the given type (in ucina base units).
    function typeUnits(uint256 tokenType) public pure returns (uint256) {
        if (tokenType == UCINA) return UCINA_UNITS;
        if (tokenType == MCINA) return MCINA_UNITS;
        if (tokenType == CINA) return CINA_UNITS;
        revert InvalidTokenType();
    }

    /// @dev Standard EIP-1155 metadata URI — lightweight, returns only the
    /// IPFS link. Third-party wallets/marketplaces never touch the heavy
    /// on-chain SVG bytes.
    function uri(uint256 tokenType) public view override returns (string memory) {
        string memory cid = typeCid[tokenType];
        if (bytes(cid).length == 0) return "";
        return string.concat("ipfs://", cid, "/metadata.json");
    }

    /// @dev Disaster-only fallback: raw SVG bytes for the worker gateway.
    /// Not called by wallets/marketplaces; the gateway base64-encodes
    /// off-chain.
    function getBackupSvgRaw(uint256 tokenType) external view returns (bytes memory) {
        return typeRawSvg[tokenType];
    }

    // ─────────────────────────── Admin ───────────────────────────

    /// @dev Writes one template (SVG bytes + immutable CID). Can be called
    /// multiple times until lockTemplates(); then disabled forever.
    function initTemplate(uint256 tokenType, bytes calldata rawSvg, string calldata cid)
        external
        onlyOwner
    {
        if (svgLocked) revert TemplatesLockedError();
        typeUnits(tokenType); // validate type
        if (rawSvg.length == 0) revert ZeroAmount();
        if (bytes(cid).length == 0) revert ZeroAmount();
        typeRawSvg[tokenType] = rawSvg;
        typeCid[tokenType] = cid;
        emit TemplateInitialized(tokenType, cid);
    }

    /// @dev Permanently locks template initialization. Call only after ALL
    /// token types have been written — the contract must not ship with a
    /// partially-backed collection (Attachment-2 hard requirement).
    function lockTemplates() external onlyOwner {
        if (svgLocked) revert TemplatesLockedError();
        if (typeRawSvg[UCINA].length == 0) revert ZeroAmount();
        if (typeRawSvg[MCINA].length == 0) revert ZeroAmount();
        if (typeRawSvg[CINA].length == 0) revert ZeroAmount();
        svgLocked = true;
        emit TemplatesLocked();
    }

    function setMintCap(uint256 _mintCapPerAddress) external onlyOwner {
        if (_mintCapPerAddress == 0) revert ZeroAmount();
        mintCapPerAddress = _mintCapPerAddress;
        emit MintCapUpdated(_mintCapPerAddress);
    }

    // ─────────────────────────── Public Mint ───────────────────────────

    /// @dev Free public mint of the base unit (ucina), capped per address.
    function mintUcina(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 total = ucinaMinted[msg.sender] + amount;
        if (total > mintCapPerAddress) revert MintCapExceeded();
        ucinaMinted[msg.sender] = total;
        _mint(msg.sender, UCINA, amount, "");
    }

    // ─────────────────────────── Exchange ───────────────────────────

    /// @dev Bidirectional fixed-rate exchange: burn `amount` of fromType,
    /// mint the equivalent of toType. Floor division — the dust is burned
    /// on the source side (no value created or destroyed).
    ///
    ///   toAmount = amount * typeUnits(from) / typeUnits(to)
    ///
    /// Examples:
    ///   1 cina      → 1,000 mcina
    ///   1 cina      → 1,000,000 ucina
    ///   1,000,000 ucina → 1 cina
    ///   1,500 mcina → 1 cina (dust 500,000 units burned)
    function exchange(uint256 fromType, uint256 toType, uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        if (fromType == toType) revert SameTokenType();
        if (amount == 0) revert ZeroAmount();
        uint256 fromUnits = typeUnits(fromType);
        uint256 toUnits = typeUnits(toType);

        uint256 toAmount = (amount * fromUnits) / toUnits;
        // Never burn user assets without minting something in return.
        if (toAmount == 0) revert ExchangeTooSmall();

        _burn(msg.sender, fromType, amount);
        _mint(msg.sender, toType, toAmount, "");
        emit Exchanged(msg.sender, fromType, toType, amount, toAmount);
    }

    // ─────────────────────────── Transfers ───────────────────────────

    /// @dev ERC-1155 transfers follow the standard (pausable for emergencies).
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override whenNotPaused {
        super._update(from, to, ids, values);
    }

    // ─────────────────────────── Emergency pause ───────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────── Ownership guard ───────────────────────────

    function renounceOwnership() public override onlyOwner {
        revert OwnershipRenounceBlocked();
    }
}
