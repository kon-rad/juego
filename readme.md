Juego - Technical Implementation Plan
Goal: Build MVP in 48 hours for ETHGlobal Buenos Aires hackathon

Deployment Complete!
Contract Addresses (Ronin Mainnet)
Contract	Address
LearnToken	0xD7f0998e629b841747ba5cF4646DCc064d24Ad74
BadgeNFT	0x89A9dC0A72ebB5Fa99A9872140dF40E46DF09e66
Admin/Owner	0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa
View on Ronin Explorer
LearnToken: https://app.roninchain.com/address/0xD7f0998e629b841747ba5cF4646DCc064d24Ad74
BadgeNFT: https://app.roninchain.com/address/0x89A9dC0A72ebB5Fa99A9872140dF40E46DF09e66
Transaction Hashes
LearnToken Deploy: 0xb7f3d3425be115ac3d45cfea302d2da80357681a9f34c48f86ce98e1cceb373b
BadgeNFT Deploy: 0x10795b07fbda3891f006c4e7d3bf3446a26dded36b7431198bc65c38e1780cc9
Verification
Both contracts are verified on Ronin Sourcify.
Next Steps
Update your backend .env or contracts.json with the new mainnet addresses to connect your application to these deployed contracts.


# Tech Stack

## Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Wallet**: Ronin Wallet Integration

## Backend
- **Runtime**: Node.js (Bun for speed)
- **Framework**: Hono (lightweight)
- **Smart Contracts**: Solidity + Hardhat

## Blockchain
- **Network**: Base Sepolia (testnet) → Base Mainnet (launch)
- **Smart Contracts**: Solidity + Hardhat
- **RPC**: Base public RPC
- **Payments**: x402 protocol (Coinbase implementation)

Storage & Infrastructure

Filecoin: Synapse SDK (knowledge base uploads)
File Processing: PDF parsing (pdf-parse), text extraction
Embeddings: OpenAI text-embedding-3-small
Database: PostgreSQL (Neon serverless)
Hosting: Railway (backend) / Vercel (frontend)


System Architecture
┌─────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                      │
│  /app/page.tsx          - Landing page                   │
│                    NEXT.JS FRONTEND                      │
│  /app/page.tsx          - Landing page                   │
│  /app/create/           - Creator onboarding             │
│  /app/[username]/       - AI twin homepage               │
│  /app/[username]/chat   - Chat interface                 │
│  /app/dashboard/        - Creator dashboard              │
└─────────────────────────────────────────────────────────┘
                            ↓ API calls
┌─────────────────────────────────────────────────────────┐
│                    HONO BACKEND API                      │
│  POST /api/creators/register                             │
│  POST /api/knowledge/upload                              │
│  POST /api/chat/message    (x402 protected)              │
│  GET  /api/creators/:username                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    MCP SERVER                            │
│  - knowledge_search (RAG from Filecoin)                  │
│  - verify_payment (x402 check)                           │
│  - execute_skill (run marketplace skills)                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                        │
│  Filecoin (Synapse SDK)  | Pinecone (vectors)           │
│  Base (smart contracts)  | PostgreSQL (metadata)         │
│  CDP Wallets            | x402 (payments)               │
└─────────────────────────────────────────────────────────┘

Database Schema (PostgreSQL)
sql-- Users/Creators table
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL, -- e.g. "maria-spanish"
  email VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) NOT NULL, -- CDP wallet
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  knowledge_base_cid TEXT, -- Filecoin CID
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services offered by creators
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id),
  name VARCHAR(100) NOT NULL, -- e.g. "30-min Spanish Lesson"
  description TEXT,
  price_juego DECIMAL(18,2) NOT NULL, -- Price in $JUEGO
  duration_minutes INTEGER, -- Optional
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id),
  client_wallet VARCHAR(42) NOT NULL,
  service_id UUID REFERENCES services(id),
  amount_paid DECIMAL(18,2),
  payment_tx_hash VARCHAR(66),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status VARCHAR(20) -- 'pending', 'active', 'completed'
);

