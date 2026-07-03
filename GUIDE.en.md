# Merkel Airdrop Development and Deployment Guide

This guide reflects the current project after the large refactor. Merkel Airdrop is now an ERC20 MRKL token airdrop system with Solidity contracts, Hardhat tests/deployment scripts, a React + Vite claim portal, default Sepolia configuration, and an embedded bilingual guide page in the frontend.

## Table of contents

1. [Project modules](#1-project-modules)
2. [End-to-end architecture](#2-end-to-end-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Smart contracts](#4-smart-contracts)
5. [Merkle data and root](#5-merkle-data-and-root)
6. [Local deployment and claiming](#6-local-deployment-and-claiming)
7. [Frontend development](#7-frontend-development)
8. [Sepolia and Vercel deployment](#8-sepolia-and-vercel-deployment)
9. [Updating the allowlist](#9-updating-the-allowlist)
10. [Testing and verification](#10-testing-and-verification)
11. [FAQ](#11-faq)

---

## 1. Project modules

| Module | Path | Purpose |
|---|---|---|
| ERC20 token | `contracts/contracts/AirdropToken.sol` | OpenZeppelin ERC20 named `Merkel Airdrop Token`, symbol `MRKL`, owner can mint |
| Airdrop contract | `contracts/contracts/MerkelAirdrop.sol` | Stores ERC20 token address and Merkle Root, verifies proofs, transfers MRKL |
| Merkle utility | `contracts/scripts/merkletree.cjs` | CommonJS utility used by Hardhat deployment scripts |
| Frontend Merkle utility | `web/src/utils/merkletree.js` | ESM utility for React proof generation and demo allowlist merging |
| Deployment script | `contracts/scripts/deploy.js` | Deploys Token, deploys Airdrop, mints total allocation to the airdrop contract, prints Vite env vars |
| Contract tests | `contracts/test/MerkelAirdropERC20.test.js` | Covers token address, claims, duplicate/invalid proofs, owner withdrawal |
| Claim portal | `web/src/App.jsx` | Wallet connection, network switching, on-chain state reads, claiming, simulation, guide rendering |
| Frontend docs | `web/src/content/GUIDE.md` / `GUIDE.en.md` | Rendered inside the `/#guide` route |

---

## 2. End-to-end architecture

```text
Allowlisted address + MRKL allocation
        │
        ▼
contracts/scripts/merkletree.cjs and web/src/utils/merkletree.js
leaf = keccak256(abi.encodePacked(address, amount))
        │
        ▼
Merkle Root = 0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830
        │
        ├─ Deployment script writes it into MerkelAirdrop(tokenAddress, root)
        │
        └─ Frontend generates a proof for the selected account
                 │
                 ▼
User connects wallet → switches target network → contract.claim(proof, amountWei)
                 │
                 ▼
Contract verifies proof, checks hasClaimed, transfers MRKL, records claim state
```

Important invariants:

- Contract `merkleRoot` must equal the root generated from the current base allowlist.
- Frontend base allowlist must match the deployment-script allowlist.
- `amount` is stored as a human-readable MRKL string and converted with `ethers.parseEther(amount)` before hashing/calling.
- Frontend demo entries are only for local simulation; they do not create on-chain eligibility.

---

## 3. Prerequisites

Required:

- Node.js >= 18
- npm
- MetaMask or compatible EVM wallet
- Git

Install dependencies:

```bash
npm install --prefix contracts
npm install --prefix web
```

Confirm versions:

```bash
node -v
npm -v
```

---

## 4. Smart contracts

### 4.1 `AirdropToken.sol`

`AirdropToken` extends OpenZeppelin `ERC20` and `Ownable`:

- Name: `Merkel Airdrop Token`
- Symbol: `MRKL`
- `mint(address to, uint256 amount)` is owner-only

### 4.2 `MerkelAirdrop.sol`

Core state:

| State | Purpose |
|---|---|
| `IERC20 public immutable airdropToken` | Airdropped ERC20 token address |
| `bytes32 public merkleRoot` | Current allowlist commitment |
| `address public owner` | Operator owner |
| `uint256 public totalAirdropAmount` | Recorded token reserve |
| `mapping(address => bool) public hasClaimed` | Replay protection |

Core functions:

| Function | Permission | Purpose |
|---|---|---|
| `claim(bytes32[] proof, uint256 amount)` | Any user | Verifies proof and transfers MRKL |
| `setMerkleRoot(bytes32 newRoot)` | owner | Updates the allowlist root |
| `syncAirdropAmount()` | Any user | Syncs `totalAirdropAmount` to current ERC20 balance |
| `checkClaimed(address user)` | view | Reads claim state |
| `withdrawTokens(address to)` | owner | Withdraws remaining MRKL |

---

## 5. Merkle data and root

The base allowlist currently has 9 addresses and a total allocation of 13,500 MRKL. Authoritative data files:

- `contracts/scripts/merkletree.cjs`
- `web/src/utils/merkletree.js`

Compute the root:

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

Current output:

```text
0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830
```

Current allocations:

| Address | Allocation |
|---|---:|
| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 1,000 MRKL |
| `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 2,000 MRKL |
| `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | 500 MRKL |
| `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | 3,000 MRKL |
| `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | 1,500 MRKL |
| `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | 2,500 MRKL |
| `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | 800 MRKL |
| `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | 1,200 MRKL |
| `0x52e598665a4eC24D671F5EeE8dDA970166C859c8` | 1,000 MRKL |

---

## 6. Local deployment and claiming

### 6.1 Start a local chain

```bash
cd contracts
npx hardhat node
```

### 6.2 Deploy Token and Airdrop

In another terminal:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

The script prints values like:

```text
AIRDROP_TOKEN_ADDRESS=<token-address>
AIRDROP_CONTRACT_ADDRESS=<airdrop-address>
VITE_AIRDROP_CONTRACT_ADDRESS=<airdrop-address>
VITE_AIRDROP_TOKEN_ADDRESS=<token-address>
```

### 6.3 Point the frontend to the local chain

```bash
cd web
VITE_AIRDROP_CHAIN_ID=1337 VITE_AIRDROP_CONTRACT_ADDRESS=<airdrop-address> VITE_AIRDROP_TOKEN_ADDRESS=<token-address> npm run dev
```

MetaMask network:

| Field | Value |
|---|---|
| Network Name | `Hardhat Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

Claim flow:

1. Open `http://localhost:5173`.
2. Connect wallet.
3. Use a Hardhat account from the base allowlist, or use simulated verification only.
4. Select an allowlisted address and inspect the proof path.
5. Click “Execute on-chain claim”.

---

## 7. Frontend development

Frontend entry point: `web/src/App.jsx`.

Current page capabilities:

- `#claim`: claim portal.
- `#guide`: embedded Markdown development guide.
- Chinese/English language toggle saved in `localStorage`.
- Automatic switch request to `VITE_AIRDROP_CHAIN_ID`.
- Reads wallet ETH balance, MRKL balance, contract MRKL reserve, and claim state.
- Falls back to demo mode when the target network/contract is unavailable.
- “Join airdrop” writes the connected wallet into a browser-local demo allowlist only.

Frontend env vars:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_AIRDROP_CONTRACT_ADDRESS` | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` | Sepolia airdrop contract |
| `VITE_AIRDROP_TOKEN_ADDRESS` | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` | Sepolia MRKL token |
| `VITE_AIRDROP_CHAIN_ID` | `11155111` | Sepolia by default |

Common commands:

```bash
cd web
npm run dev
npm run lint
npm run build
npm run preview
```

---

## 8. Sepolia and Vercel deployment

### 8.1 Sepolia contract deployment

Hardhat supports a `sepolia` network with these environment variables:

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` or `SEPOLIA_RPC` | Sepolia RPC URL |
| `PRIVATE_KEY` | Deployer private key; keep it local/CI-secret only |
| `ETHERSCAN_API_KEY` | Optional contract verification API key |

Deploy:

```bash
cd contracts
SEPOLIA_RPC_URL=<rpc-url> PRIVATE_KEY=<private-key> npx hardhat run scripts/deploy.js --network sepolia
```

### 8.2 Sync frontend environment variables

Copy deployment outputs into Vercel:

```text
VITE_AIRDROP_CHAIN_ID=11155111
VITE_AIRDROP_CONTRACT_ADDRESS=<AIRDROP_CONTRACT_ADDRESS>
VITE_AIRDROP_TOKEN_ADDRESS=<AIRDROP_TOKEN_ADDRESS>
```

Current built-in defaults:

```text
VITE_AIRDROP_CONTRACT_ADDRESS=0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A
VITE_AIRDROP_TOKEN_ADDRESS=0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC
VITE_AIRDROP_CHAIN_ID=11155111
```

### 8.3 Vercel build

Root `package.json` provides:

```bash
npm run build
```

It:

1. Enters `web`.
2. Installs frontend dependencies.
3. Runs `npm run build`.
4. Moves `web/dist` to root `dist`.

`vercel.json` rewrites every route to `/index.html` for SPA fallback.

---

## 9. Updating the allowlist

### 9.1 Update base data

Edit both files:

- `contracts/scripts/merkletree.cjs`
- `web/src/utils/merkletree.js`

New entry format:

```javascript
{ address: '0xYourAddress', amount: '1000' }
```

### 9.2 Recompute root

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

### 9.3 Update on-chain state

Two options:

1. Redeploy Token + Airdrop.
2. Have the owner call `setMerkleRoot(newRoot)` and ensure the airdrop contract has enough MRKL reserve.

Frontend “Join airdrop” only updates browser-local state. It does not update the on-chain root and does not grant real claim eligibility.

---

## 10. Testing and verification

Contract tests:

```bash
cd contracts
npm test
```

Frontend lint:

```bash
cd web
npm run lint
```

Frontend build:

```bash
cd web
npm run build
```

Root deployment build:

```bash
npm run build
```

After doc synchronization, check Markdown whitespace:

```bash
git diff --check -- README.md GUIDE.md GUIDE.en.md PRODUCT.md web/src/content/GUIDE.md web/src/content/GUIDE.en.md
```

---

## 11. FAQ

### Q1: Why does the real claim button say “Contract not ready”?

The current wallet network does not have deployed code at `VITE_AIRDROP_CONTRACT_ADDRESS`. Switch to the configured `VITE_AIRDROP_CHAIN_ID`, or redeploy and update Vite environment variables.

### Q2: Why is my address not in the allowlist?

Real claims use the connected wallet address. That address must exist in the base allowlist, and the on-chain root must match the current allowlist.

### Q3: Why can I simulate after joining the demo list but not claim on-chain?

Demo join only writes to browser `localStorage`; it does not call the owner function to update `merkleRoot`. Real claims require an on-chain root update.

### Q4: Why is ETH funding no longer required?

The current version distributes ERC20 MRKL, not ETH. The deployment script mints the total MRKL allocation into `MerkelAirdrop`. Users still need ETH only for gas.

### Q5: How do I debug `Invalid proof`?

Check in order:

1. `contracts/scripts/merkletree.cjs` and `web/src/utils/merkletree.js` contain the same base data.
2. `getMerkleRoot()` equals on-chain `merkleRoot()`.
3. Wallet address and amount match the allowlist entry exactly.
4. `VITE_AIRDROP_CONTRACT_ADDRESS` points to the contract on the correct network.
