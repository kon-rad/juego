// MongoDB API functions for player persistence

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface MongoDBPlayer {
    id: string;         // MongoDB ObjectId as string
    _id?: string;       // MongoDB ObjectId (from response)
    worldId?: string;
    name: string;
    userName?: string;
    avatarColor: string;
    x: number;
    y: number;
    isAI: boolean;
    biography?: string;
    interests?: string[];
    lastActive?: Date;
    createdAt?: Date;
}

export interface MongoDBWorld {
    id: string;
    name: string;
    width: number;
    height: number;
    players: MongoDBPlayer[];
    objects: MongoDBWorldObject[];
}

export interface MongoDBWorldObject {
    id: string;
    worldId: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Save or update a player in MongoDB
 * If no MongoDB _id is provided, creates a new player
 * If MongoDB _id is provided, updates the existing player
 */
export async function savePlayerToMongoDB(playerData: {
    mongodbId?: string;  // MongoDB ObjectId (if updating existing player)
    name: string;
    avatarColor: string;
    x: number;
    y: number;
    isAI?: boolean;
}): Promise<MongoDBPlayer | null> {
    try {
        console.log('Saving player to MongoDB:', playerData.name);
        const response = await fetch(`${API_URL}/api/game/player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: playerData.mongodbId, // Pass MongoDB _id for updates, undefined for new players
                name: playerData.name,
                avatarColor: playerData.avatarColor,
                x: playerData.x,
                y: playerData.y,
                isAI: playerData.isAI || false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to save player to MongoDB:', response.status, errorText);
            return null;
        }

        const result = await response.json();
        console.log('Player saved successfully:', result);
        return result;
    } catch (error) {
        console.error('Error saving player to MongoDB:', error);
        return null;
    }
}

/**
 * Update player position in MongoDB
 * Requires the MongoDB _id to update the correct player
 */
export async function updatePlayerPositionInMongoDB(
    mongodbId: string,
    x: number,
    y: number
): Promise<MongoDBPlayer | null> {
    try {
        const response = await fetch(`${API_URL}/api/game/player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: mongodbId,
                x,
                y
            })
        });

        if (!response.ok) {
            console.error('Failed to update player position in MongoDB:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating player position in MongoDB:', error);
        return null;
    }
}

/**
 * Load player from MongoDB by ID
 * Note: This returns all active players; filtering by ID is done client-side
 */
export async function loadPlayersFromMongoDB(): Promise<MongoDBPlayer[]> {
    try {
        const response = await fetch(`${API_URL}/api/game/players`);

        if (!response.ok) {
            console.error('Failed to load players from MongoDB:', response.statusText);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error loading players from MongoDB:', error);
        return [];
    }
}

/**
 * Get or create the game world
 */
export async function getOrCreateWorld(): Promise<MongoDBWorld | null> {
    try {
        const response = await fetch(`${API_URL}/api/game/world`);

        if (!response.ok) {
            console.error('Failed to get world from MongoDB:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting world from MongoDB:', error);
        return null;
    }
}

/**
 * Initialize world with obstacles
 */
export async function initializeWorldObstacles(
    obstacles: { x: number; y: number; width: number; height: number }[]
): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/api/game/world/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obstacles })
        });

        if (!response.ok) {
            console.error('Failed to initialize world obstacles:', response.statusText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error initializing world obstacles:', error);
        return false;
    }
}

/**
 * Delete player from MongoDB (when leaving the game permanently)
 */
export async function deletePlayerFromMongoDB(mongodbId: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/api/game/player/${mongodbId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Failed to delete player from MongoDB:', response.statusText);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error deleting player from MongoDB:', error);
        return false;
    }
}

/**
 * Get player profile by ID
 */
