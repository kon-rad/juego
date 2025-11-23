import { io, Socket } from 'socket.io-client';

export interface Player {
    id: string;
    name: string;
    avatarColor: string;
    x: number;
    y: number;
    isAI: boolean;
    mongodbId?: string;  // MongoDB ObjectId for database operations
}

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        socket = io(socketUrl, {
            autoConnect: false,
            transports: ['websocket', 'polling']
        });
    }
    return socket;
}

export function connectSocket(): Socket {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
    return s;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
    }
}

// Player event handlers
export function joinGame(player: Player): void {
    const s = getSocket();
    s.emit('player:join', player);
}

export function updatePlayerPosition(player: Player): void {
    const s = getSocket();
    s.emit('player:update', player);
}

export function leaveGame(playerId: string): void {
    const s = getSocket();
    s.emit('player:leave', playerId);
}

export function requestPlayers(): void {
    const s = getSocket();
    s.emit('players:request');
}

// Event listener setup
export function onPlayersSync(callback: (players: Player[]) => void): () => void {
    const s = getSocket();
    s.on('players:sync', callback);
    return () => s.off('players:sync', callback);
}

export function onPlayerJoined(callback: (player: Player) => void): () => void {
    const s = getSocket();
    s.on('player:joined', callback);
    return () => s.off('player:joined', callback);
}

export function onPlayerUpdated(callback: (player: Player) => void): () => void {
    const s = getSocket();
    s.on('player:updated', callback);
    return () => s.off('player:updated', callback);
}

export function onPlayerLeft(callback: (playerId: string) => void): () => void {
    const s = getSocket();
    s.on('player:left', callback);
    return () => s.off('player:left', callback);
}

export function onConnect(callback: () => void): () => void {
    const s = getSocket();
    s.on('connect', callback);
    return () => s.off('connect', callback);
}

export function onDisconnect(callback: () => void): () => void {
    const s = getSocket();
    s.on('disconnect', callback);
    return () => s.off('disconnect', callback);
}

// Chat event handlers
export interface ChatMessageEvent {
    chatId: string;
    message: {
        id: string;
        chatId: string;
        senderId: string;
        senderName?: string;
        senderAvatarColor?: string;
        content: string;
        createdAt: Date;
    };
    recipientId: string;
}

export function onChatMessage(callback: (data: ChatMessageEvent) => void): () => void {
    const s = getSocket();
    s.on('chat:message', callback);
    return () => s.off('chat:message', callback);
}
