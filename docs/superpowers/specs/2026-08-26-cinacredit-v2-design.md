# CinaCredit V2 设计稿 — 主网发行版结算凭证

日期：2026-08-26 · 状态：待评审 · 前置：第一步（地址统一）、第二步（单 token 循环经济语义）已完成

## 1. 背景与动机

现行 CinaCredit（V1，测试网 `0x03a5637a…`，OZ 5.6.0）为 cinachain 自充值场景设计，
携带与结算凭证角色无关的攻击面与单点：

| 问题 | V1 现状 | V2 目标 |
|---|---|---|
| 权限单点 | `Ownable` 单 owner 管一切（chain-worker 持 owner 私钥，泄露=无限增发） | `AccessControl` 三角色：`MINTER_ROLE`（热钱包）/ `PAUSER_ROLE` / `DEFAULT_ADMIN_ROLE`（冷多签） |
| 多余攻击面 | `mintWithEth`/`redeem` 的 rate/treasury/fee 治理、ETH 价格锚 | 全部剥离——定价与兑换留链下，需要时独立合约 |
| 授权体验 | 标准 approve 两笔交易 | `ERC20Permit`（EIP-2612）单签名授权，为未来「billing 拉款扣费」铺路 |
| 升级性 | 不可升级 | 维持不可升级；额度型凭证可从内部账本重放迁移，V2 重发成本低 |
| 应急 | `Pausable` + 阻断 renounce | 保留，暂停权归 `PAUSER_ROLE` |

语义遵循第二步决策：**单 token 循环经济**——V2 同时承担 cinachain 预付计量上限与
ciantoken 提现收益结算，链上完全可互换。

## 2. 角色与信任模型

```
DEFAULT_ADMIN_ROLE（冷钱包：Safe 多签，建议 2/3）
    ├── 授予/撤销 MINTER_ROLE、PAUSER_ROLE
    └── 兜底持有 MINTER_ROLE（热钱包失窃时可撤销并换钥匙）
MINTER_ROLE（chain-worker 专属热钱包 + 多签兜底）
    └── mintTo(address to, uint256 amount)
PAUSER_ROLE（多签或独立应急钱包）
    └── pause() / unpause()
```

- 铸造幂等由 ciantoken chain-worker 的签名交易 outbox 保证（现状不变）
- 每日铸造量告警在链下（复用 Alchemy 用量告警 + billing worker 观测），不设链上硬顶
  （收益理论上无上限，硬顶数字无法合理确定）

## 3. 接口兼容性（两个集成方零改动，仅换地址）

| 集成方 | 依赖 | V2 保证 |
|---|---|---|
| ciantoken chain-worker | `mintTo(address,uint256)`（`packages/chain-worker/src/cinachain.ts`） | 签名原样保留（权限从 `onlyOwner` 改 `onlyRole(MINTER_ROLE)`，调用方无感知） |
| cinachain billing worker | ERC-20 `Transfer` 事件 + `balanceOf`（`workers/billing/src/index.js`、`lib/indexer-run.js`） | ERC-20 标准自动满足 |

前端手写 ABI（`lib/contracts/cina-credit.ts`）中 `mintWithEth`/`redeem`/`setRate` 等
入口在 V2 上线时同步移除（独立小 PR）。

## 4. 合约草案

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract CinaCreditV2 is ERC20, ERC20Permit, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    event Minted(address indexed to, uint256 amount, address indexed operator);

    error ZeroAmount();
    error ZeroAddress();

    constructor(address defaultAdmin, address minter, address pauser)
        ERC20("CinaCredit", "CINA-C")
        ERC20Permit("CinaCredit")
    {
        if (defaultAdmin == address(0) || minter == address(0) || pauser == address(0))
            revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin); // 冷多签
        _grantRole(MINTER_ROLE, defaultAdmin);        // 多签兜底
        _grantRole(MINTER_ROLE, minter);              // chain-worker 热钱包
        _grantRole(PAUSER_ROLE, pauser);
    }

    /// @notice 结算铸造（chain-worker 提现流）。签名与 V1 一致。
    function mintTo(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit Minted(to, amount, msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ERC20Burnable 已提供自毁 burn/burnFrom（仅持有人/被授权方，无增发风险）

    // 转账暂停保护（应急止损）
    function _update(address from, address to, uint256 value)
        internal override whenNotPaused
    {
        super._update(from, to, value);
    }
}
```

要点：

- **无 ETH 锚定**：无 `mintWithEth`/`redeem`/`rate`/`treasury`/`platformFeeBps`。cinachain
  充值改为运营方多签 `mintTo` 后按账本入账（或未来的独立兑换合约），不影响计量语义
  （billing worker 只看 `balanceOf` 与 `Transfer`）。
- **`_update` 暂停覆盖**：OZ v5 的 `_update` 钩子统一拦截 transfer/mint/burn，配合
  `PAUSER_ROLE` 实现密钥事故止损。
- **构造参数**：`(defaultAdmin, minter, pauser)` 三地址——部署集成需同步
  `deploy-all.mjs`/`verify-contracts.mjs` 的构造参数表。
- **ERC20Burnable**：仅自毁语义，为未来「销毁兑换」类流程预留，无权限风险。

## 5. 测试计划（forge，风格对齐 `CinaCredit.t.sol`）

- 构造：三地址零值 revert；角色授予断言（admin/minter/pauser）
- mintTo：minter 成功 + 事件；非 minter revert（`AccessControlUnauthorizedAccount`）；
  零地址/零额 revert；暂停时 revert
- Permit：签名授权 + permitTransfer 流（`vm.sign` 构造 EIP-712 域）
- burn/burnFrom：持有人自毁、授权销毁、额度校验
- pause：PAUSER 角色外 revert；暂停时 transfer/burn/mint 全部阻断、unpause 恢复
- 转账/授权标准 ERC-20 行为（金额、事件、余额）

## 6. 部署与迁移计划

1. **前置**：创建 Safe 多签（Base，建议 2/3：提现人 + 部署钱包 + 备份）；为 chain-worker
   设立独立 minter 热钱包（仅持 `MINTER_ROLE`，低额燃料）
2. **测试网先行**：部署 V2 到 Base Sepolia（复用 deploy-contracts 模式新增
   `deploy-credit-v2` 任务 + verify）→ billing worker / chain-worker / 前端切地址回归
   → 循环经济全流程演练（充值→计量消耗→提现铸造→permit 授权）
3. **主网发行**：同一合约集部署 Base 主网（foundry.toml 已有 base profile），
   Basescan 验证，地址进 `.env.production` 与各集成方
4. **V1 退役**：测试网 V1 停用即可（不可升级、无锁仓）；若主网阶段存在 V1 余额迁移
   需求，从 billing worker 账本重放（快照 → 多签 `mintTo` 批量），不依赖 V1 状态
5. **上线后**：铸造量基线与告警（Alchemy 用量 + billing 观察）、角色变更走多签留痕

## 7. 开放问题（实现前需确认）

- [ ] Safe 多签的签署人名单与阈值
- [ ] minter 热钱包的燃料补给策略（当前部署钱包余额管理方式）
- [ ] cinachain 充值入口在 V2 下的产品形态（多签手工 mintTo / 独立兑换合约 / 暂时下线）
- [ ] 前端 `cina-credit.ts` ABI 精简的时机（与 V2 测试网切换同 PR 或分批）
