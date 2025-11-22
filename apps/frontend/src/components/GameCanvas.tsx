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

export interface NearbyPlayer {
    id: string;
    name: string;
    avatarColor: string;
    distance: number;
}

interface GameCanvasProps {
    onAgentAction?: (action: any) => void;
    onPlayerPositionChange?: (position: { x: number; y: number }) => void;
    onConnectionStatusChange?: (isConnected: boolean) => void;
    onNearbyPlayersChange?: (players: NearbyPlayer[]) => void;
    onPlayerCountChange?: (count: number) => void;
    autoMode?: boolean;
    proximityThreshold?: number;
}

export default function GameCanvas({
    onAgentAction,
    onPlayerPositionChange,
    onConnectionStatusChange,
    onNearbyPlayersChange,
    onPlayerCountChange,
    autoMode = true,
    proximityThreshold = 150
}: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const playerGraphicsRef = useRef<{ [playerId: string]: Graphics }>({});
    const playerLabelsRef = useRef<{ [playerId: string]: Text }>({});
    const keysRef = useRef<{ [key: string]: boolean }>({});
    const worldRef = useRef<Graphics | null>(null);
    const playerRef = useRef<Graphics | null>(null);
    const playerLabelRef = useRef<Text | null>(null);
    
    const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
    const [otherPlayers, setOtherPlayers] = useState<SocketPlayer[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const positionSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const playerIdRef = useRef<string>('');
    const otherPlayersRef = useRef<SocketPlayer[]>([]);
    const lastNearbyPlayersRef = useRef<string>('');

    // Keep otherPlayersRef in sync with state
    useEffect(() => {
        otherPlayersRef.current = otherPlayers;
    }, [otherPlayers]);

    // Notify parent of player count changes (current player + other players)
    useEffect(() => {
        const totalPlayers = 1 + otherPlayers.length; // 1 for current player
        onPlayerCountChange?.(totalPlayers);
    }, [otherPlayers, onPlayerCountChange]);

    // Initialize player and socket connection (runs once)
    useEffect(() => {
        // Initialize player data with random spawn position
        const playerData = getOrCreatePlayerData();
        setCurrentPlayer(playerData);
        playerIdRef.current = playerData.id;
        
        // Connect to socket server
        const socket = connectSocket();
        
        // Set up socket event listeners
        const cleanupFunctions = [
            onConnect(() => {
                console.log('Connected to game server');
                setIsConnected(true);
                onConnectionStatusChange?.(true);
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
                onConnectionStatusChange?.(false);
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
        
        return () => {
            // Cleanup
            cleanupFunctions.forEach(cleanup => cleanup());
            if (positionSyncIntervalRef.current) {
                clearInterval(positionSyncIntervalRef.current);
                positionSyncIntervalRef.current = null;
            }
            disconnectSocket();
        };
    }, []);

    // Separate useEffect for keyboard handling to prevent recreation
    useEffect(() => {
        const keys = keysRef.current;

        const onKeyDown = (e: KeyboardEvent) => {
            keys[e.key] = true;
            keys[e.key.toLowerCase()] = true; // Also handle lowercase
            console.log(`Key pressed: ${e.key}`, Object.keys(keys).filter(k => keys[k]));
        };

        const onKeyUp = (e: KeyboardEvent) => {
            keys[e.key] = false;
            keys[e.key.toLowerCase()] = false; // Also handle lowercase
            console.log(`Key released: ${e.key}`, Object.keys(keys).filter(k => keys[k]));
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // Initialize PixiJS Application (runs once, no dependencies)
    useEffect(() => {
        // Prevent multiple initializations
        if (appRef.current || !containerRef.current || !currentPlayer) {
            return;
        }

        // Initialize PixiJS Application
        const app = new Application();
        appRef.current = app;

        const initGame = async () => {
            await app.init({
                resizeTo: containerRef.current!,
                background: '#1a1a1a',
                antialias: true,
            });

            // Clear any existing canvas
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
                containerRef.current.appendChild(app.canvas);
            }

            // Create a world container
            const world = new Graphics();
            worldRef.current = world;
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
            playerRef.current = player;
            player.circle(0, 0, 20); // Make it larger for visibility
            const colorNum = parseInt(currentPlayer.avatarColor.replace('#', ''), 16);
            player.fill(colorNum);
            player.x = currentPlayer.x;
            player.y = currentPlayer.y;
            world.addChild(player);
            playerGraphicsRef.current[currentPlayer.id] = player;

            // Add player name label
            const playerLabel = new Text({
                text: currentPlayer.name + ' (You)',
                style: {
                    fill: '#ffffff',
                    fontSize: 14,
                    fontWeight: 'bold'
                }
            });
            playerLabelRef.current = playerLabel;
            playerLabel.x = player.x - playerLabel.width / 2;
            playerLabel.y = player.y - 40;
            world.addChild(playerLabel);
            playerLabelsRef.current[currentPlayer.id] = playerLabel;

            // Center camera on player initially
            const centerCameraOnPlayer = () => {
                world.pivot.x = player.x;
                world.pivot.y = player.y;
                world.position.x = app.screen.width / 2;
                world.position.y = app.screen.height / 2;
            };

            // Center camera on player
            centerCameraOnPlayer();

            // Render other players and check proximity
            const renderOtherPlayers = () => {
                const world = worldRef.current;
                if (!world) return;

                const currentPlayers = otherPlayersRef.current;
                const currentPlayerId = playerIdRef.current;

                // Remove graphics for players that no longer exist
                Object.keys(playerGraphicsRef.current).forEach(playerId => {
                    if (playerId !== currentPlayerId && !currentPlayers.find(p => p.id === playerId)) {
                        const graphics = playerGraphicsRef.current[playerId];
                        const label = playerLabelsRef.current[playerId];
                        if (graphics) world.removeChild(graphics);
                        if (label) world.removeChild(label);
                        delete playerGraphicsRef.current[playerId];
                        delete playerLabelsRef.current[playerId];
                    }
                });

                // Track nearby players for proximity detection
                const nearbyPlayers: NearbyPlayer[] = [];

                // Add/update graphics for existing players
                currentPlayers.forEach(playerData => {
                    if (!playerGraphicsRef.current[playerData.id]) {
                        // Create new player graphics
                        const otherPlayer = new Graphics();
                        otherPlayer.circle(0, 0, 20);
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
                                fontSize: 14,
                                fontWeight: 'bold'
                            }
                        });
                        otherLabel.x = otherPlayer.x - otherLabel.width / 2;
                        otherLabel.y = otherPlayer.y - 40;
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
                            label.y = playerData.y - 40;
                        }
                    }

                    // Check proximity to current player
                    if (playerRef.current) {
                        const dx = playerData.x - playerRef.current.x;
                        const dy = playerData.y - playerRef.current.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance <= proximityThreshold) {
                            nearbyPlayers.push({
                                id: playerData.id,
                                name: playerData.name,
                                avatarColor: playerData.avatarColor,
                                distance
                            });
                        }
                    }
                });

                // Notify about nearby players (only if changed)
                const nearbyKey = nearbyPlayers.map(p => p.id).sort().join(',');
                if (nearbyKey !== lastNearbyPlayersRef.current) {
                    lastNearbyPlayersRef.current = nearbyKey;
                    onNearbyPlayersChange?.(nearbyPlayers);
                }
            };

            // Enhanced game loop with fixed keyboard state reference and camera following
            app.ticker.add((ticker) => {
                // Fixed speed for consistent movement
                const speed = 8; // Fixed speed for better control
                let dx = 0;
                let dy = 0;
                let moving = false;

                // Use the persistent keys ref instead of recreated local variable
                const keys = keysRef.current;

                // Check for movement keys
                if (keys['w'] || keys['W'] || keys['ArrowUp']) {
                    dy -= speed;
                    moving = true;
                }
                if (keys['s'] || keys['S'] || keys['ArrowDown']) {
                    dy += speed;
                    moving = true;
                }
                if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
                    dx -= speed;
                    moving = true;
                }
                if (keys['d'] || keys['D'] || keys['ArrowRight']) {
                    dx += speed;
                    moving = true;
                }

                if (moving && playerRef.current && playerLabelRef.current) {
                    const oldX = player.x;
                    const oldY = player.y;

                    player.x += dx;
                    player.y += dy;

                    console.log(`Player moved from (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) to (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);

                    // Update player label position
                    playerLabel.x = player.x - playerLabel.width / 2;
                    playerLabel.y = player.y - 40;

                    // Notify parent component of position change immediately for responsive display
                    if (onPlayerPositionChange) {
                        onPlayerPositionChange({ x: player.x, y: player.y });
                    }

                    // Camera follow - always center on player
                    centerCameraOnPlayer();
                }

                // Always render other players (even when not moving) to update their positions
                renderOtherPlayers();
            });

            // Position sync interval (every 2 seconds)
            positionSyncIntervalRef.current = setInterval(() => {
                if (currentPlayer && isConnected && playerRef.current) {
                    const newX = player.x;
                    const newY = player.y;
                    
                    console.log(`Syncing position: (${newX.toFixed(1)}, ${newY.toFixed(1)})`);
                    
                    // Update localStorage
                    setPlayerPosition(newX, newY);
                    
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
            }, 2000);

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
                        if (action.payload && playerRef.current && playerLabelRef.current) {
                            player.x += (action.payload.dx || 0) * 10;
                            player.y += (action.payload.dy || 0) * 10;
                            playerLabel.x = player.x - playerLabel.width / 2;
                            playerLabel.y = player.y - 40;
                            
                            // Notify parent component of position change for agent movement too
                            if (onPlayerPositionChange) {
                                onPlayerPositionChange({ x: player.x, y: player.y });
                            }
                            
                            // Update camera for agent movement too
                            centerCameraOnPlayer();
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
            // Cleanup - destroy the PixiJS app properly
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
            }
            
            // Clear references
            worldRef.current = null;
            playerRef.current = null;
            playerLabelRef.current = null;
            
            if (positionSyncIntervalRef.current) {
                clearInterval(positionSyncIntervalRef.current);
                positionSyncIntervalRef.current = null;
            }
        };
    }, [currentPlayer]); // Only depend on currentPlayer

    // Update other players when they change (separate effect)
    useEffect(() => {
        if (!worldRef.current || !currentPlayer) return;

        const world = worldRef.current;
        const currentPlayerId = currentPlayer.id;

        // Remove graphics for players that no longer exist
        Object.keys(playerGraphicsRef.current).forEach(playerId => {
            if (playerId !== currentPlayerId && !otherPlayers.find(p => p.id === playerId)) {
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
                otherPlayer.circle(0, 0, 20);
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
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                });
                otherLabel.x = otherPlayer.x - otherLabel.width / 2;
                otherLabel.y = otherPlayer.y - 40;
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
                    label.y = playerData.y - 40;
                }
            }
        });
    }, [otherPlayers, currentPlayer]);

    return <div ref={containerRef} className="relative w-full h-full" />;
}
