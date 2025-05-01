const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying USDCMock...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const Token = await ethers.getContractFactory("USDCMock");
    const token = await Token.deploy(ethers.parseEther("1000000")); // ✅ Ethers v5

    await token.waitForDeployment(); // ✅ Wait for deployment (v5)

    console.log("USDCMock deployed to:",await token.getAddress()); // ✅ Get address (v5)
}

// Run the script
main().catch((error) => {
    console.error(error);
    process.exit(1);
});