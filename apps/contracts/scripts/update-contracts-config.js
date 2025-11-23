/**
 * Script to update contract ABIs and addresses in frontend and backend
 * Usage: node scripts/update-contracts-config.js
 */

const fs = require('fs');
const path = require('path');

const contractsDir = __dirname.replace('/scripts', '');
const artifactsDir = path.join(contractsDir, 'artifacts', 'contracts');
const deployedAddressesPath = path.join(contractsDir, 'deployed-addresses.json');

// Paths for output files
const backendConfigPath = path.join(contractsDir, '..', 'backend', 'src', 'lib', 'contracts.json');
const frontendConfigPath = path.join(contractsDir, '..', 'frontend', 'src', 'lib', 'contracts.json');

try {
  // Read deployed addresses
  if (!fs.existsSync(deployedAddressesPath)) {
    throw new Error(`Deployed addresses file not found: ${deployedAddressesPath}`);
  }
  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, 'utf-8'));

  // Read ABIs from artifacts
  const learnTokenArtifact = JSON.parse(
    fs.readFileSync(
      path.join(artifactsDir, 'LearnToken.sol', 'LearnToken.json'),
      'utf-8'
    )
  );

  const badgeNFTArtifact = JSON.parse(
    fs.readFileSync(
      path.join(artifactsDir, 'BadgeNFT.sol', 'BadgeNFT.json'),
      'utf-8'
    )
  );

  // Create config object
  const config = {
    learnToken: {
      abi: learnTokenArtifact.abi,
      address: deployedAddresses.learnToken
    },
    badgeNFT: {
      abi: badgeNFTArtifact.abi,
      address: deployedAddresses.badgeNFT
    },
    admin: deployedAddresses.admin
  };

  // Write to backend
  fs.writeFileSync(backendConfigPath, JSON.stringify(config, null, 2));
  console.log(`✅ Updated backend config: ${backendConfigPath}`);

  // Write to frontend
  fs.writeFileSync(frontendConfigPath, JSON.stringify(config, null, 2));
  console.log(`✅ Updated frontend config: ${frontendConfigPath}`);

  console.log('\n📋 Contract Addresses:');
  console.log(`  LearnToken: ${config.learnToken.address}`);
  console.log(`  BadgeNFT: ${config.badgeNFT.address}`);
  console.log(`  Admin: ${config.admin}`);
  console.log(`  Network: ${deployedAddresses.network || 'unknown'}`);

} catch (error) {
  console.error('❌ Error updating contract config:', error.message);
  process.exit(1);
}

