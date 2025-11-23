Contracts Structure
apps/contracts/
├── contracts/
│   ├── LearnToken.sol    # ERC20 token for quiz rewards
│   ├── BadgeNFT.sol      # ERC721 tradable badge NFTs
│   └── QuizGame.sol      # Core game controller
├── deploy/
│   ├── 1_deploy_learn_token.js
│   ├── 2_deploy_badge_nft.js
│   └── 3_deploy_quiz_game.js
├── test/
├── hardhat.config.js     # Configured for Ronin & Saigon
├── package.json
├── .env.example
└── .gitignore
Contracts Overview
Contract	Type	Purpose
LearnToken	ERC20	10 LEARN per correct answer + 50 bonus for passing
BadgeNFT	ERC721	Tradable badges with on-chain SVG, tier system (Basic/Advanced/Expert/Perfect)
QuizGame	Controller	Manages quiz results, rewards, role-based access for game server
Key Features
Role-based access: Only GAME_SERVER_ROLE can submit quiz results
Minimum 5 correct answers required to earn badge + tokens
On-chain SVG metadata for badges with tier colors
submitAndClaim function for gas-efficient single-tx rewards
Deploy Commands
cd apps/contracts

# Set your private key
export PRIVATE_KEY=your_key_here

# Deploy to Saigon testnet
npm run deploy:saigon

# Verify contracts
npm run verify:saigon

# Deploy to Ronin mainnet
npm run deploy:ronin
Get testnet RON from the Ronin Faucet before deploying to Saigon.