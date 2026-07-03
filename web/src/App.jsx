import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getMerkleRoot, getProof, airdropData } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';
import './App.css';

// 默认指向 Sepolia 真实部署；本地开发可用 VITE_AIRDROP_CONTRACT_ADDRESS / VITE_AIRDROP_TOKEN_ADDRESS 覆盖。
const CONTRACT_ADDRESS = import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS || '0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A';
const TOKEN_ADDRESS = import.meta.env.VITE_AIRDROP_TOKEN_ADDRESS || '0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC';
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const formatAmount = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
const shortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
const totalAirdrop = airdropData.reduce((sum, item) => sum + Number(item.amount), 0);
const claimSteps = [
  { title: 'Connect Wallet', description: '连接 MetaMask，读取网络、余额与链上合约状态。' },
  { title: 'Verify Eligibility', description: '选择白名单地址并生成 Merkle Proof，确认领取额度。' },
  { title: 'Claim Tokens', description: '提交链上交易，合约验证后释放 MRKL 代币。' },
];
const protocolNotes = [
  { title: 'Merkle Commitment', description: '空投名单被压缩为 32-byte root，链上只存储承诺值。' },
  { title: 'Proof Verification', description: '用户提交地址、金额和 proof，合约验证路径是否匹配 root。' },
  { title: 'Gas Efficient', description: '无需把完整名单写入链上，适合大规模空投分发。' },
  { title: 'Replay Protected', description: 'hasClaimed 状态避免同一地址重复领取。' },
];
const getNetworkLabel = (network) => {
  if (!network) return 'Wallet Offline';
  const chainId = network.chainId.toString();
  if (chainId === '31337' || chainId === '1337') return `Hardhat Local · ${chainId}`;
  return `${network.name === 'unknown' ? 'EVM Network' : network.name} · ${chainId}`;
};

