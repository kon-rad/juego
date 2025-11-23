# Juego Quest Smart Contracts

This directory contains the smart contracts for Juego Quest, including the LearnToken (ERC20) and BadgeNFT (ERC721) contracts deployed on the Ronin blockchain.

## Prerequisites

Ensure you have the following installed:
- Node.js (v16 or higher)
- npm or pnpm
- Hardhat

## Installation

1. Navigate to the contracts directory:
   ```bash
   cd apps/contracts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Hardhat Node

1. Navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Start the Hardhat node:
   ```bash
   npx hardhat node
   ```

   This will start a local Ethereum blockchain at `http://127.0.0.1:8545/` with pre-funded accounts. The accounts and their private keys will be displayed in the terminal.

## Deploying Contracts

1. Open a new terminal and navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Deploy the contracts to the local Hardhat network:
   ```bash
   npx hardhat run --network localhost deploy/1_deploy_learn_token.js
   npx hardhat run --network localhost deploy/2_deploy_badge_nft.js
   ```

   The deployed contract addresses will be saved to `apps/contracts/deployed-addresses.json`.

## Running the Backend

1. Navigate to the `apps/backend` directory:
   ```bash
   cd apps/backend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the backend server:
   ```bash
   pnpm dev
   ```

## Running the Frontend

1. Navigate to the `apps/frontend` directory:
   ```bash
   cd apps/frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the frontend application:
   ```bash
   pnpm dev
   ```

   The frontend will be available at `http://localhost:3000/`.

## Testing Contracts

1. Navigate to the `apps/contracts` directory:
   ```bash
   cd apps/contracts
   ```

2. Run the tests:
   ```bash
   npx hardhat test
   ```

   This will execute all the contract tests and display the results in the terminal.

## Environment Setup

Before deploying to testnet or mainnet, you need to set up your environment variables.

### 1. Create `.env` File

Create a `.env` file in the `apps/contracts` directory:

```bash
cd apps/contracts
touch .env
```

### 2. Add Private Keys

Add your private keys to the `.env` file:

```env
# Production (Ronin Mainnet)
# Private key for wallet: 0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa
PRIVATE_KEY_PROD=your_production_private_key_here

# Development/Testnet (Saigon Testnet)
PRIVATE_KEY_DEV=your_development_private_key_here
```

**Important Notes:**
- Never commit the `.env` file (it's already in `.gitignore`)
- Private keys should be hex strings **without** the `0x` prefix
- For production, the wallet address must be `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`

### 3. Verify Your Setup

Verify that your private keys are configured correctly:

```bash
npm run verify:wallet
```

This will check that:
- Your production private key matches the expected wallet address
- Your private keys are in the correct format

For more detailed setup instructions, see [SETUP_ENV.md](./SETUP_ENV.md).

## Production Deployment

### Deploy to Saigon Testnet (Testing)

First, test your deployment on Saigon testnet:

```bash
# Compile contracts
npm run compile

# Deploy to testnet
npm run deploy:saigon

# Verify contracts (optional)
npm run verify:saigon
```

### Deploy to Ronin Mainnet (Production)

**⚠️ WARNING: This deploys to production. Make sure you've tested on testnet first!**

```bash
# Compile contracts
npm run compile

# Deploy to mainnet
npm run deploy:ronin

# Verify contracts (recommended)
npm run verify:ronin
```

After deployment, contract addresses will be saved to `deployed-addresses.json`.

**Production Admin Wallet**: `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`

This wallet will be set as the owner/admin of both contracts, allowing it to:
- Mint LearnToken tokens
- Mint BadgeNFT badges
- Update BadgeNFT metadata URI

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Available Scripts

- `npm run compile` - Compile the contracts
- `npm run test` - Run contract tests
- `npm run deploy:local` - Deploy to local Hardhat network
- `npm run deploy:saigon` - Deploy to Saigon testnet
- `npm run deploy:ronin` - Deploy to Ronin mainnet
- `npm run verify:saigon` - Verify contracts on Saigon
- `npm run verify:ronin` - Verify contracts on Ronin
- `npm run verify:wallet` - Verify wallet address matches private key
- `npm run clean` - Clean build artifacts

## Contract Details

### LearnToken (ERC20)
- **Name**: Learn Token
- **Symbol**: LEARN
- **Owner Functions**: `mint(address to, uint256 amount)` - Only owner can mint tokens

### BadgeNFT (ERC721)
- **Name**: Juego Quest Badge
- **Symbol**: BADGE
- **Owner Functions**: 
  - `mintBadge(...)` - Only owner can mint badges
  - `setBaseURI(string memory _baseURI)` - Only owner can update metadata URI

## Quick Reference

### Local Development
- Start Hardhat node: `npx hardhat node`
- Deploy to localhost: `npm run deploy:local`
- Run tests: `npm run test`

### Production Deployment
1. Set up `.env` file with `PRIVATE_KEY_PROD`
2. Verify setup: `npm run verify:wallet`
3. Compile: `npm run compile`
4. Deploy to testnet: `npm run deploy:saigon` (optional)
5. Deploy to mainnet: `npm run deploy:ronin`
6. Verify contracts: `npm run verify:ronin`

### Other Services
- Run backend: `pnpm dev` in `apps/backend`
- Run frontend: `pnpm dev` in `apps/frontend`

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [SETUP_ENV.md](./SETUP_ENV.md) - Environment setup instructions
- [README.md](./README.md) - This file