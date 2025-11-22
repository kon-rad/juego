'use client';

import { useState } from 'react';
import GameCanvas from '@/components/GameCanvas';
import AgentPanel, { AgentLog } from '@/components/AgentPanel';
import GameStatePanel from '@/components/GameStatePanel';
import MenuBar from '@/components/MenuBar';

export default function Home() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | undefined>();
  const [playerCount, setPlayerCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);

  const handleAgentAction = (action: any) => {
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: action.type,
      content: action.payload
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handlePlayerPositionChange = (position: { x: number; y: number }) => {
    setCurrentPosition(position);
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-deep-black grid grid-cols-[1fr_384px] grid-rows-[32px_1fr_80px]">
      {/* Menu Bar - Top (spans both columns) */}
      <div className="col-span-2">
        <MenuBar autoMode={autoMode} onAutoModeToggle={setAutoMode} />
      </div>

      {/* Game Canvas - Center Left */}
      <div className="relative w-full h-full border-2 border-matrix-green/30 rounded-lg overflow-hidden glow-green-subtle">
        <GameCanvas 
          onAgentAction={handleAgentAction} 
          onPlayerPositionChange={handlePlayerPositionChange}
          autoMode={autoMode} 
        />
      </div>

      {/* Agent Panel - Right Side (spans 2 rows) */}
      <div className="row-span-2 h-full">
        <AgentPanel logs={logs} />
      </div>

      {/* Game State Panel - Bottom Left */}
      <div className="h-20">
        <GameStatePanel 
          currentPosition={currentPosition}
          playerCount={playerCount}
          isConnected={isConnected}
          agentCount={autoMode ? 1 : 0}
          tick={0}
          fps={60}
        />
      </div>
    </main>
  );
}
