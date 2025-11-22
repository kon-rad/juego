// MongoDB API functions for player persistence

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface MongoDBPlayer {
    id: string;         // MongoDB ObjectId as string
    _id?: string;       // MongoDB ObjectId (from response)
    worldId?: string;
    name: string;
    avatarColor: string;
    x: number;
    y: number;
    isAI: boolean;
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
            console.error('Failed to save player to MongoDB:', response.statusText);
            return null;
        }

        const result = await response.json();
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
