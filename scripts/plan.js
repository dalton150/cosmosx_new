const { ethers } = require("hardhat");
require("dotenv").config();
const tokenAddress = process.env.USDC_CONTRACT; // Replace with your token address
const rootAddress = process.env.ROOT_ADDRESS; // Replace with your root address

async function main() {
    console.log("Deploying FortonClone...");
    const cosmosx = await ethers.getContractFactory("CosmosXMatrix");
    console.log("Hello world!");
    
    const COSMOSX = await cosmosx.deploy(tokenAddress,rootAddress);
    console.log("COSMOSX address:", COSMOSX.address);
    console.log("Root address:", rootAddress);
    await COSMOSX.waitForDeployment();
    console.log("plan deployed to:",await COSMOSX.getAddress());
    // npx hardhat run scripts/plan.js --network amoy  // command to run the script
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
