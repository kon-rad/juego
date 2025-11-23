import { Hono } from 'hono';
import { blockchainService } from '../services/blockchain.service.js';

const blockchain = new Hono();

/**
 * GET /blockchain/stats
 * Get comprehensive blockchain statistics including NFT and token data
 */
blockchain.get('/stats', async (c) => {
  try {
    const stats = await blockchainService.getBlockchainStats();
    return c.json(stats);
  } catch (error) {
    console.error('Error fetching blockchain stats:', error);
    return c.json(
      { 
        error: 'Failed to fetch blockchain stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * GET /blockchain/nfts/total
 * Get total number of NFT badges minted
 */
blockchain.get('/nfts/total', async (c) => {
  try {
    const totalMinted = await blockchainService.getTotalNFTsMinted();
    return c.json({ totalMinted });
  } catch (error) {
    console.error('Error fetching NFT total:', error);
    return c.json(
      { 
        error: 'Failed to fetch NFT total',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * GET /blockchain/tokens/total
 * Get total supply of Learn Tokens
 */
blockchain.get('/tokens/total', async (c) => {
  try {
    const totalSupply = await blockchainService.getTotalTokenSupply();
    return c.json({ totalSupply });
  } catch (error) {
    console.error('Error fetching token total:', error);
    return c.json(
      { 
        error: 'Failed to fetch token total',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * GET /blockchain/player/:address
 * Get player's NFT and token balances
 */
blockchain.get('/player/:address', async (c) => {
  try {
    const address = c.req.param('address');
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json({ error: 'Invalid Ethereum address' }, 400);
    }

    const playerStats = await blockchainService.getPlayerStats(address);
    return c.json(playerStats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return c.json(
      { 
        error: 'Failed to fetch player stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * POST /blockchain/mint/tokens
 * Mint Learn Tokens to a specific address
 */
blockchain.post('/mint/tokens', async (c) => {
  try {
    const { address, amount } = await c.req.json();

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json({ error: 'Invalid Ethereum address' }, 400);
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    await blockchainService.mintTokens(address, amount);
    return c.json({ message: `Successfully minted ${amount} tokens to ${address}` });
  } catch (error) {
    console.error('Error minting tokens:', error);
    return c.json(
      { 
        error: 'Failed to mint tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * POST /blockchain/mint/nft
 * Mint Badge NFT to a specific address
 */
blockchain.post('/mint/nft', async (c) => {
  try {
    const { address, quizId, correctAnswers, totalQuestions, quizName } = await c.req.json();

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json({ error: 'Invalid Ethereum address' }, 400);
    }

    // Use defaults if not provided
    const finalQuizId = quizId || 1;
    const finalCorrectAnswers = correctAnswers ?? 5;
    const finalTotalQuestions = totalQuestions ?? 5;
    const finalQuizName = quizName || 'Demo Quiz';

    // Validate inputs
    if (finalTotalQuestions <= 0) {
      return c.json({ error: 'Total questions must be greater than 0' }, 400);
    }
    if (finalCorrectAnswers > finalTotalQuestions) {
      return c.json({ error: 'Correct answers cannot exceed total questions' }, 400);
    }
    if (finalQuizName.length > 100) {
      return c.json({ error: 'Quiz name must be 100 characters or less' }, 400);
    }

    const result = await blockchainService.mintNFT(
      address,
      finalQuizId,
      finalCorrectAnswers,
      finalTotalQuestions,
      finalQuizName
    );
    return c.json({ 
      message: `Successfully minted NFT to ${address}`,
      tokenId: result.tokenId
    });
  } catch (error) {
    console.error('Error minting NFT:', error);
    return c.json(
      { 
        error: 'Failed to mint NFT',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

/**
 * POST /blockchain/wallet/generate
 * Generate a new wallet for the user
 */
// Add logging to debug wallet generation
blockchain.post('/wallet/generate', async (c) => {
  try {
    console.log('Received request to generate wallet');
    const { address, encryptedPrivateKey } = await blockchainService.generateWallet();
    console.log('Generated wallet address:', address);

    // Here you would save the encryptedPrivateKey securely in your database
    // For now, we just return the address

    return c.json({ address });
  } catch (error) {
    console.error('Error generating wallet:', error);
    return c.json(
      { 
        error: 'Failed to generate wallet',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});

export default blockchain;
