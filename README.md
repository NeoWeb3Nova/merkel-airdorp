<div align="center">
  <h1>Merkel Airdrop</h1>
  <p><strong>Verified ERC20 airdrop claims powered by Merkle proofs.</strong></p>
  <p>
    <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/English-active-533afd?style=for-the-badge"></a>
    <a href="./README.zh-CN.md"><img alt="中文" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README-f6f9fc?style=for-the-badge&labelColor=e3e8ee&color=f6f9fc"></a>
  </p>
  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19.2.7-61DAFB?style=flat-square&logo=react&logoColor=0d253d">
    <img alt="Vite" src="https://img.shields.io/badge/Vite-8.1.1-646CFF?style=flat-square&logo=vite&logoColor=white">
    <img alt="Ethers" src="https://img.shields.io/badge/Ethers-v6.17.0-2535A0?style=flat-square">
    <img alt="Solidity" src="https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity">
    <img alt="Hardhat" src="https://img.shields.io/badge/Hardhat-2.28.0-F7DF1E?style=flat-square">
    <img alt="Network" src="https://img.shields.io/badge/Network-Sepolia%2011155111-533afd?style=flat-square">
  </p>
</div>

---

Merkel Airdrop is an ERC20 claim portal based on Merkle Tree proofs. The current version has moved beyond the early ETH-airdrop demo into an on-chain ERC20 distribution system with a React claim portal: the contract stores only the Merkle Root, users submit Merkle Proofs from their wallet to claim MRKL tokens, and the frontend provides real claiming, proof simulation, bilingual developer guides, and demo allowlist registration.

## Current Status

| Item | Status |
|---|---|
| Airdrop asset | ERC20 `Merkel Airdrop Token`, symbol `MRKL` |
| Default network | Sepolia `11155111`; local development can override to Hardhat `1337` / `31337` |
| Default airdrop contract | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` |
| Default token contract | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` |
| Current Merkle Root | `0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830` |
| Eligible accounts | 9 |
| Total allocation | 13,500 MRKL |
| Frontend | React 19 + Vite 8 + Ethers v6 |
| Contracts | Solidity 0.8.20 + Hardhat 2 + OpenZeppelin 5 |

## Core Capabilities

- ERC20 airdrop: `AirdropToken` issues MRKL, and `MerkelAirdrop` holds the token reserve and executes claims.
- Merkle Proof verification: only a 32-byte root is stored on-chain; claims verify `keccak256(abi.encodePacked(address, amount))`.
- Replay protection: `hasClaimed(address)` ensures each address can claim only once.
- Owner operations: update Merkle Root, sync contract reserves, and withdraw remaining ERC20 tokens.
- Frontend claim portal: wallet connection, network switching, on-chain balance reads, contract reserve reads, proof-path display, and on-chain claim execution.
- Demo mode: proof simulation remains available when the target network or contract is unavailable; users can add their current wallet to a local demo allowlist, which only affects browser state and does not update the on-chain root.
- Embedded bilingual docs: `web/src/content/GUIDE.md` and `GUIDE.en.md` render directly inside the frontend `#guide` page.

## Project Structure

```text
merkel-airdorp/
├── README.md                         # English README, shown by default on GitHub
├── README.zh-CN.md                   # 中文 README
├── GUIDE.md / GUIDE.en.md             # Chinese/English development and deployment guide
├── PRODUCT.md                         # Product and design positioning
├── DESIGN.md                          # Design tokens / visual specification
├── package.json                       # Root build script for Vercel output into dist/
├── vercel.json                        # SPA route rewrite
├── contracts/
│   ├── contracts/
│   │   ├── AirdropToken.sol           # ERC20 MRKL token
│   │   └── MerkelAirdrop.sol          # Merkle Proof airdrop contract
│   ├── scripts/
│   │   ├── merkletree.cjs             # Hardhat/CommonJS Merkle utility
│   │   ├── deploy.js                  # Deploy Token + Airdrop and mint reserve into the airdrop contract
│   │   └── update-sepolia-airdrop.js  # Sepolia update script
│   ├── test/MerkelAirdropERC20.test.js
│   └── hardhat.config.js
└── web/
    ├── src/
    │   ├── App.jsx                    # Claim portal + guide page + bilingual copy
    │   ├── App.css                    # Stripe-inspired lightweight financial UI
    │   ├── utils/merkletree.js        # Frontend Merkle utility + local demo allowlist merge
    │   ├── abi/MerkelAirdrop.json
    │   └── content/GUIDE*.md          # Embedded frontend guides
    ├── package.json
    └── vite.config.js
```

