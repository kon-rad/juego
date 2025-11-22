// Player management utilities for localStorage persistence

export interface PlayerData {
    id: string;
    name: string;
    avatarColor: string;
    x: number;
    y: number;
}

const PLAYER_KEY = 'juego_player_id';
const PLAYER_NAME_KEY = 'juego_player_name';
const PLAYER_COLOR_KEY = 'juego_player_color';

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
}
