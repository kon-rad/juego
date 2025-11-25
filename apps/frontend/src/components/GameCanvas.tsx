'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Text, Container } from 'pixi.js';
import {
    getOrCreatePlayerFromMongoDB,
    setPlayerPosition,
    PlayerData,
    getOrCreatePlayerName
} from '@/lib/player';
import {
    updatePlayerPositionInMongoDB,
    getOrCreateWorld,
    getTeachers,
    Teacher
} from '@/lib/mongodb-api';
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
import {
    createCharacterSprite,
    updateCharacterSprite,
    getDirectionFromMovement,
    CharacterSprite,
    Direction
} from '@/lib/character-sprite';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface NearbyPlayer {
    id: string;
    name: string;
    avatarColor: string;
    distance: number;
    mongodbId?: string;  // MongoDB ObjectId for chat operations
}

export interface NearbyTeacher {
    id: string;
    name: string;
    topic: string;
    x: number;
    y: number;
    distance: number;
}

interface GameCanvasProps {
    onAgentAction?: (action: any) => void;
    onPlayerPositionChange?: (position: { x: number; y: number }) => void;
    onConnectionStatusChange?: (isConnected: boolean) => void;
    onNearbyPlayersChange?: (players: NearbyPlayer[]) => void;
    onPlayerCountChange?: (count: number) => void;
    onPlayerIdChange?: (playerId: string) => void;
    onMongoDBPlayerIdChange?: (mongodbId: string) => void;
    onNearbyTeachersChange?: (teachers: NearbyTeacher[]) => void;
    autoMode?: boolean;
    proximityThreshold?: number;
    isGenieVisible?: boolean;
    teachers?: Teacher[];
    playerNameUpdateTrigger?: number;
}

