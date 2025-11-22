'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Graphics } from 'pixi.js';
import { getOrCreatePlayerId, getOrCreatePlayerName, getOrCreateAvatarColor } from '@/lib/player';

interface GameCanvasProps {
    onAgentAction?: (action: any) => void;
    autoMode?: boolean;
}

export default function GameCanvas({ onAgentAction, autoMode = true }: GameCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const [playerId, setPlayerId] = useState<string>('');
    const [playerName, setPlayerName] = useState<string>('');
    const [avatarColor, setAvatarColor] = useState<string>('#00ff00');
    const playerSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize player ID, name, and color from localStorage
    useEffect(() => {
        setPlayerId(getOrCreatePlayerId());
        setPlayerName(getOrCreatePlayerName());
        setAvatarColor(getOrCreateAvatarColor());
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
            if (!containerRef.current) return;

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
            const width = app.screen.width * 4; // Make world larger
            const height = app.screen.height * 4;

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


            // Create player avatar with their color
            const player = new Graphics();
            player.circle(0, 0, 15);
            // Convert hex color to number for PixiJS
            const colorNum = parseInt(avatarColor.replace('#', ''), 16);
            player.fill(colorNum);
            player.x = app.screen.width / 2;
            player.y = app.screen.height / 2;
            // Add player to the world container
            world.addChild(player);

            // Create player in backend
            const createPlayerInBackend = async () => {
                if (!playerId || !playerName) return;

                try {
                    const response = await fetch('http://localhost:3001/api/game/player', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: playerId,
                            name: playerName,
                            avatarColor: avatarColor,
                            x: player.x,
                            y: player.y,
                            isAI: false
                        })
                    });

                    if (response.ok) {
                        console.log('Player created/updated in backend');
                    }
                } catch (error) {
                    console.error('Failed to create player:', error);
                }
            };

            // Create player when entering world
            if (playerId && playerName) {
                createPlayerInBackend();
            }

            // Sync player position to backend periodically
            const syncPlayerPosition = async () => {
                if (!playerId) return;

                try {
                    await fetch('http://localhost:3001/api/game/player', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: playerId,
                            name: playerName,
                            avatarColor: avatarColor,
                            x: player.x,
                            y: player.y,
                            isAI: false
                        })
                    });
                } catch (error) {
                    console.error('Failed to sync player position:', error);
                }
            };

            // Start position sync interval (every 2 seconds)
            playerSyncIntervalRef.current = setInterval(syncPlayerPosition, 2000);

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

                // Camera follow
                world.pivot.x = player.x;
                world.pivot.y = player.y;
                world.position.x = app.screen.width / 2;
                world.position.y = app.screen.height / 2;
            });

            // Agent Loop
            const runAgent = async () => {
                if (!appRef.current || !autoMode) return;

                const state = {
                    player: { x: player.x, y: player.y },
                    world: { width, height, obstacles }
                };

                try {
                    const response = await fetch('http://localhost:3001/api/agent/tick', {
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
                        // For now, just teleport or nudge.
                        // In a real game, we'd set a target and move towards it in the ticker.
                        // Let's just nudge for simplicity of the prototype.
                        if (action.payload) {
                            player.x += (action.payload.dx || 0) * 10;
                            player.y += (action.payload.dy || 0) * 10;
                        }
                    } else if (action.type === 'think' || action.type === 'plan' || action.type === 'converse') {
                        // Display thought bubble?
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
            if (playerSyncIntervalRef.current) {
                clearInterval(playerSyncIntervalRef.current);
            }
            // PixiJS v8 handles cleanup automatically
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    return <div ref={containerRef} className="relative w-full h-full" />;
}
