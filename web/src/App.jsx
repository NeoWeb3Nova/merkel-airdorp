import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getMerkleRoot, getProof, airdropData } from './utils/merkletree';
import ABI from './abi/MerkelAirdrop.json';
import './App.css';

// 本地 Hardhat 网络默认合约地址（可修改）
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

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
  const [selectedUser, setSelectedUser] = useState(null);

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
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      setAccount(address);
      setProvider(provider);
      setContract(contract);

      // 获取账户余额
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));

      // 获取合约余额
      const cb = await provider.getBalance(CONTRACT_ADDRESS);
      setContractBalance(ethers.formatEther(cb));

      // 检查是否已领取
      const claimed = await contract.hasClaimed(address);
      setHasClaimed(claimed);
    } catch (err) {
      console.error('Connection error:', err);
      setClaimStatus('连接失败: ' + err.message);
    }
  };

  const claimAirdrop = async () => {
    if (!contract || !account) return;
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
      console.error('Claim error:', err);
      setClaimStatus('领取失败: ' + (err.reason || err.message));
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

  return (
    <div className="app">
      <header className="header">
        <h1> Merkle Tree Airdrop</h1>
        <p className="subtitle">基于 Merkle Tree 的空投领取演示</p>
      </header>

      <main className="main">
        {/* 连接钱包 */}
        <section className="card connect-section">
          <h2>钱包连接</h2>
          {account ? (
            <div className="account-info">
              <p><strong>连接地址:</strong> {account}</p>
              <p><strong>账户余额:</strong> {balance} ETH</p>
              <p><strong>空投合约余额:</strong> {contractBalance} ETH</p>
              <p><strong>已领取:</strong> {hasClaimed ? '是' : '否'}</p>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              连接 MetaMask
            </button>
          )}
        </section>

        {/* Merkle Tree 信息 */}
        <section className="card merkle-info">
          <h2>Merkle Tree 信息</h2>
          <div className="info-row">
            <span className="label">Merkle Root:</span>
            <span className="value mono">{merkleRoot}</span>
          </div>
          <div className="info-row">
            <span className="label">空投用户总数:</span>
            <span className="value">{airdropData.length}</span>
          </div>
        </section>

        {/* 空投列表 */}
        <section className="card airdrop-list">
          <h2>空投合格列表</h2>
          <p className="hint">点击选择一个用户，然后点击领取（模拟模式直接演示）</p>
          <div className="list-header">
            <span>地址</span>
            <span>金额 (ETH)</span>
            <span>状态</span>
          </div>
          <div className="list-body">
            {airdropData.map((item, index) => (
              <div
                key={index}
                className={`list-item ${selectedUser?.address === item.address ? 'selected' : ''}`}
                onClick={() => setSelectedUser(item)}
              >
                <span className="mono">{item.address}</span>
                <span>{item.amount}</span>
                <span>{selectedUser?.address === item.address ? '已选中' : '-'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 领取操作 */}
        <section className="card claim-section">
          <h2>领取空投</h2>
          {selectedUser && (
            <div className="selected-info">
              <p><strong>选中用户:</strong> {selectedUser.address}</p>
              <p><strong>可领金额:</strong> {selectedUser.amount} ETH</p>
              {(() => {
                const proof = getProof(selectedUser.address, selectedUser.amount);
                return (
                  <div className="proof-preview">
                    <p><strong>Merkle Proof:</strong></p>
                    <div className="proof-list">
                      {proof.map((p, i) => (
                        <div key={i} className="proof-node mono">
                          {p}
                        </div>
                      ))}
                    </div>
                    <p className="proof-count">Proof 节点数: {proof.length}</p>
                  </div>
                );
              })()}
            </div>
          )}
          
          <div className="button-group">
            <button 
              className="btn btn-primary" 
              onClick={claimAirdrop}
              disabled={isLoading || !account || !selectedUser}
            >
              {isLoading ? '处理中...' : '连接钱包领取'}
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
            <div className={`status ${claimStatus.includes('成功') ? 'success' : 'error'}`}>
              <pre>{claimStatus}</pre>
            </div>
          )}
        </section>

        {/* 原理说明 */}
        <section className="card explanation">
          <h2>工作原理</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-content">
                <h3>生成 Merkle Tree</h3>
                <p>将所有空投用户（地址 + 金额）作为叶子节点，上层节点逐层哈希合并，最终生成唯一的 Merkle Root。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-content">
                <h3>部署到链上</h3>
                <p>将 Merkle Root 写入智能合约，每个用户的领取验证都基于这个公开的 root。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-content">
                <h3>领取验证</h3>
                <p>用户提供自己的地址、金额和 Merkle Proof，合约通过递归验证确认该用户确实在空投列表中。</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">4</div>
              <div className="step-content">
                <h3>节省 Gas</h3>
                <p>无需在链上存储整个空投列表，只需一个 32 bytes 的 root，大幅降低存储和查询成本。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Merkel Airdrop Demo - 基于 React + Vite + Ethers.js + MerkleTree.js</p>
      </footer>
    </div>
  );
}

export default App;