function App() {
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
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(airdropData[0]);
  const [networkLabel, setNetworkLabel] = useState('Wallet Offline');
  const [contractReady, setContractReady] = useState(false);

  useEffect(() => {
    const root = getMerkleRoot();
    setMerkleRoot(root);
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('请安装 MetaMask!');
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
      setNetworkLabel(getNetworkLabel(network));
      setContractReady(hasDeployedContract);

      // 获取账户余额
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));

      if (!hasDeployedContract) {
        setContractBalance('0');
        setTokenBalance('0');
        setHasClaimed(false);
        setClaimStatus(
          `演示模式已连接：当前钱包网络未在 ${CONTRACT_ADDRESS} 检测到 MerkelAirdrop 合约。\n` +
          'Vercel 页面可继续使用 Proof 模拟；真实链上领取请切换到本地 Hardhat 网络，或部署合约后配置 VITE_AIRDROP_CONTRACT_ADDRESS。'
        );
        return;
      }

      // 获取 ERC20 代币余额
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

      // 检查是否已领取
      const claimed = await contract.hasClaimed(address);
      setHasClaimed(claimed);
      setClaimStatus('钱包已连接，链上合约已就绪。');
    } catch (err) {
      alert('连接失败: ' + (err.reason || err.message || err));
      setClaimStatus('连接失败: ' + (err.reason || err.message || err));
    }
  };

  const claimAirdrop = async () => {
    if (!contract || !account) {
      setClaimStatus('当前网络未检测到可交互的 MerkelAirdrop 合约，请先部署/切换网络，或使用模拟领取。');
      return;
    }
    if (!selectedUser) {
      setClaimStatus('请先选择一个空投用户');
      return;
    }

    setIsLoading(true);
    setClaimStatus('');

    try {
      const amount = selectedUser.amount;
      const amountWei = ethers.parseEther(amount);
      
      // 获取 Merkle Proof
      const proof = getProof(account, amount);
      
      if (proof.length === 0) {
        setClaimStatus('该地址不在空投列表中，无法生成有效 proof');
        setIsLoading(false);
        return;
      }

      console.log('Claiming with proof:', proof);
      console.log('Amount:', amountWei.toString());

      const tx = await contract.claim(proof, amountWei);
      setClaimStatus('交易已提交，等待确认...');
      
      await tx.wait();
      
      setClaimStatus('空投领取成功!');
      setHasClaimed(true);
      
      // 更新余额
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
      alert('领取失败: ' + (err.reason || err.message || err));
      setClaimStatus('领取失败: ' + (err.reason || err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  // 模拟模式：模拟领取
  const simulateClaim = () => {
    if (!selectedUser) {
      setClaimStatus('请先选择一个空投用户');
      return;
    }

    const proof = getProof(selectedUser.address, selectedUser.amount);
    
    if (proof.length === 0) {
      setClaimStatus('该地址不在空投列表中，无法生成有效 proof');
      return;
    }

    setClaimStatus(`模拟领取成功!\n地址: ${selectedUser.address}\n金额: ${selectedUser.amount} ${tokenSymbol}\nProof 节点数: ${proof.length}`);
  };

  const selectedProof = selectedUser ? getProof(selectedUser.address, selectedUser.amount) : [];
  const isSuccess = claimStatus.includes('成功') || claimStatus.includes('提交') || claimStatus.includes('已连接') || claimStatus.includes('已就绪');
  const isNotice = claimStatus.includes('演示模式') || claimStatus.includes('未检测到');

  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="topbar" aria-label="Merkle airdrop portal">
          <div className="brand-mark">
            <span className="brand-sigil" aria-hidden="true">M</span>
            <div>
              <strong>Merkel Airdrop</strong>
              <span>Verified Claim Portal</span>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`network-pill ${contractReady ? 'success' : account ? 'warning' : ''}`}>
              <span className="pulse-dot" aria-hidden="true" />
              {networkLabel}
            </span>
            <button className="btn btn-secondary compact" onClick={connectWallet}>
              {account ? shortAddress(account) : 'Connect Wallet'}
            </button>
          </div>
        </nav>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Institutional Web3 Distribution</p>
            <h1>可信金融级空投领取门户</h1>
            <p className="hero-lede">
              以链上透明度和可审计 Proof 为核心，重构钱包连接、资格验证与领取执行路径，让客户和用户都能清楚判断当前网络、合约与领取状态。
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={connectWallet}>
                {account ? `Wallet ${shortAddress(account)}` : '连接 MetaMask'}
              </button>
              <button className="btn btn-ghost" onClick={simulateClaim} disabled={!selectedUser}>
                验证 Proof 模拟
              </button>
            </div>
          </div>

          <aside className="claim-summary-card" aria-label="Airdrop summary">
            <div className="summary-card-header">
              <span className="label">Total Allocation</span>
              <span className="chip">Merkle verified</span>
            </div>
            <strong className="allocation-value">{formatAmount(totalAirdrop)} {tokenSymbol}</strong>
            <dl className="summary-grid">
              <div>
                <dt>Eligible Accounts</dt>
                <dd>{airdropData.length}</dd>
              </div>
              <div>
                <dt>Proof Nodes</dt>
                <dd>{selectedProof.length || '--'}</dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd>{contractReady ? 'Ready' : 'Demo'}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{account ? 'Connected' : 'Offline'}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="trust-strip" aria-label="Trust indicators">
          <div>
            <span>Distribution Model</span>
            <strong>Merkle Proof</strong>
          </div>
          <div>
            <span>Claim Asset</span>
            <strong>{tokenSymbol}</strong>
          </div>
          <div>
            <span>Network Status</span>
            <strong>{contractReady ? 'Contract Deployed' : 'Demo / Preview'}</strong>
          </div>
          <div>
            <span>Replay Guard</span>
            <strong>{hasClaimed ? 'Claimed' : 'Available'}</strong>
          </div>
        </section>
      </header>

      <main className="portal-layout">
        <section className="panel execution-panel">
          <div className="section-heading">
            <p className="kicker">Claim Workflow</p>
            <h2>三步完成领取</h2>
            <p>从钱包连接到 Proof 验证再到链上领取，核心动作集中在同一个执行区。</p>
          </div>

          <div className="workflow-steps" aria-label="Claim workflow steps">
            {claimSteps.map((step, index) => (
              <div key={step.title} className={`workflow-step ${index === 0 && account ? 'done' : ''} ${index === 1 && selectedUser ? 'done' : ''} ${index === 2 && contractReady ? 'active' : ''}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {selectedUser ? (
            <div className="selected-claim-card">
              <div className="selected-summary">
                <div>
                  <span>Selected Wallet</span>
                  <strong className="mono" title={selectedUser.address}>{shortAddress(selectedUser.address)}</strong>
                </div>
                <div>
                  <span>Allocation</span>
                  <strong>{selectedUser.amount} {tokenSymbol}</strong>
                </div>
                <div>
                  <span>Eligibility</span>
                  <strong className="success-text">Verified</strong>
                </div>
              </div>
              <div className="proof-preview">
                <div className="proof-title">
                  <div>
                    <span className="label">Audit Trail</span>
                    <strong>Merkle Proof</strong>
                  </div>
                  <span className="chip neutral">{selectedProof.length} nodes</span>
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
            <p className="hint">请先在白名单列表中选择一个领取地址。</p>
          )}

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={claimAirdrop}
              disabled={isLoading || !account || !selectedUser || !contractReady}
            >
              {isLoading ? '交易处理中...' : contractReady ? '链上领取空投' : '合约未就绪'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={simulateClaim}
              disabled={!selectedUser}
            >
              模拟验证
            </button>
          </div>

          {claimStatus && (
            <div className={`status ${isNotice ? 'notice' : isSuccess ? 'success' : 'error'}`} role="status" aria-live="polite">
              <pre>{claimStatus}</pre>
            </div>
          )}
        </section>

        <aside className="side-stack" aria-label="Wallet and contract state">
          <section className="panel wallet-panel">
            <div className="section-heading compact-heading">
              <p className="kicker">Wallet State</p>
              <h2>账户与合约</h2>
            </div>
            {account ? (
              <div className="account-stack">
                <div className="address-display mono" title={account}>{account}</div>
                <div className="data-row">
                  <span>ETH Balance</span>
                  <strong>{formatAmount(balance)} ETH</strong>
                </div>
                <div className="data-row">
                  <span>Wallet Token</span>
                  <strong>{formatAmount(tokenBalance)} {tokenSymbol}</strong>
                </div>
                <div className="data-row">
                  <span>Contract Reserve</span>
                  <strong>{formatAmount(contractBalance)} {tokenSymbol}</strong>
                </div>
                <div className="data-row">
                  <span>Contract Status</span>
                  <strong className={contractReady ? 'success-text' : 'warning-text'}>{contractReady ? 'Deployed' : 'Demo Mode'}</strong>
                </div>
                <div className="data-row">
                  <span>Claim Status</span>
                  <strong className={hasClaimed ? 'danger-text' : 'success-text'}>{hasClaimed ? 'Claimed' : 'Available'}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>连接 MetaMask 后读取链上余额、合约储备和领取状态。</p>
                <button className="btn btn-primary" onClick={connectWallet}>连接钱包</button>
              </div>
            )}
          </section>

          <section className="panel root-panel">
            <div className="section-heading compact-heading">
              <p className="kicker">Merkle Root</p>
              <h2>链上验证根</h2>
            </div>
            <div className="root-hash mono">{merkleRoot}</div>
            <div className="root-meta">
              <span>32-byte commitment</span>
              <span>{airdropData.length} eligible accounts</span>
            </div>
          </section>
        </aside>

        <section className="panel roster-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="kicker">Allowlist</p>
              <h2>合格领取地址</h2>
              <p>选择一个地址后，执行区会同步更新额度和 Proof 审计链路。</p>
            </div>
            <span className="chip">{airdropData.length} records</span>
          </div>
          <div className="list-header" aria-hidden="true">
            <span>Wallet Address</span>
            <span>Allocation</span>
            <span>Status</span>
          </div>
          <div className="list-body" role="listbox" aria-label="空投合格地址列表">
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
                  <span className={`status-pill ${isSelected ? 'success' : ''}`}>{isSelected ? 'Selected' : 'Eligible'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel explanation-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="kicker">Protocol Assurance</p>
              <h2>为什么可信</h2>
            </div>
            <span className="chip neutral">On-chain verifiable</span>
          </div>
          <div className="assurance-grid">
            {protocolNotes.map((note, index) => (
              <div key={note.title} className="assurance-card">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Merkel Airdrop Claim Portal</span>
        <span>React + Vite + Ethers.js + MerkleTree.js</span>
      </footer>
    </div>
  );
}

export default App;
