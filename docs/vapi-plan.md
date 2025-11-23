Vapi Voice Integration for AI Characters
Overview
Enable voice-first conversations between players and AI characters using Vapi. Store AI character data (personality, system prompt) and user profiles (biography, score, interests) in MongoDB, and pass this information to Vapi when initiating voice calls.

Implementation Plan
1. Database Schema Updates
MongoDB Collections:

aiCharacters collection - Store AI character data:
name (string)
personality (string) - Character personality description
systemPrompt (string) - Full system prompt for Vapi
voiceSettings (object) - Vapi voice configuration (voiceId, speed, etc.)
avatar (string, optional) - Avatar/image URL
createdAt, updatedAt (dates)
players collection - Extend existing collection with:
biography (string, optional)
score (number, default: 0)
interests (array of strings, optional)
level (number, optional)
2. Backend Implementation
Files to create/modify:

apps/backend/src/lib/mongodb.ts
Add getAICharactersCollection() helper function
apps/backend/src/routes/ai-character.ts (new)
GET /api/ai-character - List all AI characters
GET /api/ai-character/:id - Get specific AI character
POST /api/ai-character - Create new AI character
PUT /api/ai-character/:id - Update AI character
DELETE /api/ai-character/:id - Delete AI character
apps/backend/src/routes/player.ts (new)
GET /api/player/:id - Get player profile with biography, score, interests
PUT /api/player/:id - Update player profile (biography, score, interests)
apps/backend/src/services/vapi.service.ts (new)
initiateCall(characterId, userId) - Create Vapi call with:
AI character system prompt
User profile data (biography, score, interests)
Voice settings from character
getCallStatus(callId) - Check call status
endCall(callId) - End active call
apps/backend/src/routes/vapi.ts (new)
POST /api/vapi/initiate - Initiate voice call
Body: { characterId, userId }
Returns: { callId, status }
GET /api/vapi/call/:callId - Get call status
POST /api/vapi/call/:callId/end - End call
POST /api/vapi/webhook - Handle Vapi webhooks (call events)
apps/backend/src/index.ts
Register new routes: /api/ai-character, /api/player, /api/vapi
apps/backend/package.json
Add Vapi SDK dependency
3. Frontend Implementation
Files to create/modify:

apps/frontend/src/lib/vapi.ts (new)
initiateVoiceCall(characterId) - Call backend to start Vapi call
endVoiceCall(callId) - End active call
getCallStatus(callId) - Check call status
apps/frontend/src/components/VoiceCallButton.tsx (new)
Button component to initiate/end voice calls
Shows call status (connecting, active, ended)
Handles call state management
apps/frontend/src/components/AICharacterList.tsx (new)
Display list of available AI characters
Show character name, personality preview
Voice call button for each character
apps/frontend/src/components/AgentPanel.tsx
Add voice call section/tab
Integrate VoiceCallButton component
apps/frontend/src/lib/mongodb-api.ts
Add functions:
getAICharacters() - Fetch all AI characters
getAICharacter(id) - Fetch specific character
getPlayerProfile(id) - Fetch player with profile data
updatePlayerProfile(id, data) - Update player profile
4. Environment Variables
Backend (.env):

VAPI_API_KEY - Vapi API key
VAPI_ASSISTANT_ID (optional) - Default assistant ID if using pre-configured assistant
VAPI_PHONE_NUMBER_ID (optional) - Phone number ID for outbound calls
5. Vapi Integration Details
Call Initiation Flow:

User clicks voice call button for an AI character
Frontend calls POST /api/vapi/initiate with characterId and userId
Backend:
Fetches AI character from MongoDB (system prompt, voice settings)
Fetches user profile from MongoDB (biography, score, interests)
Constructs Vapi call request with:
System prompt: AI character's system prompt + user profile context
Voice settings from character
Initiates Vapi call via SDK
Returns call ID and status
System Prompt Construction:

[AI Character System Prompt]

User Profile:
- Name: [user name]
- Biography: [user biography]
- Score: [user score]
- Interests: [user interests]
6. Testing Considerations
Test Vapi call initiation with sample characters
Verify system prompt includes user profile data
Test webhook handling for call events
Verify MongoDB schema updates work correctly
Files Summary
New Backend Files:

apps/backend/src/routes/ai-character.ts
apps/backend/src/routes/player.ts
apps/backend/src/routes/vapi.ts
apps/backend/src/services/vapi.service.ts
New Frontend Files:

apps/frontend/src/lib/vapi.ts
apps/frontend/src/components/VoiceCallButton.tsx
apps/frontend/src/components/AICharacterList.tsx
Modified Files:

apps/backend/src/lib/mongodb.ts
apps/backend/src/index.ts
apps/backend/package.json
apps/frontend/src/components/AgentPanel.tsx
apps/frontend/src/lib/mongodb-api.ts
apps/backend/src/routes/game.ts (update player creation to include profile fields)