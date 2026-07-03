import { Fragment, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import guideMarkdownZh from './content/GUIDE.md?raw';
import guideMarkdownEn from './content/GUIDE.en.md?raw';
import { getMerkleRoot, getProof, airdropData, setAirdropData, mergeAirdropData, isEligible } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';
import './App.css';

// 默认指向 Sepolia 真实部署；本地开发可用 VITE_AIRDROP_CONTRACT_ADDRESS / VITE_AIRDROP_TOKEN_ADDRESS 覆盖。
const CONTRACT_ADDRESS = import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS || '0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A';
const TOKEN_ADDRESS = import.meta.env.VITE_AIRDROP_TOKEN_ADDRESS || '0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC';
const EXPECTED_CHAIN_ID = BigInt(import.meta.env.VITE_AIRDROP_CHAIN_ID || '11155111');
const EXPECTED_CHAIN_HEX = `0x${EXPECTED_CHAIN_ID.toString(16)}`;
const EXPECTED_NETWORK_LABEL = EXPECTED_CHAIN_ID === 11155111n
  ? 'Sepolia · 11155111'
  : EXPECTED_CHAIN_ID === 31337n || EXPECTED_CHAIN_ID === 1337n
    ? `Hardhat Local · ${EXPECTED_CHAIN_ID.toString()}`
    : `Chain · ${EXPECTED_CHAIN_ID.toString()}`;
const CHAIN_CONFIGS = {
  11155111: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  31337: {
    chainId: '0x7a69',
    chainName: 'Hardhat Local',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['http://127.0.0.1:8545'],
  },
  1337: {
    chainId: '0x539',
    chainName: 'Hardhat Local',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['http://127.0.0.1:8545'],
  },
};
const GITHUB_REPO_URL = 'https://github.com/NeoWeb3Nova/merkel-airdorp';
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const translations = {
  zh: {
    pageTitle: 'Merkel Airdrop | 可信领取门户',
    navigationLabel: 'Merkel Airdrop 页面导航',
    brandSubtitle: '可信领取门户',
    navClaim: '领取门户',
    navGuide: '开发指南',
    repo: 'GitHub 项目',
    languageToggle: 'English',
    walletOffline: '钱包离线',
    evmNetwork: 'EVM 网络',
    installMetamask: '请安装 MetaMask!',
    connectFailed: '连接失败: ',
    claimFailed: '领取失败: ',
    networkSwitchFailed: `请先在钱包中切换到 ${EXPECTED_NETWORK_LABEL}。当前合约部署在该网络，其他网络会显示“合约未就绪”。`,
    demoConnected:
      `演示模式已连接：当前钱包网络未在 ${CONTRACT_ADDRESS} 检测到 MerkelAirdrop 合约。\n` +
      `Vercel 页面可继续使用 Proof 模拟；真实链上领取请切换到 ${EXPECTED_NETWORK_LABEL}，或部署合约后配置 VITE_AIRDROP_CONTRACT_ADDRESS 与 VITE_AIRDROP_CHAIN_ID。`,
    walletReady: '钱包已连接，链上合约已就绪。',
    noInteractiveContract: '当前网络未检测到可交互的 MerkelAirdrop 合约，请先部署/切换网络，或使用模拟领取。',
    selectUserFirst: '请先选择一个空投用户',
    notAllowlisted: '该地址不在空投列表中，无法生成有效 proof',
    txSubmitted: '交易已提交，等待确认...',
    claimSuccess: '空投领取成功!',
    simulateSuccess: ({ address, amount, tokenSymbol, proofLength }) =>
      `模拟领取成功!\n地址: ${address}\n金额: ${amount} ${tokenSymbol}\nProof 节点数: ${proofLength}`,
    eyebrow: 'Institutional Web3 Distribution',
    heroTitle: '可信金融级空投领取门户',
    heroLede: '以链上透明度和可审计 Proof 为核心，重构钱包连接、资格验证与领取执行路径，让客户和用户都能清楚判断当前网络、合约与领取状态。',
    connectMetamask: '连接钱包',
    wallet: '钱包',
    simulateProof: '验证资格',
    airdropSummary: '空投概览',
    totalAllocation: '总空投额度',
    merkleVerified: 'Merkle 已验证',
    eligibleAccounts: '合格地址',
    proofNodes: '验证节点',
    contract: '合约',
    walletLabel: '钱包',
    ready: '已就绪',
    demo: '演示',
    connected: '已连接',
    offline: '离线',
    distributionModel: '分发模型',
    claimAsset: '空投代币',
    networkStatus: '网络状态',
    replayGuard: '重复领取保护',
    contractDeployed: '合约已部署',
    demoPreview: '演示模式',
    claimed: '已领取',
    available: '可领取',
    workflowKicker: '领取流程',
    workflowTitle: '三步完成领取',
    workflowCopy: '连接钱包、验证资格、链上领取，所有操作在同一界面完成。',
    claimSteps: [
      { title: '连接钱包', description: '连接 MetaMask 或兼容钱包，读取网络、余额与合约状态。' },
      { title: '验证资格', description: '选择白名单地址，生成 Merkle 验证路径并确认领取额度。' },
      { title: '执行领取', description: '提交链上交易，合约验证后自动释放代币。' },
    ],
    selectedWallet: '已选地址',
    allocation: '空投额度',
    eligibility: '资格状态',
    verified: '已验证',
    auditTrail: '审计链路',
    merkleProof: 'Merkle 验证路径',
    nodes: '个节点',
    chooseAddressHint: '请先在白名单列表中选择一个领取地址。',
    processing: '交易提交中...',
    claimOnChain: '执行链上领取',
    contractNotReady: '合约未就绪',
    simulateVerify: '模拟验证',
    walletState: '账户状态',
    accountAndContract: '账户与合约',
    ethBalance: 'ETH 余额',
    walletToken: '代币余额',
    contractReserve: '合约储备',
    contractStatus: '合约状态',
    claimStatus: '领取状态',
    deployed: '已部署',
    demoMode: '演示模式',
    connectWalletReadState: '连接钱包后自动读取链上余额、合约储备和领取状态。',
    connectWallet: '连接钱包',
    merkleRoot: '链上验证根',
    commitment: '32-byte 承诺值',
    allowlist: '白名单',
    allowlistTitle: '合格领取地址',
    allowlistCopy: '选择地址后，右侧面板自动显示额度和验证路径。',
    records: '条记录',
    walletAddress: '钱包地址',
    status: '状态',
    selected: '已选择',
    eligible: '合格',
    protocolKicker: '协议保障',
    protocolTitle: '为什么可信',
    onChainVerifiable: '链上可验证',
    protocolNotes: [
      { title: 'Merkle 承诺', description: '空投名单被压缩为 32-byte 根哈希，链上仅存储承诺值。' },
      { title: '路径验证', description: '用户提交地址、金额和验证路径，合约逐层哈希比对根值。' },
      { title: 'Gas 优化', description: '无需把完整名单写入链上，验证复杂度为 O(log n)。' },
      { title: '防重放', description: '链上 hasClaimed 状态确保同一地址只能领取一次。' },
    ],
    guideEyebrow: '开发指南',
    guideTitle: 'Merkle Tree 空投开发指南',
    guideLede: '从零搭建基于 Merkle Tree 的以太坊空投系统，涵盖合约、前端与部署全流程。',
    guideSource: '内容来源：GUIDE.md',
    guideRepoCta: '查看源码',
    guideClaimCta: '返回领取门户',
    registerCta: '加入空投',
    registerCancel: '取消',
    registerConfirm: '确认加入',
    registerLabel: 'Demo Registration',
    registerTitle: '添加到演示白名单',
    registerCopy: '使用当前链接的钱包地址加入演示空投列表，立即可生成有效的 Merkle Proof。此操作仅影响前端演示，不会更新链上合约。',
    registerNeedWallet: '请先连接钱包以获取地址',
    registerInvalidAmount: '请输入有效的空投数量',
    registerAlreadyEligible: '该地址已在白名单中，可直接选择领取',
    registerSuccess: ({ address, amount }) => `已添加到演示白名单：${address}\n空投额度：${amount} MRKL\n现在可以生成有效的 Merkle Proof 并模拟领取。`,
    registerHint: '提示：此演示机制仅修改前端本地状态。真实链上领取需要合约 Owner 更新 Merkle Root。',
    unregister: '移除',
  },
  en: {
    pageTitle: 'Merkel Airdrop | Verified Claim Portal',
    navigationLabel: 'Merkel Airdrop page navigation',
    brandSubtitle: 'Verified Claim Portal',
    navClaim: 'Claim Portal',
    navGuide: 'Developer Guide',
    repo: 'GitHub Project',
    languageToggle: '中文',
    walletOffline: 'Wallet Offline',
    evmNetwork: 'EVM Network',
    installMetamask: 'Please install MetaMask!',
    connectFailed: 'Connection failed: ',
    claimFailed: 'Claim failed: ',
    networkSwitchFailed: `Please switch your wallet to ${EXPECTED_NETWORK_LABEL}. The contract is deployed on that network; other networks show “Contract not ready”.`,
    demoConnected:
      `Demo mode connected: no MerkelAirdrop contract was detected at ${CONTRACT_ADDRESS} on the current wallet network.\n` +
      `You can still use proof simulation on the Vercel page. For a real on-chain claim, switch to ${EXPECTED_NETWORK_LABEL}, or deploy the contract and set VITE_AIRDROP_CONTRACT_ADDRESS plus VITE_AIRDROP_CHAIN_ID.`,
    walletReady: 'Wallet connected. The on-chain contract is ready.',
    noInteractiveContract: 'No interactive MerkelAirdrop contract was detected on the current network. Deploy/switch network first, or use simulated verification.',
    selectUserFirst: 'Select an airdrop user first.',
    notAllowlisted: 'This address is not in the airdrop list, so no valid proof can be generated.',
    txSubmitted: 'Transaction submitted. Waiting for confirmation...',
    claimSuccess: 'Airdrop claimed successfully!',
    simulateSuccess: ({ address, amount, tokenSymbol, proofLength }) =>
      `Simulated claim succeeded!\nAddress: ${address}\nAmount: ${amount} ${tokenSymbol}\nProof nodes: ${proofLength}`,
    eyebrow: 'Institutional Web3 Distribution',
    heroTitle: 'Verified financial-grade airdrop portal',
    heroLede: 'A transparent, auditable claim experience centered on on-chain state and Merkle proofs, so users can understand wallet, network, contract, and claim status before submitting a transaction.',
    connectMetamask: 'Connect wallet',
    wallet: 'Wallet',
    simulateProof: 'Verify eligibility',
    airdropSummary: 'Airdrop summary',
    totalAllocation: 'Total allocation',
    merkleVerified: 'Merkle verified',
    eligibleAccounts: 'Eligible addresses',
    proofNodes: 'Proof nodes',
    contract: 'Contract',
    walletLabel: 'Wallet',
    ready: 'Ready',
    demo: 'Demo',
    connected: 'Connected',
    offline: 'Offline',
    distributionModel: 'Distribution model',
    claimAsset: 'Airdrop token',
    networkStatus: 'Network status',
    replayGuard: 'Replay guard',
    contractDeployed: 'Deployed',
    demoPreview: 'Demo mode',
    claimed: 'Claimed',
    available: 'Available',
    workflowKicker: 'Claim workflow',
    workflowTitle: 'Three-step claim',
    workflowCopy: 'Connect wallet, verify eligibility, and execute on-chain claim — all in one view.',
    claimSteps: [
      { title: 'Connect wallet', description: 'Connect MetaMask or compatible wallet to read network, balance, and contract state.' },
      { title: 'Verify eligibility', description: 'Select an allowlisted address, generate Merkle proof path, and confirm allocation.' },
      { title: 'Execute claim', description: 'Submit on-chain transaction; the contract releases tokens after verification.' },
    ],
    selectedWallet: 'Selected address',
    allocation: 'Allocation',
    eligibility: 'Eligibility',
    verified: 'Verified',
    auditTrail: 'Audit trail',
    merkleProof: 'Merkle proof path',
    nodes: 'nodes',
    chooseAddressHint: 'Select an eligible address from the allowlist first.',
    processing: 'Submitting transaction...',
    claimOnChain: 'Execute on-chain claim',
    contractNotReady: 'Contract not ready',
    simulateVerify: 'Simulate verification',
    walletState: 'Account state',
    accountAndContract: 'Account and contract',
    ethBalance: 'ETH balance',
    walletToken: 'Token balance',
    contractReserve: 'Contract reserve',
    contractStatus: 'Contract status',
    claimStatus: 'Claim status',
    deployed: 'Deployed',
    demoMode: 'Demo mode',
    connectWalletReadState: 'Connect wallet to automatically read on-chain balance, contract reserves, and claim status.',
    connectWallet: 'Connect wallet',
    merkleRoot: 'On-chain verification root',
    commitment: '32-byte commitment',
    allowlist: 'Allowlist',
    allowlistTitle: 'Eligible claim addresses',
    allowlistCopy: 'After selecting an address, the right panel automatically shows allocation and proof path.',
    records: 'records',
    walletAddress: 'Wallet address',
    status: 'Status',
    selected: 'Selected',
    eligible: 'Eligible',
    protocolKicker: 'Protocol assurance',
    protocolTitle: 'Why it is trustworthy',
    onChainVerifiable: 'On-chain verifiable',
    protocolNotes: [
      { title: 'Merkle commitment', description: 'The airdrop list is compressed into a 32-byte root hash; only the commitment is stored on-chain.' },
      { title: 'Path verification', description: 'Users submit address, amount, and proof path; the contract hashes each layer against the root.' },
      { title: 'Gas efficient', description: 'No need to write the full list on-chain; verification complexity is O(log n).' },
      { title: 'Replay protected', description: 'On-chain hasClaimed state ensures each address can only claim once.' },
    ],
    guideEyebrow: 'Developer guide',
    guideTitle: 'Merkle Tree airdrop developer guide',
    guideLede: 'Build a Merkle Tree-based Ethereum airdrop system from scratch, covering contracts, frontend, and deployment.',
    guideSource: 'Source: GUIDE.en.md',
    guideRepoCta: 'View source',
    guideClaimCta: 'Back to claim portal',
    registerCta: 'Join airdrop',
    registerCancel: 'Cancel',
    registerConfirm: 'Confirm join',
    registerLabel: 'Demo registration',
    registerTitle: 'Add to demo allowlist',
    registerCopy: 'Use the currently connected wallet address to join the demo airdrop list and instantly generate a valid Merkle Proof. This only affects the frontend demo and does not update the on-chain contract.',
    registerNeedWallet: 'Please connect your wallet first to get an address',
    registerInvalidAmount: 'Please enter a valid airdrop amount',
    registerAlreadyEligible: 'This address is already in the allowlist; select it to claim',
    registerSuccess: ({ address, amount }) => `Added to demo allowlist: ${address}\nAirdrop allocation: ${amount} MRKL\nYou can now generate a valid Merkle Proof and simulate a claim.`,
    registerHint: 'Tip: This demo mechanism only modifies local frontend state. Real on-chain claiming requires the contract owner to update the Merkle Root.',
    unregister: 'Remove',
  },
};

const formatAmount = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
const shortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';

const normalizeRoute = () => (window.location.hash === '#guide' ? 'guide' : 'claim');

const parseInline = (text) => {
  const nodes = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('`')) {
      nodes.push(<code key={`code-${match.index}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      nodes.push(
        <a key={`link-${match.index}`} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

const parseMarkdown = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || line.trim() === '---') {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', language, value: codeLines.join('\n') });
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length, value: heading[2] });
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', value: quoteLines.join(' ') });
      continue;
    }

    const tableSeparator = lines[i + 1]?.trim();
    if (line.includes('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(tableSeparator || '')) {
      const headers = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(lines[i].split('|').map((cell) => cell.trim()).filter(Boolean));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items = [];
      while (i < lines.length) {
        const itemMatch = ordered ? lines[i].match(/^\d+\.\s+(.+)$/) : lines[i].match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^(#{1,4})\s+(.+)$/) &&
      !lines[i].match(/^[-*]\s+(.+)$/) &&
      !lines[i].match(/^\d+\.\s+(.+)$/) &&
      !lines[i].startsWith('>')
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', value: paragraph.join(' ') });
  }

  return blocks;
};

const MarkdownBlock = ({ block }) => {
  if (block.type === 'heading') {
    if (block.depth === 1) return <h2>{parseInline(block.value)}</h2>;
    if (block.depth === 2) return <h3>{parseInline(block.value)}</h3>;
    if (block.depth === 3) return <h4>{parseInline(block.value)}</h4>;
    return <h5>{parseInline(block.value)}</h5>;
  }

  if (block.type === 'code') {
    return (
      <pre className="guide-code">
        <code>{block.value}</code>
      </pre>
    );
  }

  if (block.type === 'quote') return <blockquote>{parseInline(block.value)}</blockquote>;

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag>
        {block.items.map((item, index) => <li key={`${item}-${index}`}>{parseInline(item)}</li>)}
      </ListTag>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="guide-table-wrap">
        <table>
          <thead>
            <tr>{block.headers.map((header) => <th key={header}>{parseInline(header)}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {block.headers.map((header, cellIndex) => <td key={`${header}-${cellIndex}`}>{parseInline(row[cellIndex] || '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <p>{parseInline(block.value)}</p>;
};

const getInitialLanguage = () => {
  const stored = localStorage.getItem('merkel-airdrop-language');
  if (stored === 'zh' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

const getNetworkLabel = (network, t) => {
  if (!network) return t.walletOffline;
  const chainId = network.chainId.toString();
  if (chainId === '31337' || chainId === '1337') return `Hardhat Local · ${chainId}`;
  return `${network.name === 'unknown' ? t.evmNetwork : network.name} · ${chainId}`;
};

const switchToExpectedNetwork = async () => {
  if (!window.ethereum?.request) return false;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: EXPECTED_CHAIN_HEX }],
    });
    return true;
  } catch (err) {
    if (err?.code === 4902 && CHAIN_CONFIGS[Number(EXPECTED_CHAIN_ID)]) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [CHAIN_CONFIGS[Number(EXPECTED_CHAIN_ID)]],
      });
      return true;
    }
    throw err;
  }
};

function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [page, setPage] = useState(normalizeRoute);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [merkleRoot, setMerkleRoot] = useState('');
  const [hasClaimed, setHasClaimed] = useState(false);
  const [balance, setBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [contractBalance, setContractBalance] = useState('0');
  const [tokenSymbol, setTokenSymbol] = useState('MRKL');
  const [claimStatus, setClaimStatus] = useState('');
  const [statusTone, setStatusTone] = useState('success');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(airdropData[0]);
  const [networkLabel, setNetworkLabel] = useState(translations[language].walletOffline);
  const [contractReady, setContractReady] = useState(false);
  const [customUsers, setCustomUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('merkel-airdrop-custom-users');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationAmount, setRegistrationAmount] = useState('100');

  const t = translations[language];
  const guideMarkdown = language === 'zh' ? guideMarkdownZh : guideMarkdownEn;
  const guideBlocks = useMemo(() => parseMarkdown(guideMarkdown), [guideMarkdown]);
  const totalAirdrop = airdropData.reduce((sum, item) => sum + Number(item.amount), 0);
  const selectedProof = selectedUser ? getProof(selectedUser.address, selectedUser.amount) : [];

  useEffect(() => {
    const merged = mergeAirdropData(customUsers);
    setAirdropData(merged);
    setMerkleRoot(getMerkleRoot(merged));
  }, [customUsers]);

  useEffect(() => {
    const onHashChange = () => setPage(normalizeRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = t.pageTitle;
    localStorage.setItem('merkel-airdrop-language', language);
    if (!account) setNetworkLabel(t.walletOffline);
  }, [account, language, t]);

  const toggleLanguage = () => {
    setLanguage((current) => current === 'zh' ? 'en' : 'zh');
  };

  const setStatus = (message, tone = 'success') => {
    setClaimStatus(message);
    setStatusTone(tone);
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus(t.installMetamask, 'error');
      return;
    }

    try {
      let provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      let network = await provider.getNetwork();

      if (network.chainId !== EXPECTED_CHAIN_ID) {
        await switchToExpectedNetwork();
        provider = new ethers.BrowserProvider(window.ethereum);
        network = await provider.getNetwork();
      }

      if (network.chainId !== EXPECTED_CHAIN_ID) {
        setNetworkLabel(getNetworkLabel(network, t));
        setContractReady(false);
        setContract(null);
        setStatus(t.networkSwitchFailed, 'notice');
        return;
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const code = await provider.getCode(CONTRACT_ADDRESS);
      const hasDeployedContract = code && code !== '0x';
      const contract = hasDeployedContract ? new ethers.Contract(CONTRACT_ADDRESS, ABI, signer) : null;

      setAccount(address);
      setProvider(provider);
      setContract(contract);
      setNetworkLabel(getNetworkLabel(network, t));
      setContractReady(hasDeployedContract);

      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));

      if (!hasDeployedContract) {
        setContractBalance('0');
        setTokenBalance('0');
        setHasClaimed(false);
        setStatus(t.demoConnected, 'notice');
        return;
      }

      const tokenAddress = TOKEN_ADDRESS || await contract.airdropToken();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [symbol, decimals, accountTokenBalance, contractTokenBalance] = await Promise.all([
        token.symbol(),
        token.decimals(),
        token.balanceOf(address),
        token.balanceOf(CONTRACT_ADDRESS),
      ]);
      setTokenSymbol(symbol);
      setTokenBalance(ethers.formatUnits(accountTokenBalance, decimals));
      setContractBalance(ethers.formatUnits(contractTokenBalance, decimals));

      const claimed = await contract.hasClaimed(address);
      setHasClaimed(claimed);
      setStatus(t.walletReady, 'success');
    } catch (err) {
      const isNetworkSwitchError = err?.code === 4001 || err?.code === 4902 || err?.code === -32603;
      const message = isNetworkSwitchError
        ? t.networkSwitchFailed
        : t.connectFailed + (err.reason || err.message || err);
      setStatus(message, 'error');
    }
  };

  const claimAirdrop = async () => {
    if (!contract || !account) {
      setStatus(t.noInteractiveContract, 'notice');
      return;
    }
    if (!selectedUser) {
      setStatus(t.selectUserFirst, 'error');
      return;
    }

    setIsLoading(true);
    setStatus('', 'success');

    try {
      const amount = selectedUser.amount;
      const amountWei = ethers.parseEther(amount);
      const proof = getProof(account, amount);

      if (proof.length === 0) {
        setStatus(t.notAllowlisted, 'error');
        setIsLoading(false);
        return;
      }

      console.log('Claiming with proof:', proof);
      console.log('Amount:', amountWei.toString());

      const tx = await contract.claim(proof, amountWei);
      setStatus(t.txSubmitted, 'success');

      await tx.wait();

      setStatus(t.claimSuccess, 'success');
      setHasClaimed(true);

      const bal = await provider.getBalance(account);
      setBalance(ethers.formatEther(bal));
      const tokenAddress = TOKEN_ADDRESS || await contract.airdropToken();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [decimals, accountTokenBalance, contractTokenBalance] = await Promise.all([
        token.decimals(),
        token.balanceOf(account),
        token.balanceOf(CONTRACT_ADDRESS),
      ]);
      setTokenBalance(ethers.formatUnits(accountTokenBalance, decimals));
      setContractBalance(ethers.formatUnits(contractTokenBalance, decimals));
    } catch (err) {
      const message = t.claimFailed + (err.reason || err.message || err);
      setStatus(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateClaim = () => {
    if (!selectedUser) {
      setStatus(t.selectUserFirst, 'error');
      return;
    }

    const proof = getProof(selectedUser.address, selectedUser.amount);

    if (proof.length === 0) {
      setStatus(t.notAllowlisted, 'error');
      return;
    }

    setStatus(t.simulateSuccess({
      address: selectedUser.address,
      amount: selectedUser.amount,
      tokenSymbol,
      proofLength: proof.length,
    }), 'success');
  };

  const registerForAirdrop = () => {
    if (!account) {
      setStatus(t.registerNeedWallet, 'error');
      return;
    }
    if (!registrationAmount || Number(registrationAmount) <= 0) {
      setStatus(t.registerInvalidAmount, 'error');
      return;
    }
    const amountStr = String(Number(registrationAmount));
    const normalizedAddress = account.toLowerCase();

    if (isEligible(account)) {
      setStatus(t.registerAlreadyEligible, 'notice');
      setRegistrationOpen(false);
      // Select the existing entry
      const existing = airdropData.find(item => item.address.toLowerCase() === normalizedAddress);
      if (existing) setSelectedUser(existing);
      return;
    }

    const newEntry = { address: account, amount: amountStr };
    const next = [...customUsers, newEntry];
    setCustomUsers(next);
    localStorage.setItem('merkel-airdrop-custom-users', JSON.stringify(next));
    setSelectedUser(newEntry);
    setStatus(t.registerSuccess({ address: account, amount: amountStr }), 'success');
    setRegistrationOpen(false);
    setRegistrationAmount('100');
  };

  const unregister = (address) => {
    const next = customUsers.filter(u => u.address.toLowerCase() !== address.toLowerCase());
    setCustomUsers(next);
    localStorage.setItem('merkel-airdrop-custom-users', JSON.stringify(next));
    if (selectedUser?.address.toLowerCase() === address.toLowerCase()) {
      setSelectedUser(airdropData.find(u => u.address.toLowerCase() !== address.toLowerCase()) || null);
    }
  };

  const Header = () => (
    <header className="site-header">
      <nav className="topbar" aria-label={t.navigationLabel}>
        <a className="brand-mark" href="#claim" aria-label="Merkel Airdrop">
          <span className="brand-sigil" aria-hidden="true">M</span>
          <div>
            <strong>Merkel Airdrop</strong>
            <span>{t.brandSubtitle}</span>
          </div>
        </a>
        <div className="nav-links">
          <a className={page === 'claim' ? 'active' : ''} href="#claim" aria-current={page === 'claim' ? 'page' : undefined}>{t.navClaim}</a>
          <a className={page === 'guide' ? 'active' : ''} href="#guide" aria-current={page === 'guide' ? 'page' : undefined}>{t.navGuide}</a>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">{t.repo}</a>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary compact" onClick={toggleLanguage} type="button">
            {t.languageToggle}
          </button>
          <span className={`network-pill ${contractReady ? 'success' : account ? 'warning' : ''}`}>
            <span className="pulse-dot" aria-hidden="true" />
            {networkLabel}
          </span>
          <button className="btn btn-secondary compact" onClick={connectWallet} type="button">
            {account ? shortAddress(account) : t.connectWallet}
          </button>
        </div>
      </nav>
    </header>
  );

  const ClaimPage = () => (
    <Fragment>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="label">{t.eyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="hero-lede">{t.heroLede}</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={connectWallet} type="button">
              {account ? `${t.wallet} ${shortAddress(account)}` : t.connectMetamask}
            </button>
            <button className="btn btn-ghost" onClick={simulateClaim} disabled={!selectedUser} type="button">
              {t.simulateProof}
            </button>
          </div>
        </div>

        <aside className="claim-summary-card" aria-label={t.airdropSummary}>
          <div className="summary-card-header">
            <span className="label">{t.totalAllocation}</span>
            <span className="chip">{t.merkleVerified}</span>
          </div>
          <strong className="allocation-value">{formatAmount(totalAirdrop)} {tokenSymbol}</strong>
          <dl className="summary-grid">
            <div>
              <dt>{t.eligibleAccounts}</dt>
              <dd>{airdropData.length}</dd>
            </div>
            <div>
              <dt>{t.proofNodes}</dt>
              <dd>{selectedProof.length || '--'}</dd>
            </div>
            <div>
              <dt>{t.contract}</dt>
              <dd>{contractReady ? t.ready : t.demo}</dd>
            </div>
            <div>
              <dt>{t.walletLabel}</dt>
              <dd>{account ? t.connected : t.offline}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="trust-strip" aria-label="Trust indicators">
        <div>
          <span>{t.distributionModel}</span>
          <strong>Merkle Proof</strong>
        </div>
        <div>
          <span>{t.claimAsset}</span>
          <strong>{tokenSymbol}</strong>
        </div>
        <div>
          <span>{t.networkStatus}</span>
          <strong>{contractReady ? t.contractDeployed : t.demoPreview}</strong>
        </div>
        <div>
          <span>{t.replayGuard}</span>
          <strong>{hasClaimed ? t.claimed : t.available}</strong>
        </div>
      </section>

      <main className="portal-layout">
        <section className="panel execution-panel">
          <div className="section-heading">
            <p className="label">{t.workflowKicker}</p>
            <h2>{t.workflowTitle}</h2>
            <p>{t.workflowCopy}</p>
          </div>

          <div className="workflow-steps" aria-label={t.workflowTitle}>
            {t.claimSteps.map((step, index) => {
              const isDone = (index === 0 && account) || (index === 1 && selectedUser);
              const isActive = index === 2 && contractReady;
              return (
                <div key={step.title} className={`workflow-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                  <span>{isDone ? '✓' : isActive ? '●' : String(index + 1)}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedUser ? (
            <div className="selected-claim-card">
              <div className="selected-summary">
                <div>
                  <span>{t.selectedWallet}</span>
                  <strong className="mono" title={selectedUser.address}>{shortAddress(selectedUser.address)}</strong>
                </div>
                <div>
                  <span>{t.allocation}</span>
                  <strong>{selectedUser.amount} {tokenSymbol}</strong>
                </div>
                <div>
                  <span>{t.eligibility}</span>
                  <strong className="success-text">{t.verified}</strong>
                </div>
              </div>
              <div className="proof-preview">
                <div className="proof-title">
                  <div>
                    <span className="label">{t.auditTrail}</span>
                    <strong>{t.merkleProof}</strong>
                  </div>
                  <span className="chip neutral">{selectedProof.length} {t.nodes}</span>
                </div>
                <div className="proof-list">
                  {selectedProof.map((p, i) => (
                    <div key={p} className="proof-node mono">
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <code>{p}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="hint">{t.chooseAddressHint}</p>
          )}

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={claimAirdrop}
              disabled={isLoading || !account || !selectedUser || !contractReady}
              type="button"
            >
              {isLoading ? t.processing : contractReady ? t.claimOnChain : t.contractNotReady}
            </button>
            <button
              className="btn btn-secondary"
              onClick={simulateClaim}
              disabled={!selectedUser}
              type="button"
            >
              {t.simulateVerify}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setRegistrationOpen(!registrationOpen)}
              type="button"
            >
              {registrationOpen ? t.registerCancel : t.registerCta}
            </button>
          </div>

          {registrationOpen && (
            <div className="panel registration-panel" style={{ marginTop: '12px', borderColor: 'var(--amber-border)', background: 'var(--amber-glow)' }}>
              <div className="section-heading compact-heading">
                <p className="label">{t.registerLabel}</p>
                <h3>{t.registerTitle}</h3>
                <p>{t.registerCopy}</p>
              </div>
              <div className="data-row" style={{ marginBottom: '12px' }}>
                <span>{t.walletAddress}</span>
                <strong className="mono">{account || t.walletOffline}</strong>
              </div>
              <div className="data-row" style={{ marginBottom: '12px' }}>
                <span>{t.allocation}</span>
                <input
                  type="number"
                  className="mono"
                  value={registrationAmount}
                  onChange={(e) => setRegistrationAmount(e.target.value)}
                  min="1"
                  step="1"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    width: '120px',
                    textAlign: 'right',
                  }}
                />
                <span>{tokenSymbol}</span>
              </div>
              <div className="button-group" style={{ marginTop: 0 }}>
                <button className="btn btn-primary" onClick={registerForAirdrop} disabled={!account} type="button">
                  {t.registerConfirm}
                </button>
                <button className="btn btn-secondary" onClick={() => setRegistrationOpen(false)} type="button">
                  {t.registerCancel}
                </button>
              </div>
              <p className="hint" style={{ margin: '10px 0 0', fontSize: '0.78rem', border: 'none', background: 'transparent', padding: '0' }}>
                {t.registerHint}
              </p>
            </div>
          )}

          {claimStatus && (
            <div className={`status ${statusTone}`} role="status" aria-live="polite">
              <pre>{claimStatus}</pre>
            </div>
          )}
        </section>

        <aside className="side-stack" aria-label="Wallet and contract state">
          <section className="panel wallet-panel">
            <div className="section-heading compact-heading">
              <p className="label">{t.walletState}</p>
              <h2>{t.accountAndContract}</h2>
            </div>
            {account ? (
              <div className="account-stack">
                <div className="address-display mono" title={account}>{account}</div>
                <div className="data-row">
                  <span>{t.ethBalance}</span>
                  <strong>{formatAmount(balance)} ETH</strong>
                </div>
                <div className="data-row">
                  <span>{t.walletToken}</span>
                  <strong>{formatAmount(tokenBalance)} {tokenSymbol}</strong>
                </div>
                <div className="data-row">
                  <span>{t.contractReserve}</span>
                  <strong>{formatAmount(contractBalance)} {tokenSymbol}</strong>
                </div>
                <div className="data-row">
                  <span>{t.contractStatus}</span>
                  <strong className={contractReady ? 'success-text' : 'warning-text'}>{contractReady ? t.deployed : t.demoMode}</strong>
                </div>
                <div className="data-row">
                  <span>{t.claimStatus}</span>
                  <strong className={hasClaimed ? 'danger-text' : 'success-text'}>{hasClaimed ? t.claimed : t.available}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>{t.connectWalletReadState}</p>
                <button className="btn btn-primary" onClick={connectWallet} type="button">{t.connectWallet}</button>
              </div>
            )}
          </section>

          <section className="panel root-panel">
            <div className="section-heading compact-heading">
              <p className="label">Merkle Root</p>
              <h2>{t.merkleRoot}</h2>
            </div>
            <div className="root-hash mono">{merkleRoot}</div>
            <div className="root-meta">
              <span>{t.commitment}</span>
              <span>{airdropData.length} {t.eligibleAccounts.toLowerCase()}</span>
            </div>
          </section>
        </aside>

        <section className="panel roster-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="label">{t.allowlist}</p>
              <h2>{t.allowlistTitle}</h2>
              <p>{t.allowlistCopy}</p>
            </div>
            <span className="chip">{airdropData.length} {t.records}</span>
          </div>
          <div className="list-header" aria-hidden="true">
            <span>{t.walletAddress}</span>
            <span>{t.allocation}</span>
            <span>{t.status}</span>
          </div>
          <div className="list-body" role="listbox" aria-label={t.allowlistTitle}>
            {airdropData.map((item) => {
              const isSelected = selectedUser?.address === item.address;
              const isCustom = customUsers.some(u => u.address.toLowerCase() === item.address.toLowerCase());
              return (
                <div
                  key={item.address}
                  className={`list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(item)}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedUser(item); } }}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <span className="mono" title={item.address}>{item.address}</span>
                  <strong>{item.amount} {tokenSymbol}</strong>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-pill ${isSelected ? 'success' : ''}`}>{isSelected ? t.selected : t.eligible}</span>
                    {isCustom && (
                      <button
                        type="button"
                        className="btn btn-danger compact"
                        onClick={(e) => { e.stopPropagation(); unregister(item.address); }}
                        title={t.unregister}
                        style={{ padding: '0 8px', minHeight: '28px', fontSize: '0.72rem' }}
                      >
                        {t.unregister}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel explanation-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="label">{t.protocolKicker}</p>
              <h2>{t.protocolTitle}</h2>
            </div>
            <span className="chip neutral">{t.onChainVerifiable}</span>
          </div>
          <div className="assurance-grid">
            {t.protocolNotes.map((note, index) => (
              <div key={note.title} className="assurance-card">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Fragment>
  );

  const GuidePage = () => (
    <main className="guide-page">
      <section className="guide-hero panel">
        <div>
          <p className="label">{t.guideEyebrow}</p>
          <h1>{t.guideTitle}</h1>
          <p className="hero-lede">{t.guideLede}</p>
          <span className="guide-source">{t.guideSource}</span>
        </div>
        <div className="guide-actions">
          <a className="btn btn-primary anchor-btn" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            {t.guideRepoCta}
          </a>
          <a className="btn btn-secondary anchor-btn" href="#claim">
            {t.guideClaimCta}
          </a>
        </div>
      </section>

      <article className="guide-document panel">
        {guideBlocks.map((block, index) => <MarkdownBlock key={`${block.type}-${index}`} block={block} />)}
      </article>
    </main>
  );

  return (
    <div className="app-shell">
      {Header()}
      {page === 'guide' ? GuidePage() : ClaimPage()}
      <footer className="footer">
        <span>Merkel Airdrop Claim Portal</span>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">{t.repo}</a>
        <span>React + Vite + Ethers.js + MerkleTree.js</span>
      </footer>
    </div>
  );
}

export default App;
