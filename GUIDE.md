# Merkel Airdrop 开发与部署指南

这份指南同步当前改造后的项目：Merkel Airdrop 已从早期 ETH 空投示例升级为 ERC20 MRKL 代币空投系统，包含 Solidity 合约、Hardhat 测试/部署脚本、React + Vite 领取门户、Sepolia 默认部署配置和前端内嵌双语文档页。

## 目录

1. [项目模块](#1-项目模块)
2. [端到端架构](#2-端到端架构)
3. [环境准备](#3-环境准备)
4. [合约开发](#4-合约开发)
5. [Merkle 数据与 Root](#5-merkle-数据与-root)
6. [本地部署与领取](#6-本地部署与领取)
7. [前端开发](#7-前端开发)
8. [Sepolia 与 Vercel 部署](#8-sepolia-与-vercel-部署)
9. [更新白名单](#9-更新白名单)
10. [测试与验证](#10-测试与验证)
11. [常见问题](#11-常见问题)

---

## 1. 项目模块

| 模块 | 路径 | 说明 |
|---|---|---|
| ERC20 代币 | `contracts/contracts/AirdropToken.sol` | OpenZeppelin ERC20，名称 `Merkel Airdrop Token`，symbol `MRKL`，owner 可 mint |
| 空投合约 | `contracts/contracts/MerkelAirdrop.sol` | 保存 ERC20 地址与 Merkle Root，验证 Proof 并转账 MRKL |
| Merkle 工具 | `contracts/scripts/merkletree.cjs` | CommonJS 版本，供 Hardhat 部署脚本使用 |
| 前端 Merkle 工具 | `web/src/utils/merkletree.js` | ESM 版本，供 React 页面生成 Root/Proof 和演示白名单使用 |
| 部署脚本 | `contracts/scripts/deploy.js` | 部署 Token、部署 Airdrop、mint 总额度到空投合约、输出 Vite 环境变量 |
| 合约测试 | `contracts/test/MerkelAirdropERC20.test.js` | 覆盖 token 地址、领取、防重复/无效 proof、owner 提取 |
| 前端门户 | `web/src/App.jsx` | 钱包连接、网络切换、链上状态读取、领取、模拟、文档渲染 |
| 前端文档 | `web/src/content/GUIDE.md` / `GUIDE.en.md` | 在 `/#guide` 页面内嵌渲染 |

---

## 2. 端到端架构

```text
白名单地址 + MRKL 额度
        │
        ▼
contracts/scripts/merkletree.cjs 与 web/src/utils/merkletree.js
生成 leaf = keccak256(abi.encodePacked(address, amount))
        │
        ▼
Merkle Root = 0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830
        │
        ├─ 部署脚本写入 MerkelAirdrop(tokenAddress, root)
        │
        └─ 前端为选中地址生成 proof
                 │
                 ▼
用户连接钱包 → 切换目标网络 → contract.claim(proof, amountWei)
                 │
                 ▼
合约验证 proof、检查 hasClaimed、转账 MRKL、记录已领取
```

关键不变量：

- 合约 `merkleRoot` 必须等于当前基础白名单生成的 Root。
- 前端展示的基础白名单必须与部署脚本的白名单一致。
- `amount` 在工具中用字符串 MRKL 数量表示，哈希和合约调用前统一 `ethers.parseEther(amount)`。
- 前端本地演示名单只用于模拟 Proof，不代表链上可领取资格。

---

## 3. 环境准备

需要：

- Node.js >= 18
- npm
- MetaMask 或兼容 EVM 钱包
- Git

安装依赖：

```bash
npm install --prefix contracts
npm install --prefix web
```

确认版本：

```bash
node -v
npm -v
```

---

## 4. 合约开发

### 4.1 `AirdropToken.sol`

`AirdropToken` 继承 OpenZeppelin `ERC20` 与 `Ownable`：

- 名称：`Merkel Airdrop Token`
- Symbol：`MRKL`
- `mint(address to, uint256 amount)` 仅 owner 可调用

### 4.2 `MerkelAirdrop.sol`

核心状态：

| 状态 | 说明 |
|---|---|
| `IERC20 public immutable airdropToken` | 空投 ERC20 地址 |
| `bytes32 public merkleRoot` | 当前白名单承诺 |
| `address public owner` | 运维 owner |
| `uint256 public totalAirdropAmount` | 记录的合约代币储备 |
| `mapping(address => bool) public hasClaimed` | 防重复领取 |

核心函数：

| 函数 | 权限 | 说明 |
|---|---|---|
| `claim(bytes32[] proof, uint256 amount)` | 任意用户 | 验证 Proof，成功后转账 MRKL |
| `setMerkleRoot(bytes32 newRoot)` | owner | 更新空投名单 Root |
| `syncAirdropAmount()` | 任意用户 | 将 `totalAirdropAmount` 同步为当前 ERC20 余额 |
| `checkClaimed(address user)` | view | 查询领取状态 |
| `withdrawTokens(address to)` | owner | 提取剩余 MRKL |

---

## 5. Merkle 数据与 Root

基础白名单当前为 9 个地址，总额度 13,500 MRKL。权威数据文件：

- `contracts/scripts/merkletree.cjs`
- `web/src/utils/merkletree.js`

计算 Root：

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

当前输出：

```text
0x9fb630f0f3bdeb2629b70ee780df4ff4f6c39a7ecb3b78a47322b61dd708e830
```

当前额度：

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

---

## 6. 本地部署与领取

### 6.1 启动本地链

```bash
cd contracts
npx hardhat node
```

### 6.2 部署 Token 与 Airdrop

另开终端：

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

脚本会输出类似：

```text
AIRDROP_TOKEN_ADDRESS=<token-address>
AIRDROP_CONTRACT_ADDRESS=<airdrop-address>
VITE_AIRDROP_CONTRACT_ADDRESS=<airdrop-address>
VITE_AIRDROP_TOKEN_ADDRESS=<token-address>
```

### 6.3 配置前端连接本地链

```bash
cd web
VITE_AIRDROP_CHAIN_ID=1337 VITE_AIRDROP_CONTRACT_ADDRESS=<airdrop-address> VITE_AIRDROP_TOKEN_ADDRESS=<token-address> npm run dev
```

MetaMask 网络：

| 字段 | 值 |
|---|---|
| Network Name | `Hardhat Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

领取流程：

1. 打开 `http://localhost:5173`。
2. 连接钱包。
3. 如果钱包不在基础白名单，可使用 Hardhat 本地账户，或只做“模拟验证”。
4. 选择白名单地址，查看 Proof 路径。
5. 点击“执行链上领取”。

---

## 7. 前端开发

前端入口：`web/src/App.jsx`。

当前页面能力：

- `#claim`：领取门户。
- `#guide`：内嵌 Markdown 开发指南。
- 中英文切换，语言偏好保存到 `localStorage`。
- 自动请求切换到 `VITE_AIRDROP_CHAIN_ID` 对应网络。
- 读取钱包 ETH 余额、MRKL 余额、空投合约 MRKL 储备、领取状态。
- 合约不可用时进入演示模式，不阻断 Proof 学习与 UI 演示。
- “加入空投”会把当前钱包写入 `localStorage` 的演示白名单，只影响浏览器本地状态。

前端环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_AIRDROP_CONTRACT_ADDRESS` | `0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A` | Sepolia 空投合约地址 |
| `VITE_AIRDROP_TOKEN_ADDRESS` | `0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC` | Sepolia MRKL Token 地址 |
| `VITE_AIRDROP_CHAIN_ID` | `11155111` | 默认 Sepolia |

常用命令：

```bash
cd web
npm run dev
npm run lint
npm run build
npm run preview
```

---

## 8. Sepolia 与 Vercel 部署

### 8.1 Sepolia 合约部署

Hardhat 配置支持 `sepolia` 网络，使用以下环境变量：

| 变量 | 说明 |
|---|---|
| `SEPOLIA_RPC_URL` 或 `SEPOLIA_RPC` | Sepolia RPC URL |
| `PRIVATE_KEY` | 部署账户私钥；只放本地/CI secrets，不提交 |
| `ETHERSCAN_API_KEY` | 可选，合约验证 API key |

部署：

```bash
cd contracts
SEPOLIA_RPC_URL=<rpc-url> PRIVATE_KEY=<private-key> npx hardhat run scripts/deploy.js --network sepolia
```

### 8.2 同步前端环境变量

把部署脚本输出同步到 Vercel：

```text
VITE_AIRDROP_CHAIN_ID=11155111
VITE_AIRDROP_CONTRACT_ADDRESS=<AIRDROP_CONTRACT_ADDRESS>
VITE_AIRDROP_TOKEN_ADDRESS=<AIRDROP_TOKEN_ADDRESS>
```

当前代码内置默认值：

```text
VITE_AIRDROP_CONTRACT_ADDRESS=0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A
VITE_AIRDROP_TOKEN_ADDRESS=0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC
VITE_AIRDROP_CHAIN_ID=11155111
```

### 8.3 Vercel 构建

根目录 `package.json`：

```bash
npm run build
```

该命令会：

1. 进入 `web`。
2. 安装前端依赖。
3. 执行 `npm run build`。
4. 将 `web/dist` 移动到根目录 `dist`。

`vercel.json` 已配置 SPA fallback：所有路径重写到 `/index.html`。

---

## 9. 更新白名单

### 9.1 更新基础数据

同时编辑：

- `contracts/scripts/merkletree.cjs`
- `web/src/utils/merkletree.js`

新增格式：

```javascript
{ address: '0xYourAddress', amount: '1000' }
```

### 9.2 重新计算 Root

```bash
cd contracts
node -e "const { getMerkleRoot } = require('./scripts/merkletree.cjs'); console.log(getMerkleRoot());"
```

### 9.3 更新链上状态

两种方式：

1. 重新部署 Token + Airdrop。
2. 使用 owner 调用 `setMerkleRoot(newRoot)`，并确保空投合约有足够 MRKL 储备。

如果只是前端“加入空投”，它只修改本地浏览器状态，不会更新链上 Root，不能产生真实领取资格。

---

## 10. 测试与验证

合约测试：

```bash
cd contracts
npm test
```

前端 lint：

```bash
cd web
npm run lint
```

前端构建：

```bash
cd web
npm run build
```

根部署构建：

```bash
npm run build
```

文档同步后建议同时检查：

```bash
git diff --check -- README.md GUIDE.md GUIDE.en.md PRODUCT.md web/src/content/GUIDE.md web/src/content/GUIDE.en.md
```

---

## 11. 常见问题

### Q1：为什么真实领取按钮显示“合约未就绪”？

钱包当前网络没有在 `VITE_AIRDROP_CONTRACT_ADDRESS` 检测到合约。切换到 `VITE_AIRDROP_CHAIN_ID` 对应网络，或重新部署合约并同步 Vite 环境变量。

### Q2：为什么提示不在空投列表？

真实领取使用当前连接钱包地址生成 Proof。该地址必须存在于基础白名单，并且链上 Root 必须匹配当前白名单。

### Q3：为什么演示加入后可以模拟，但不能链上领取？

演示加入只写入浏览器 `localStorage`，不会调用 owner 更新链上 `merkleRoot`。真实领取必须更新链上 Root。

### Q4：为什么不再需要给合约转 ETH？

当前版本领取的是 ERC20 MRKL，不是 ETH。部署脚本会 mint 总空投额度到 `MerkelAirdrop` 合约。合约 ETH 只用于 gas 由调用者钱包支付，不是空投资产。

### Q5：`Invalid proof` 怎么排查？

按顺序检查：

1. `contracts/scripts/merkletree.cjs` 与 `web/src/utils/merkletree.js` 是否同一份基础数据。
2. `getMerkleRoot()` 输出是否等于链上 `merkleRoot()`。
3. 钱包地址与 amount 是否与白名单记录完全一致。
4. 前端 `VITE_AIRDROP_CONTRACT_ADDRESS` 是否指向正确网络上的合约。
