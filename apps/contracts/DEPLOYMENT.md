# Contract Deployment Guide

This guide explains how to deploy the LearnToken and BadgeNFT contracts to Ronin mainnet and Saigon testnet.

## Prerequisites

1. **Wallet Setup**: You need a wallet with the following address for production:
   - **Production Admin Wallet**: `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`
   - This wallet will be the owner/admin of both contracts after deployment

2. **Private Keys**: You need the private key for the production wallet and optionally a test wallet for development

3. **Network Access**: Ensure your wallet has sufficient RON tokens to pay for gas fees:
   - Ronin Mainnet: For production deployments
   - Saigon Testnet: For testing (get testnet RON from faucet)

## Environment Setup

For detailed environment setup instructions, see [SETUP_ENV.md](./SETUP_ENV.md).

Quick setup:

1. **Create `.env` file** in the `apps/contracts` directory:

   ```bash
   cd apps/contracts
   touch .env
   ```

2. **Add your private keys** to the `.env` file:

   ```env
   # Production (Ronin Mainnet)
   # Private key for wallet: 0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa
   PRIVATE_KEY_PROD=your_production_private_key_here

   # Development/Testnet (Saigon Testnet)
   PRIVATE_KEY_DEV=your_development_private_key_here
   ```

   **Important**: 
   - Never commit the `.env` file (it's already in `.gitignore`)
   - The private key should be the hex string without the `0x` prefix
   - For production, use the private key for wallet `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`

3. **Verify your setup:**
   ```bash
   npm run verify:wallet
   ```

## Deployment Steps

### 1. Compile Contracts

```bash
npm run compile
```

### 2. Deploy to Saigon Testnet (Testing)

First, test your deployment on Saigon testnet:

```bash
npm run deploy:saigon
```

This will:
- Deploy LearnToken contract
- Deploy BadgeNFT contract
- Set the deployer wallet as the owner/admin of both contracts
- Save contract addresses to `deployed-addresses.json`

### 3. Verify on Saigon (Optional)

After deployment, verify the contracts:

```bash
npm run verify:saigon
```

### 4. Deploy to Ronin Mainnet (Production)

**⚠️ WARNING: This deploys to production. Make sure you've tested on testnet first!**

```bash
npm run deploy:ronin
```

This will:
- Deploy LearnToken contract
- Deploy BadgeNFT contract
- Set wallet `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa` as the owner/admin
- Save contract addresses to `deployed-addresses.json`

### 5. Verify on Ronin (Recommended)

After deployment, verify the contracts on Ronin:

```bash
npm run verify:ronin
```

## Post-Deployment

After successful deployment:

1. **Check `deployed-addresses.json`** for the contract addresses:
   ```json
   {
     "learnToken": "0x...",
     "badgeNFT": "0x...",
     "admin": "0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa",
     "network": "ronin",
     "deployedAt": "2025-01-XX..."
   }
   ```

2. **Update Contract Configs**: Copy the ABIs and addresses to frontend and backend:
   ```bash
   npm run update:config
   ```
   
   This will:
   - Read the ABIs from `artifacts/contracts/`
   - Read the addresses from `deployed-addresses.json`
   - Create/update `apps/backend/src/lib/contracts.json`
   - Create/update `apps/frontend/src/lib/contracts.json`

3. **Update Backend Environment**: Update your backend `.env` file:
   ```env
   RPC_URL=http://127.0.0.1:8545  # or https://api.roninchain.com/rpc for production
   ADMIN_PRIVATE_KEY=your_admin_private_key_here
   ```
   
   The contract addresses are now read from `contracts.json`, so you don't need to set them in `.env`.

4. **Verify Ownership**: You can verify the contracts are owned by the correct address by calling:
   - `LearnToken.owner()` should return `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`
   - `BadgeNFT.owner()` should return `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`

## Contract Details

### LearnToken
- **Name**: Learn Token
- **Symbol**: LEARN
- **Type**: ERC20
- **Owner Functions**: `mint(address to, uint256 amount)` - Only owner can mint tokens

### BadgeNFT
- **Name**: Juego Quest Badge
- **Symbol**: BADGE
- **Type**: ERC721 (with Enumerable extension)
- **Owner Functions**: 
  - `mintBadge(...)` - Only owner can mint badges
  - `setBaseURI(string memory _baseURI)` - Only owner can update metadata URI

## Troubleshooting

### "Insufficient funds" error
- Ensure your wallet has enough RON tokens for gas fees
- For testnet, get RON from the Saigon faucet

### "Invalid private key" error
- Verify your private key is correct (hex string without `0x` prefix)
- Ensure there are no extra spaces or newlines in the `.env` file

### Contracts not verified
- Wait a few minutes after deployment before verifying
- Ensure the contract code matches exactly (no optimizations differences)

## Security Notes

- **Never share your private keys**
- **Never commit `.env` files to git**
- **Always test on testnet before production deployment**
- **Keep your private keys secure and backed up**
- **The admin wallet controls minting - keep it secure**

