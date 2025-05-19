const { ethers } = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.USDC_CONTRACT;   // USDC address on Polygon
const rootAddress = process.env.ROOT_ADDRESS;     // Root user wallet

async function main() {
    console.log("🚀 Deploying CosmosXMatrix...");

    const CosmosXMatrix = await ethers.getContractFactory("CosmosXMatrix");
    const contract = await CosmosXMatrix.deploy(tokenAddress, rootAddress);

    console.log("📡 Waiting for deployment confirmation...");
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();

    console.log(`✅ CosmosXMatrix deployed at: ${deployedAddress}`);
    console.log(`🌱 Root address set to: ${rootAddress}`);
}
  
main().then(() => process.exit(0)).catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
