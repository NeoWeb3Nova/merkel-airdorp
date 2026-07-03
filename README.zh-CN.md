<div align="center">
  <h1>Merkel Airdrop</h1>
  <p><strong>由 Merkle Proof 驱动的可信 ERC20 空投领取门户。</strong></p>
  <p>
    <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/English-README-f6f9fc?style=for-the-badge&labelColor=e3e8ee&color=f6f9fc"></a>
    <a href="./README.zh-CN.md"><img alt="中文" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-active-533afd?style=for-the-badge"></a>
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

<p align="center">
  <img src="assets/merkel-airdrop-claim-portal.png" alt="Merkel Airdrop 领取门户预览" width="100%">
</p>

---

Merkel Airdrop 是一个基于 Merkle Tree 的 ERC20 空投领取门户。当前版本已经从早期 ETH 空投 Demo 升级为“链上 ERC20 分发 + React 可信领取门户”：合约只保存 Merkle Root，用户通过钱包提交 Merkle Proof 领取 MRKL 代币，前端同时提供链上领取、Proof 模拟、双语开发指南和演示白名单注册。

## 当前状态

| 项目 | 状态 |
|---|---|
| 空投资产 | ERC20 `Merkel Airdrop Token`，symbol `MRKL` |
| 默认网络 | Sepolia `11155111`；本地开发可覆盖为 Hardhat `1337` / `31337` |
| 默认空投合约 | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` |
| 默认代币合约 | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` |
| 当前 Merkle Root | `0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830` |
| 合格地址数 | 9 |
| 总空投额度 | 13,500 MRKL |
| 前端 | React 19 + Vite 8 + Ethers v6 |
| 合约 | Solidity 0.8.20 + Hardhat 2 + OpenZeppelin 5 |

## 核心能力

- ERC20 空投：`AirdropToken` 负责发行 MRKL，`MerkelAirdrop` 持有代币储备并执行领取。
- Merkle Proof 验证：链上只保存 32-byte Root，领取时验证 `keccak256(abi.encodePacked(address, amount))`。
- 防重复领取：`hasClaimed(address)` 保证同一地址只能领取一次。
- Owner 运维：可更新 Merkle Root、同步合约储备、提取剩余 ERC20 代币。
- 前端领取门户：钱包连接、网络切换、链上余额读取、合约储备读取、Proof 路径展示、链上领取。
- 演示模式：目标网络或合约不可用时仍可模拟 Proof；用户可把当前钱包加入本地演示白名单（只影响浏览器本地状态，不更新链上 Root）。
- 双语内嵌文档：`web/src/content/GUIDE.md` 与 `GUIDE.en.md` 会直接渲染到前端 `#guide` 页面。

## 项目结构

```text
merkel-airdorp/
├── README.md                         # English README，GitHub 默认展示
├── README.zh-CN.md                   # 中文 README
├── GUIDE.md / GUIDE.en.md             # 中英文开发与部署指南
├── PRODUCT.md                         # 产品与设计定位
├── DESIGN.md                          # 设计 token / 视觉规范
├── package.json                       # 根构建脚本，面向 Vercel 输出 dist/
├── vercel.json                        # SPA 路由重写
├── contracts/
│   ├── contracts/
│   │   ├── AirdropToken.sol           # ERC20 MRKL 代币
│   │   └── MerkelAirdrop.sol          # Merkle Proof 空投合约
│   ├── scripts/
│   │   ├── merkletree.cjs             # Hardhat/CommonJS Merkle 工具
│   │   ├── deploy.js                  # 部署 Token、Airdrop，并 mint 代币到空投合约
│   │   └── update-sepolia-airdrop.js  # Sepolia 更新脚本
│   ├── test/MerkelAirdropERC20.test.js
│   └── hardhat.config.js
└── web/
    ├── src/
    │   ├── App.jsx                    # 领取门户 + 文档页 + 双语文案
    │   ├── App.css                    # Stripe 风格轻量金融界面
    │   ├── utils/merkletree.js        # 前端 Merkle 工具 + 本地演示名单合并
    │   ├── abi/MerkelAirdrop.json
    │   └── content/GUIDE*.md          # 前端内嵌开发指南
    ├── package.json
    └── vite.config.js
```

## 空投数据

当前基础白名单来自 `contracts/scripts/merkletree.cjs` 与 `web/src/utils/merkletree.js`，两端必须保持一致。

| 地址 | 额度 |
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

