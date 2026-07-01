const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// 示例空投列表: [地址, 金额]
const airdropList = [
  ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', ethers.parseEther('1.0')],
  ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', ethers.parseEther('2.0')],
  ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', ethers.parseEther('0.5')],
];

// 生成叶子节点
const leaves = airdropList.map(([addr, amount]) =>
  keccak256(Buffer.from(addr.slice(2) + amount.toString(16).padStart(64, '0'), 'hex'))
);

const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = tree.getHexRoot();

console.log('Merkle Root:', root);

// 为某个地址生成 proof
function getProof(address, amount) {
  const leaf = keccak256(Buffer.from(address.slice(2) + amount.toString(16).padStart(64, '0'), 'hex'));
  return tree.getHexProof(leaf);
}

module.exports = { tree, root, getProof, airdropList };
