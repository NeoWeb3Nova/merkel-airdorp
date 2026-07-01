# Merkel Airdrop Demo

基于 Merkle Tree 原理的空投领取演示项目，包含智能合约和前端页面。

## 项目结构

```
merkel-airdorp/
├── contracts/              # Solidity 智能合约 + Hardhat 部署脚本
│   ├── MerkelAirdrop.sol   # 空投合约
│   ├── hardhat.config.js   # Hardhat 配置
│   └── scripts/
│       ├── deploy.js       # 部署脚本
│       └── merkletree.js   # 生成 Merkle Tree
│
└── web/                    # React + Vite 前端
    ├── src/
    │   ├── App.jsx         # 主页面
    │   ├── App.css         # 样式
    │   ├── utils/
    │   │   └── merkletree.js  # 前端 Merkle Tree 工具
    │   └── abi/
    │       └── MerkelAirdrop.json  # 合约 ABI
    ├── package.json
    └── vite.config.js
```

## 核心原理

1. **Merkle Tree 生成**: 将所有空投用户（地址 + 金额）作为叶子节点，哈希后两两合并直到根节点
2. **链上存储**: 仅存储 32 bytes 的 Merkle Root 到合约，节省 Gas
3. **领取验证**: 用户提交 Merkle Proof + 地址 + 金额，合约递归验证该用户确实在白名单中

## 快速开始

### 前端

```bash
cd web
npm install
npm run dev      # 开发模式
npm run build    # 生产构建
```

### 合约（需先安装 Hardhat）

```bash
cd contracts
npx hardhat node              # 启动本地节点
npx hardhat run scripts/deploy.js  --network localhost  # 部署合约
```

## 使用说明

1. 打开前端页面，选择空投列表中的一个地址
2. 点击"模拟领取"可以看到 Merkle Proof 生成过程
3. 连接 MetaMask 到本地 Hardhat 网络后，点击"连接钱包领取"可进行真实链上交互

## 合约功能

- `claim(proof, amount)` - 领取空投（需验证 Merkle Proof）
- `setMerkleRoot(root)` - 更新 Merkle Root（仅 owner）
- `fundAirdrop()` - 向合约充值资金（仅 owner）
- `checkClaimed(user)` - 查询是否已领取

## 技术栈

- **合约**: Solidity 0.8.20, OpenZeppelin MerkleProof
- **前端**: React 19, Vite, Ethers.js, MerkleTree.js, Keccak256
- **工具**: Hardhat