-- Chat messages (for history)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexing
CREATE INDEX idx_creators_username ON creators(username);
CREATE INDEX idx_sessions_creator ON sessions(creator_id);
CREATE INDEX idx_messages_session ON messages(session_id);

Smart Contracts (3 Total)
1. JuegoRegistry.sol
solidity// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract JuegoRegistry {
    struct Creator {
        address wallet;
        string username;
        string knowledgeBaseCID;
        bool active;
        uint256 registeredAt;
    }
    
    mapping(address => Creator) public creators;
    mapping(string => address) public usernameToAddress;
    
    event CreatorRegistered(address indexed wallet, string username);
    event KnowledgeBaseUpdated(address indexed wallet, string cid);
    
    function register(string calldata username, string calldata knowledgeBaseCID) 
        external 
    {
        require(usernameToAddress[username] == address(0), "Username taken");
        require(creators[msg.sender].wallet == address(0), "Already registered");
        
        creators[msg.sender] = Creator({
            wallet: msg.sender,
            username: username,
            knowledgeBaseCID: knowledgeBaseCID,
            active: true,
            registeredAt: block.timestamp
        });
        
        usernameToAddress[username] = msg.sender;
        emit CreatorRegistered(msg.sender, username);
    }
    
    function updateKnowledgeBase(string calldata newCID) external {
        require(creators[msg.sender].wallet != address(0), "Not registered");
        creators[msg.sender].knowledgeBaseCID = newCID;
        emit KnowledgeBaseUpdated(msg.sender, newCID);
    }
}
2. JuegoToken.sol
solidity// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JuegoToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens
    
    constructor() ERC20("Juego", "JUEGO") Ownable(msg.sender) {
        // Mint initial supply for liquidity (10%)
        _mint(msg.sender, 100_000_000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }
}
3. JuegoDAO.sol (Simple Version)
solidity// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract JuegoDAO {
    IERC20 public juegoToken;
    
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 fundingAmount;
        address recipient;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 endTime;
        bool executed;
    }
    
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    uint256 constant VOTING_PERIOD = 7 days;
    
    constructor(address _juegoToken) {
        juegoToken = IERC20(_juegoToken);
    }
    
    function propose(
        string calldata description,
        uint256 fundingAmount,
        address recipient
    ) external returns (uint256) {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            description: description,
            fundingAmount: fundingAmount,
            recipient: recipient,
            votesFor: 0,
            votesAgainst: 0,
            endTime: block.timestamp + VOTING_PERIOD,
            executed: false
        });
        return proposalCount;
    }
    
    function vote(uint256 proposalId, bool support) external {
        require(block.timestamp < proposals[proposalId].endTime, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        
        uint256 votes = juegoToken.balanceOf(msg.sender);
        require(votes > 0, "No voting power");
        
        if (support) {
            proposals[proposalId].votesFor += votes;
        } else {
            proposals[proposalId].votesAgainst += votes;
        }
        
        hasVoted[proposalId][msg.sender] = true;
    }
    
    function execute(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.endTime, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal rejected");
        
        proposal.executed = true;
        juegoToken.transfer(proposal.recipient, proposal.fundingAmount);
    }
}
Deployment Script (Foundry):
bash# Deploy to Base Sepolia
forge create --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  src/JuegoRegistry.sol:JuegoRegistry

forge create --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  src/JuegoToken.sol:JuegoToken

forge create --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args $JUEGO_TOKEN_ADDRESS \
  src/JuegoDAO.sol:JuegoDAO
```

---

## API Implementation (Hono Backend)

### File Structure
```
backend/
├── src/
│   ├── index.ts              # Main Hono app
│   ├── routes/
│   │   ├── creators.ts       # Creator registration
│   │   ├── knowledge.ts      # Knowledge base upload
│   │   ├── chat.ts           # Chat endpoints
│   │   └── services.ts       # Service CRUD
│   ├── mcp/
│   │   ├── server.ts         # MCP server implementation
│   │   └── tools.ts          # MCP tools
│   ├── lib/
│   │   ├── filecoin.ts       # Synapse SDK wrapper
│   │   ├── x402.ts           # x402 payment verification
│   │   ├── vector.ts         # Pinecone client
│   │   └── llm.ts            # OpenAI client
│   └── db/
│       └── postgres.ts       # Database connection
├── package.json
└── tsconfig.json
Key Endpoints
POST /api/creators/register
typescript// src/routes/creators.ts
import { Hono } from 'hono';
import { db } from '../db/postgres';
import { filecoin } from '../lib/filecoin';

