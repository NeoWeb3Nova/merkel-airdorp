const { ethers } = require('hardhat');
const { getMerkleRoot, airdropData } = require('./merkletree.cjs');

const AIRDROP = '0xC4c8D8ce56cDFC9b592F01A300Bdc19b6463563A';
const TOKEN = '0xd6dB4Efd0Aea1763eD421D4Fa94C123B4E21D8BC';

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const airdrop = await ethers.getContractAt('MerkelAirdrop', AIRDROP);
  const token = await ethers.getContractAt('AirdropToken', TOKEN);
  const newRoot = getMerkleRoot();
  const total = airdropData.reduce((sum, item) => sum + ethers.parseEther(item.amount), 0n);
  const currentRoot = await airdrop.merkleRoot();
  const currentSupply = await token.totalSupply();
  const currentBalance = await token.balanceOf(AIRDROP);

  console.log('Chain ID:', net.chainId.toString());
  console.log('Deployer:', await deployer.getAddress());
  console.log('Airdrop:', AIRDROP);
  console.log('Token:', TOKEN);
  console.log('Old root:', currentRoot);
  console.log('New root:', newRoot);
  console.log('Current supply:', ethers.formatEther(currentSupply), 'MRKL');
  console.log('Current airdrop balance:', ethers.formatEther(currentBalance), 'MRKL');
  console.log('Target supply:', ethers.formatEther(total), 'MRKL');
  console.log('Per-user allocations:');
  for (const item of airdropData) {
    console.log(' ', item.address, item.amount, 'MRKL', 'claimed=', await airdrop.hasClaimed(item.address));
  }

  if (currentRoot.toLowerCase() !== newRoot.toLowerCase()) {
    console.log('[1/3] Updating Merkle root...');
    const tx = await airdrop.setMerkleRoot(newRoot);
    console.log('setMerkleRoot tx:', tx.hash);
    await tx.wait();
  } else {
    console.log('[1/3] Merkle root already updated');
  }

  if (currentSupply < total) {
    const mintAmount = total - currentSupply;
    console.log('[2/3] Minting additional', ethers.formatEther(mintAmount), 'MRKL to airdrop...');
    const tx = await token.mint(AIRDROP, mintAmount);
    console.log('mint tx:', tx.hash);
    await tx.wait();
  } else {
    console.log('[2/3] Supply already >= target');
  }

  console.log('[3/3] Syncing recorded airdrop amount...');
  const syncTx = await airdrop.syncAirdropAmount();
  console.log('sync tx:', syncTx.hash);
  await syncTx.wait();

  console.log('Final root:', await airdrop.merkleRoot());
  console.log('Final supply:', ethers.formatEther(await token.totalSupply()), 'MRKL');
  console.log('Final airdrop balance:', ethers.formatEther(await token.balanceOf(AIRDROP)), 'MRKL');
  console.log('Final recorded totalAirdropAmount:', ethers.formatEther(await airdrop.totalAirdropAmount()), 'MRKL');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
