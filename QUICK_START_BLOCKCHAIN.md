# 🚀 Quick Start: Blockchain Setup

Choose your environment and follow the steps:

## 🏠 Local Development (Recommended for Development)

### Step 1: Start Hardhat Node
```bash
cd apps/contracts
npx hardhat node
# Keep this running!
```

### Step 2: Deploy Contracts
```bash
# In a new terminal
cd apps/contracts
npm run deploy:localhost
```

### Step 3: Configure Backend
```bash
cd apps/backend
# Copy the local example
cp .env.local.example .env
# Edit .env and add your MongoDB URI
```

Your `.env` should have:
```bash
BLOCKCHAIN_ENV=local
LOCAL_RPC_URL=http://127.0.0.1:8545
LOCAL_ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Step 4: Start Backend
```bash
cd apps/backend
npm run dev
```

✅ **You're done!** The backend will automatically use local contracts.

---

## 🌐 Production (Ronin Mainnet)

### Step 1: Get Your Production Info
- Deployed contract addresses from Ronin
- Your secure private key
- Production RPC URL

### Step 2: Configure Backend
```bash
cd apps/backend
# Copy the production example
cp .env.production.example .env
# Edit .env with your production values
```

Your `.env` should have:
```bash
BLOCKCHAIN_ENV=production
PRODUCTION_RPC_URL=https://api.roninchain.com/rpc
PRODUCTION_ADMIN_PRIVATE_KEY=your_secure_key
PRODUCTION_LEARN_TOKEN_ADDRESS=0xYourTokenAddress
PRODUCTION_BADGE_NFT_ADDRESS=0xYourNFTAddress
```

### Step 3: Start Backend
```bash
cd apps/backend
npm run dev
```

✅ **You're done!** The backend will use production contracts.

---

## 🔄 Switching Between Environments

Just change `BLOCKCHAIN_ENV` in your `.env`:

```bash
# For local development
BLOCKCHAIN_ENV=local

# For production
BLOCKCHAIN_ENV=production
```

Then restart your backend.

---

## ✅ Verify It's Working

Test the blockchain connection:

```bash
curl http://localhost:3001/api/blockchain/stats
```

You should see contract information in the response.

---

## 🆘 Troubleshooting

### "could not decode result data"
**Problem**: Contracts not deployed to local network
**Solution**: Run `npm run deploy:localhost` in contracts directory

### "Master key not found"
**Problem**: Database encryption key missing
**Solution**: Fixed automatically on first wallet request

### "ECONNREFUSED 127.0.0.1:8545"
**Problem**: Local blockchain not running
**Solution**: Start with `npx hardhat node` in contracts directory

### Wrong network detected
**Problem**: Connected to wrong blockchain
**Solution**: Check `BLOCKCHAIN_ENV` and corresponding variables in `.env`

---

## 📚 More Info

See [BLOCKCHAIN_SETUP.md](./BLOCKCHAIN_SETUP.md) for detailed documentation.
