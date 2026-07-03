const { ethers } = require('hardhat');
const { getMerkleRoot, airdropData } = require('./merkletree.cjs');

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const deployerAddress = await deployer.getAddress();
  const merkleRoot = getMerkleRoot();
  const totalAirdrop = airdropData.reduce((sum, item) => sum + ethers.parseEther(item.amount), 0n);

  console.log('Chain ID:', network.chainId.toString());
  console.log('Deployer:', deployerAddress);
  console.log('Deployer ETH balance:', ethers.formatEther(await ethers.provider.getBalance(deployerAddress)));
  console.log('Merkle root:', merkleRoot);
  console.log('Eligible accounts:', airdropData.length);
  console.log('Total ERC20 airdrop:', ethers.formatEther(totalAirdrop), 'MRKL');

  console.log('[1/3] Deploying AirdropToken...');
  const Token = await ethers.getContractFactory('AirdropToken');
  const token = await Token.deploy(deployerAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('AIRDROP_TOKEN_ADDRESS=' + tokenAddress);

  console.log('[2/3] Deploying MerkelAirdrop...');
  const MerkelAirdrop = await ethers.getContractFactory('MerkelAirdrop');
  const airdrop = await MerkelAirdrop.deploy(tokenAddress, merkleRoot);

  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log('AIRDROP_CONTRACT_ADDRESS=' + airdropAddress);

  console.log('[3/3] Minting ERC20 tokens into airdrop contract...');
  const mintTx = await token.mint(airdropAddress, totalAirdrop);
  await mintTx.wait();
  const syncTx = await airdrop.syncAirdropAmount();
  await syncTx.wait();

  console.log('Airdrop token balance:', ethers.formatEther(await token.balanceOf(airdropAddress)), 'MRKL');
  console.log('Recorded totalAirdropAmount:', ethers.formatEther(await airdrop.totalAirdropAmount()), 'MRKL');
  console.log('VITE_AIRDROP_CONTRACT_ADDRESS=' + airdropAddress);
  console.log('VITE_AIRDROP_TOKEN_ADDRESS=' + tokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
