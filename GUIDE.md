# Merkel Airdrop 开发教程

从零搭建一个基于 Merkle Tree 的以太坊空投系统。

## 目录

1. [项目概述](#1-项目概述)
2. [环境准备](#2-环境准备)
3. [第一步：编写 Solidity 智能合约](#3-第一步编写-solidity-智能合约)
4. [第二步：Merkle Tree 工具类](#4-第二步-merkle-tree-工具类)
5. [第三步：Hardhat 配置与部署](#5-第三步-hardhat-配置与部署)
6. [第四步：React + Vite 前端](#6-第四步-react--vite-前端)
7. [第五步：链上互动](#7-第五步链上互动)
8. [第六步：添加新空投地址](#8-第六步添加新空投地址)
9. [常见问题](#9-常见问题)

---

## 1. 项目概述

### 什么是 Merkle Tree 空投

传统空投的问题：如果白名单有 10,000 个地址，把所有地址写到链上存储费用极高，用户查询也很贵。

Merkle Tree 解法：
- 只在链上存储 32 bytes 的 **Merkle Root**
- 用户领取时提交自己的 **Proof**（就是路径上的几个兄弟节点）
- 合约逐层哈希验证，确认用户在白名单中

Gas 节省：由 O(n) 降到 O(log n)，1 万用户只需 14 个节点就能验证。

### 核心流程

```
用户地址 + 金额  →  哈希为叶子
两两合并  →  第一层节点
一直合并  →  最终得到 Root
→ 存储到链上合约
```

---

## 2. 环境准备

需要：
- Node.js >= 18
- MetaMask 插件
- Git（可选）

```bash
node -v   # 确认 >= 18
npm -v
```

---

## 3. 第一步：编写 Solidity 智能合约

创建目录结构：

```bash
mkdir -p merkel-airdorp/contracts/contracts
mkdir -p merkel-airdorp/web/src
```

### 3.1 空投合约代码

`contracts/contracts/MerkelAirdrop.sol`：

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

### 合约要点

- `claim` 接收 `proof` 数组和 `amount`
- 用 `keccak256(abi.encodePacked(address, amount))` 生成叶子
- 使用 OpenZeppelin 的 `MerkleProof.verify` 验证
- `hasClaimed` mapping 防止重复领取

---

## 4. 第二步：Merkle Tree 工具类

创建 `contracts/scripts/merkletree.cjs`（也可以放到前端共用）：

```javascript
const { ethers } = require('ethers');

const airdropData = [
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '1.0' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', amount: '2.0' },
  // 更多地址...
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
        nextLayer.push(layer[i]);  // 奇数个节点，直接提升
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

### 验证 Merkle Root

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

输出：`0x544c58397ac6b5640c1f9a5e692d4df31709de5aaa78c8e82cd277a26d4ab7e2`

### 为什么要用 `solidityPackedKeccak256`

协议：
- `solidityPackedKeccak256(['address', 'uint256'], [addr, amount])` 
- 对应 Solidity 中 `keccak256(abi.encodePacked(address, amount))`
- 这是确保前后端一致的关键

---

## 5. 第三步：Hardhat 配置与部署

### 5.1 安装 Hardhat

```bash
cd contracts
npm init -y
npm install -D hardhat@"^2.28.0" "@nomicfoundation/hardhat-toolbox@hh2"
npm install @openzeppelin/contracts
```

重要：`@hh2` tag 对应 Hardhat 2.x。当前的 `latest` 版本是 Hardhat 3，与 Hardhat 2 的脚本不兼容。

### 5.2 Hardhat 配置

`hardhat.config.js`：

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

使用 CJS (`require`) ，不要加 `"type": "module"`。

### 5.3 部署脚本

`scripts/deploy.js`：

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

### 5.4 编译与部署

```bash
# 1. 编译
npx hardhat compile
# 输出：Compiled 3 Solidity files successfully

# 2. 启动本地节点（保持运行）
npx hardhat node

# 3. 在另一个终端部署
npx hardhat run scripts/deploy.js --network localhost
# 输出：Airdrop deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 5.5 给合约充值

```bash
npx hardhat console --network localhost
```

```javascript
const [owner] = await ethers.getSigners();
await owner.sendTransaction({
  to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  value: ethers.parseEther('10')
});
// 确认余额
console.log(await ethers.provider.getBalance('0x5FbDB2315678afecb367f032d93F642f64180aa3'));
```

如果不充值，领取会报 `Insufficient funds`。

---

## 6. 第四步：React + Vite 前端

### 6.1 创建项目

```bash
cd web
npm create vite@latest . -- --template react
cd web
npm install
npm install ethers merkletreejs
```

### 6.2 Vite 配置

`vite.config.js` 需要 polyfill Node.js 模块，因为 Ethers.js v6 依赖 buffer/util。

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

### 6.3 前端 Merkle Tree

`src/utils/merkletree.js` 和 `contracts/scripts/merkletree.cjs` 的逻辑完全一致，只是使用 ESM `import/export`：

```javascript
import { ethers } from 'ethers';

const airdropData = [
  // ... 同合约端的地址列表
];

// hashLeaf, hashPair, buildTree, getProof, getMerkleRoot 与第四步完全相同

export { airdropData, getMerkleRoot, getProof, verifyProof };
```

### 6.4 ABI 文件

从 `artifacts/contracts/MerkelAirdrop.sol/MerkelAirdrop.json` 中拷贝 `abi` 数组到 `src/abi/MerkelAirdrop.json`。

### 6.5 主页面 App.jsx

核心逻辑：

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
      setClaimStatus('该地址不在空投列表中');
      return;
    }
    const amountWei = ethers.parseEther(selectedUser.amount);
    const tx = await contract.claim(proof, amountWei);
    await tx.wait();
    setClaimStatus('领取成功！');
  };

  // UI 渲染...
}
```

### 6.6 运行前端

```bash
npm run dev     # 开发模式
npm run build   # 生产构建，输出到 dist/
```

---

## 7. 第五步：链上互动

### 7.1 MetaMask 配置

添加本地网络：
- Network Name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Currency Symbol: `ETH`

### 7.2 导入 Hardhat 测试账户

Hardhat 自带 20 个已充值的测试账户。这些账户的私钥对应空投列表中的地址：

| 地址 | 私钥 |
|------|------|
| 0x7099... | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| 0x3C44... | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |

导入方法：MetaMask → 账户详情 → 导入账户 → 粘贴私钥

### 7.3 交互流程

1. 打开前端 `http://localhost:5173`
2. 选择空投列表中的一个地址
3. 点击模拟领取 —— 验证 Proof 生成
4. 连接 MetaMask 到 Hardhat 本地网络
5. 点击连接钱包领取 —— 真实链上交互

---

## 8. 第六步：添加新空投地址

### 8.1 修改前端和合约端的地址列表

编辑 `web/src/utils/merkletree.js` 和 `contracts/scripts/merkletree.cjs`，在 `airdropData` 数组中添加新对象：

```javascript
{ address: '0xYourNewAddressHere', amount: '1.0' }
```

### 8.2 重新计算 Root

```bash
cd web
node -e "
const { getMerkleRoot } = require('./src/utils/merkletree.js');
console.log(getMerkleRoot());
"
```

输出新的 Root，更新到 `contracts/scripts/deploy.js`。

### 8.3 更新链上合约

方法 A：重新部署
```bash
npx hardhat run scripts/deploy.js --network localhost
# 更新前端 App.jsx 中的 CONTRACT_ADDRESS
```

方法 B：用 owner 调用 setMerkleRoot
```bash
npx hardhat console --network localhost
```
```javascript
const contract = await ethers.getContractAt("MerkelAirdrop", "0x5FbDB...");
await contract.setMerkleRoot("0x新的Root...");
```

**关键要求：**前端的 `airdropData` 、部署脚本的 `merkleRoot` 、链上合约的 `merkleRoot` 三者必须严格一致，否则 claim 会失败。

---

## 9. 常见问题

### Q1: "该地址不在空投列表中"

原因：你的 MetaMask 地址不在 `airdropData` 中，或者链上 `merkleRoot` 与前端计算的不一致。

解决：确认三处一致：前端 `airdropData` → `deploy.js` 的 `merkleRoot` → 链上合约 `merkleRoot`。

### Q2: "Insufficient funds"

原因：合约没有 ETH。

解决：调用 `fundAirdrop()` 或直接发送 ETH 到合约地址。

### Q3: "Invalid proof"

原因：居然能看到这个错误，说明 `proof.length > 0` 但验证不通过。几乎肯定是 Root 不一致。

解决：使用 `npx hardhat console` 检查 `await contract.merkleRoot()` 与前端 `getMerkleRoot()` 的值是否相同。

### Q4: Hardhat ESM 错误

```
Hardhat only supports ESM projects.
```

解决：确保不要在 `contracts/package.json` 中设置 `"type": "module"`，且 `hardhat.config.js` 使用 `require`/`module.exports`。

### Q5: Ethers.js v6 与 v5 差异

| v5 | v6 |
|---|---|
| `ethers.providers.Web3Provider` | `ethers.BrowserProvider` |
| `ethers.utils.parseEther` | `ethers.parseEther` |
| `await contract.deployed()` | `await contract.waitForDeployment()` |
| `contract.address` | `await contract.getAddress()` |
| `ethers.utils.keccak256` | `ethers.keccak256` |

本项目使用 v6，注意语法区别。

---

## 相关资料

- [OpenZeppelin MerkleProof 文档](https://docs.openzeppelin.com/contracts/4.x/api/utils#MerkleProof)
- [Ethers.js v6 迁移指南](https://docs.ethers.org/v6/migrating/)
- [Hardhat 文档](https://hardhat.org/docs)
