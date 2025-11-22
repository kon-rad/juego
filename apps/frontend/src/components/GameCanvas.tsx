'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Text } from 'pixi.js';
import { 
    getOrCreatePlayerData, 
    setPlayerPosition, 
    PlayerData 
} from '@/lib/player';
import {
    connectSocket,
    disconnectSocket,
    joinGame,
    updatePlayerPosition,
    onPlayerJoined,
    onPlayerUpdated,
    onPlayerLeft,
    onPlayersSync,
    onConnect,
    onDisconnect,
    Player as SocketPlayer
} from '@/lib/socket';

interface GameCanvasProps {
    onAgentAction?: (action: any) => void;
    onPlayerPositionChange?: (position: { x: number; y: number }) => void;
    autoMode?: boolean;
}

export default function GameCanvas({ 
    onAgentAction, 
    onPlayerPositionChange,
    autoMode = true 
}: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const playerGraphicsRef = useRef<{ [playerId: string]: Graphics }>({});
    const playerLabelsRef = useRef<{ [playerId: string]: Text }>({});
    
    const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
    const [otherPlayers, setOtherPlayers] = useState<SocketPlayer[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    
    const positionSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize player and socket connection
    useEffect(() => {
        // Initialize player data with random spawn position
        const playerData = getOrCreatePlayerData();
        setCurrentPlayer(playerData);
        
        // Connect to socket server
        const socket = connectSocket();
        
        // Set up socket event listeners
        const cleanupFunctions = [
            onConnect(() => {
                console.log('Connected to game server');
                setIsConnected(true);
                // Join game when connected
                joinGame({
                    id: playerData.id,
                    name: playerData.name,
                    avatarColor: playerData.avatarColor,
                    x: playerData.x,
                    y: playerData.y,
                    isAI: false
                });
            }),
            
            onDisconnect(() => {
                console.log('Disconnected from game server');
                setIsConnected(false);
            }),
            
            onPlayersSync((players: SocketPlayer[]) => {
                console.log('Received players sync:', players);
                // Filter out current player from others
                const others = players.filter(p => p.id !== playerData.id);
                setOtherPlayers(others);
            }),
            
            onPlayerJoined((player: SocketPlayer) => {
                console.log('Player joined:', player.name);
                setOtherPlayers(prev => [...prev, player]);
            }),
            
            onPlayerUpdated((player: SocketPlayer) => {
                console.log('Player updated:', player.name);
                setOtherPlayers(prev => 
                    prev.map(p => p.id === player.id ? player : p)
                );
            }),
            
            onPlayerLeft((playerId: string) => {
                console.log('Player left:', playerId);
                setOtherPlayers(prev => prev.filter(p => p.id !== playerId));
            })
        ];
        
        // Position sync interval (every 1 second instead of 2 for smoother movement)
        positionSyncIntervalRef.current = setInterval(() => {
            if (appRef.current && currentPlayer && isConnected) {
                const playerGraphics = playerGraphicsRef.current[currentPlayer.id];
                if (playerGraphics) {
                    const newX = playerGraphics.x;
                    const newY = playerGraphics.y;
                    
                    // Update localStorage
                    setPlayerPosition(newX, newY);
                    
                    // Notify parent component of position change
                    if (onPlayerPositionChange) {
                        onPlayerPositionChange({ x: newX, y: newY });
                    }
                    
                    // Send position update to server
                    updatePlayerPosition({
                        id: currentPlayer.id,
                        name: currentPlayer.name,
                        avatarColor: currentPlayer.avatarColor,
                        x: newX,
                        y: newY,
                        isAI: false
                    });
                }
            }
        }, 1000);
        
        return () => {
            // Cleanup
            cleanupFunctions.forEach(cleanup => cleanup());
            if (positionSyncIntervalRef.current) {
                clearInterval(positionSyncIntervalRef.current);
            }
            disconnectSocket();
        };
    }, []);

    useEffect(() => {
        // Initialize PixiJS Application
        const app = new Application();
        appRef.current = app;

        // Movement state
        const keys: { [key: string]: boolean } = {};

        const onKeyDown = (e: KeyboardEvent) => {
            keys[e.key] = true;
        };

        const onKeyUp = (e: KeyboardEvent) => {
            keys[e.key] = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const initGame = async () => {
            if (!containerRef.current || !currentPlayer) return;

            await app.init({
                resizeTo: containerRef.current,
                background: '#1a1a1a',
                antialias: true,
            });

            if (containerRef.current) {
                containerRef.current.appendChild(app.canvas);
            }

            // Create a world container
            const world = new Graphics();
            app.stage.addChild(world);

            // Draw a grid to visualize movement
            const gridSize = 50;
            const width = 2000; // Fixed world size for consistency
            const height = 2000;

            world.strokeStyle = { width: 1, color: 0x333333 };
            for (let x = 0; x <= width; x += gridSize) {
                world.moveTo(x, 0);
                world.lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gridSize) {
                world.moveTo(0, y);
                world.lineTo(width, y);
            }
            world.stroke();

            // Add some random obstacles/buildings
            const obstacles: { x: number; y: number; width: number; height: number }[] = [];
            for (let i = 0; i < 20; i++) {
                const rect = new Graphics();
                rect.rect(0, 0, 100, 100);
                rect.fill(0x555555);
                const ox = Math.random() * width;
                const oy = Math.random() * height;
                rect.x = ox;
                rect.y = oy;
                world.addChild(rect);
                obstacles.push({ x: ox, y: oy, width: 100, height: 100 });
            }

            // Create current player avatar with their color and spawn position
            const player = new Graphics();
            player.circle(0, 0, 15);
            const colorNum = parseInt(currentPlayer.avatarColor.replace('#', ''), 16);
            player.fill(colorNum);
            player.x = currentPlayer.x;
            player.y = currentPlayer.y;
            world.addChild(player);
            playerGraphicsRef.current[currentPlayer.id] = player;

            // Add player name label
            const playerLabel = new Text({
                text: currentPlayer.name,
                style: {
                    fill: '#ffffff',
                    fontSize: 12,
                    fontWeight: 'bold'
                }
            });
            playerLabel.x = player.x - playerLabel.width / 2;
            playerLabel.y = player.y - 35;
            world.addChild(playerLabel);
            playerLabelsRef.current[currentPlayer.id] = playerLabel;

            // Render other players
            const renderOtherPlayers = () => {
                // Remove graphics for players that no longer exist
                Object.keys(playerGraphicsRef.current).forEach(playerId => {
                    if (playerId !== currentPlayer.id && !otherPlayers.find(p => p.id === playerId)) {
                        const graphics = playerGraphicsRef.current[playerId];
                        const label = playerLabelsRef.current[playerId];
                        if (graphics) world.removeChild(graphics);
                        if (label) world.removeChild(label);
                        delete playerGraphicsRef.current[playerId];
                        delete playerLabelsRef.current[playerId];
                    }
                });

                // Add/update graphics for existing players
                otherPlayers.forEach(playerData => {
                    if (!playerGraphicsRef.current[playerData.id]) {
                        // Create new player graphics
                        const otherPlayer = new Graphics();
                        otherPlayer.circle(0, 0, 15);
                        const otherColorNum = parseInt(playerData.avatarColor.replace('#', ''), 16);
                        otherPlayer.fill(otherColorNum);
                        otherPlayer.x = playerData.x;
                        otherPlayer.y = playerData.y;
                        world.addChild(otherPlayer);
                        playerGraphicsRef.current[playerData.id] = otherPlayer;

                        // Add player name label
                        const otherLabel = new Text({
                            text: playerData.name,
                            style: {
                                fill: '#ffffff',
                                fontSize: 12,
                                fontWeight: 'bold'
                            }
                        });
                        otherLabel.x = otherPlayer.x - otherLabel.width / 2;
                        otherLabel.y = otherPlayer.y - 35;
                        world.addChild(otherLabel);
                        playerLabelsRef.current[playerData.id] = otherLabel;
                    } else {
                        // Update existing player graphics
                        const graphics = playerGraphicsRef.current[playerData.id];
                        const label = playerLabelsRef.current[playerData.id];
                        if (graphics) {
                            graphics.x = playerData.x;
                            graphics.y = playerData.y;
                        }
                        if (label) {
                            label.x = playerData.x - label.width / 2;
                            label.y = playerData.y - 35;
                        }
                    }
                });
            };

            // Game loop
            app.ticker.add((ticker) => {
                const speed = 5 * ticker.deltaTime;
                let dx = 0;
                let dy = 0;

                if (keys['w'] || keys['ArrowUp']) dy -= speed;
                if (keys['s'] || keys['ArrowDown']) dy += speed;
                if (keys['a'] || keys['ArrowLeft']) dx -= speed;
                if (keys['d'] || keys['ArrowRight']) dx += speed;

                player.x += dx;
                player.y += dy;

                // Update player label position
                playerLabel.x = player.x - playerLabel.width / 2;
                playerLabel.y = player.y - 35;

                // Camera follow
                world.pivot.x = player.x;
                world.pivot.y = player.y;
                world.position.x = app.screen.width / 2;
                world.position.y = app.screen.height / 2;

                // Render other players
                renderOtherPlayers();
            });

            // Agent Loop
            const runAgent = async () => {
                if (!appRef.current || !autoMode) return;

                const state = {
                    player: { x: player.x, y: player.y },
                    world: { width, height, obstacles }
                };

                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agent/tick`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state })
                    });

                    const action = await response.json();
                    console.log('Agent Action:', action);

                    // Bubble up action to parent
                    if (onAgentAction) {
                        onAgentAction(action);
                    }

                    if (action.type === 'move') {
                        if (action.payload) {
                            player.x += (action.payload.dx || 0) * 10;
                            player.y += (action.payload.dy || 0) * 10;
                            playerLabel.x = player.x - playerLabel.width / 2;
                            playerLabel.y = player.y - 35;
                        }
                    } else if (action.type === 'think' || action.type === 'plan' || action.type === 'converse') {
                        console.log(`Agent ${action.type}:`, action.payload);
                    }

                } catch (e) {
                    console.error("Agent tick failed", e);
                }

                // Schedule next tick only if still in auto mode
                if (autoMode) {
                    setTimeout(runAgent, 2000);
                }
            };

            // Start agent loop only if auto mode is enabled
            if (autoMode) {
                runAgent();
            }
        };

        initGame();

        return () => {
            // Cleanup
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            // PixiJS v8 handles cleanup automatically
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPlayer, otherPlayers]); // Re-run when player or others change

    return <div ref={containerRef} className="relative w-full h-full" />;
}
