require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable Intermediate Representation
    },
  },
  networks: {
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.API_KEY}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: 137,
    },
    amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${process.env.API_KEY}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.API_KEY, // Mainnet
      polygonAmoy: process.env.API_KEY, // Amoy
    },
  },
};
