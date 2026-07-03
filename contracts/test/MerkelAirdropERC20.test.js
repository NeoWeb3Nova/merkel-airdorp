const { expect } = require('chai');
const { ethers } = require('hardhat');

function hashLeaf(address, amount) {
  return ethers.solidityPackedKeccak256(['address', 'uint256'], [address, amount]);
}

function hashPair(a, b) {
  const [left, right] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([left, right]));
}

function buildTree(leaves) {
  const layers = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const layer = layers[layers.length - 1];
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      nextLayer.push(i + 1 < layer.length ? hashPair(layer[i], layer[i + 1]) : layer[i]);
    }
    layers.push(nextLayer);
  }
  return layers;
}

function getProof(leaves, targetIndex) {
  const layers = buildTree(leaves);
  const proof = [];
  let index = targetIndex;
  for (let i = 0; i < layers.length - 1; i += 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < layers[i].length) {
      proof.push(layers[i][siblingIndex]);
    }
    index = Math.floor(index / 2);
  }
  return proof;
}

describe('MerkelAirdrop ERC20 claims', function () {
  async function deployFixture() {
    const [owner, alice, bob, outsider] = await ethers.getSigners();
    const allocations = [
      { account: alice, amount: ethers.parseEther('10') },
      { account: bob, amount: ethers.parseEther('25') },
    ];
    const leaves = allocations.map(({ account, amount }) => hashLeaf(account.address, amount));
    const root = buildTree(leaves).at(-1)[0];

    const Token = await ethers.getContractFactory('AirdropToken');
    const token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const Airdrop = await ethers.getContractFactory('MerkelAirdrop');
    const airdrop = await Airdrop.deploy(await token.getAddress(), root);
    await airdrop.waitForDeployment();

    const total = allocations.reduce((sum, item) => sum + item.amount, 0n);
    await token.mint(await airdrop.getAddress(), total);

    return { owner, alice, bob, outsider, token, airdrop, allocations, leaves, root, total };
  }

  it('stores the ERC20 token address and funded token balance', async function () {
    const { token, airdrop, total } = await deployFixture();

    expect(await airdrop.airdropToken()).to.equal(await token.getAddress());
    expect(await token.balanceOf(await airdrop.getAddress())).to.equal(total);
  });

  it('transfers ERC20 allocation to an eligible claimant', async function () {
    const { alice, token, airdrop, allocations, leaves } = await deployFixture();
    const allocation = allocations[0];
    const proof = getProof(leaves, 0);

    await expect(airdrop.connect(alice).claim(proof, allocation.amount))
      .to.emit(airdrop, 'AirdropClaimed')
      .withArgs(alice.address, allocation.amount);

    expect(await token.balanceOf(alice.address)).to.equal(allocation.amount);
    expect(await airdrop.hasClaimed(alice.address)).to.equal(true);
  });

  it('rejects duplicate claims and invalid proofs', async function () {
    const { alice, outsider, airdrop, allocations, leaves } = await deployFixture();
    const proof = getProof(leaves, 0);

    await airdrop.connect(alice).claim(proof, allocations[0].amount);
    await expect(airdrop.connect(alice).claim(proof, allocations[0].amount)).to.be.revertedWith('Already claimed');
    await expect(airdrop.connect(outsider).claim(proof, allocations[0].amount)).to.be.revertedWith('Invalid proof');
  });

  it('lets only the owner withdraw remaining ERC20 tokens', async function () {
    const { owner, alice, token, airdrop, total } = await deployFixture();

    await expect(airdrop.connect(alice).withdrawTokens(owner.address)).to.be.revertedWith('Not owner');
    await airdrop.withdrawTokens(owner.address);

    expect(await token.balanceOf(owner.address)).to.equal(total);
    expect(await token.balanceOf(await airdrop.getAddress())).to.equal(0n);
  });
});
