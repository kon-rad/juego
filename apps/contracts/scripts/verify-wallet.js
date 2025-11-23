/**
 * Script to verify that the private key in .env matches the expected wallet address
 * 
 * Usage: 
 *   node scripts/verify-wallet.js
 * 
 * Make sure to set your environment variables first:
 *   export PRIVATE_KEY_PROD=your_key_here
 *   export PRIVATE_KEY_DEV=your_key_here
 * 
 * Or use dotenv (if installed): node -r dotenv/config scripts/verify-wallet.js
 */

// Try to load dotenv if available, but don't fail if it's not
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, use environment variables directly
}

const { ethers } = require('ethers');

async function verifyWallet() {
  const expectedProdAddress = '0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa';
  
  console.log('='.repeat(60));
  console.log('Wallet Address Verification');
  console.log('='.repeat(60));
  
  // Check production key
  const prodKey = process.env.PRIVATE_KEY_PROD || process.env.PRIVATE_KEY_RONIN;
  if (prodKey) {
    try {
      const wallet = new ethers.Wallet(prodKey);
      const address = wallet.address;
      
      console.log('\n📋 Production Wallet:');
      console.log(`  Expected: ${expectedProdAddress}`);
      console.log(`  Actual:   ${address}`);
      
      if (address.toLowerCase() === expectedProdAddress.toLowerCase()) {
        console.log('  ✅ MATCH - Private key is correct!');
      } else {
        console.log('  ❌ MISMATCH - Private key does not match expected address!');
        console.log('  ⚠️  Please verify your PRIVATE_KEY_PROD in .env file');
      }
    } catch (error) {
      console.log('  ❌ ERROR - Invalid private key format');
      console.log(`  Error: ${error.message}`);
    }
  } else {
    console.log('\n⚠️  Production private key not found in .env');
    console.log('   Set PRIVATE_KEY_PROD or PRIVATE_KEY_RONIN in your .env file');
  }
  
  // Check dev key
  const devKey = process.env.PRIVATE_KEY_DEV || process.env.PRIVATE_KEY_SAIGON;
  if (devKey) {
    try {
      const wallet = new ethers.Wallet(devKey);
      const address = wallet.address;
      
      console.log('\n📋 Development Wallet:');
      console.log(`  Address: ${address}`);
      console.log('  ✅ Valid private key format');
    } catch (error) {
      console.log('\n❌ Development private key has invalid format');
      console.log(`  Error: ${error.message}`);
    }
  } else {
    console.log('\n⚠️  Development private key not found in .env');
    console.log('   Set PRIVATE_KEY_DEV or PRIVATE_KEY_SAIGON in your .env file');
  }
  
  console.log('\n' + '='.repeat(60));
}

verifyWallet().catch(console.error);

