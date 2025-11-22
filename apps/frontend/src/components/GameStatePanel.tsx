'use client';

interface GameStatePanelProps {
    currentPosition?: { x: number; y: number };
    playerCount?: number;
    isConnected?: boolean;
    agentCount?: number;
    tick?: number;
    fps?: number;
}

export default function GameStatePanel({ 
    currentPosition, 
    playerCount = 1, 
    isConnected = true, 
    agentCount = 1, 
    tick = 0, 
    fps = 60 
}: GameStatePanelProps) {
    const formatCoordinate = (value: number | undefined): string => {
        if (value === undefined) return '---';
        return value.toFixed(0);
    };

    return (
        <div className="h-full w-full bg-terminal-black border-t-2 border-matrix-green/30 p-4">
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                    <div className="text-xs font-mono uppercase tracking-wider text-dim-green">
                        Game State
                    </div>
                    <div className="h-4 w-px bg-matrix-green/30"></div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2">
                            <span className="text-ghost-green uppercase tracking-wider">Position:</span>
                            <span className="text-matrix-green">
                                ({formatCoordinate(currentPosition?.x)}, {formatCoordinate(currentPosition?.y)})
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-ghost-green uppercase tracking-wider">Players:</span>
                            <span className={`${playerCount > 1 ? 'text-matrix-green' : 'text-dim-green'}`}>
                                {playerCount}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-ghost-green uppercase tracking-wider">Status:</span>
                            <span className={`${isConnected ? 'text-matrix-green' : 'text-red-400'}`}>
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono">
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">Agents:</span>
                        <span className="text-matrix-green">{agentCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">Tick:</span>
                        <span className="text-matrix-green">{tick}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">FPS:</span>
                        <span className="text-matrix-green">{fps}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