## Airdrop Data

The current base allowlist comes from `contracts/scripts/merkletree.cjs` and `web/src/utils/merkletree.js`. These two files must stay aligned.

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

Verify the root:

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

## Quick Start

### 1. Install dependencies

```bash
npm install --prefix contracts
npm install --prefix web
```

### 2. Run contract tests

```bash
cd contracts
npm test
```

### 3. Deploy contracts locally

Terminal A:

```bash
cd contracts
npx hardhat node
```

Terminal B:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

The deployment script will:

1. Deploy `AirdropToken`.
2. Compute the current Merkle Root and deploy `MerkelAirdrop(tokenAddress, root)`.
3. Mint the total allowlist allocation into the airdrop contract.
4. Print `VITE_AIRDROP_CONTRACT_ADDRESS` and `VITE_AIRDROP_TOKEN_ADDRESS`.

### 4. Start the frontend

```bash
cd web
VITE_AIRDROP_CHAIN_ID=1337 VITE_AIRDROP_CONTRACT_ADDRESS=<local-airdrop-address> VITE_AIRDROP_TOKEN_ADDRESS=<local-token-address> npm run dev
```

Open `http://localhost:5173` and connect MetaMask to the Hardhat Local network.

## Environment Variables

### Frontend (Vite)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_AIRDROP_CONTRACT_ADDRESS` | No | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` | `MerkelAirdrop` address |
| `VITE_AIRDROP_TOKEN_ADDRESS` | No | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` | MRKL ERC20 address |
| `VITE_AIRDROP_CHAIN_ID` | No | `11155111` | Target chain ID; local development can use `1337` or `31337` |

### Contract Deployment (Hardhat)

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` or `SEPOLIA_RPC` | Sepolia RPC URL |
| `PRIVATE_KEY` | Deployer private key; never commit it to Git |
| `ETHERSCAN_API_KEY` | Optional contract verification API key |

## Available Scripts

| Command | Description |
|---|---|
| `npm run build` | Root build: installs `web` dependencies, runs Vite build, and moves output to root `dist/` |
| `cd web && npm run dev` | Start the Vite development server |
| `cd web && npm run build` | Build the frontend to `web/dist/` |
| `cd web && npm run lint` | Run oxlint |
| `cd web && npm run preview` | Preview the production build locally |
| `cd contracts && npm test` | Run Hardhat contract tests |
| `cd contracts && npx hardhat compile` | Compile contracts |
| `cd contracts && npx hardhat run scripts/deploy.js --network localhost` | Deploy Token + Airdrop locally |
| `cd contracts && npx hardhat run scripts/deploy.js --network sepolia` | Deploy to Sepolia; requires deployment environment variables |

## Deployment

### Vercel Frontend

The repository root contains `package.json` and `vercel.json`, so deployment should run from the root. Build command:

```bash
npm run build
```

The output directory is root `dist/`. `vercel.json` rewrites all routes to `index.html`, supporting `/#claim` and `/#guide`.

### Sepolia Contracts

```bash
cd contracts
SEPOLIA_RPC_URL=<rpc-url> PRIVATE_KEY=<deployer-private-key> npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, sync the script outputs into Vercel environment variables:

```text
VITE_AIRDROP_CHAIN_ID=11155111
VITE_AIRDROP_CONTRACT_ADDRESS=<AIRDROP_CONTRACT_ADDRESS>
VITE_AIRDROP_TOKEN_ADDRESS=<AIRDROP_TOKEN_ADDRESS>
```

## Operations Notes

- When the allowlist changes, update both `contracts/scripts/merkletree.cjs` and `web/src/utils/merkletree.js`.
- The new root must be applied by the owner via `setMerkleRoot(newRoot)` or by redeploying the contract.
- If the token balance changes, call `syncAirdropAmount()` to sync `totalAirdropAmount`.
- Frontend “Join airdrop” is local demo behavior only; it does not change the on-chain root. Real eligibility requires an owner-controlled root update.
- Only expose public `VITE_*` configuration to the frontend. Never put private keys, privileged RPC credentials, or Etherscan keys into frontend environment variables.

## License

`contracts/package.json` currently declares `ISC`. No standalone root `LICENSE` file has been found.
