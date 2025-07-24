const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying CredVerse Registry...");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy the upgradeable contract
  const CredVerseRegistry = await ethers.getContractFactory("CredVerseRegistry");
  
  console.log("Deploying CredVerseRegistry...");
  const registry = await upgrades.deployProxy(CredVerseRegistry, [], {
    initializer: "initialize",
    kind: "uups"
  });

  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  console.log("CredVerseRegistry deployed to:", registryAddress);
  console.log("Transaction hash:", registry.deploymentTransaction().hash);

  // Verify deployment
  console.log("Verifying deployment...");
  const version = await registry.version();
  console.log("Contract version:", version);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: registryAddress,
    deployerAddress: deployer.address,
    transactionHash: registry.deploymentTransaction().hash,
    blockNumber: registry.deploymentTransaction().blockNumber,
    version: version,
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const path = require("path");
  
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  fs.writeFileSync(
    path.join("deployments", `${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\nDeployment info saved to deployments/${hre.network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });