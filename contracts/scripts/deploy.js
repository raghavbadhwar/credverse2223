const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying CredentialRegistry to", network.name);
  console.log("==========================================");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Low balance detected. Make sure you have enough funds for deployment.");
  }

  console.log("\n🔨 Deploying CredentialRegistry...");
  
  // Deploy the contract
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  
  console.log("✅ CredentialRegistry deployed to:", registryAddress);
  console.log("📄 Transaction hash:", registry.deploymentTransaction().hash);

  // Wait for a few confirmations on testnet/mainnet
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("⏳ Waiting for confirmations...");
    await registry.deploymentTransaction().wait(3);
    console.log("✅ Contract confirmed on blockchain");
  }

  // Verify deployment by calling a function
  console.log("\n🔍 Verifying deployment...");
  try {
    const [totalCredentials, totalInstitutions, totalRevoked] = await registry.getStats();
    console.log("📊 Initial stats:", {
      totalCredentials: totalCredentials.toString(),
      totalInstitutions: totalInstitutions.toString(),
      totalRevoked: totalRevoked.toString()
    });
    
    // Check if deployer has admin role
    const adminRole = await registry.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await registry.hasRole(adminRole, deployer.address);
    console.log("👑 Deployer has admin role:", hasAdminRole);
    
  } catch (error) {
    console.error("❌ Error verifying deployment:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    contractName: "CredentialRegistry",
    contractAddress: registryAddress,
    deployerAddress: deployer.address,
    transactionHash: registry.deploymentTransaction().hash,
    blockNumber: registry.deploymentTransaction().blockNumber,
    gasUsed: registry.deploymentTransaction().gasLimit?.toString(),
    timestamp: new Date().toISOString(),
    chainId: network.config.chainId,
    rpcUrl: network.config.url
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // Also save to a general deployments file
  const allDeploymentsFile = path.join(deploymentsDir, "all-deployments.json");
  let allDeployments = {};
  if (fs.existsSync(allDeploymentsFile)) {
    allDeployments = JSON.parse(fs.readFileSync(allDeploymentsFile, "utf8"));
  }
  allDeployments[network.name] = deploymentInfo;
  fs.writeFileSync(allDeploymentsFile, JSON.stringify(allDeployments, null, 2));

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("🌐 Network:", network.name);
  console.log("📄 Contract:", "CredentialRegistry");
  console.log("📍 Address:", registryAddress);
  console.log("🏠 Deployer:", deployer.address);
  console.log("⛽ Chain ID:", network.config.chainId);
  console.log("💾 Saved to:", deploymentFile);

  // Create ABI file for frontend
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CredentialRegistry.sol", "CredentialRegistry.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiFile = path.join(deploymentsDir, `CredentialRegistry-${network.name}-abi.json`);
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log("📋 ABI saved to:", abiFile);

    // Save ABI to server for backend integration
    const serverAbiDir = path.join(__dirname, "..", "..", "server", "contracts");
    if (!fs.existsSync(serverAbiDir)) {
      fs.mkdirSync(serverAbiDir, { recursive: true });
    }
    
    const serverAbiFile = path.join(serverAbiDir, "CredentialRegistry.json");
    const contractInfo = {
      contractName: "CredentialRegistry",
      abi: artifact.abi,
      networks: {
        [network.config.chainId]: {
          address: registryAddress,
          transactionHash: registry.deploymentTransaction().hash
        }
      }
    };
    fs.writeFileSync(serverAbiFile, JSON.stringify(contractInfo, null, 2));
    console.log("🔗 Contract info saved for backend:", serverAbiFile);
  }

  // Update environment variables
  console.log("\n📝 Environment Variables to Update:");
  console.log(`CREDVERSE_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`CHAIN_ID=${network.config.chainId}`);
  
  if (network.name === "mumbai") {
    console.log(`MUMBAI_RPC_URL=${network.config.url}`);
  } else if (network.name === "polygon") {
    console.log(`POLYGON_RPC_URL=${network.config.url}`);
  }

  // Next steps
  console.log("\n🎯 Next Steps:");
  console.log("1. Update your .env file with the contract address above");
  console.log("2. Verify the contract on PolygonScan (if on mainnet/testnet)");
  console.log("3. Register your institution: await registry.registerInstitution(name, did)");
  console.log("4. Admin verify institution: await registry.verifyInstitution(address, true)");
  console.log("5. Start issuing credentials!");

  if (network.name === "mumbai" || network.name === "polygon") {
    console.log("\n🔍 Verify contract on PolygonScan:");
    console.log(`npx hardhat verify --network ${network.name} ${registryAddress}`);
  }

  console.log("\n✅ Deployment completed successfully! 🎉");
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });