const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface BlockchainStats {
  nfts: {
    totalMinted: string;
    name: string;
    symbol: string;
    contractAddress: string;
  };
  tokens: {
    totalSupply: string;
    name: string;
    symbol: string;
    contractAddress: string;
  };
}

export interface PlayerStats {
  address: string;
  nftBalance: string;
  tokenBalance: string;
}

/**
 * Fetch comprehensive blockchain statistics
 */
export async function getBlockchainStats(): Promise<BlockchainStats> {
  const response = await fetch(`${API_URL}/api/blockchain/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch blockchain stats');
  }
  return response.json();
}

/**
 * Fetch total number of NFTs minted
 */
export async function getTotalNFTsMinted(): Promise<string> {
  const response = await fetch(`${API_URL}/api/blockchain/nfts/total`);
  if (!response.ok) {
    throw new Error('Failed to fetch NFT total');
  }
  const data = await response.json();
  return data.totalMinted;
}

/**
 * Fetch total token supply
 */
export async function getTotalTokenSupply(): Promise<string> {
  const response = await fetch(`${API_URL}/api/blockchain/tokens/total`);
  if (!response.ok) {
    throw new Error('Failed to fetch token total');
  }
  const data = await response.json();
  return data.totalSupply;
}

/**
 * Fetch player's blockchain stats (NFT and token balances)
 */
export async function getPlayerStats(address: string): Promise<PlayerStats> {
  const response = await fetch(`${API_URL}/api/blockchain/player/${address}`);
  if (!response.ok) {
    throw new Error('Failed to fetch player stats');
  }
  return response.json();
}

/**
 * Mint Learn Tokens to a wallet address
 */
export async function mintTokens(address: string, amount: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/blockchain/mint/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amount })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mint tokens');
  }
  return response.json();
}

/**
 * Mint Badge NFT to a wallet address
 */
export async function mintNFT(
  address: string,
  quizId?: number,
  correctAnswers?: number,
  totalQuestions?: number,
  quizName?: string
): Promise<{ message: string; tokenId?: string }> {
  const response = await fetch(`${API_URL}/api/blockchain/mint/nft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      quizId,
      correctAnswers,
      totalQuestions,
      quizName
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mint NFT');
  }
  return response.json();
}
