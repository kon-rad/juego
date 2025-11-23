import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACTS_CONFIG_PATH = path.resolve(
  __dirname,
  '../lib/contracts.json'
);

const DEPLOYED_ADDRESSES_PATH = path.resolve(
  __dirname,
  '../../../contracts/deployed-addresses.json'
);

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private learnTokenContract: ethers.Contract;
  private badgeNFTContract: ethers.Contract;
  private adminWallet: ethers.Wallet;

  private initialized: boolean = false;

  constructor() {
    // Don't throw error in constructor - initialize lazily
    // This allows the app to start even if blockchain isn't configured
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

    if (!adminPrivateKey) {
      throw new Error('Admin wallet private key not configured. Set ADMIN_PRIVATE_KEY in environment variables.');
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);

      // Load contract config (ABI and addresses)
      if (!fs.existsSync(CONTRACTS_CONFIG_PATH)) {
        throw new Error(`Contracts config file not found at ${CONTRACTS_CONFIG_PATH}. Please copy contracts.json first.`);
      }

      const contractsConfig = JSON.parse(
        fs.readFileSync(CONTRACTS_CONFIG_PATH, 'utf-8')
      );

      if (!contractsConfig.learnToken || !contractsConfig.badgeNFT) {
        throw new Error('Contract configuration not found in contracts.json. Please ensure the file is properly configured.');
      }

      if (!contractsConfig.learnToken.address || !contractsConfig.badgeNFT.address) {
        throw new Error('Contract addresses not found in contracts.json.');
      }

      if (!contractsConfig.learnToken.abi || !contractsConfig.badgeNFT.abi) {
        throw new Error('Contract ABIs not found in contracts.json.');
      }

      this.learnTokenContract = new ethers.Contract(
        contractsConfig.learnToken.address,
        contractsConfig.learnToken.abi,
        this.adminWallet
      );
      this.badgeNFTContract = new ethers.Contract(
        contractsConfig.badgeNFT.address,
        contractsConfig.badgeNFT.abi,
        this.adminWallet
      );

      this.initialized = true;
      console.log('Blockchain service initialized successfully');
      console.log(`  RPC URL: ${rpcUrl}`);
      console.log(`  Admin wallet: ${this.adminWallet.address}`);
      console.log(`  LearnToken: ${contractsConfig.learnToken.address}`);
      console.log(`  BadgeNFT: ${contractsConfig.badgeNFT.address}`);
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
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
      throw new Error('Failed to fetch NFT total supply');
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
      throw new Error('Failed to fetch token total supply');
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
      throw new Error('Failed to fetch NFT balance');
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
      throw new Error('Failed to fetch token balance');
    }
  }

  /**
   * Get comprehensive blockchain stats
   */
  async getBlockchainStats() {
    await this.ensureInitialized();
    try {
      const [totalNFTs, totalTokens, tokenName, tokenSymbol, nftName, nftSymbol] = await Promise.all([
        this.getTotalNFTsMinted(),
        this.getTotalTokenSupply(),
        this.learnTokenContract.name(),
        this.learnTokenContract.symbol(),
        this.badgeNFTContract.name(),
        this.badgeNFTContract.symbol()
      ]);

      return {
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
    } catch (error) {
      console.error('Error fetching blockchain stats:', error);
      throw new Error('Failed to fetch blockchain stats');
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
      throw new Error('Failed to fetch player stats');
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
