'use client';

import { useState, useEffect } from 'react';
import GameCanvas, { NearbyPlayer, NearbyTeacher } from '@/components/GameCanvas';
import AgentPanel, { AgentLog, ActiveTeacher } from '@/components/AgentPanel';
import GameStatePanel from '@/components/GameStatePanel';
import MenuBar from '@/components/MenuBar';
import { Teacher } from '@/lib/mongodb-api';

export default function Home() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | undefined>();
  const [playerCount, setPlayerCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isGenieActive, setIsGenieActive] = useState(false);
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [nearbyTeachers, setNearbyTeachers] = useState<NearbyTeacher[]>([]);
  const [activeTab, setActiveTab] = useState<'thinking' | 'conversations' | 'voice' | 'settings'>('thinking');
  const [activeTeacher, setActiveTeacher] = useState<ActiveTeacher | null>(null);

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
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'converse',
      content: { message: `Started conversation with ${player.name}` }
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleSummonGenie = () => {
    setIsGenieActive(true);
    // Auto-switch to conversations tab
    setActiveTab('conversations');
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'converse',
      content: { message: 'Summoned the Learning Genie!' }
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleTeacherCreated = (teacher: Teacher) => {
    setTeachers(prev => [...prev, teacher]);
    const newLog: AgentLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type: 'converse',
      content: { message: `Created teacher: ${teacher.name} for ${teacher.topic}` }
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handlePlayerIdChange = (id: string) => {
    setPlayerId(id);
  };

  const handleNearbyTeachersChange = (nearbyTeachersList: NearbyTeacher[]) => {
    setNearbyTeachers(nearbyTeachersList);
    
    // Clear activeTeacher if the teacher is no longer nearby
    if (activeTeacher && !nearbyTeachersList.find(t => t.id === activeTeacher.id)) {
      setActiveTeacher(null);
    }
  };

  const handleTabChange = (tab: 'thinking' | 'conversations' | 'voice' | 'settings') => {
    setActiveTab(tab);
  };

  const handleStartTeacherChat = (teacher: NearbyTeacher) => {
    setActiveTeacher({
      id: teacher.id,
      name: teacher.name,
      topic: teacher.topic
    });
    setActiveTab('conversations');
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
          onPlayerIdChange={handlePlayerIdChange}
          onNearbyTeachersChange={handleNearbyTeachersChange}
          autoMode={autoMode}
          isGenieVisible={isGenieActive}
          teachers={teachers}
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

        {/* Nearby Teachers Menu */}
        {nearbyTeachers.length > 0 && (
          <div className="absolute bottom-4 left-4 mt-2 bg-black/80 border border-amber-400/50 rounded-lg p-3 max-w-xs" style={{ bottom: nearbyPlayers.length > 0 ? '120px' : '16px' }}>
            <h3 className="text-amber-400 text-sm font-bold mb-2">
              Nearby Teachers ({nearbyTeachers.length})
            </h3>
            <ul className="space-y-2">
              {nearbyTeachers.map((teacher) => (
                <li key={teacher.id} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-400" />
                  <div className="flex-1">
                    <span className="text-amber-200 text-sm block">{teacher.name}</span>
                    <span className="text-amber-400/60 text-xs">{teacher.topic}</span>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {Math.round(teacher.distance)}px
                  </span>
                  <button
                    onClick={() => handleStartTeacherChat(teacher)}
                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/50 rounded text-amber-400 text-xs transition-colors"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Connect to VAPI call
                      setActiveTab('voice');
                      console.log('Call teacher:', teacher.name);
                    }}
                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/40 border border-green-400/50 rounded text-green-400 text-xs transition-colors"
                  >
                    Call
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Agent Panel - Right Side (spans 2 rows) */}
      <div className="row-span-2 h-full">
        <AgentPanel
          logs={logs}
          playerId={playerId}
          isGenieActive={isGenieActive}
          playerPosition={currentPosition}
          onTeacherCreated={handleTeacherCreated}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeTeacher={activeTeacher}
        />
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
    </main>
  );
}