const app = new Hono();

app.post('/register', async (c) => {
  const { username, email, walletAddress, knowledgeFiles } = await c.req.json();
  
  // 1. Upload knowledge base to Filecoin
  const cid = await filecoin.upload(knowledgeFiles);
  
  // 2. Generate embeddings
  const embeddings = await generateEmbeddings(knowledgeFiles);
  await pinecone.upsert(embeddings, { namespace: username });
  
  // 3. Save to database
  const creator = await db.query(
    'INSERT INTO creators (username, email, wallet_address, knowledge_base_cid) VALUES ($1, $2, $3, $4) RETURNING *',
    [username, email, walletAddress, cid]
  );
  
  // 4. Register on-chain (optional for MVP)
  // await contracts.registry.register(username, cid);
  
  return c.json({ success: true, creator: creator.rows[0] });
});
POST /api/chat/message (x402 protected)
typescript// src/routes/chat.ts
import { Hono } from 'hono';
import { verifyX402Payment } from '../lib/x402';
import { mcpServer } from '../mcp/server';

const app = new Hono();

app.post('/message', async (c) => {
  const { sessionId, message, creatorUsername } = await c.req.json();
  
  // 1. Verify x402 payment
  const paymentValid = await verifyX402Payment(c.req.header());
  if (!paymentValid) {
    return c.json({ error: 'Payment required' }, 402);
  }
  
  // 2. Get creator's knowledge base
  const creator = await db.query(
    'SELECT * FROM creators WHERE username = $1',
    [creatorUsername]
  );
  
  // 3. Use MCP server to generate response
  const response = await mcpServer.processMessage({
    message,
    creatorId: creator.rows[0].id,
    knowledgeBaseCID: creator.rows[0].knowledge_base_cid,
    namespace: creatorUsername
  });
  
  // 4. Save message to database
  await db.query(
    'INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'user', message]
  );
  await db.query(
    'INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'assistant', response.content]
  );
  
  return c.json({ response: response.content });
});

MCP Server Implementation
typescript// src/mcp/server.ts
import { OpenAI } from 'openai';
import { pinecone } from '../lib/vector';
import { filecoin } from '../lib/filecoin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class MCPServer {
  // Tool 1: Search knowledge base
  async knowledgeSearch(query: string, namespace: string, topK = 5) {
    // 1. Generate query embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });
    
    // 2. Search Pinecone
    const results = await pinecone.query({
      vector: embedding.data[0].embedding,
      topK,
      namespace,
      includeMetadata: true
    });
    
    return results.matches.map(m => ({
      text: m.metadata.text,
      score: m.score,
      source: m.metadata.source
    }));
  }
  
  // Tool 2: Generate response
  async processMessage({ 
    message, 
    creatorId, 
    knowledgeBaseCID, 
    namespace 
  }: {
    message: string;
    creatorId: string;
    knowledgeBaseCID: string;
    namespace: string;
  }) {
    // 1. Search knowledge base
    const knowledge = await this.knowledgeSearch(message, namespace);
    
    // 2. Build context
    const context = knowledge.map(k => k.text).join('\n\n');
    
    // 3. Generate response with LLM
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI twin helping clients. Use this knowledge to answer:
          
${context}

Answer in a helpful, professional tone. Keep responses concise.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return {
      content: completion.choices[0].message.content,
      sources: knowledge.map(k => k.source)
    };
  }
}

export const mcpServer = new MCPServer();

Filecoin Integration (Synapse SDK)
typescript// src/lib/filecoin.ts
import { SynapseClient } from '@filecoin/synapse-sdk';

const synapse = new SynapseClient({
  apiKey: process.env.SYNAPSE_API_KEY
});

