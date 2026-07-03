// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MerkelAirdrop {
    using SafeERC20 for IERC20;

    IERC20 public immutable airdropToken;
    bytes32 public merkleRoot;
    address public owner;
    uint256 public totalAirdropAmount;

    // 记录已领取的用户
    mapping(address => bool) public hasClaimed;

    event MerkleRootUpdated(bytes32 newRoot);
    event AirdropClaimed(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _airdropToken, bytes32 _merkleRoot) {
        require(_airdropToken != address(0), "Invalid token");
        owner = msg.sender;
        airdropToken = IERC20(_airdropToken);
        merkleRoot = _merkleRoot;
    }

    // 更新 Merkle Root（用于新一轮空投）
    function setMerkleRoot(bytes32 _newRoot) external onlyOwner {
        merkleRoot = _newRoot;
        emit MerkleRootUpdated(_newRoot);
    }

    // 记录已转入合约的 ERC20 空投额度
    function syncAirdropAmount() external {
        totalAirdropAmount = airdropToken.balanceOf(address(this));
    }

    // 领取空投
    function claim(bytes32[] calldata proof, uint256 amount) external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(airdropToken.balanceOf(address(this)) >= amount, "Insufficient funds");

        // 生成叶子节点: keccak256(abi.encodePacked(address, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        hasClaimed[msg.sender] = true;
        totalAirdropAmount = airdropToken.balanceOf(address(this)) - amount;
        airdropToken.safeTransfer(msg.sender, amount);

        emit AirdropClaimed(msg.sender, amount);
    }

    // 查看是否已领取
    function checkClaimed(address user) external view returns (bool) {
        return hasClaimed[user];
    }

    // 提取剩余 ERC20 空投代币
    function withdrawTokens(address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = airdropToken.balanceOf(address(this));
        totalAirdropAmount = 0;
        airdropToken.safeTransfer(to, balance);
    }
}
