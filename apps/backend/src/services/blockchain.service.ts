import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOYED_ADDRESSES_PATH = path.resolve(
  __dirname,
  '../../../contracts/deployed-addresses.json'
);

// ABI for the methods we need
const LEARN_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)'
];

const BADGE_NFT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to)'
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private learnTokenContract: ethers.Contract;
  private badgeNFTContract: ethers.Contract;
  private adminWallet: ethers.Wallet;

  constructor() {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

    if (!adminPrivateKey) {
      throw new Error('Admin wallet private key not configured in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);

    const deployedAddresses = JSON.parse(
      fs.readFileSync(DEPLOYED_ADDRESSES_PATH, 'utf-8')
    );

    this.learnTokenContract = new ethers.Contract(
      deployedAddresses.learnToken,
      LEARN_TOKEN_ABI,
      this.adminWallet
    );
    this.badgeNFTContract = new ethers.Contract(
      deployedAddresses.badgeNFT,
      BADGE_NFT_ABI,
      this.adminWallet
    );
  }

  /**
   * Get the total number of NFT badges minted
   */
  async getTotalNFTsMinted(): Promise<string> {
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
          contractAddress: this.badgeNFTContract.address
        },
        tokens: {
          totalSupply: totalTokens,
          name: tokenName,
          symbol: tokenSymbol,
          contractAddress: this.learnTokenContract.address
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
  async mintTokens(to: string, amount: string): Promise<void> {
    try {
      const decimals = await this.learnTokenContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);
      const tx = await this.learnTokenContract.mint(to, amountInWei);
      await tx.wait();
      console.log(`Minted ${amount} tokens to ${to}`);
    } catch (error) {
      console.error('Error minting tokens:', error);
      throw new Error('Failed to mint tokens');
    }
  }

  /**
   * Mint Badge NFTs to a specific address
   */
  async mintNFT(to: string): Promise<void> {
    try {
      const tx = await this.badgeNFTContract.mint(to);
      await tx.wait();
      console.log(`Minted NFT to ${to}`);
    } catch (error) {
      console.error('Error minting NFT:', error);
      throw new Error('Failed to mint NFT');
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
