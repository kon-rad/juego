# Local Development Setup for Blockchain Features

This guide explains how to set up the backend for local blockchain testing with Hardhat.

## Prerequisites

1. **Deploy contracts to local Hardhat network** (see `apps/contracts/README.md`)
2. **Start Hardhat node** in a separate terminal:
   ```bash
   cd apps/contracts
   npx hardhat node
   ```

## Environment Variables

Create a `.env` file in `apps/backend/` with the following variables:

```env
# Blockchain Configuration
RPC_URL=http://127.0.0.1:8545
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Wallet Generation (optional, for generating new wallets)
ENCRYPTION_KEY=your-encryption-key-here

# Other backend variables...
MONGODB_URI=your-mongodb-uri
PORT=3001
```

### Getting the Admin Private Key

When you start Hardhat node, it will display a list of accounts with their private keys. Use the **first account** (index 0) as the admin, which should be the deployer of the contracts.

The default Hardhat account private key is:
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Important**: Make sure this account matches the deployer address in `apps/contracts/deployed-addresses.json`.

## Setup Steps

1. **Start Hardhat node** (in `apps/contracts/`):
   ```bash
   cd apps/contracts
   npx hardhat node
   ```
   Keep this terminal running.

2. **Deploy contracts** (in a new terminal, in `apps/contracts/`):
   ```bash
   cd apps/contracts
   npm run deploy:local
   ```
   This will create/update `deployed-addresses.json`.

3. **Set up backend `.env`** (in `apps/backend/`):
   ```bash
   cd apps/backend
   # Create .env file with the variables above
   ```

4. **Start backend** (in `apps/backend/`):
   ```bash
   npm run dev
   ```

5. **Start frontend** (in `apps/frontend/`):
   ```bash
   npm run dev
   ```

## Testing Minting

Once everything is running:

1. Open the frontend in your browser
2. The menu bar should show your wallet address
3. Click the **+100** button to mint 100 LEARN tokens
4. Click the **+NFT** button to mint a Badge NFT
5. Balances should update automatically

## Troubleshooting

### "Admin wallet private key not configured"
- Make sure `ADMIN_PRIVATE_KEY` is set in `apps/backend/.env`
- The private key should be a hex string starting with `0x`

### "Deployed addresses file not found"
- Make sure you've deployed contracts first: `npm run deploy:local` in `apps/contracts/`
- Check that `apps/contracts/deployed-addresses.json` exists

### "Failed to mint tokens/NFT"
- Make sure Hardhat node is running
- Check that the admin wallet has enough ETH for gas fees (Hardhat accounts are pre-funded)
- Verify the contract addresses in `deployed-addresses.json` match the deployed contracts

### Balances not updating
- Check browser console for errors
- Verify the backend is running and accessible
- Make sure the wallet address is valid (starts with `0x` and is 42 characters)

## Production Setup

For production (Ronin mainnet), use:
```env
RPC_URL=https://api.roninchain.com/rpc
ADMIN_PRIVATE_KEY=your-production-private-key
```

Make sure the admin wallet address matches the deployer address from production deployment.

