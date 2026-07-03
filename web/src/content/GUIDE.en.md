# Merkel Airdrop Developer Guide

Build an Ethereum airdrop system based on a Merkle Tree from scratch.

## Table of contents

1. [Project overview](#1-project-overview)
2. [Environment setup](#2-environment-setup)
3. [Step 1: Write the Solidity smart contract](#3-step-1-write-the-solidity-smart-contract)
4. [Step 2: Merkle Tree utilities](#4-step-2-merkle-tree-utilities)
5. [Step 3: Hardhat configuration and deployment](#5-step-3-hardhat-configuration-and-deployment)
6. [Step 4: React + Vite frontend](#6-step-4-react--vite-frontend)
7. [Step 5: On-chain interaction](#7-step-5-on-chain-interaction)
8. [Step 6: Add a new airdrop address](#8-step-6-add-a-new-airdrop-address)
9. [FAQ](#9-faq)

---

## 1. Project overview

### What is a Merkle Tree airdrop?

The traditional airdrop problem: if an allowlist has 10,000 addresses, storing every address on-chain is expensive, and querying the full list is also inefficient.

Merkle Tree solution:
- Store only a 32-byte **Merkle Root** on-chain
- A user submits their own **Proof** when claiming, which contains the sibling nodes along the path
- The contract hashes each layer and verifies that the user belongs to the allowlist

Gas cost drops from O(n) to O(log n). With 10,000 users, only about 14 nodes are needed for verification.

### Core flow

```text
User address + amount  →  hash into a leaf
Pair and merge leaves  →  first layer of nodes
Keep merging layers    →  final root
→ store the root in the on-chain contract
```

---

## 2. Environment setup

Required:
- Node.js >= 18
- MetaMask browser extension
- Git (optional)

```bash
node -v   # confirm >= 18
npm -v
```

---

## 3. Step 1: Write the Solidity smart contract

Create the directory structure:

```bash
mkdir -p merkel-airdorp/contracts/contracts
mkdir -p merkel-airdorp/web/src
```

### 3.1 Airdrop contract code

`contracts/contracts/MerkelAirdrop.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MerkelAirdrop {
    bytes32 public merkleRoot;
    address public owner;
    uint256 public totalAirdropAmount;

    mapping(address => bool) public hasClaimed;

    event MerkleRootUpdated(bytes32 newRoot);
    event AirdropClaimed(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(bytes32 _merkleRoot) {
        owner = msg.sender;
        merkleRoot = _merkleRoot;
    }

    function setMerkleRoot(bytes32 _newRoot) external onlyOwner {
        merkleRoot = _newRoot;
        emit MerkleRootUpdated(_newRoot);
    }

    function fundAirdrop() external payable onlyOwner {
        totalAirdropAmount += msg.value;
    }

    function claim(bytes32[] calldata proof, uint256 amount) external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(address(this).balance >= amount, "Insufficient funds");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        hasClaimed[msg.sender] = true;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit AirdropClaimed(msg.sender, amount);
    }

    function checkClaimed(address user) external view returns (bool) {
        return hasClaimed[user];
    }

    function withdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    receive() external payable {
        totalAirdropAmount += msg.value;
    }
}
```

### Contract highlights

- `claim` receives a `proof` array and an `amount`
- The leaf is generated with `keccak256(abi.encodePacked(address, amount))`
- OpenZeppelin `MerkleProof.verify` validates the proof
- The `hasClaimed` mapping prevents repeated claims

---

## 4. Step 2: Merkle Tree utilities

Create `contracts/scripts/merkletree.cjs`. You can also share the same logic with the frontend.

```javascript
const { ethers } = require('ethers');

const airdropData = [
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '1.0' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', amount: '2.0' },
  // more addresses...
];

function hashLeaf(address, amount) {
  return ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [address, ethers.parseEther(amount)]
  );
}

function hashPair(a, b) {
  const [left, right] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  const leftBytes = ethers.getBytes(left);
  const rightBytes = ethers.getBytes(right);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return ethers.keccak256(combined);
}

function buildTree(leaves) {
  let layers = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const layer = layers[layers.length - 1];
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        nextLayer.push(hashPair(layer[i], layer[i + 1]));
      } else {
        nextLayer.push(layer[i]);
      }
    }
    layers.push(nextLayer);
  }
  return layers;
}

function getMerkleRoot() {
  const leaves = airdropData.map(item => hashLeaf(item.address, item.amount));
  const layers = buildTree(leaves);
  return layers[layers.length - 1][0];
}

function getProof(address, amount) {
  const leaves = airdropData.map(item => hashLeaf(item.address, item.amount));
  const targetLeaf = hashLeaf(address, amount);
  let index = leaves.findIndex(l => l === targetLeaf);
  if (index === -1) return [];

  const layers = buildTree(leaves);
  const proof = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }
    index = Math.floor(index / 2);
  }
  return proof;
}

module.exports = { airdropData, getMerkleRoot, getProof, hashLeaf };
```

### Verify the Merkle Root

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

Expected output:

```text
0x544c58397ac6b5640c1f9a5e692d4df31709de5aaa78c8e82cd277a26d4ab7e2
```

### Why `solidityPackedKeccak256` matters

Protocol:
- `solidityPackedKeccak256(['address', 'uint256'], [addr, amount])`
- Matches Solidity `keccak256(abi.encodePacked(address, amount))`
- This is the key to keeping frontend and contract hashing consistent

---

## 5. Step 3: Hardhat configuration and deployment

### 5.1 Install Hardhat

```bash
cd contracts
npm init -y
npm install -D hardhat@"^2.28.0" "@nomicfoundation/hardhat-toolbox@hh2"
npm install @openzeppelin/contracts
```

Important: the `@hh2` tag is for Hardhat 2.x. The current `latest` version is Hardhat 3, which is incompatible with these Hardhat 2 scripts.

### 5.2 Hardhat configuration

`hardhat.config.js`:

```javascript
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: '0.8.20',
  networks: {
    hardhat: {
      chainId: 1337,
    },
  },
};
```

Use CommonJS (`require`) and do not add `"type": "module"`.

### 5.3 Deployment script

`scripts/deploy.js`:

```javascript
const { ethers } = require('hardhat');

async function main() {
  const merkleRoot = '0x544c58397ac6b5640c1f9a5e692d4df31709de5aaa78c8e82cd277a26d4ab7e2';

  const MerkelAirdrop = await ethers.getContractFactory('MerkelAirdrop');
  const airdrop = await MerkelAirdrop.deploy(merkleRoot);
  await airdrop.waitForDeployment();

  console.log('Airdrop deployed to:', await airdrop.getAddress());
}

main().catch(console.error);
```

### 5.4 Compile and deploy

```bash
# 1. Compile
npx hardhat compile
# Output: Compiled 3 Solidity files successfully

# 2. Start a local node and keep it running
npx hardhat node

# 3. Deploy from another terminal
npx hardhat run scripts/deploy.js --network localhost
# Output: Airdrop deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 5.5 Fund the contract

```bash
npx hardhat console --network localhost
```

```javascript
const [owner] = await ethers.getSigners();
await owner.sendTransaction({
  to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  value: ethers.parseEther('10')
});
console.log(await ethers.provider.getBalance('0x5FbDB2315678afecb367f032d93F642f64180aa3'));
```

If the contract is not funded, claiming fails with `Insufficient funds`.

---

## 6. Step 4: React + Vite frontend

### 6.1 Create the project

```bash
cd web
npm create vite@latest . -- --template react
cd web
npm install
npm install ethers merkletreejs
```

### 6.2 Vite configuration

`vite.config.js` needs Node.js polyfills because Ethers.js v6 depends on modules such as `buffer` and `util`.

```bash
npm install -D vite-plugin-node-polyfills
```

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ['buffer', 'util', 'events'] })
  ],
});
```

### 6.3 Frontend Merkle Tree

`src/utils/merkletree.js` and `contracts/scripts/merkletree.cjs` use the same logic. The frontend version uses ESM `import/export`.

```javascript
import { ethers } from 'ethers';

const airdropData = [
  // same address list as the contract-side script
];

// hashLeaf, hashPair, buildTree, getProof, and getMerkleRoot are the same as above

export { airdropData, getMerkleRoot, getProof, verifyProof };
```

### 6.4 ABI file

Copy the `abi` array from `artifacts/contracts/MerkelAirdrop.sol/MerkelAirdrop.json` into `src/abi/MerkelAirdrop.json`.

### 6.5 Main App.jsx flow

Core logic:

```javascript
import { useState } from 'react';
import { ethers } from 'ethers';
import { getMerkleRoot, getProof, airdropData } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [claimStatus, setClaimStatus] = useState('');

  const connectWallet = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    setAccount(await signer.getAddress());
    setContract(contract);
  };

  const claimAirdrop = async () => {
    if (!contract || !account) return;
    const proof = getProof(account, selectedUser.amount);
    if (proof.length === 0) {
      setClaimStatus('This address is not in the airdrop list.');
      return;
    }
    const amountWei = ethers.parseEther(selectedUser.amount);
    const tx = await contract.claim(proof, amountWei);
    await tx.wait();
    setClaimStatus('Claim succeeded!');
  };

  // render UI...
}
```

### 6.6 Run the frontend

```bash
npm run dev     # development mode
npm run build   # production build, output to dist/
```

---

## 7. Step 5: On-chain interaction

### 7.1 MetaMask network configuration

Add the local network:
- Network Name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Currency Symbol: `ETH`

### 7.2 Import Hardhat test accounts

Hardhat provides 20 funded test accounts. These private keys correspond to addresses in the airdrop list.

| Address | Private key |
|---|---|
| 0x7099... | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| 0x3C44... | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |

Import path: MetaMask → Account details → Import account → paste the private key.

### 7.3 Interaction flow

1. Open `http://localhost:5173`
2. Select one address from the airdrop list
3. Click simulated claim to verify proof generation
4. Connect MetaMask to the Hardhat local network
5. Click the wallet claim button for the real on-chain interaction

---

## 8. Step 6: Add a new airdrop address

### 8.1 Update address lists on both frontend and contract side

Edit `web/src/utils/merkletree.js` and `contracts/scripts/merkletree.cjs`, then add a new object to the `airdropData` array:

```javascript
{ address: '0xYourNewAddressHere', amount: '1.0' }
```

### 8.2 Recompute the Root

```bash
cd web
node -e "
const { getMerkleRoot } = require('./src/utils/merkletree.js');
console.log(getMerkleRoot());
"
```

Use the new Root to update `contracts/scripts/deploy.js`.

### 8.3 Update the on-chain contract

Method A: redeploy

```bash
npx hardhat run scripts/deploy.js --network localhost
# update CONTRACT_ADDRESS in App.jsx
```

Method B: call `setMerkleRoot` as the owner

```bash
npx hardhat console --network localhost
```

```javascript
const contract = await ethers.getContractAt("MerkelAirdrop", "0x5FbDB...");
await contract.setMerkleRoot("0xNewRoot...");
```

**Key requirement:** the frontend `airdropData`, deployment-script `merkleRoot`, and on-chain contract `merkleRoot` must be strictly consistent. Otherwise `claim` fails.

---

## 9. FAQ

### Q1: "This address is not in the airdrop list"

Cause: your MetaMask address is not in `airdropData`, or the on-chain `merkleRoot` does not match the frontend calculation.

Fix: confirm these three values are aligned: frontend `airdropData` → `deploy.js` `merkleRoot` → on-chain contract `merkleRoot`.

### Q2: "Insufficient funds"

Cause: the contract has no ETH.

Fix: call `fundAirdrop()` or send ETH directly to the contract address.

### Q3: "Invalid proof"

Cause: if `proof.length > 0` but verification still fails, the Root is almost certainly inconsistent.

Fix: use `npx hardhat console` and compare `await contract.merkleRoot()` with frontend `getMerkleRoot()`.

### Q4: Hardhat ESM error

```text
Hardhat only supports ESM projects.
```

Fix: make sure `contracts/package.json` does not set `"type": "module"`, and make sure `hardhat.config.js` uses `require` / `module.exports`.

### Q5: Ethers.js v6 vs v5 differences

| v5 | v6 |
|---|---|
| `ethers.providers.Web3Provider` | `ethers.BrowserProvider` |
| `ethers.utils.parseEther` | `ethers.parseEther` |
| `await contract.deployed()` | `await contract.waitForDeployment()` |
| `contract.address` | `await contract.getAddress()` |
| `ethers.utils.keccak256` | `ethers.keccak256` |

This project uses v6, so pay attention to the syntax changes.

---

## Related resources

- [OpenZeppelin MerkleProof docs](https://docs.openzeppelin.com/contracts/4.x/api/utils#MerkleProof)
- [Ethers.js v6 migration guide](https://docs.ethers.org/v6/migrating/)
- [Hardhat docs](https://hardhat.org/docs)
