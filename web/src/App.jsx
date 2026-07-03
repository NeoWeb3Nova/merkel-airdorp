import { Fragment, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import guideMarkdownZh from '../../GUIDE.md?raw';
import guideMarkdownEn from '../../GUIDE.en.md?raw';
import { getMerkleRoot, getProof, airdropData } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';
import './App.css';

// 默认指向 Sepolia 真实部署；本地开发可用 VITE_AIRDROP_CONTRACT_ADDRESS / VITE_AIRDROP_TOKEN_ADDRESS 覆盖。
const CONTRACT_ADDRESS = import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS || '0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A';
const TOKEN_ADDRESS = import.meta.env.VITE_AIRDROP_TOKEN_ADDRESS || '0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC';
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
    demoConnected:
      `演示模式已连接：当前钱包网络未在 ${CONTRACT_ADDRESS} 检测到 MerkelAirdrop 合约。\n` +
      'Vercel 页面可继续使用 Proof 模拟；真实链上领取请切换到本地 Hardhat 网络，或部署合约后配置 VITE_AIRDROP_CONTRACT_ADDRESS。',
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
    connectMetamask: '连接 MetaMask',
    wallet: 'Wallet',
    simulateProof: '验证 Proof 模拟',
    airdropSummary: '空投概览',
    totalAllocation: '总空投额度',
    merkleVerified: 'Merkle 已验证',
    eligibleAccounts: '合格账户',
    proofNodes: 'Proof 节点',
    contract: '合约',
    walletLabel: '钱包',
    ready: '就绪',
    demo: '演示',
    connected: '已连接',
    offline: '离线',
    distributionModel: '分发模型',
    claimAsset: '领取资产',
    networkStatus: '网络状态',
    replayGuard: '重复领取保护',
    contractDeployed: '合约已部署',
    demoPreview: '演示 / 预览',
    claimed: '已领取',
    available: '可领取',
    workflowKicker: 'Claim Workflow',
    workflowTitle: '三步完成领取',
    workflowCopy: '从钱包连接到 Proof 验证再到链上领取，核心动作集中在同一个执行区。',
    claimSteps: [
      { title: 'Connect Wallet', description: '连接 MetaMask，读取网络、余额与链上合约状态。' },
      { title: 'Verify Eligibility', description: '选择白名单地址并生成 Merkle Proof，确认领取额度。' },
      { title: 'Claim Tokens', description: '提交链上交易，合约验证后释放 MRKL 代币。' },
    ],
    selectedWallet: '已选钱包',
    allocation: '领取额度',
    eligibility: '资格',
    verified: '已验证',
    auditTrail: '审计链路',
    merkleProof: 'Merkle Proof',
    nodes: '个节点',
    chooseAddressHint: '请先在白名单列表中选择一个领取地址。',
    processing: '交易处理中...',
    claimOnChain: '链上领取空投',
    contractNotReady: '合约未就绪',
    simulateVerify: '模拟验证',
    walletState: 'Wallet State',
    accountAndContract: '账户与合约',
    ethBalance: 'ETH 余额',
    walletToken: '钱包代币',
    contractReserve: '合约储备',
    contractStatus: '合约状态',
    claimStatus: '领取状态',
    deployed: '已部署',
    demoMode: '演示模式',
    connectWalletReadState: '连接 MetaMask 后读取链上余额、合约储备和领取状态。',
    connectWallet: '连接钱包',
    merkleRoot: '链上验证根',
    commitment: '32-byte 承诺值',
    allowlist: 'Allowlist',
    allowlistTitle: '合格领取地址',
    allowlistCopy: '选择一个地址后，执行区会同步更新额度和 Proof 审计链路。',
    records: '条记录',
    walletAddress: '钱包地址',
    status: '状态',
    selected: '已选择',
    eligible: '合格',
    protocolKicker: 'Protocol Assurance',
    protocolTitle: '为什么可信',
    onChainVerifiable: '链上可验证',
    protocolNotes: [
      { title: 'Merkle Commitment', description: '空投名单被压缩为 32-byte root，链上只存储承诺值。' },
      { title: 'Proof Verification', description: '用户提交地址、金额和 proof，合约验证路径是否匹配 root。' },
      { title: 'Gas Efficient', description: '无需把完整名单写入链上，适合大规模空投分发。' },
      { title: 'Replay Protected', description: 'hasClaimed 状态避免同一地址重复领取。' },
    ],
    guideEyebrow: 'Developer Guide',
    guideTitle: 'Merkle Tree 空投开发指南',
    guideLede: '把仓库中的 GUIDE.md 直接转为前端文档页面，便于用户在领取门户内查看完整开发流程。',
    guideSource: '内容来源：GUIDE.md',
    guideRepoCta: '查看 GitHub 项目',
    guideClaimCta: '返回领取门户',
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
    demoConnected:
      `Demo mode connected: no MerkelAirdrop contract was detected at ${CONTRACT_ADDRESS} on the current wallet network.\n` +
      'You can still use proof simulation on the Vercel page. For a real on-chain claim, switch to the local Hardhat network or deploy the contract and set VITE_AIRDROP_CONTRACT_ADDRESS.',
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
    connectMetamask: 'Connect MetaMask',
    wallet: 'Wallet',
    simulateProof: 'Simulate Proof',
    airdropSummary: 'Airdrop summary',
    totalAllocation: 'Total Allocation',
    merkleVerified: 'Merkle verified',
    eligibleAccounts: 'Eligible Accounts',
    proofNodes: 'Proof Nodes',
    contract: 'Contract',
    walletLabel: 'Wallet',
    ready: 'Ready',
    demo: 'Demo',
    connected: 'Connected',
    offline: 'Offline',
    distributionModel: 'Distribution Model',
    claimAsset: 'Claim Asset',
    networkStatus: 'Network Status',
    replayGuard: 'Replay Guard',
    contractDeployed: 'Contract Deployed',
    demoPreview: 'Demo / Preview',
    claimed: 'Claimed',
    available: 'Available',
    workflowKicker: 'Claim Workflow',
    workflowTitle: 'Claim in three steps',
    workflowCopy: 'Wallet connection, proof verification, and on-chain execution are kept in one focused workflow.',
    claimSteps: [
      { title: 'Connect Wallet', description: 'Connect MetaMask and read network, balance, and contract state.' },
      { title: 'Verify Eligibility', description: 'Select an allowlisted wallet, generate a Merkle proof, and confirm the allocation.' },
      { title: 'Claim Tokens', description: 'Submit the transaction and let the contract release MRKL tokens after verification.' },
    ],
    selectedWallet: 'Selected Wallet',
    allocation: 'Allocation',
    eligibility: 'Eligibility',
    verified: 'Verified',
    auditTrail: 'Audit Trail',
    merkleProof: 'Merkle Proof',
    nodes: 'nodes',
    chooseAddressHint: 'Select an eligible address from the allowlist first.',
    processing: 'Processing transaction...',
    claimOnChain: 'Claim on-chain',
    contractNotReady: 'Contract not ready',
    simulateVerify: 'Simulate verification',
    walletState: 'Wallet State',
    accountAndContract: 'Account and contract',
    ethBalance: 'ETH Balance',
    walletToken: 'Wallet Token',
    contractReserve: 'Contract Reserve',
    contractStatus: 'Contract Status',
    claimStatus: 'Claim Status',
    deployed: 'Deployed',
    demoMode: 'Demo Mode',
    connectWalletReadState: 'Connect MetaMask to read on-chain balance, contract reserves, and claim status.',
    connectWallet: 'Connect Wallet',
    merkleRoot: 'On-chain verification root',
    commitment: '32-byte commitment',
    allowlist: 'Allowlist',
    allowlistTitle: 'Eligible claim addresses',
    allowlistCopy: 'After selecting an address, the execution area updates the allocation and proof audit path.',
    records: 'records',
    walletAddress: 'Wallet Address',
    status: 'Status',
    selected: 'Selected',
    eligible: 'Eligible',
    protocolKicker: 'Protocol Assurance',
    protocolTitle: 'Why it is trustworthy',
    onChainVerifiable: 'On-chain verifiable',
    protocolNotes: [
      { title: 'Merkle Commitment', description: 'The airdrop list is compressed into a 32-byte root; only the commitment is stored on-chain.' },
      { title: 'Proof Verification', description: 'Users submit address, amount, and proof; the contract verifies the path against the root.' },
      { title: 'Gas Efficient', description: 'The complete list does not need to be written on-chain, making large distributions practical.' },
      { title: 'Replay Protected', description: 'The hasClaimed state prevents the same address from claiming twice.' },
    ],
    guideEyebrow: 'Developer Guide',
    guideTitle: 'Merkle Tree airdrop developer guide',
    guideLede: 'The repository GUIDE.md is rendered as a first-party documentation page so users can review the complete build process inside the portal.',
    guideSource: 'Source: GUIDE.en.md',
    guideRepoCta: 'View GitHub project',
    guideClaimCta: 'Back to claim portal',
  },
};