export async function getPlayerProfile(playerId: string): Promise<MongoDBPlayer | null> {
    try {
        const response = await fetch(`${API_URL}/api/player/${playerId}`);

        if (!response.ok) {
            console.error('Failed to get player profile:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting player profile:', error);
        return null;
    }
}

/**
 * Update player profile
 */
export async function updatePlayerProfile(
    playerId: string,
    profileData: {
        biography?: string;
        score?: number;
        interests?: string[];
        level?: number;
        name?: string;
        userName?: string;
        avatarColor?: string;
    }
): Promise<MongoDBPlayer | null> {
    try {
        const response = await fetch(`${API_URL}/api/player/${playerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            console.error('Failed to update player profile:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating player profile:', error);
        return null;
    }
}

/**
 * Add score to player
 */
export async function addPlayerScore(playerId: string, points: number): Promise<MongoDBPlayer | null> {
    try {
        const response = await fetch(`${API_URL}/api/player/${playerId}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points })
        });

        if (!response.ok) {
            console.error('Failed to add player score:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error adding player score:', error);
        return null;
    }
}

/**
 * Add interest to player
 */
export async function addPlayerInterest(playerId: string, interest: string): Promise<MongoDBPlayer | null> {
    try {
        const response = await fetch(`${API_URL}/api/player/${playerId}/interests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interest })
        });

        if (!response.ok) {
            console.error('Failed to add player interest:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error adding player interest:', error);
        return null;
    }
}

// ============== Teacher API Functions ==============

export interface Teacher {
    id: string;
    _id?: string;
    worldId: string;
    topic: string;
    name: string;
    systemPrompt: string;
    personality: string;
    x: number;
    y: number;
    avatarColor: string;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Get all teachers in the world
 */
export async function getTeachers(): Promise<Teacher[]> {
    try {
        const response = await fetch(`${API_URL}/api/teacher`);

        if (!response.ok) {
            console.error('Failed to get teachers:', response.statusText);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting teachers:', error);
        return [];
    }
}

/**
 * Check if a position is available for a new teacher (100px radius)
 */
export async function checkTeacherPosition(x: number, y: number): Promise<{
    available: boolean;
    nearbyTeacher: { id: string; name: string; topic: string; distance: number } | null;
}> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/check-position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y })
        });

        if (!response.ok) {
            console.error('Failed to check teacher position:', response.statusText);
            return { available: false, nearbyTeacher: null };
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking teacher position:', error);
        return { available: false, nearbyTeacher: null };
    }
}

/**
 * Create a new teacher at a position
 */
export async function createTeacher(
    topic: string,
    x: number,
    y: number,
    createdBy: string,
    teacherInfo?: { name: string; systemPrompt: string; personality: string }
): Promise<Teacher | null> {
    try {
        const body: any = { topic, x, y, createdBy };
        if (teacherInfo) {
            body.name = teacherInfo.name;
            body.systemPrompt = teacherInfo.systemPrompt;
            body.personality = teacherInfo.personality;
        }
        
        const response = await fetch(`${API_URL}/api/teacher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Failed to create teacher:', error);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating teacher:', error);
        return null;
    }
}

export interface EvaluationResult {
    score: number; // Score from 1-10
    feedback: string;
}

export interface TeacherChatResponse {
    response: string;
    teacherName: string;
    topic: string;
    isCorrect?: boolean;
    score?: number; // Score from 1-10
    tokensAwarded?: number;
    nftAwarded?: boolean;
    newScore?: number;
    evaluationResult?: EvaluationResult;
    // Legacy field for backwards compatibility
    toolCallResult?: any;
}

/**
 * Chat with a teacher
 */
export async function chatWithTeacher(
    teacherId: string,
    message: string,
    conversationHistory: { role: string; content: string }[],
    playerId?: string,
    walletAddress?: string
): Promise<TeacherChatResponse | null> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/${teacherId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, conversationHistory, playerId, walletAddress })
        });

        if (!response.ok) {
            console.error('Failed to chat with teacher:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error chatting with teacher:', error);
        return null;
    }
}

/**
 * Get a specific teacher by ID
 */