验证 Root：

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

## 快速开始

### 1. 安装依赖

```bash
npm install --prefix contracts
npm install --prefix web
```

### 2. 运行合约测试

```bash
cd contracts
npm test
```

### 3. 本地部署合约

终端 A：

```bash
cd contracts
npx hardhat node
```

终端 B：

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

部署脚本会按顺序：

1. 部署 `AirdropToken`。
2. 计算当前 Merkle Root 并部署 `MerkelAirdrop(tokenAddress, root)`。
3. 按白名单总额度 mint MRKL 到空投合约。
4. 输出 `VITE_AIRDROP_CONTRACT_ADDRESS` 与 `VITE_AIRDROP_TOKEN_ADDRESS`。

### 4. 启动前端

```bash
cd web
VITE_AIRDROP_CHAIN_ID=1337 VITE_AIRDROP_CONTRACT_ADDRESS=<本地部署输出的空投合约地址> VITE_AIRDROP_TOKEN_ADDRESS=<本地部署输出的代币合约地址> npm run dev
```

打开 `http://localhost:5173`，连接 MetaMask 的 Hardhat Local 网络。

## 环境变量

### 前端（Vite）

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `VITE_AIRDROP_CONTRACT_ADDRESS` | 否 | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` | `MerkelAirdrop` 地址 |
| `VITE_AIRDROP_TOKEN_ADDRESS` | 否 | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` | MRKL ERC20 地址 |
| `VITE_AIRDROP_CHAIN_ID` | 否 | `11155111` | 目标链 ID；本地可设 `1337` 或 `31337` |

### 合约部署（Hardhat）

| 变量 | 用途 |
|---|---|
| `SEPOLIA_RPC_URL` 或 `SEPOLIA_RPC` | Sepolia RPC URL |
| `PRIVATE_KEY` | 部署账户私钥；不要提交到 Git |
| `ETHERSCAN_API_KEY` | 可选，合约验证 API Key |

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run build` | 根目录构建：安装 `web` 依赖、执行 Vite build、移动输出到根 `dist/` |
| `cd web && npm run dev` | 启动 Vite 开发服务器 |
| `cd web && npm run build` | 构建前端到 `web/dist/` |
| `cd web && npm run lint` | 运行 oxlint |
| `cd web && npm run preview` | 本地预览生产构建 |
| `cd contracts && npm test` | 运行 Hardhat 合约测试 |
| `cd contracts && npx hardhat compile` | 编译合约 |
| `cd contracts && npx hardhat run scripts/deploy.js --network localhost` | 本地部署 Token + Airdrop |
| `cd contracts && npx hardhat run scripts/deploy.js --network sepolia` | Sepolia 部署，需要部署环境变量 |

## 部署

### Vercel 前端

仓库根目录包含 `package.json` 与 `vercel.json`，适合从根目录部署。构建命令使用：

```bash
npm run build
```

输出目录为根目录 `dist/`。`vercel.json` 将所有路由重写到 `index.html`，支持 `/#claim` 与 `/#guide`。

### Sepolia 合约

```bash
cd contracts
SEPOLIA_RPC_URL=<rpc-url> PRIVATE_KEY=<deployer-private-key> npx hardhat run scripts/deploy.js --network sepolia
```

部署完成后，把脚本输出的地址同步到 Vercel 环境变量：

```text
VITE_AIRDROP_CHAIN_ID=11155111
VITE_AIRDROP_CONTRACT_ADDRESS=<AIRDROP_CONTRACT_ADDRESS>
VITE_AIRDROP_TOKEN_ADDRESS=<AIRDROP_TOKEN_ADDRESS>
```

## 运维注意事项

- 改白名单时必须同时更新 `contracts/scripts/merkletree.cjs` 与 `web/src/utils/merkletree.js` 的基础数据。
- 新 Root 必须通过 owner 调用 `setMerkleRoot(newRoot)` 或重新部署合约。
- 如果合约代币余额变化，调用 `syncAirdropAmount()` 同步 `totalAirdropAmount`。
- 前端“加入空投”只是本地演示，不会改变链上 Root；真实领取必须由合约 owner 更新 Root。
- 前端只允许暴露 `VITE_*` 公共配置，不要把私钥、RPC 管理密钥或 Etherscan key 写入前端环境变量。

## 许可证

`contracts/package.json` 当前声明 `ISC`。仓库根目录尚未发现独立 `LICENSE` 文件。
