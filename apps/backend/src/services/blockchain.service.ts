import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_CONTRACTS_CONFIG_PATH = path.resolve(
  __dirname,
  '../lib/contracts.json'
);

const DEPLOYED_ADDRESSES_PATH = path.resolve(
  __dirname,
  '../../../contracts/deployed-addresses.json'
);

// Helper to get blockchain configuration based on environment
function getBlockchainConfig() {
  const blockchainEnv = process.env.BLOCKCHAIN_ENV || 'local';

  if (blockchainEnv === 'production') {
    return {
      mode: 'production',
      rpcUrl: process.env.PRODUCTION_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545',
      adminPrivateKey: process.env.PRODUCTION_ADMIN_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY,
      learnTokenAddress: process.env.PRODUCTION_LEARN_TOKEN_ADDRESS,
      badgeNFTAddress: process.env.PRODUCTION_BADGE_NFT_ADDRESS,
      useEnvAddresses: !!(process.env.PRODUCTION_LEARN_TOKEN_ADDRESS && process.env.PRODUCTION_BADGE_NFT_ADDRESS)
    };
  } else {
    // Default to local
    return {
      mode: 'local',
      rpcUrl: process.env.LOCAL_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545',
      adminPrivateKey: process.env.LOCAL_ADMIN_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY,
      useEnvAddresses: false // Always use contracts.json for local
    };
  }
}

export class BlockchainService {
  private provider!: ethers.JsonRpcProvider;
  private learnTokenContract!: ethers.Contract;
  private badgeNFTContract!: ethers.Contract;
  private adminWallet!: ethers.Wallet;

  private initialized: boolean = false;

  // Cache for blockchain stats to reduce RPC calls
  private statsCache: {
    data: any;
    timestamp: number;
  } | null = null;
  private CACHE_TTL = 60000; // 60 seconds cache

