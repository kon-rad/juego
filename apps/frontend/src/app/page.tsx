'use client';

import { useState } from 'react';
import GameCanvas, { NearbyPlayer } from '@/components/GameCanvas';
import AgentPanel, { AgentLog } from '@/components/AgentPanel';
import GameStatePanel from '@/components/GameStatePanel';
import MenuBar from '@/components/MenuBar';
import GenieChatModal from '@/components/GenieChatModal';

export default function Home() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | undefined>();
  const [playerCount, setPlayerCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isGenieVisible, setIsGenieVisible] = useState(false);
  const [showGenieChat, setShowGenieChat] = useState(false);

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

  const handleConnectionStatusChange = (connected: boolean) => {
    setIsConnected(connected);
  };

  const handleNearbyPlayersChange = (players: NearbyPlayer[]) => {
    setNearbyPlayers(players);
  };

  const handleStartConversation = (player: NearbyPlayer) => {
    console.log('Starting conversation with:', player.name);
    // Add a log entry for the conversation
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'converse',
      content: { message: `Started conversation with ${player.name}` }
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleSummonGenie = () => {
    setIsGenieVisible(true);
    setShowGenieChat(true);
    // Add a log entry for summoning the genie
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'converse',
      content: { message: 'Summoned the Learning Genie!' }
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleCloseGenieChat = () => {
    setShowGenieChat(false);
    // Keep genie visible in the game world for a bit, or hide immediately
    setIsGenieVisible(false);
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
          onConnectionStatusChange={handleConnectionStatusChange}
          onNearbyPlayersChange={handleNearbyPlayersChange}
          onPlayerCountChange={setPlayerCount}
          autoMode={autoMode}
          isGenieVisible={isGenieVisible}
        />

        {/* Nearby Players Conversation Menu */}
        {nearbyPlayers.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-black/80 border border-matrix-green/50 rounded-lg p-3 max-w-xs">
            <h3 className="text-matrix-green text-sm font-bold mb-2">
              Nearby Players ({nearbyPlayers.length})
            </h3>
            <ul className="space-y-2">
              {nearbyPlayers.map((player) => (
                <li key={player.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.avatarColor }}
                  />
                  <span className="text-white text-sm flex-1">{player.name}</span>
                  <span className="text-gray-400 text-xs">
                    {Math.round(player.distance)}px
                  </span>
                  <button
                    onClick={() => handleStartConversation(player)}
                    className="px-2 py-1 bg-matrix-green/20 hover:bg-matrix-green/40 border border-matrix-green/50 rounded text-matrix-green text-xs transition-colors"
                  >
                    Chat
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          onSummonGenie={handleSummonGenie}
        />
      </div>

      {/* Genie Chat Modal */}
      <GenieChatModal
        isOpen={showGenieChat}
        onClose={handleCloseGenieChat}
        playerPosition={currentPosition || { x: 0, y: 0 }}
      />
    </main>
  );
}