export const filecoin = {
  // Upload knowledge base
  async upload(files: File[]) {
    const uploadPromises = files.map(file => 
      synapse.upload({
        data: file,
        metadata: {
          type: 'knowledge-base',
          uploadedAt: Date.now()
        }
      })
    );
    
    const cids = await Promise.all(uploadPromises);
    
    // Return single CID pointing to directory
    return cids[0]; // Simplified for MVP
  },
  
  // Retrieve knowledge base
  async retrieve(cid: string) {
    const data = await synapse.retrieve(cid);
    return data;
  }
};

x402 Payment Integration
typescript// src/lib/x402.ts
import { createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

export async function verifyX402Payment(headers: Record<string, string>) {
  const paymentProof = headers['x-payment-proof'];
  const amount = headers['x-payment-amount'];
  const txHash = headers['x-payment-tx'];
  
  if (!paymentProof || !amount || !txHash) {
    return false;
  }
  
  // Verify transaction on Base
  const tx = await publicClient.getTransactionReceipt({ hash: txHash });
  
  if (!tx || tx.status !== 'success') {
    return false;
  }
  
  // Additional verification logic here
  // (check amount, recipient, etc.)
  
  return true;
}

export async function createPaymentRequest(
  servicePrice: number,
  recipientAddress: string
) {
  return {
    amount: servicePrice,
    recipient: recipientAddress,
    network: 'base',
    token: 'JUEGO'
  };
}
```

---

## Frontend Implementation (Next.js)

### File Structure
```
frontend/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── create/
│   │   └── page.tsx                # Creator onboarding
│   ├── [username]/
│   │   ├── page.tsx                # AI twin homepage
│   │   └── chat/
│   │       └── page.tsx            # Chat interface
│   ├── dashboard/
│   │   └── page.tsx                # Creator dashboard
│   └── layout.tsx
├── components/
│   ├── WalletConnect.tsx           # CDP wallet connection
│   ├── ChatInterface.tsx           # Chat UI
│   ├── ServiceCard.tsx             # Service listing
│   └── PaymentModal.tsx            # x402 payment flow
├── lib/
│   ├── wagmi.ts                    # Wagmi config
│   └── api.ts                      # API client
└── package.json
Key Components
Creator Onboarding (app/create/page.tsx)
typescript'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { uploadToFilecoin, registerCreator } from '@/lib/api';

export default function CreatePage() {
  const { address } = useAccount();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    bio: '',
    files: []
  });
  
  async function handleSubmit() {
    // 1. Upload knowledge base to Filecoin
    const cid = await uploadToFilecoin(formData.files);
    
    // 2. Register creator
    await registerCreator({
      username: formData.username,
      displayName: formData.displayName,
      bio: formData.bio,
      walletAddress: address,
      knowledgeBaseCID: cid
    });
    
    // 3. Redirect to dashboard
    window.location.href = '/dashboard';
  }
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      {step === 1 && (
        <div>
          <h1>Create Your AI Twin</h1>
          <input
            placeholder="Username (e.g., maria-spanish)"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <button onClick={() => setStep(2)}>Next</button>
        </div>
      )}
      
      {step === 2 && (
        <div>
          <h1>Upload Your Knowledge</h1>
          <input
            type="file"
            multiple
            onChange={(e) => setFormData({ ...formData, files: e.target.files })}
          />
          <button onClick={handleSubmit}>Create AI Twin</button>
        </div>
      )}
    </div>
  );
}
Chat Interface (app/[username]/chat/page.tsx)
typescript'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { sendMessage, verifyPayment } from '@/lib/api';