  constructor() {
    // Don't throw error in constructor - initialize lazily
    // This allows the app to start even if blockchain isn't configured
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    const config = getBlockchainConfig();

    console.log('Initializing blockchain service...');
    console.log(`  Mode: ${config.mode.toUpperCase()}`);
    console.log(`  RPC URL: ${config.rpcUrl}`);

    if (!config.adminPrivateKey) {
      throw new Error(`Admin wallet private key not configured. Set ${config.mode === 'production' ? 'PRODUCTION_ADMIN_PRIVATE_KEY' : 'LOCAL_ADMIN_PRIVATE_KEY'} in environment variables.`);
    }

    try {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

      // Test connection to blockchain
      console.log('Testing blockchain connection...');
      const network = await this.provider.getNetwork();
      console.log(`  Connected to network: chainId=${network.chainId}`);

      this.adminWallet = new ethers.Wallet(config.adminPrivateKey, this.provider);

      let learnTokenAddress: string;
      let badgeNFTAddress: string;
      let learnTokenAbi: any;
      let badgeNFTAbi: any;

      if (config.useEnvAddresses && config.learnTokenAddress && config.badgeNFTAddress) {
        // Production mode with addresses in env vars
        console.log('Using contract addresses from environment variables');
        learnTokenAddress = config.learnTokenAddress;
        badgeNFTAddress = config.badgeNFTAddress;

        // Try to load ABIs from contracts.json if available
        if (fs.existsSync(LOCAL_CONTRACTS_CONFIG_PATH)) {
          const contractsConfig = JSON.parse(fs.readFileSync(LOCAL_CONTRACTS_CONFIG_PATH, 'utf-8'));
          learnTokenAbi = contractsConfig.learnToken?.abi;
          badgeNFTAbi = contractsConfig.badgeNFT?.abi;
        }

        // If ABIs not in contracts.json, try to load from artifacts
        if (!learnTokenAbi || !badgeNFTAbi) {
          console.log('Loading ABIs from contract artifacts...');
          const learnTokenArtifactPath = path.resolve(__dirname, '../../../contracts/artifacts/contracts/LearnToken.sol/LearnToken.json');
          const badgeNFTArtifactPath = path.resolve(__dirname, '../../../contracts/artifacts/contracts/BadgeNFT.sol/BadgeNFT.json');

          if (fs.existsSync(learnTokenArtifactPath) && fs.existsSync(badgeNFTArtifactPath)) {
            learnTokenAbi = JSON.parse(fs.readFileSync(learnTokenArtifactPath, 'utf-8')).abi;
            badgeNFTAbi = JSON.parse(fs.readFileSync(badgeNFTArtifactPath, 'utf-8')).abi;
          } else {
            throw new Error('Contract ABIs not found. Please run contract compilation or provide contracts.json');
          }
        }
      } else {
        // Local mode - use contracts.json
        console.log(`Loading contract config from: ${LOCAL_CONTRACTS_CONFIG_PATH}`);

        if (!fs.existsSync(LOCAL_CONTRACTS_CONFIG_PATH)) {
          throw new Error(`Contracts config file not found at ${LOCAL_CONTRACTS_CONFIG_PATH}. Please run 'npm run deploy:localhost' in contracts directory.`);
        }

        const contractsConfig = JSON.parse(fs.readFileSync(LOCAL_CONTRACTS_CONFIG_PATH, 'utf-8'));

        if (!contractsConfig.learnToken || !contractsConfig.badgeNFT) {
          throw new Error('Contract configuration not found in contracts.json.');
        }

        if (!contractsConfig.learnToken.address || !contractsConfig.badgeNFT.address) {
          throw new Error('Contract addresses not found in contracts.json. Please run deployment script.');
        }

        if (!contractsConfig.learnToken.abi || !contractsConfig.badgeNFT.abi) {
          throw new Error('Contract ABIs not found in contracts.json.');
        }

        learnTokenAddress = contractsConfig.learnToken.address;
        badgeNFTAddress = contractsConfig.badgeNFT.address;
        learnTokenAbi = contractsConfig.learnToken.abi;
        badgeNFTAbi = contractsConfig.badgeNFT.abi;
      }

      // Initialize contracts
      this.learnTokenContract = new ethers.Contract(
        learnTokenAddress,
        learnTokenAbi,
        this.adminWallet
      );
      this.badgeNFTContract = new ethers.Contract(
        badgeNFTAddress,
        badgeNFTAbi,
        this.adminWallet
      );

      // Test contract connections
      console.log('Testing contract connections...');
      const [tokenName, nftName] = await Promise.all([
        this.learnTokenContract.name(),
        this.badgeNFTContract.name()
      ]);
      console.log(`  Token contract: ${tokenName} at ${learnTokenAddress}`);
      console.log(`  NFT contract: ${nftName} at ${badgeNFTAddress}`);

      this.initialized = true;
      console.log('✅ Blockchain service initialized successfully');
      console.log(`  Admin wallet: ${this.adminWallet.address}`);
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  /**
   * Get the total number of NFT badges minted
   */
  async getTotalNFTsMinted(): Promise<string> {
    await this.ensureInitialized();
    try {
      const totalSupply = await this.badgeNFTContract.totalSupply();
      return totalSupply.toString();
    } catch (error) {
      console.error('Error fetching NFT total supply:', error);
      throw error; // Re-throw the original error
    }
  }

  /**
   * Get the total supply of Learn Tokens
   */
  async getTotalTokenSupply(): Promise<string> {
    await this.ensureInitialized();
    try {
      const totalSupply = await this.learnTokenContract.totalSupply();
      const decimals = await this.learnTokenContract.decimals();
      // Convert from wei to token units
      return ethers.formatUnits(totalSupply, decimals);
    } catch (error) {
      console.error('Error fetching token total supply:', error);
      throw error; // Re-throw the original error
    }
  }

  /**
   * Get NFT balance for a specific address
   */
  async getNFTBalance(address: string): Promise<string> {
    await this.ensureInitialized();
    try {
      const balance = await this.badgeNFTContract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Error fetching NFT balance:', error);
      throw error; // Re-throw the original error
    }
  }

  /**
   * Get token balance for a specific address
   */
  async getTokenBalance(address: string): Promise<string> {
    await this.ensureInitialized();
    try {
      const balance = await this.learnTokenContract.balanceOf(address);
      const decimals = await this.learnTokenContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      throw error; // Re-throw the original error
    }
  }

  /**
   * Get comprehensive blockchain stats
   */
  async getBlockchainStats() {
    await this.ensureInitialized();

    // Check cache first
    const now = Date.now();
    if (this.statsCache && (now - this.statsCache.timestamp) < this.CACHE_TTL) {
      console.log('Returning cached blockchain stats');
      return this.statsCache.data;
    }

    try {
      console.log('Fetching fresh blockchain stats from RPC...');
      const [totalNFTs, totalTokens, tokenName, tokenSymbol, nftName, nftSymbol] = await Promise.all([
        this.getTotalNFTsMinted(),
        this.getTotalTokenSupply(),
        this.learnTokenContract.name(),
        this.learnTokenContract.symbol(),
        this.badgeNFTContract.name(),
        this.badgeNFTContract.symbol()
      ]);

      const stats = {
        nfts: {
          totalMinted: totalNFTs,
          name: nftName,
          symbol: nftSymbol,
          contractAddress: await this.badgeNFTContract.getAddress()
        },
        tokens: {
          totalSupply: totalTokens,
          name: tokenName,
          symbol: tokenSymbol,
          contractAddress: await this.learnTokenContract.getAddress()
        }
      };

      // Update cache
      this.statsCache = {
        data: stats,
        timestamp: now
      };

      return stats;
    } catch (error) {
      console.error('Error fetching blockchain stats:', error);
      throw error; // Re-throw the original error instead of wrapping it
    }
  }

  /**
   * Get player stats (both NFTs and tokens)
   */
  async getPlayerStats(address: string) {
    await this.ensureInitialized();
    try {
      const [nftBalance, tokenBalance] = await Promise.all([
        this.getNFTBalance(address),
        this.getTokenBalance(address)
      ]);

      return {
        address,
        nftBalance,
        tokenBalance
      };
    } catch (error) {
      console.error('Error fetching player stats:', error);
      throw error; // Re-throw the original error instead of wrapping it
    }
  }

  /**
   * Mint Learn Tokens to a specific address
   */
  async mintTokens(to: string, amount: string): Promise<{ txHash: string }> {
    await this.ensureInitialized();
    try {
      const decimals = await this.learnTokenContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const tx = await this.learnTokenContract.mint(to, amountInWei);
      const receipt = await tx.wait();
      console.log(`Minted ${amount} tokens to ${to}, tx: ${receipt.hash}`);
      return { txHash: receipt.hash };
    } catch (error) {
      console.error('Error minting tokens:', error);
      throw new Error(`Failed to mint tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mint Badge NFT to a specific address
   */
  async mintNFT(
    to: string,
    quizId: number = 1,
    correctAnswers: number = 5,
    totalQuestions: number = 5,
    quizName: string = 'Demo Quiz'
  ): Promise<{ tokenId: string; txHash: string }> {
    await this.ensureInitialized();
    try {
      const tx = await this.badgeNFTContract.mintBadge(
        to,
        quizId,
        correctAnswers,
        totalQuestions,
        quizName
      );
      const receipt = await tx.wait();
      console.log(`Minted NFT to ${to}, tx: ${receipt.hash}`);

      // Get the token ID from the event or return a placeholder
      // The contract returns the tokenId, but we need to extract it from the transaction
      // For now, we'll return the transaction hash as a reference
      return { tokenId: receipt.hash, txHash: receipt.hash };
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw new Error(`Failed to mint NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mint tokens and NFT sequentially to avoid nonce issues
   * Waits for token minting to complete before minting NFT
   */
  async mintTokensAndNFT(
    to: string,
    tokenAmount: string,
    quizId: number = 1,
    correctAnswers: number = 5,
    totalQuestions: number = 5,
    quizName: string = 'Demo Quiz'
  ): Promise<{ tokensTxHash: string; nftTokenId?: string }> {
    await this.ensureInitialized();
    try {
      // First mint tokens and wait for confirmation
      const decimals = await this.learnTokenContract.decimals();
      const amountInWei = ethers.parseUnits(tokenAmount, decimals);
      const tokenTx = await this.learnTokenContract.mint(to, amountInWei);
      const tokenReceipt = await tokenTx.wait();
      console.log(`Minted ${tokenAmount} tokens to ${to}, tx: ${tokenReceipt.hash}`);

      // Wait a bit to ensure the transaction is fully processed
      // This helps avoid nonce issues in local development
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Then mint NFT
      const nftTx = await this.badgeNFTContract.mintBadge(
        to,
        quizId,
        correctAnswers,
        totalQuestions,
        quizName
      );
      const nftReceipt = await nftTx.wait();
      console.log(`Minted NFT to ${to}, tx: ${nftReceipt.hash}`);

      return {
        tokensTxHash: tokenReceipt.hash,
        nftTokenId: nftReceipt.hash
      };
    } catch (error) {
      console.error('Error minting tokens and NFT:', error);
      throw new Error(`Failed to mint tokens and NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new Ethereum wallet
   */
  async generateWallet(): Promise<{ address: string; encryptedPrivateKey: string }> {
    try {
      const wallet = ethers.Wallet.createRandom();
      const privateKey = wallet.privateKey;

      // Encrypt the private key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Encryption key not configured in environment variables');
      }

      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return { address: wallet.address, encryptedPrivateKey: encrypted };
    } catch (error) {
      console.error('Error generating wallet:', error);
      throw new Error('Failed to generate wallet');
    }
  }
}

// Export singleton instance - lazy initialization
let blockchainServiceInstance: BlockchainService | null = null;

export const getBlockchainService = (): BlockchainService => {
  if (!blockchainServiceInstance) {
    blockchainServiceInstance = new BlockchainService();
  }
  return blockchainServiceInstance;
};

export const blockchainService = getBlockchainService();
