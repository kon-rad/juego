'use client';

export default function GameStatePanel() {
    return (
        <div className="h-full w-full bg-terminal-black border-t-2 border-matrix-green/30 p-4">
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                    <div className="text-xs font-mono uppercase tracking-wider text-dim-green">
                        Game State
                    </div>
                    <div className="h-4 w-px bg-matrix-green/30"></div>
                    <div className="text-xs font-mono text-ghost-green">
                        Ready
                    </div>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono">
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">Agents:</span>
                        <span className="text-matrix-green">1</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">Tick:</span>
                        <span className="text-matrix-green">0</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-ghost-green uppercase tracking-wider">FPS:</span>
                        <span className="text-matrix-green">60</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
