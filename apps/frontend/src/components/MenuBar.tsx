'use client';

import { Heart } from 'lucide-react';

interface MenuBarProps {
    autoMode: boolean;
    onAutoModeToggle: (enabled: boolean) => void;
    walletAddress: string; // Added prop for wallet address
}

export default function MenuBar({ autoMode, onAutoModeToggle, walletAddress }: MenuBarProps) {
    return (
        <div className="h-8 w-full bg-code-black border-b border-matrix-green/30 flex items-center justify-between px-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Heart size={16} className="text-matrix-green fill-matrix-green" />
                <span className="text-xs font-mono uppercase tracking-wider text-matrix-green font-semibold">
                    Juego
                </span>
            </div>

            {/* Auto Toggle and Wallet Address */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-dim-green">
                        Auto
                    </span>
                    <button
                        onClick={() => onAutoModeToggle(!autoMode)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${autoMode
                                ? 'bg-matrix-green'
                                : 'bg-ghost-green/30 border border-matrix-green/40'
                            }`}
                    >
                        <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${autoMode
                                    ? 'right-0.5 bg-code-black'
                                    : 'left-0.5 bg-matrix-green/60'
                                }`}
                        />
                    </button>
                </div>

                {/* Wallet Address */}
                <span className="text-xs font-mono text-matrix-green truncate max-w-xs">
                    {walletAddress}
                </span>
            </div>
        </div>
    );
}
