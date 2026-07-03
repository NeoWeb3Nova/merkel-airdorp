require('@nomicfoundation/hardhat-toolbox');

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC;
const privateKey = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.20',
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: sepoliaRpcUrl || '',
      accounts: privateKey ? [privateKey] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};
