// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CinaCredit — ERC-20 credit token for the CinaChain API billing system
/// @notice On-chain asset layer only: top-ups mint, transfers move balance.
///         Consumption is metered server-side (zero gas per API call);
///         on-chain balance is the credit CEILING, not the exact remaining.
contract CinaCredit is ERC20, Ownable, Pausable, ReentrancyGuard {
    /// @notice 1 ETH = N credit (owner-settable; oracle planned for mainnet)
    uint256 public ethToCreditRate;

    /// @notice Treasury that receives ETH from mintWithEth
    address public treasury;

    /// @notice Platform fee in basis points (200 = 2%); 0 disables
    uint256 public platformFeeBps;

    /// @notice Cumulative minted per address (weak tier reference)
    mapping(address => uint256) public totalMintedOf;

    /// @notice Cumulative burned per address (weak tier reference)
    mapping(address => uint256) public totalBurnedOf;

    /// @notice Whether credit redemption is enabled (treasury-funded)
    bool public redeemEnabled;

    event CreditMinted(address indexed to, uint256 amount, uint8 channel);
    event CreditRedeemed(address indexed from, uint256 amount);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event RedeemToggled(bool enabled);

    error ZeroRate();
    error ZeroTreasury();
    error FeeTooHigh();
    error NoEthSent();
    error RedeemDisabled();
    error InsufficientTreasury();

    constructor(
        address _initialOwner,
        uint256 _ethToCreditRate,
        address _treasury,
        uint256 _platformFeeBps
    ) ERC20("CinaCredit", "CINA-C") Ownable(_initialOwner) {
        if (_ethToCreditRate == 0) revert ZeroRate();
        if (_treasury == address(0)) revert ZeroTreasury();
        if (_platformFeeBps > 1000) revert FeeTooHigh(); // max 10%
        ethToCreditRate = _ethToCreditRate;
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    /// @notice Channel 1: user top-up with ETH. Fee is taken in credit terms
    ///         (feeBps of the gross credit is not minted).
    function mintWithEth() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert NoEthSent();
        uint256 gross = msg.value * ethToCreditRate;
        uint256 fee = (gross * platformFeeBps) / 10000;
        uint256 net = gross - fee;

        _mint(msg.sender, net);
        totalMintedOf[msg.sender] += net;

        (bool ok, ) = payable(treasury).call{value: msg.value}("");
        require(ok, "treasury transfer failed");

        emit CreditMinted(msg.sender, net, 1);
    }

    /// @notice Channel 2/3: platform-controlled issuance (key-confirmed
    ///         minting, custodial top-ups, rewards). Minting is a liability
    ///         confirmation — only call after service/credit is verified.
    function mintTo(address to, uint256 amount) external onlyOwner whenNotPaused {
        _mint(to, amount);
        totalMintedOf[to] += amount;
        emit CreditMinted(to, amount, 2);
    }

    /// @notice Redeem credit for ETH at the current rate (treasury-funded).
    function redeem(uint256 creditAmount) external nonReentrant whenNotPaused {
        if (!redeemEnabled) revert RedeemDisabled();
        if (creditAmount == 0) revert NoEthSent();
        uint256 ethOut = creditAmount / ethToCreditRate;
        if (ethOut == 0) revert NoEthSent();
        if (ethOut > address(this).balance) revert InsufficientTreasury();

        _burn(msg.sender, creditAmount);
        totalBurnedOf[msg.sender] += creditAmount;

        (bool ok, ) = payable(msg.sender).call{value: ethOut}("");
        require(ok, "redeem transfer failed");

        emit CreditRedeemed(msg.sender, creditAmount);
    }

    // ── Admin ──
    function setRate(uint256 newRate) external onlyOwner {
        if (newRate == 0) revert ZeroRate();
        emit RateUpdated(ethToCreditRate, newRate);
        ethToCreditRate = newRate;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroTreasury();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert FeeTooHigh();
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function setRedeemEnabled(bool enabled) external onlyOwner {
        redeemEnabled = enabled;
        emit RedeemToggled(enabled);
    }

    /// @dev Prevent accidental renouncement — admin functions are required.
    function renounceOwnership() public override onlyOwner {
        revert("renounce blocked");
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
