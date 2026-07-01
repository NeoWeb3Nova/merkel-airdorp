import { ethers } from 'ethers';

// Example airdrop data (all checksummed addresses)
const airdropData = [
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', amount: '1.0' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', amount: '2.0' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', amount: '0.5' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', amount: '3.0' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', amount: '1.5' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', amount: '2.5' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', amount: '0.8' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', amount: '1.2' },
  { address: '0x52e598665a4eC24D671F5EeE8dDA970166C859c8', amount: '1.0' },
];

// Hash leaf: keccak256(abi.encodePacked(address, uint256))
function hashLeaf(address, amount) {
  return ethers.solidityPackedKeccak256(['address', 'uint256'], [address, ethers.parseEther(amount)]);
}

// Hash two nodes together with pair sorting (like OpenZeppelin hashsort)
function hashPair(a, b) {
  const [left, right] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  const leftBytes = ethers.getBytes(left);
  const rightBytes = ethers.getBytes(right);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return ethers.keccak256(combined);
}

// Build Merkle tree layers
function buildTree(leaves) {
  let layers = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const layer = layers[layers.length - 1];
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        nextLayer.push(hashPair(layer[i], layer[i + 1]));
      } else {
        // Odd leaf: promote to next level without rehashing
        nextLayer.push(layer[i]);
      }
    }
    layers.push(nextLayer);
  }
  return layers;
}

// Generate Merkle Tree
export function generateMerkleTree() {
  const leaves = airdropData.map(item => hashLeaf(item.address, item.amount));
  const layers = buildTree(leaves);
  return { layers, data: airdropData };
}

// Get Merkle Root
export function getMerkleRoot() {
  const { layers } = generateMerkleTree();
  return layers[layers.length - 1][0];
}

// Get proof for a specific address/amount
export function getProof(address, amount) {
  const leaves = airdropData.map(item => hashLeaf(item.address, item.amount));
  const targetLeaf = hashLeaf(address, amount);
  
  // Find index of target leaf
  let index = -1;
  for (let i = 0; i < leaves.length; i++) {
    if (leaves[i] === targetLeaf) {
      index = i;
      break;
    }
  }
  
  if (index === -1) return []; // Not in list
  
  const layers = buildTree(leaves);
  const proof = [];
  
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }
    index = Math.floor(index / 2);
  }
  
  return proof;
}

// Verify proof locally (for testing)
export function verifyProof(root, proof, address, amount) {
  let hash = hashLeaf(address, amount);
  for (const p of proof) {
    const [left, right] = BigInt(hash) <= BigInt(p) ? [hash, p] : [p, hash];
    const leftBytes = ethers.getBytes(left);
    const rightBytes = ethers.getBytes(right);
    const combined = new Uint8Array(leftBytes.length + rightBytes.length);
    combined.set(leftBytes, 0);
    combined.set(rightBytes, leftBytes.length);
    hash = ethers.keccak256(combined);
  }
  return hash === root;
}

export { airdropData };
