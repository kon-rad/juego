'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import GenieSvg from './GenieSvg';
import { getBlockchainStats, type BlockchainStats } from '@/lib/blockchain-api';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

interface GameStatePanelProps {
    currentPosition?: { x: number; y: number };
    playerCount?: number;
    isConnected?: boolean;
    agentCount?: number;
    tick?: number;
    fps?: number;
    onSettingsChange?: (settings: { name: string; color: string }) => void;
    currentSettings?: { name: string; color: string };
    onSummonGenie?: () => void;
}

interface PlayerSettings {
    name: string;
    color: string;
}

const PRESET_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84',
    '#FF9999', '#66B2FF', '#99FF99', '#FFCC99', '#FF99CC'
];

export default function GameStatePanel({
    currentPosition,
    playerCount = 1,
    isConnected = true,
    agentCount = 1,
    tick = 0,
    fps = 60,
    onSettingsChange,
    currentSettings,
    onSummonGenie
}: GameStatePanelProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<PlayerSettings>({
        name: currentSettings?.name || 'Player',
        color: currentSettings?.color || '#4ECDC4'
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [blockchainStats, setBlockchainStats] = useState<BlockchainStats | null>(null);
    const [isLoadingBlockchain, setIsLoadingBlockchain] = useState(false);

    const formatCoordinate = (value: number | undefined): string => {
        if (value === undefined) return '---';
        return value.toFixed(0);
    };

    useEffect(() => {
        if (currentSettings) {
            setSettings(currentSettings);
        }
    }, [currentSettings]);

    // Fetch blockchain stats on mount and periodically
    useEffect(() => {
        const fetchBlockchainData = async () => {
            setIsLoadingBlockchain(true);
            try {
                const stats = await getBlockchainStats();
                setBlockchainStats(stats);
            } catch (error) {
                console.error('Error fetching blockchain stats:', error);
            } finally {
                setIsLoadingBlockchain(false);
            }
        };

        // Fetch immediately
        fetchBlockchainData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchBlockchainData, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        setSaveMessage('');

        try {
            const response = await fetch(`${API_URL}/api/player/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: settings.name,
                    avatarColor: settings.color
                }),
            });

            if (response.ok) {
                const updatedPlayer = await response.json();
                console.log('Settings saved:', updatedPlayer);
                setSaveMessage('Settings saved successfully!');
                onSettingsChange?.(settings);
                
                // Clear message after 3 seconds
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setSaveMessage('Failed to save settings');
            
            // Clear message after 3 seconds
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleColorChange = (color: string) => {
        setSettings(prev => ({ ...prev, color }));
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, name: e.target.value }));
    };

    return (
        <div className="h-full w-full bg-terminal-black border-t-2 border-matrix-green/30 p-4 relative">
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-xs font-mono uppercase tracking-wider text-dim-green hover:text-matrix-green transition-colors cursor-pointer"
                    >
                        Game State
                    </button>
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
                    <div className="h-8 w-px bg-matrix-green/30"></div>
                    {/* Blockchain Stats */}
                    {blockchainStats && (
                        <>
                            <div className="flex items-center gap-2" title={`${blockchainStats.nfts.name} (${blockchainStats.nfts.symbol})`}>
                                <span className="text-ghost-green uppercase tracking-wider">NFTs:</span>
                                <span className="text-amber-400 font-bold">{blockchainStats.nfts.totalMinted}</span>
                            </div>
                            <div className="flex items-center gap-2" title={`${blockchainStats.tokens.name} (${blockchainStats.tokens.symbol})`}>
                                <span className="text-ghost-green uppercase tracking-wider">Tokens:</span>
                                <span className="text-amber-400 font-bold">
                                    {parseFloat(blockchainStats.tokens.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-matrix-green/30"></div>
                        </>
                    )}
                    {isLoadingBlockchain && !blockchainStats && (
                        <div className="flex items-center gap-2">
                            <span className="text-ghost-green uppercase tracking-wider">Loading blockchain...</span>
                        </div>
                    )}
                    {/* Genie Button */}
                    <button
                        onClick={onSummonGenie}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-400/50 rounded-lg hover:from-amber-500/40 hover:to-amber-400/30 hover:border-amber-300/70 transition-all group"
                        title="Summon the Learning Genie"
                    >
                        <GenieSvg size={24} />
                        <span className="text-amber-300 uppercase tracking-wider font-bold group-hover:text-amber-200 transition-colors">
                            Genie
                        </span>
                        <Sparkles size={14} className="text-amber-400 group-hover:text-amber-300" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="absolute top-0 right-0 h-full w-80 bg-terminal-black/95 border-l-2 border-matrix-green/30 p-4 z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-matrix-green">Player Settings</h3>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="text-dim-green hover:text-matrix-green transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Player Name */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-ghost-green mb-2">
                                Player Name
                            </label>
                            <input
                                type="text"
                                value={settings.name}
                                onChange={handleNameChange}
                                className="w-full px-3 py-2 bg-terminal-black/50 border border-matrix-green/30 rounded text-matrix-green font-mono text-sm focus:outline-none focus:border-matrix-green transition-colors"
                                placeholder="Enter your name"
                                maxLength={20}
                            />
                        </div>

                        {/* Color Selection */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-ghost-green mb-2">
                                Avatar Color
                            </label>
                            <div className="grid grid-cols-5 gap-2 mb-3">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => handleColorChange(color)}
                                        className={`w-8 h-8 rounded border-2 transition-all ${
                                            settings.color === color 
                                                ? 'border-matrix-green scale-110' 
                                                : 'border-dim-green/50 hover:border-matrix-green/70'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={settings.color}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    className="w-12 h-8 border border-matrix-green/30 rounded bg-transparent cursor-pointer"
                                />
                                <span className="text-xs font-mono text-dim-green">{settings.color}</span>
                            </div>
                        </div>

                        {/* Current Preview */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-ghost-green mb-2">
                                Preview
                            </label>
                            <div className="flex items-center gap-3 p-3 bg-terminal-black/50 border border-matrix-green/30 rounded">
                                <div 
                                    className="w-6 h-6 rounded-full border-2 border-matrix-green/30"
                                    style={{ backgroundColor: settings.color }}
                                />
                                <span className="text-matrix-green font-mono text-sm">{settings.name}</span>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="w-full py-2 px-4 bg-matrix-green/20 border border-matrix-green/30 rounded text-matrix-green font-mono text-sm hover:bg-matrix-green/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>

                        {/* Save Message */}
                        {saveMessage && (
                            <div className={`text-xs font-mono p-2 rounded ${
                                saveMessage.includes('success') 
                                    ? 'bg-matrix-green/20 text-matrix-green border border-matrix-green/30' 
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                                {saveMessage}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
