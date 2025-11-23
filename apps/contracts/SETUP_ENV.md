# Environment Setup Instructions

## Quick Setup

1. **Navigate to the contracts directory:**
   ```bash
   cd apps/contracts
   ```

2. **Create the `.env` file:**
   ```bash
   touch .env
   ```

3. **Add your private keys to `.env`:**
   ```env
   # Production (Ronin Mainnet)
   # Private key for wallet: 0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa
   PRIVATE_KEY_PROD=your_production_private_key_here

   # Development/Testnet (Saigon Testnet)
   PRIVATE_KEY_DEV=your_development_private_key_here
   ```

4. **Replace the placeholders:**
   - Replace `your_production_private_key_here` with the actual private key for wallet `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa`
   - Replace `your_development_private_key_here` with a test wallet private key (optional, for testing on Saigon)

5. **Verify your setup:**
   ```bash
   npm run verify:wallet
   ```

   This will verify that:
   - Your production private key matches the expected wallet address
   - Your private keys are in the correct format

## Important Notes

- **Never commit the `.env` file** - it's already in `.gitignore`
- **Private key format**: The private key should be a hex string **without** the `0x` prefix
- **Security**: Keep your private keys secure and never share them
- **Production wallet**: Must be `0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa` for production deployments

## Example .env file

```env
# Production (Ronin Mainnet) - Wallet: 0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa
PRIVATE_KEY_PROD=abc123def4567890123456789012345678901234567890123456789012345678

# Development/Testnet (Saigon Testnet)
PRIVATE_KEY_DEV=def456abc1237890123456789012345678901234567890123456789012345678
```

## Alternative Environment Variable Names

The following variable names are also supported (in order of priority):

**For Production (Ronin):**
- `PRIVATE_KEY_PROD` (recommended)
- `PRIVATE_KEY_RONIN`
- `PRIVATE_KEY` (fallback)

**For Development (Saigon):**
- `PRIVATE_KEY_DEV` (recommended)
- `PRIVATE_KEY_SAIGON`
- `PRIVATE_KEY` (fallback)

## Next Steps

After setting up your `.env` file:

1. Verify your wallet: `npm run verify:wallet`
2. Compile contracts: `npm run compile`
3. Deploy to testnet: `npm run deploy:saigon` (optional, for testing)
4. Deploy to mainnet: `npm run deploy:ronin`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

