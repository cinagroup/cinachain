# ERC1155 CinaChain Integration

This CinaChain integration provides a suite of hooks and components to facilitate interaction with ERC1155 contracts. In consideration of the numerous extensions and features offered by ERC1155, this integration is based on a contract from [solidstate](https://github.com/solidstate-network/solidstate-solidity), incorporating the following features and access controls:

**Features:**

- Mintable
- Enumerable
- ERC1155BaseStorage
- Single Approve

**Access Control:**

- Ownable

## ABI and Bytecode

Within the `artifacts` directory, you will find the `erc1155-abi.ts` file, containing the ABI from the contract that was used to generate the [Wagmi CLI](https://wagmi.sh/cli/getting-started) contract hooks. The `erc1155-bytecode.ts` file contains the bytecode used for contract deployment. If you wish to use a different ERC1155 contract with distinct features/extensions, simply update the ABI and bytecode, and then regenerate the Wagmi CLI hooks using the command `pnpm wagmi generate`.

## Hooks:

- `useErc1155TokenStorage`: Utilizes Jotai and local storage to persist the deployed token's address within the browser's local storage. It updates the value across all components observing it whenever a new deployment occurs.
- `useERC1155Metadata`: Accepts contract and token information (contract address, chainId, tokenId, and ipfsGatewayUrl) and returns a query object from `tanstack-query` with the token metadata information. The hook and the components adhere to the "ERC1155 Metadata JSON Schema" convention for metadata formatting. Learn more [here](https://eips.ethereum.org/EIPS/eip-1155).

## Components:

This integration includes read and write/deploy components. The read components solely access the contract information and retrieve the response, whereas the write/deploy components are capable of deploying the contract and performing write actions, requiring a signer and a transaction to be submitted.

**Read Components:**

- `ERC1155Name`: Returns the contract's name.
- `ERC1155Symbol`: Returns the contract's symbol.
- `ERC1155TotalSupply`: Returns the total supply of the contract.
- `ERC1155OwnerOf`: Returns the owners of a specific token.
- `ERC1155TokenUriName`: Returns the name of a specific token.
- `ERC1155TokenUriDescription`: Returns the description of a specific token.
- `ERC1155TokenUriImage`: Returns the image of a specific token.
- `Erc1155Read`: Returns a card with aggregate information about the contract and a selected token ID.

**Write/Deploy Components:**

- `ERC1155Deploy`: Form for contract deployment. Upon deployment, the contract address is saved in local storage under the key `erc1155-token`.
- `ERC1155DeployTest`: Form for test contract deployment. Upon deployment, the contract address is saved in local storage under the key `erc1155-token`.
- `Erc1155WriteMint`: Form for minting new NFTs. Only the contract owner can mint new NFTs.
- `Erc1155WriteApprove`: Form for approving an address's permission to transfer a token on behalf of the token holder. Only the token holder can perform the approved transaction.
- `Erc1155WriteTransfer`: Form for transferring a token to a different address. Only a token owner or approved address can transfer.

File Structure

```
integrations/erc1155
├─ artifacts/
|  ├─ core/
│  |  ├─ erc1155-abi.ts
│  |  ├─ erc1155-bytecode.ts
|  ├─ test/
│  |  ├─ erc1155-abi.ts
│  |  ├─ erc1155-bytecode.ts
├─ components/
│  ├─ erc1155-deploy.tsx
│  ├─ erc1155-name.tsx
│  ├─ erc1155-owner-of.tsx
│  ├─ erc1155-read.tsx
│  ├─ erc1155-set-token-storage.tsx
│  ├─ erc1155-symbol.tsx
│  ├─ erc1155-token-uri-description.tsx
│  ├─ erc1155-token-uri-image.tsx
│  ├─ erc1155-token-uri-name.tsx
│  ├─ erc1155-token-uri.tsx
│  ├─ erc1155-contract-uri.tsx
│  ├─ erc1155-total-supply.tsx
│  ├─ erc1155-write-approve.tsx
│  ├─ erc1155-write-mint.tsx
│  ├─ erc1155-write-transfer.tsx
│  ├─ erc1155-write-batch-transfer.tsx
├─ generated/
│  ├─ erc1155-wagmi.ts
├─ hooks/
│  ├─ use-erc1155-metadata.ts
│  ├─ use-erc1155-token-storage.ts
├─ utils/
│  ├─ types.ts
├─ index.ts
├─ wagmi.config.ts
├─ README.md
```
