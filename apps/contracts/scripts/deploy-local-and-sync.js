/**
 * Deploy contracts to local Hardhat network and sync with backend
 *
 * This script:
 * 1. Deploys LearnToken and BadgeNFT to local network
 * 2. Updates deployed-addresses.json
 * 3. Updates backend's contracts.json with ABIs and addresses
 *
 * Run this after starting: npx hardhat node
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting local deployment...\n");

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy LearnToken
  console.log("📝 Deploying LearnToken...");
  const LearnToken = await hre.ethers.getContractFactory("LearnToken");
  const learnToken = await LearnToken.deploy();
  await learnToken.waitForDeployment();
  const learnTokenAddress = await learnToken.getAddress();
  console.log("✅ LearnToken deployed to:", learnTokenAddress);

  // Deploy BadgeNFT
  console.log("\n📝 Deploying BadgeNFT...");
  const BadgeNFT = await hre.ethers.getContractFactory("BadgeNFT");
  const badgeNFT = await BadgeNFT.deploy();
  await badgeNFT.waitForDeployment();
  const badgeNFTAddress = await badgeNFT.getAddress();
  console.log("✅ BadgeNFT deployed to:", badgeNFTAddress);

  // Test contracts are working
  console.log("\n🔍 Verifying deployments...");
  const tokenName = await learnToken.name();
  const tokenSymbol = await learnToken.symbol();
  const nftName = await badgeNFT.name();
  const nftSymbol = await badgeNFT.symbol();

  console.log("  Token:", tokenName, `(${tokenSymbol})`);
  console.log("  NFT:", nftName, `(${nftSymbol})`);

  // Save deployed addresses
  console.log("\n💾 Saving deployment info...");
  const addresses = {
    learnToken: learnTokenAddress,
    badgeNFT: badgeNFTAddress,
    admin: deployer.address,
    network: "localhost",
    deployedAt: new Date().toISOString()
  };

  const addressesPath = path.join(__dirname, '..', 'deployed-addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("✅ Addresses saved to:", addressesPath);

  // Get contract ABIs
  const LearnTokenArtifact = await hre.artifacts.readArtifact("LearnToken");
  const BadgeNFTArtifact = await hre.artifacts.readArtifact("BadgeNFT");

  // Create contracts config for backend
  const contractsConfig = {
    learnToken: {
      abi: LearnTokenArtifact.abi,
      address: learnTokenAddress
    },
    badgeNFT: {
      abi: BadgeNFTArtifact.abi,
      address: badgeNFTAddress
    },
    admin: deployer.address
  };

  // Save to backend
  const backendConfigPath = path.join(__dirname, '../../backend/src/lib/contracts.json');
  fs.writeFileSync(backendConfigPath, JSON.stringify(contractsConfig, null, 2));
  console.log("✅ Backend contracts config updated:", backendConfigPath);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("LearnToken:", learnTokenAddress);
  console.log("BadgeNFT:  ", badgeNFTAddress);
  console.log("Admin:     ", deployer.address);
  console.log("=".repeat(60));
  console.log("\n📋 Next steps:");
  console.log("  1. Backend contracts.json has been updated");
  console.log("  2. Restart your backend server to use new addresses");
  console.log("  3. Update your .env ADMIN_PRIVATE_KEY if needed");
  console.log("\n💡 Tip: Your backend should now connect successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