export default function GameCanvas({
    onAgentAction,
    onPlayerPositionChange,
    onConnectionStatusChange,
    onNearbyPlayersChange,
    onPlayerCountChange,
    onPlayerIdChange,
    onMongoDBPlayerIdChange,
    onNearbyTeachersChange,
    autoMode = true,
    proximityThreshold = 150,
    isGenieVisible = false,
    teachers = [],
    playerNameUpdateTrigger = 0
}: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const playerGraphicsRef = useRef<{ [playerId: string]: CharacterSprite }>({});
    const playerLabelsRef = useRef<{ [playerId: string]: Text }>({});
    const keysRef = useRef<{ [key: string]: boolean }>({});
    const worldRef = useRef<Graphics | null>(null);
    const playerRef = useRef<CharacterSprite | null>(null);
    const playerLabelRef = useRef<Text | null>(null);
    const playerDirectionRef = useRef<Direction>('down');
    const genieGraphicsRef = useRef<Graphics | null>(null);
    const genieLabelRef = useRef<Text | null>(null);
    const teacherGraphicsRef = useRef<{ [teacherId: string]: Graphics }>({});
    const teacherLabelsRef = useRef<{ [teacherId: string]: Text }>({});
    const teachersRef = useRef<Teacher[]>([]);
    const lastNearbyTeachersRef = useRef<string>('');

    const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
    const [loadedTeachers, setLoadedTeachers] = useState<Teacher[]>([]);
    const [otherPlayers, setOtherPlayers] = useState<SocketPlayer[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);

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
        let isMounted = true;
        let cleanupFunctions: (() => void)[] = [];

        const initPlayer = async () => {
            // Initialize player data with MongoDB persistence
            const playerData = await getOrCreatePlayerFromMongoDB();

            if (!isMounted) return;

            setCurrentPlayer(playerData);
            playerIdRef.current = playerData.id;
            onPlayerIdChange?.(playerData.id);

            // Notify parent when MongoDB ID is ready
            if (playerData.mongodbId) {
                onMongoDBPlayerIdChange?.(playerData.mongodbId);
            }

            // Load teachers from database
            const dbTeachers = await getTeachers();
            setLoadedTeachers(dbTeachers);
            teachersRef.current = dbTeachers;

            // Connect to socket server
            connectSocket();

            // Set up socket event listeners
            cleanupFunctions = [
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
                        isAI: false,
                        mongodbId: playerData.mongodbId
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
                    setOtherPlayers(prev => {
                        // Prevent duplicates by checking if player already exists
                        if (prev.some(p => p.id === player.id)) {
                            return prev;
                        }
                        return [...prev, player];
                    });
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
        };

        initPlayer();

        return () => {
            isMounted = false;
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
            // Don't handle keyboard input when user is typing in an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            keys[e.key] = true;
            keys[e.key.toLowerCase()] = true; // Also handle lowercase
            console.log(`Key pressed: ${e.key}`, Object.keys(keys).filter(k => keys[k]));
        };

        const onKeyUp = (e: KeyboardEvent) => {
            // Don't handle keyboard input when user is typing in an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

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

    // Update player label when name changes
    useEffect(() => {
        if (currentPlayer && playerLabelRef.current) {
            const newName = getOrCreatePlayerName();
            const labelText = newName + ' (You)';
            playerLabelRef.current.text = labelText;
            // Re-center the label
            if (playerRef.current) {
                playerLabelRef.current.x = playerRef.current.container.x - playerLabelRef.current.width / 2;
            }
            console.log('Updated player label to:', labelText);
        }
    }, [playerNameUpdateTrigger]);

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
            const playerSprite = createCharacterSprite(currentPlayer.avatarColor);
            playerRef.current = playerSprite;
            playerSprite.container.x = currentPlayer.x;
            playerSprite.container.y = currentPlayer.y;
            world.addChild(playerSprite.container);
            playerGraphicsRef.current[currentPlayer.id] = playerSprite;

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
            playerLabel.x = playerSprite.container.x - playerLabel.width / 2;
            playerLabel.y = playerSprite.container.y - 40;
            world.addChild(playerLabel);
            playerLabelsRef.current[currentPlayer.id] = playerLabel;

            // Share initial player position with parent consumers (needed for genie placement)
            onPlayerPositionChange?.({ x: playerSprite.container.x, y: playerSprite.container.y });

            // Center camera on player initially
            const centerCameraOnPlayer = () => {
                world.pivot.x = playerSprite.container.x;
                world.pivot.y = playerSprite.container.y;
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
                        const sprite = playerGraphicsRef.current[playerId];
                        const label = playerLabelsRef.current[playerId];
                        if (sprite) world.removeChild(sprite.container);
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
                        // Create new player sprite
                        const otherPlayerSprite = createCharacterSprite(playerData.avatarColor);
                        otherPlayerSprite.container.x = playerData.x;
                        otherPlayerSprite.container.y = playerData.y;
                        world.addChild(otherPlayerSprite.container);
                        playerGraphicsRef.current[playerData.id] = otherPlayerSprite;

                        // Add player name label
                        const otherLabel = new Text({
                            text: playerData.name,
                            style: {
                                fill: '#ffffff',
                                fontSize: 14,
                                fontWeight: 'bold'
                            }
                        });
                        otherLabel.x = playerData.x - otherLabel.width / 2;
                        otherLabel.y = playerData.y - 40;
                        world.addChild(otherLabel);
                        playerLabelsRef.current[playerData.id] = otherLabel;
                    } else {
                        // Update existing player graphics
                        const sprite = playerGraphicsRef.current[playerData.id];
                        const label = playerLabelsRef.current[playerData.id];
                        if (sprite) {
                            sprite.container.x = playerData.x;
                            sprite.container.y = playerData.y;
                        }
                        if (label) {
                            label.x = playerData.x - label.width / 2;
                            label.y = playerData.y - 40;
                        }
                    }

                    // Check proximity to current player
                    if (playerRef.current) {
                        const dx = playerData.x - playerRef.current.container.x;
                        const dy = playerData.y - playerRef.current.container.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance <= proximityThreshold) {
                            nearbyPlayers.push({
                                id: playerData.id,
                                name: playerData.name,
                                avatarColor: playerData.avatarColor,
                                distance,
                                mongodbId: playerData.mongodbId
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

            // Enhanced game loop with sprite animation and camera following
            app.ticker.add((ticker) => {
                // Fixed speed for consistent movement
                const speed = 8;
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

                if (playerRef.current && playerLabelRef.current) {
                    const playerSprite = playerRef.current;
                    const oldX = playerSprite.container.x;
                    const oldY = playerSprite.container.y;

                    if (moving) {
                        // Update position
                        playerSprite.container.x += dx;
                        playerSprite.container.y += dy;

                        console.log(`Player moved from (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) to (${playerSprite.container.x.toFixed(1)}, ${playerSprite.container.y.toFixed(1)})`);

                        // Determine direction based on movement
                        const direction = getDirectionFromMovement(dx, dy);
                        playerDirectionRef.current = direction;

                        // Update player label position
                        playerLabel.x = playerSprite.container.x - playerLabel.width / 2;
                        playerLabel.y = playerSprite.container.y - 40;

                        // Notify parent component of position change immediately for responsive display
                        if (onPlayerPositionChange) {
                            onPlayerPositionChange({ x: playerSprite.container.x, y: playerSprite.container.y });
                        }

                        // Camera follow - always center on player
                        centerCameraOnPlayer();
                    }

                    // Update sprite animation (handles both moving and standing)
                    updateCharacterSprite(
                        playerSprite,
                        currentPlayer.avatarColor,
                        playerDirectionRef.current,
                        moving,
                        ticker.deltaTime
                    );
                }

                // Always render other players (even when not moving) to update their positions
                renderOtherPlayers();
            });

            // Position sync interval (every 2 seconds)
            positionSyncIntervalRef.current = setInterval(() => {
                if (currentPlayer && isConnected && playerRef.current) {
                    const newX = playerRef.current.container.x;
                    const newY = playerRef.current.container.y;

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
                        isAI: false,
                        mongodbId: currentPlayer.mongodbId
                    });
                }
            }, 2000);

            // Agent Loop
            const runAgent = async () => {
                if (!appRef.current || !autoMode || !playerRef.current) return;

                const state = {
                    player: { x: playerRef.current.container.x, y: playerRef.current.container.y },
                    world: { width, height, obstacles }
                };

                try {
                    const response = await fetch(`${API_BASE_URL}/api/agent/tick`, {
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
                            const dx = (action.payload.dx || 0) * 10;
                            const dy = (action.payload.dy || 0) * 10;

                            playerRef.current.container.x += dx;
                            playerRef.current.container.y += dy;
                            playerLabel.x = playerRef.current.container.x - playerLabel.width / 2;
                            playerLabel.y = playerRef.current.container.y - 40;

                            // Update direction for agent movement
                            if (dx !== 0 || dy !== 0) {
                                playerDirectionRef.current = getDirectionFromMovement(dx, dy);
                            }

                            // Notify parent component of position change for agent movement too
                            if (onPlayerPositionChange) {
                                onPlayerPositionChange({ x: playerRef.current.container.x, y: playerRef.current.container.y });
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
                const sprite = playerGraphicsRef.current[playerId];
                const label = playerLabelsRef.current[playerId];
                if (sprite) world.removeChild(sprite.container);
                if (label) world.removeChild(label);
                delete playerGraphicsRef.current[playerId];
                delete playerLabelsRef.current[playerId];
            }
        });

        // Add/update graphics for existing players
        otherPlayers.forEach(playerData => {
            if (!playerGraphicsRef.current[playerData.id]) {
                // Create new player sprite
                const otherPlayerSprite = createCharacterSprite(playerData.avatarColor);
                otherPlayerSprite.container.x = playerData.x;
                otherPlayerSprite.container.y = playerData.y;
                world.addChild(otherPlayerSprite.container);
                playerGraphicsRef.current[playerData.id] = otherPlayerSprite;

                // Add player name label
                const otherLabel = new Text({
                    text: playerData.name,
                    style: {
                        fill: '#ffffff',
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                });
                otherLabel.x = playerData.x - otherLabel.width / 2;
                otherLabel.y = playerData.y - 40;
                world.addChild(otherLabel);
                playerLabelsRef.current[playerData.id] = otherLabel;
            } else {
                // Update existing player sprite
                const sprite = playerGraphicsRef.current[playerData.id];
                const label = playerLabelsRef.current[playerData.id];
                if (sprite) {
                    sprite.container.x = playerData.x;
                    sprite.container.y = playerData.y;
                }
                if (label) {
                    label.x = playerData.x - label.width / 2;
                    label.y = playerData.y - 40;
                }
            }
        });
    }, [otherPlayers, currentPlayer]);

    // Handle Genie visibility - spawn next to player when visible
    useEffect(() => {
        const world = worldRef.current;
        const playerSprite = playerRef.current;

        if (!world || !playerSprite) return;

        if (isGenieVisible) {
            // Create genie if it doesn't exist
            if (!genieGraphicsRef.current) {
                const genie = new Graphics();

                // Gold genie body - lamp smoke shape
                genie.circle(0, 0, 25);
                genie.fill(0xFFD700); // Gold color

                // Add a glow effect with outer circle
                const genieGlow = new Graphics();
                genieGlow.circle(0, 0, 30);
                genieGlow.fill({ color: 0xFFA500, alpha: 0.3 });
                world.addChild(genieGlow);

                // Position genie next to player (offset by 60px to the right)
                genie.x = playerSprite.container.x + 60;
                genie.y = playerSprite.container.y;
                genieGlow.x = genie.x;
                genieGlow.y = genie.y;

                world.addChild(genie);
                genieGraphicsRef.current = genie;

                // Add genie label
                const genieLabel = new Text({
                    text: 'Learning Genie',
                    style: {
                        fill: '#FFD700',
                        fontSize: 12,
                        fontWeight: 'bold'
                    }
                });
                genieLabel.x = genie.x - genieLabel.width / 2;
                genieLabel.y = genie.y - 45;
                world.addChild(genieLabel);
                genieLabelRef.current = genieLabel;
            } else {
                // Update genie position to follow player
                const genie = genieGraphicsRef.current;
                const label = genieLabelRef.current;
                genie.x = playerSprite.container.x + 60;
                genie.y = playerSprite.container.y;
                if (label) {
                    label.x = genie.x - label.width / 2;
                    label.y = genie.y - 45;
                }
            }
        } else {
            // Remove genie when not visible
            if (genieGraphicsRef.current) {
                world.removeChild(genieGraphicsRef.current);
                genieGraphicsRef.current = null;
            }
            if (genieLabelRef.current) {
                world.removeChild(genieLabelRef.current);
                genieLabelRef.current = null;
            }
        }
    }, [isGenieVisible, currentPlayer]);

    // Render teachers on the map and check proximity
    useEffect(() => {
        const world = worldRef.current;
        const playerSprite = playerRef.current;

        if (!world || !playerSprite) return;

        // Combine loaded teachers with newly created teachers from props
        const allTeachers = [...loadedTeachers, ...teachers.filter(t =>
            !loadedTeachers.find(lt => lt.id === t.id)
        )];
        teachersRef.current = allTeachers;

        // Track nearby teachers
        const nearbyTeachers: NearbyTeacher[] = [];

        // Render each teacher
        allTeachers.forEach(teacher => {
            if (!teacherGraphicsRef.current[teacher.id]) {
                // Create teacher graphics - gold circle with glow
                const teacherGfx = new Graphics();
                teacherGfx.circle(0, 0, 25);
                teacherGfx.fill(0xFFD700); // Gold color

                // Add glow
                const teacherGlow = new Graphics();
                teacherGlow.circle(0, 0, 30);
                teacherGlow.fill({ color: 0xFFA500, alpha: 0.3 });
                teacherGlow.x = teacher.x;
                teacherGlow.y = teacher.y;
                world.addChild(teacherGlow);

                teacherGfx.x = teacher.x;
                teacherGfx.y = teacher.y;
                world.addChild(teacherGfx);
                teacherGraphicsRef.current[teacher.id] = teacherGfx;

                // Add teacher label
                const teacherLabel = new Text({
                    text: teacher.name,
                    style: {
                        fill: '#FFD700',
                        fontSize: 12,
                        fontWeight: 'bold'
                    }
                });
                teacherLabel.x = teacher.x - teacherLabel.width / 2;
                teacherLabel.y = teacher.y - 45;
                world.addChild(teacherLabel);
                teacherLabelsRef.current[teacher.id] = teacherLabel;
            }

            // Check proximity to current player
            const dx = teacher.x - playerSprite.container.x;
            const dy = teacher.y - playerSprite.container.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= proximityThreshold) {
                nearbyTeachers.push({
                    id: teacher.id,
                    name: teacher.name,
                    topic: teacher.topic,
                    x: teacher.x,
                    y: teacher.y,
                    distance
                });
            }
        });

        // Notify about nearby teachers (only if changed)
        const nearbyKey = nearbyTeachers.map(t => t.id).sort().join(',');
        if (nearbyKey !== lastNearbyTeachersRef.current) {
            lastNearbyTeachersRef.current = nearbyKey;
            onNearbyTeachersChange?.(nearbyTeachers);
        }
    }, [loadedTeachers, teachers, currentPlayer, proximityThreshold, onNearbyTeachersChange]);

    // Initialize wallet on component mount
    useEffect(() => {
        const initializeWallet = async () => {
            const storedWalletAddress = localStorage.getItem('walletAddress');

            try {
                let walletAddress;

                if (storedWalletAddress) {
                    // Use existing wallet address
                    const response = await fetch(`${API_BASE_URL}/api/player/wallet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ publicAddress: storedWalletAddress })
                    });

                    const data = await response.json();
                    if (response.ok) {
                        walletAddress = data.walletAddress;
                        console.log('Wallet retrieved:', walletAddress);
                    } else {
                        console.error('Failed to retrieve wallet:', data.error);
                    }
                } else {
                    // Create a new wallet
                    const response = await fetch(`${API_BASE_URL}/api/player/wallet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    });

                    const data = await response.json();
                    if (response.ok) {
                        walletAddress = data.walletAddress;
                        localStorage.setItem('walletAddress', walletAddress);
                        console.log('New wallet created:', walletAddress);
                    } else {
                        console.error('Failed to create wallet:', data.error);
                    }
                }
            } catch (error) {
                console.error('Error initializing wallet:', error);
            }
        };

        initializeWallet();
    }, []);

    useEffect(() => {
        const storedWalletAddress = localStorage.getItem('walletAddress');
        let walletAddress;

        const fetchWallet = async () => {
            if (storedWalletAddress) {
                const response = await fetch(`${API_BASE_URL}/api/player/wallet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ publicAddress: storedWalletAddress })
                });
                const data = await response.json();
                walletAddress = data.walletAddress;
            } else {
                const response = await fetch(`${API_BASE_URL}/api/player/wallet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await response.json();
                walletAddress = data.walletAddress;
                localStorage.setItem('walletAddress', walletAddress);
            }
            setWalletAddress(walletAddress);
        };

        fetchWallet();
    }, []);

    return <div ref={containerRef} className="relative w-full h-full" />;
}
