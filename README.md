# Merkel Airdrop

基于 Merkle Tree 的以太坊空投领取系统，包含 Solidity 智能合约和 React 前端。

## 项目结构

```
merkel-airdorp/
├── contracts/                  # Solidity 合约 + Hardhat
│   ├── contracts/
│   │   └── MerkelAirdrop.sol # 空投主合约
│   ├── scripts/
│   │   └── deploy.js         # 部署脚本（含 Merkle Root）
│   ├── hardhat.config.js     # Hardhat 配置
│   └── package.json
│
└── web/                      # React + Vite 前端
    ├── src/
    │   ├── App.jsx           # 主页面
    │   ├── utils/
    │   │   └── merkletree.js # 前端 Merkle Tree 生成器
    │   └── abi/
    │       └── MerkelAirdrop.json
    ├── package.json
    └── vite.config.js
```

## 技术栈

- **合约**: Solidity 0.8.20, OpenZeppelin MerkleProof, Hardhat 2
- **前端**: React 19, Vite, Ethers.js v6

## 核心原理

1. **生成 Merkle Tree**: 将所有空投用户（地址 + 金额）作为叶子节点，逐层哈希合并直到根节点
2. **链上存储**: 仅存储 32 bytes 的 Merkle Root，节省 Gas
3. **领取验证**: 用户提交 Merkle Proof + 地址 + 金额，合约递归验证用户是否在白名单中

## 当前空投列表

| 地址 | 金额 |
|------|------|
| 0x7099...79C8 | 1.0 ETH |
| 0x3C44...93BC | 2.0 ETH |
| 0x90F7...8906 | 0.5 ETH |
| 0x15d3...6A65 | 3.0 ETH |
| 0x9965...A4dc | 1.5 ETH |
| 0x976E...0aa9 | 2.5 ETH |
| 0x14dC...9955 | 0.8 ETH |
| 0x2361...E8f | 1.2 ETH |
| 0x52e5...59c8 | 1.0 ETH |

> 注意：前端 `web/src/utils/merkletree.js` 中的列表必须与合约部署时的 `Merkle Root` 严格一致，否则链上验证会失败。

## 快速开始

### 1. 合约端

```bash
cd contracts
npm install          # 安装 hardhat + @nomicfoundation/hardhat-toolbox
npx hardhat compile  # 编译 Solidity
npx hardhat node     # 启动本地 Hardhat 节点（保持运行）
```

在另一个终端部署：

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

默认部署地址：`0x5FbDB2315678afecb367f032d93F642f64180aa3`

**充值合约资金（必须，否则 claim 会报 Insufficient funds）：**

```bash
npx hardhat console --network localhost
```

```javascript
const [owner] = await ethers.getSigners();
await owner.sendTransaction({
  to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  value: ethers.parseEther('10')
});
```

### 2. 前端

```bash
cd web
npm install
npm run dev      # 开发模式 http://localhost:5173
npm run build    # 生产构建
```

### 3. MetaMask 配置

添加本地网络：
- **网络名称**: Hardhat Local
- **RPC URL**: http://127.0.0.1:8545
- **Chain ID**: 1337
- **货币符号**: ETH

## 使用流程

1. 打开前端页面，确认 Merkle Root 显示正常
2. 选择空投列表中的地址（点击选中）
3. 点击"模拟领取"可查看 Merkle Proof 生成过程（不触发链上交易）
4. 连接 MetaMask 到 Hardhat 本地网络
5. 选中列表中的地址，点击"连接钱包领取"进行真实链上交互

## 合约功能

- `claim(bytes32[] proof, uint256 amount)` — 领取空投（需验证 Merkle Proof）
- `setMerkleRoot(bytes32 root)` — 更新 Merkle Root（仅 owner）
- `fundAirdrop()` — 向合约充值 ETH（仅 owner）
- `checkClaimed(address user)` — 查询是否已领取
- `withdraw()` — 提取合约剩余资金（仅 owner）

## 添加新空投地址

1. 编辑 `web/src/utils/merkletree.js`，在 `airdropData` 数组中添加新地址和金额
2. 重新计算 Merkle Root：

```bash
cd web
node -e "
const { getMerkleRoot } = require('./src/utils/merkletree.js');
console.log(getMerkleRoot());
"
```

3. 将新 Root 更新到 `contracts/scripts/deploy.js`
4. 重新部署合约，或用 owner 调用 `setMerkleRoot(newRoot)`

## 环境要求

- Node.js >= 18
- Hardhat 2.x（当前项目使用 `^2.28.0`）
- `@nomicfoundation/hardhat-toolbox@hh2`（兼容 Hardhat 2 的版本）

## 常见问题

**Q: 只能点击模拟领取，真实领取失败？**
A: 你的 MetaMask 地址不在空投列表中。检查 `merkletree.js` 的 `airdropData` 是否包含你的地址，以及合约 `merkleRoot` 是否与前端一致。

**Q: 合约余额不足？**
A: 部署后必须调用 `fundAirdrop()` 或直接用 `sendTransaction` 给合约地址充值 ETH。

**Q: Hardhat 编译报错 ESM？**
A: 当前项目使用 Hardhat 2（CJS），`hardhat.config.js` 和 `deploy.js` 使用 `require`/`module.exports`。不要加 `"type": "module"` 到 `package.json`。
