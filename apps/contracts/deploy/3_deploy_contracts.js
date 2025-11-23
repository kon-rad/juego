const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying contracts with deployer:", deployer);

  // Deploy LearnToken
  const learnToken = await deploy("LearnToken", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  // Deploy BadgeNFT
  const badgeNFT = await deploy("BadgeNFT", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log("Deployment complete!");
  console.log("=".repeat(50));
  console.log("Contract Addresses:");
  console.log("  LearnToken:", learnToken.address);
  console.log("  BadgeNFT:", badgeNFT.address);
  console.log("  Admin/Owner:", deployer);
  console.log("=".repeat(50));

  // Save addresses to a file for backend/server use
  const fs = require('fs');
  const path = require('path');

  const addresses = {
    learnToken: learnToken.address,
    badgeNFT: badgeNFT.address,
    admin: deployer,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, '..', 'deployed-addresses.json');
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log("Contract addresses saved to:", outputPath);
};

module.exports = func;
func.tags = ["Contracts"];
func.dependencies = ["LearnToken", "BadgeNFT"];