const formatAmount = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
const shortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
const totalAirdrop = airdropData.reduce((sum, item) => sum + Number(item.amount), 0);

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

  const t = translations[language];
  const guideMarkdown = language === 'zh' ? guideMarkdownZh : guideMarkdownEn;
  const guideBlocks = useMemo(() => parseMarkdown(guideMarkdown), [guideMarkdown]);
  const selectedProof = selectedUser ? getProof(selectedUser.address, selectedUser.amount) : [];

  useEffect(() => {
    const root = getMerkleRoot();
    setMerkleRoot(root);
  }, []);

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
      alert(t.installMetamask);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const network = await provider.getNetwork();
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
      const message = t.connectFailed + (err.reason || err.message || err);
      alert(message);
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
      alert(message);
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
          <button className="btn btn-secondary compact" onClick={connectWallet}>
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
            <button className="btn btn-primary" onClick={connectWallet}>
              {account ? `${t.wallet} ${shortAddress(account)}` : t.connectMetamask}
            </button>
            <button className="btn btn-ghost" onClick={simulateClaim} disabled={!selectedUser}>
              {t.simulateProof}
            </button>
            <a className="btn btn-ghost anchor-btn" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              {t.repo}
            </a>
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
            >
              {isLoading ? t.processing : contractReady ? t.claimOnChain : t.contractNotReady}
            </button>
            <button
              className="btn btn-secondary"
              onClick={simulateClaim}
              disabled={!selectedUser}
            >
              {t.simulateVerify}
            </button>
          </div>

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
                <button className="btn btn-primary" onClick={connectWallet}>{t.connectWallet}</button>
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
              return (
                <button
                  key={item.address}
                  type="button"
                  className={`list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(item)}
                  aria-selected={isSelected}
                  role="option"
                >
                  <span className="mono" title={item.address}>{item.address}</span>
                  <strong>{item.amount} {tokenSymbol}</strong>
                  <span className={`status-pill ${isSelected ? 'success' : ''}`}>{isSelected ? t.selected : t.eligible}</span>
                </button>
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
      <Header />
      {page === 'guide' ? <GuidePage /> : <ClaimPage />}
      <footer className="footer">
        <span>Merkel Airdrop Claim Portal</span>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">{t.repo}</a>
        <span>React + Vite + Ethers.js + MerkleTree.js</span>
      </footer>
    </div>
  );
}

export default App;
