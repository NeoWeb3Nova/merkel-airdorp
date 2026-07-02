import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getMerkleRoot, getProof, airdropData } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';
import './App.css';

// 默认是本地 Hardhat 部署地址；生产环境可用 VITE_AIRDROP_CONTRACT_ADDRESS 覆盖。
const CONTRACT_ADDRESS = import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const formatEth = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
const shortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
const totalAirdrop = airdropData.reduce((sum, item) => sum + Number(item.amount), 0);
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
  const [contractBalance, setContractBalance] = useState('0');
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
        setHasClaimed(false);
        setClaimStatus(
          `演示模式已连接：当前钱包网络未在 ${CONTRACT_ADDRESS} 检测到 MerkelAirdrop 合约。\n` +
          'Vercel 页面可继续使用 Proof 模拟；真实链上领取请切换到本地 Hardhat 网络，或部署合约后配置 VITE_AIRDROP_CONTRACT_ADDRESS。'
        );
        return;
      }

      // 获取合约余额
      const cb = await provider.getBalance(CONTRACT_ADDRESS);
      setContractBalance(ethers.formatEther(cb));

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
      const cb = await provider.getBalance(CONTRACT_ADDRESS);
      setContractBalance(ethers.formatEther(cb));
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

    setClaimStatus(`模拟领取成功!\n地址: ${selectedUser.address}\n金额: ${selectedUser.amount} ETH\nProof 节点数: ${proof.length}`);
  };

  const selectedProof = selectedUser ? getProof(selectedUser.address, selectedUser.amount) : [];
  const isSuccess = claimStatus.includes('成功') || claimStatus.includes('提交') || claimStatus.includes('已连接') || claimStatus.includes('已就绪');
  const isNotice = claimStatus.includes('演示模式') || claimStatus.includes('未检测到');

  return (
    <div className="app-shell">
      <div className="cyber-grid" aria-hidden="true" />
      <div className="scanline" aria-hidden="true" />

      <header className="hero-panel">
        <nav className="topbar" aria-label="Merkle airdrop status">
          <div className="brand-mark">
            <span className="brand-sigil" aria-hidden="true">M</span>
            <span>Merkel Airdrop</span>
          </div>
          <div className="network-pill">
            <span className="pulse-dot" aria-hidden="true" />
            {networkLabel}
          </div>
        </nav>

        <section className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">CYBERPUNK CLAIM TERMINAL / MERKLE VERIFIED</p>
            <h1>空投领取控制台</h1>
            <p className="hero-lede">
              面向 Web3 客户演示的霓虹朋克版 Merkle Tree Airdrop：钱包连接、白名单选择、Proof 预览与链上领取路径集中在一个高可信操作界面。
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={connectWallet}>
                {account ? `已连接 ${shortAddress(account)}` : '连接 MetaMask'}
              </button>
              <button className="btn btn-secondary" onClick={simulateClaim} disabled={!selectedUser}>
                运行 Proof 模拟
              </button>
            </div>
          </div>

          <aside className="terminal-card" aria-label="Airdrop telemetry">
            <div className="terminal-header">
              <span>CLAIM_TELEMETRY</span>
              <span className="terminal-status">LIVE</span>
            </div>
            <dl className="metrics-grid">
              <div>
                <dt>Eligible Nodes</dt>
                <dd>{airdropData.length}</dd>
              </div>
              <div>
                <dt>Total Drop</dt>
                <dd>{formatEth(totalAirdrop)} ETH</dd>
              </div>
              <div>
                <dt>Proof Depth</dt>
                <dd>{selectedProof.length || '--'}</dd>
              </div>
              <div>
                <dt>Wallet State</dt>
                <dd>{account ? 'SYNCED' : 'OFFLINE'}</dd>
              </div>
            </dl>
          </aside>
        </section>
      </header>

      <main className="main-grid">
        <section className="panel wallet-panel">
          <div className="section-heading">
            <p className="kicker">01 / Wallet Link</p>
            <h2>钱包连接</h2>
          </div>
          {account ? (
            <div className="account-stack">
              <div className="address-display mono" title={account}>{account}</div>
              <div className="data-row">
                <span>账户余额</span>
                <strong>{formatEth(balance)} ETH</strong>
              </div>
              <div className="data-row">
                <span>合约余额</span>
                <strong>{formatEth(contractBalance)} ETH</strong>
              </div>
              <div className="data-row">
                <span>合约状态</span>
                <strong className={contractReady ? 'success-text' : 'warning-text'}>{contractReady ? '已部署' : '演示模式'}</strong>
              </div>
              <div className="data-row">
                <span>领取状态</span>
                <strong className={hasClaimed ? 'danger-text' : 'success-text'}>{hasClaimed ? '已领取' : '未领取'}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>连接 MetaMask 后读取链上余额与领取状态。</p>
              <button className="btn btn-primary" onClick={connectWallet}>连接钱包</button>
            </div>
          )}
        </section>

        <section className="panel root-panel">
          <div className="section-heading">
            <p className="kicker">02 / Merkle Root</p>
            <h2>链上验证根</h2>
          </div>
          <div className="root-hash mono">{merkleRoot}</div>
          <div className="root-meta">
            <span>32-byte commitment</span>
            <span>{airdropData.length} eligible accounts</span>
          </div>
        </section>

        <section className="panel roster-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="kicker">03 / Allowlist Matrix</p>
              <h2>空投合格列表</h2>
            </div>
            <span className="chip">Select one node</span>
          </div>
          <div className="list-header" aria-hidden="true">
            <span>地址</span>
            <span>金额</span>
            <span>状态</span>
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
                  <strong>{item.amount} ETH</strong>
                  <span className="status-pill">{isSelected ? 'LOCKED' : 'READY'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel claim-panel">
          <div className="section-heading">
            <p className="kicker">04 / Claim Execution</p>
            <h2>领取空投</h2>
          </div>
          {selectedUser ? (
            <div className="selected-info">
              <div className="selected-summary">
                <div>
                  <span>Selected Wallet</span>
                  <strong className="mono" title={selectedUser.address}>{shortAddress(selectedUser.address)}</strong>
                </div>
                <div>
                  <span>Allocation</span>
                  <strong>{selectedUser.amount} ETH</strong>
                </div>
              </div>
              <div className="proof-preview">
                <div className="proof-title">
                  <strong>Merkle Proof Stream</strong>
                  <span>{selectedProof.length} nodes</span>
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
            <p className="hint">请先在左侧白名单矩阵中选择一个用户。</p>
          )}
          
          <div className="button-group">
            <button 
              className="btn btn-primary" 
              onClick={claimAirdrop}
              disabled={isLoading || !account || !selectedUser || !contractReady}
            >
              {isLoading ? '处理中...' : contractReady ? '连接钱包领取' : '链上合约未就绪'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={simulateClaim}
              disabled={!selectedUser}
            >
              模拟领取
            </button>
          </div>

          {claimStatus && (
            <div className={`status ${isNotice ? 'notice' : isSuccess ? 'success' : 'error'}`} role="status" aria-live="polite">
              <pre>{claimStatus}</pre>
            </div>
          )}
        </section>

        <section className="panel explanation-panel">
          <div className="section-heading split-heading">
            <div>
              <p className="kicker">05 / Protocol Flow</p>
              <h2>工作原理</h2>
            </div>
            <span className="chip">Gas efficient</span>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-content">
                <h3>生成 Merkle Tree</h3>
                <p>将所有空投用户（地址 + 金额）作为叶子节点，上层节点逐层哈希合并，最终生成唯一的 Merkle Root。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-content">
                <h3>部署到链上</h3>
                <p>将 Merkle Root 写入智能合约，每个用户的领取验证都基于这个公开的 root。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-content">
                <h3>领取验证</h3>
                <p>用户提供自己的地址、金额和 Merkle Proof，合约递归验证该用户确实在空投列表中。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <div className="step-content">
                <h3>节省 Gas</h3>
                <p>无需在链上存储整个空投列表，只需一个 32 bytes 的 root，大幅降低存储和查询成本。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Merkel Airdrop Demo</span>
        <span>React + Vite + Ethers.js + MerkleTree.js</span>
      </footer>
    </div>
  );
}

export default App;
