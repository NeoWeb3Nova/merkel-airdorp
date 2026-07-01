const { ethers } = require('hardhat');

async function main() {
  // 使用 merkletree.js 生成的 root（9个地址，包含 0x52e598...）
  const merkleRoot = '0x544c58397ac6b5640c1f9a5e692d4df31709de5aaa78c8e82cd277a26d4ab7e2';

  const MerkelAirdrop = await ethers.getContractFactory('MerkelAirdrop');
  const airdrop = await MerkelAirdrop.deploy(merkleRoot);

  await airdrop.waitForDeployment();
  console.log('Airdrop deployed to:', await airdrop.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
