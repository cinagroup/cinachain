// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CinaCreditV2 — settlement token for the cina circular economy
/// @notice One token, dual role (docs/superpowers/specs/2026-08-26-cinacredit-v2-design.md):
///         the on-chain balance is the metering ceiling for cinachain API billing AND the
///         settlement vehicle for cinatoken marketplace withdrawals — fully fungible.
///         mintTo(address,uint256) keeps the V1 signature so the ciantoken chain-worker
///         swaps the address and nothing else; the billing worker consumes only the
///         standard Transfer event and balanceOf.
/// @dev No ETH anchoring (no mintWithEth/redeem/rate/treasury) — pricing stays off-chain.
///      Non-upgradeable by design: balance migration replays the internal ledgers.
contract CinaCreditV2 is ERC20, ERC20Permit, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    event Minted(address indexed to, uint256 amount, address indexed operator);

    error ZeroAmount();
    error ZeroAddress();

    /// @param defaultAdmin cold multisig — grants/revokes roles and holds a backup MINTER_ROLE
    /// @param minter       chain-worker hot wallet — the operational settlement minter
    /// @param pauser       emergency wallet — pause/unpause for key-incident containment
    constructor(address defaultAdmin, address minter, address pauser)
        ERC20("CinaCredit", "CINA-C")
        ERC20Permit("CinaCredit")
    {
        if (defaultAdmin == address(0) || minter == address(0) || pauser == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
    }

    /// @notice Settlement mint (ciantoken withdrawal outbox → on-chain earnings).
    ///         Idempotency is guaranteed by the caller's signed-tx outbox.
    function mintTo(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit Minted(to, amount, msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev Pausable covers transfers, mints and burns uniformly in OZ v5 —
    ///      key-incident containment stops every value movement at once.
    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
