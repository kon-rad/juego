// Player management utilities for localStorage persistence

import { savePlayerToMongoDB } from './mongodb-api';

export interface PlayerData {
    id: string;           // localStorage UUID (used for Socket.IO)
    mongodbId?: string;   // MongoDB ObjectId (used for persistence)
    name: string;
    avatarColor: string;
    x: number;
    y: number;
}

const PLAYER_KEY = 'juego_player_id';
const PLAYER_NAME_KEY = 'juego_player_name';
const PLAYER_COLOR_KEY = 'juego_player_color';
const PLAYER_X_KEY = 'juego_player_x';
const PLAYER_Y_KEY = 'juego_player_y';
const MONGODB_PLAYER_ID_KEY = 'juego_mongodb_player_id';

const DEFAULT_WORLD_WIDTH = 2000;
const DEFAULT_WORLD_HEIGHT = 2000;

/**
 * Generate a random vibrant color
 */
function generateRandomColor(): string {
    const colors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Cyan
        '#45B7D1', // Blue
        '#FFA07A', // Orange
        '#98D8C8', // Mint
        '#F7DC6F', // Yellow
        '#BB8FCE', // Purple
        '#85C1E2', // Sky Blue
        '#F8B195', // Peach
        '#C06C84', // Pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate random spawn position within world bounds
 */
function generateRandomPosition(worldWidth: number = DEFAULT_WORLD_WIDTH, worldHeight: number = DEFAULT_WORLD_HEIGHT): { x: number; y: number } {
    // Generate position within world bounds, leaving some margin from edges
    const margin = 100;
    const x = Math.random() * (worldWidth - margin * 2) + margin;
    const y = Math.random() * (worldHeight - margin * 2) + margin;
    
    return { x, y };
}

/**
 * Get or create a unique player ID stored in localStorage
 */
export function getOrCreatePlayerId(): string {
    if (typeof window === 'undefined') return '';

    let playerId = localStorage.getItem(PLAYER_KEY);

    if (!playerId) {
        // Generate a new UUID
        playerId = crypto.randomUUID();
        localStorage.setItem(PLAYER_KEY, playerId);
    }

    return playerId;
}

/**
 * Get or create a player name
 */
export function getOrCreatePlayerName(): string {
    if (typeof window === 'undefined') return 'Player';

    let playerName = localStorage.getItem(PLAYER_NAME_KEY);

    if (!playerName) {
        // Generate a random name
        const adjectives = ['Swift', 'Brave', 'Clever', 'Bold', 'Quick', 'Wise', 'Silent', 'Mighty'];
        const nouns = ['Fox', 'Wolf', 'Eagle', 'Tiger', 'Bear', 'Hawk', 'Lion', 'Dragon'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        playerName = `${adj}${noun}`;
        localStorage.setItem(PLAYER_NAME_KEY, playerName);
    }

    return playerName;
}

/**
 * Get or create avatar color
 */
export function getOrCreateAvatarColor(): string {
    if (typeof window === 'undefined') return '#00ff00';

    let avatarColor = localStorage.getItem(PLAYER_COLOR_KEY);

    if (!avatarColor) {
        avatarColor = generateRandomColor();
        localStorage.setItem(PLAYER_COLOR_KEY, avatarColor);
    }

    return avatarColor;
}

/**
 * Get or create player position
 */
export function getOrCreatePlayerPosition(): { x: number; y: number } {
    if (typeof window === 'undefined') return { x: 0, y: 0 };

    const xStr = localStorage.getItem(PLAYER_X_KEY);
    const yStr = localStorage.getItem(PLAYER_Y_KEY);

    if (xStr && yStr) {
        return { x: parseFloat(xStr), y: parseFloat(yStr) };
    }

    // Generate new random position if none exists
    const position = generateRandomPosition();
    setPlayerPosition(position.x, position.y);
    return position;
}

/**
 * Set player position in localStorage
 */
export function setPlayerPosition(x: number, y: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLAYER_X_KEY, x.toString());
    localStorage.setItem(PLAYER_Y_KEY, y.toString());
}

/**
 * Get complete player data with all attributes
 */
export function getOrCreatePlayerData(): PlayerData {
    const id = getOrCreatePlayerId();
    const name = getOrCreatePlayerName();
    const avatarColor = getOrCreateAvatarColor();
    const position = getOrCreatePlayerPosition();

    return {
        id,
        name,
        avatarColor,
        x: position.x,
        y: position.y
    };
}

/**
 * Update player name in localStorage
 */
export function setPlayerName(name: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Clear player data (for testing/reset)
 */
export function clearPlayerData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PLAYER_KEY);
    localStorage.removeItem(PLAYER_NAME_KEY);
    localStorage.removeItem(PLAYER_COLOR_KEY);
    localStorage.removeItem(PLAYER_X_KEY);
    localStorage.removeItem(PLAYER_Y_KEY);
}

/**
 * Get all connected players from the server (placeholder for future implementation)
 */
export async function getAllPlayers(): Promise<PlayerData[]> {
    try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
        const response = await fetch(`${API_URL}/api/game/players`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch players:', error);
    }
    return [];
}

/**
 * Get MongoDB player ID from localStorage
 */
export function getMongoDBPlayerId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(MONGODB_PLAYER_ID_KEY);
}

/**
 * Set MongoDB player ID in localStorage
 */
export function setMongoDBPlayerId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MONGODB_PLAYER_ID_KEY, id);
}

/**
 * Clear MongoDB player ID from localStorage
 */
export function clearMongoDBPlayerId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(MONGODB_PLAYER_ID_KEY);
}

/**
 * Get or create player from MongoDB
 * - If MongoDB ID exists in localStorage, return it
 * - If not, create a new player in MongoDB and store the ID
 */
export async function getOrCreatePlayerFromMongoDB(): Promise<PlayerData> {
    // First get local player data
    const localPlayerData = getOrCreatePlayerData();

    // Check if we already have a MongoDB ID
    const existingMongoDBId = getMongoDBPlayerId();

    if (existingMongoDBId) {
        // We have a MongoDB ID, return the player data with it
        return {
            ...localPlayerData,
            mongodbId: existingMongoDBId
        };
    }

    // No MongoDB ID, create a new player in MongoDB
    const mongoPlayer = await savePlayerToMongoDB({
        name: localPlayerData.name,
        avatarColor: localPlayerData.avatarColor,
        x: localPlayerData.x,
        y: localPlayerData.y,
        isAI: false
    });

    if (mongoPlayer && mongoPlayer.id) {
        // Store the MongoDB ID for future use
        setMongoDBPlayerId(mongoPlayer.id);

        return {
            ...localPlayerData,
            mongodbId: mongoPlayer.id
        };
    }

    // Failed to create in MongoDB, return without MongoDB ID
    console.warn('Failed to create player in MongoDB, using localStorage only');
    return localPlayerData;
}
