require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_MAINNET === "true" ? {
        url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/",
        blockNumber: parseInt(process.env.FORK_BLOCK_NUMBER || "0") || undefined
      } : undefined
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
      gasPrice: 35000000000, // 35 gwei
      gas: 6000000,
      timeout: 60000,
      confirmations: 3
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 35000000000, // 35 gwei
      gas: 6000000,
      timeout: 60000,
      confirmations: 5
    }
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY
    },
    customChains: [
      {
        network: "mumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://api-testnet.polygonscan.com/api",
          browserURL: "https://mumbai.polygonscan.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: true
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 35,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  mocha: {
    timeout: 120000
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};