export async function getTeacher(teacherId: string): Promise<Teacher | null> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/${teacherId}`);

        if (!response.ok) {
            console.error('Failed to get teacher:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting teacher:', error);
        return null;
    }
}

// ============== Teacher Chat History API Functions ==============

export interface TeacherChatMessage {
    role: 'user' | 'teacher' | 'reward';
    content: string;
    timestamp: Date;
    speakerName?: string;
}

export interface TeacherChatHistoryResponse {
    id?: string;
    playerId: string;
    teacherId: string;
    teacherName: string;
    topic: string;
    messages: TeacherChatMessage[];
    lastMessageAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Get all chat histories for a player
 */
export async function getPlayerTeacherChatHistories(playerId: string): Promise<TeacherChatHistoryResponse[]> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/chat-history/player/${playerId}`);

        if (!response.ok) {
            console.error('Failed to get chat histories:', response.statusText);
            return [];
        }

        const histories = await response.json();
        // Parse dates
        return histories.map((h: any) => ({
            ...h,
            lastMessageAt: new Date(h.lastMessageAt),
            createdAt: h.createdAt ? new Date(h.createdAt) : undefined,
            updatedAt: h.updatedAt ? new Date(h.updatedAt) : undefined,
            messages: h.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }))
        }));
    } catch (error) {
        console.error('Error getting chat histories:', error);
        return [];
    }
}

/**
 * Get chat history for a specific player-teacher pair
 */
export async function getTeacherChatHistory(playerId: string, teacherId: string): Promise<TeacherChatHistoryResponse | null> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/chat-history/${playerId}/${teacherId}`);

        if (!response.ok) {
            console.error('Failed to get chat history:', response.statusText);
            return null;
        }

        const history = await response.json();
        if (!history.messages || history.messages.length === 0) {
            return null;
        }

        return {
            ...history,
            lastMessageAt: new Date(history.lastMessageAt),
            createdAt: history.createdAt ? new Date(history.createdAt) : undefined,
            updatedAt: history.updatedAt ? new Date(history.updatedAt) : undefined,
            messages: history.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }))
        };
    } catch (error) {
        console.error('Error getting chat history:', error);
        return null;
    }
}

/**
 * Save/update chat history for a player-teacher pair
 */
export async function saveTeacherChatHistory(
    playerId: string,
    teacherId: string,
    teacherName: string,
    topic: string,
    messages: { role: string; content: string; timestamp: Date; speakerName?: string }[]
): Promise<TeacherChatHistoryResponse | null> {
    try {
        const response = await fetch(`${API_URL}/api/teacher/chat-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                teacherId,
                teacherName,
                topic,
                messages
            })
        });

        if (!response.ok) {
            console.error('Failed to save chat history:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error saving chat history:', error);
        return null;
    }
}

// ============== Chat API Functions ==============

export interface Chat {
    id: string;
    participant1Id: string;
    participant2Id: string;
    participant1Name?: string;
    participant2Name?: string;
    participant1AvatarColor?: string;
    participant2AvatarColor?: string;
    lastMessage?: string;
    lastMessageAt?: Date;
    otherParticipantId?: string;
    otherParticipantName?: string;
    otherParticipantAvatarColor?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderName?: string;
    senderAvatarColor?: string;
    content: string;
    createdAt: Date;
}

/**
 * Get or create a chat conversation between two players
 */
export async function getOrCreateChat(participant1Id: string, participant2Id: string): Promise<Chat | null> {
    try {
        const response = await fetch(`${API_URL}/api/chat/conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participant1Id, participant2Id })
        });

        if (!response.ok) {
            console.error('Failed to get/create chat:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting/creating chat:', error);
        return null;
    }
}

/**
 * Get all chat conversations for a player
 */
export async function getPlayerConversations(playerId: string): Promise<Chat[]> {
    try {
        const response = await fetch(`${API_URL}/api/chat/${playerId}/conversations`);

        if (!response.ok) {
            console.error('Failed to get conversations:', response.statusText);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting conversations:', error);
        return [];
    }
}

/**
 * Get messages for a chat
 */
export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
    try {
        const response = await fetch(`${API_URL}/api/chat/${chatId}/messages`);

        if (!response.ok) {
            console.error('Failed to get messages:', response.statusText);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting messages:', error);
        return [];
    }
}

/**
 * Send a message in a chat
 */
export async function sendChatMessage(chatId: string, senderId: string, content: string): Promise<ChatMessage | null> {
    try {
        const response = await fetch(`${API_URL}/api/chat/${chatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId, content })
        });

        if (!response.ok) {
            console.error('Failed to send message:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}
