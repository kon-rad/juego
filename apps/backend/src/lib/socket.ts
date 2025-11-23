import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

export interface Player {
    id: string;
    name: string;
    avatarColor: string;
    x: number;
    y: number;
    isAI: boolean;
    mongodbId?: string;  // MongoDB ObjectId for database operations
}

// In-memory store of connected players
const players: Map<string, Player> = new Map();
let socketServer: SocketServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketServer {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    
    socketServer = io;

    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Handle player joining
        socket.on('player:join', (playerData: Player) => {
            console.log(`Player joined: ${playerData.id} (${playerData.name})`);
            
            // Store player data
            players.set(playerData.id, playerData);

            // Notify the joining player of all existing players
            socket.emit('players:sync', Array.from(players.values()));

            // Broadcast new player to all other clients
            socket.broadcast.emit('player:joined', playerData);
        });

        // Handle player position update
        socket.on('player:update', (playerData: Player) => {
            // Update player data
            players.set(playerData.id, playerData);

            // Broadcast updated position to all other clients
            socket.broadcast.emit('player:updated', playerData);
        });

        // Handle player leaving
        socket.on('player:leave', (playerId: string) => {
            console.log(`Player left: ${playerId}`);
            players.delete(playerId);
            socket.broadcast.emit('player:left', playerId);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            // Note: We don't remove the player here because the player ID is different from socket ID
            // The player will be removed when they explicitly leave or when the frontend handles cleanup
        });

        // Request all players (for reconnection scenarios)
        socket.on('players:request', () => {
            socket.emit('players:sync', Array.from(players.values()));
        });
    });

    console.log('Socket.IO server initialized');
    return io;
}

export function getConnectedPlayers(): Player[] {
    return Array.from(players.values());
}

export function removePlayer(playerId: string): void {
    players.delete(playerId);
}

export function getSocketServer(): SocketServer | null {
    return socketServer;
}
