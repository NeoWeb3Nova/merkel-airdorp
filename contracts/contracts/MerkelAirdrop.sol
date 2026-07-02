// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MerkelAirdrop {
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

    constructor(bytes32 _merkleRoot) {
        owner = msg.sender;
        merkleRoot = _merkleRoot;
    }

    // 更新 Merkle Root（用于新一轮空投）
    function setMerkleRoot(bytes32 _newRoot) external onlyOwner {
        merkleRoot = _newRoot;
        emit MerkleRootUpdated(_newRoot);
    }

    // 接收空投资金
    function fundAirdrop() external payable onlyOwner {
        totalAirdropAmount += msg.value;
    }

    // 领取空投
    function claim(bytes32[] calldata proof, uint256 amount) external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(address(this).balance >= amount, "Insufficient funds");

        // 生成叶子节点: keccak256(abi.encodePacked(address, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        hasClaimed[msg.sender] = true;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit AirdropClaimed(msg.sender, amount);
    }

    // 查看是否已领取
    function checkClaimed(address user) external view returns (bool) {
        return hasClaimed[user];
    }

    // 提取剩余资金
    function withdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    receive() external payable {
        totalAirdropAmount += msg.value;
    }
}