export default function ChatPage() {
  const { username } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [paid, setPaid] = useState(false);
  
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [paid, setPaid] = useState(false);
  
  async function handlePayment() {
    // Trigger x402 payment flow
    const payment = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        to: creatorAddress,
        value: parseEther(servicePrice),
        data: '0x' // x402 payment data
      }]
    });
    
    setPaid(true);
    setSessionId(generateSessionId());
  }
  
  async function handleSend() {
    if (!paid) {
      alert('Please pay first');
      return;
    }
    
    const userMsg = { role: 'user', content: input };
    setMessages([...messages, userMsg]);
    
    const response = await sendMessage({
      sessionId,
      message: input,
      creatorUsername: username
    });
    
    const aiMsg = { role: 'assistant', content: response.content };
    setMessages([...messages, userMsg, aiMsg]);
    setInput('');
  }
  
  return (
    <div className="flex flex-col h-screen">
      {!paid && (
        <div className="p-4 bg-blue-50">
          <button onClick={handlePayment}>
            Pay 20 $JUEGO to Start Chat
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div className="inline-block p-3 rounded-lg mb-2">
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
}

Environment Variables
bash# .env
# Database
DATABASE_URL=postgresql://user:password@host:5432/juego

# Filecoin
SYNAPSE_API_KEY=your_synapse_key

# OpenAI
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=juego

# Base RPC
BASE_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org

# Smart Contracts
JUEGO_REGISTRY_ADDRESS=0x...
JUEGO_TOKEN_ADDRESS=0x...
JUEGO_DAO_ADDRESS=0x...

# CDP/Coinbase
CDP_API_KEY=your_cdp_key
CDP_SECRET=your_cdp_secret

# x402
X402_FACILITATOR_URL=https://facilitator.x402.xyz

Development Timeline (48 Hours)
Hour 0-8: Setup & Infrastructure

 Initialize Next.js + Hono repos
 Set up PostgreSQL (Neon)
 Set up Pinecone index
 Deploy smart contracts to Base Sepolia
 Configure Filecoin Synapse SDK

Hour 8-16: Backend Core

 Build creator registration API
 Implement knowledge base upload (Filecoin)
 Build embedding generation pipeline
 Implement MCP server (RAG + LLM)
 Build chat API with x402 verification

Hour 16-24: Frontend Core

 Landing page
 Creator onboarding flow
 AI twin homepage (public profile)
 Basic chat interface
 CDP wallet integration

Hour 24-36: Integration

 Connect frontend ↔ backend
 Test knowledge upload → Filecoin
 Test chat → RAG → response
 Test x402 payment flow
 Add service listing/creation

Hour 36-44: Polish

 UI/UX improvements
 Error handling
 Loading states
 Mobile responsive
 Demo data seeding

Hour 44-48: Demo & Deploy

 Record demo video
 Deploy to Vercel + Railway
 Test end-to-end flow
 Prepare pitch deck
 Submit to hackathon


Testing Checklist
Smart Contracts:

 Deploy to Base Sepolia
 Register creator on-chain
 Verify on Basescan

Backend:

 Upload 3 test PDFs to Filecoin
 Generate embeddings, store in Pinecone
 Query RAG system, verify results
 Test x402 payment verification
 Test chat message flow

Frontend:

 Create test creator account
 Upload knowledge base
 View AI twin homepage
 Book service, pay with x402
 Chat with AI twin, verify responses

Integration:

 End-to-end: Create account → Upload → Chat → Pay
 Mobile browser compatibility
 Error edge cases (no payment, bad files, etc.)


Deployment
Frontend (Vercel)
bashcd frontend
vercel --prod
Backend (Railway)
bashcd backend
railway login
railway up
Database (Neon)
bash# Create database on Neon.tech
# Run migrations
psql $DATABASE_URL < migrations/001_initial.sql

Team Roles (Suggested)
Developer 1: Smart contracts + blockchain integration
Developer 2: Backend API + MCP server
Developer 3: Frontend UI + CDP wallet integration
Developer 4: Filecoin integration + vector embeddings
All: Final integration & testing

Critical Success Factors

✅ Keep it simple: Don't overbuild, focus on core flow
✅ Test early: Don't wait until last hour to integrate
✅ Use hosted services: Pinecone, Neon, Vercel (no DevOps)
✅ Mock when needed: If x402 is hard, fake it for demo
✅ Demo-driven: Build what shows well in 3-min demo


Resources

Coinbase CDP Docs: https://docs.cdp.coinbase.com/
Filecoin Synapse SDK: https://github.com/FilOzone/synapse-sdk
x402 Protocol: https://x402.org
Base Docs: https://docs.base.org
Pinecone Docs: https://docs.pinecone.io
OpenAI API: https://platform.openai.com/docs


Build fast. Ship faster. Win bounties. 🚀