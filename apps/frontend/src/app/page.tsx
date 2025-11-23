'use client';

import { useState, useEffect } from 'react';
import GameCanvas, { NearbyPlayer, NearbyTeacher } from '@/components/GameCanvas';
import AgentPanel, { AgentLog, ActiveTeacher, ActivePlayerChat } from '@/components/AgentPanel';
import GameStatePanel from '@/components/GameStatePanel';
import MenuBar from '@/components/MenuBar';
import { Teacher, getOrCreateChat } from '@/lib/mongodb-api';
import { getMongoDBPlayerId } from '@/lib/player';

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
  const [activePlayerChat, setActivePlayerChat] = useState<ActivePlayerChat | null>(null);
  const [mongoDBPlayerId, setMongoDBPlayerId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Add logging to debug wallet initialization
  useEffect(() => {
    const initializeWallet = async () => {
      const storedWalletAddress = localStorage.getItem('walletAddress');
      console.log('Stored wallet address:', storedWalletAddress);

      try {
        if (storedWalletAddress) {
          // Use existing wallet address
          setWalletAddress(storedWalletAddress);
          console.log('Using stored wallet address:', storedWalletAddress);
        } else {
          // Create a new wallet
          console.log('No wallet found, generating a new one...');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/blockchain/wallet/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const data = await response.json();
          console.log('Response from wallet generation:', data);
          if (response.ok && data.address) {
            localStorage.setItem('walletAddress', data.address);
            setWalletAddress(data.address);
            console.log('New wallet address set:', data.address);
          } else {
            console.error('Failed to generate wallet:', data);
          }
        }
      } catch (error) {
        console.error('Error initializing wallet:', error);
      }
    };

    initializeWallet();
  }, []);

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

  const handleStartConversation = async (player: NearbyPlayer) => {
    // Get MongoDB IDs for both players
    const currentPlayerMongoId = mongoDBPlayerId || getMongoDBPlayerId();
    
    if (!currentPlayerMongoId) {
      console.error('Cannot start conversation: MongoDB player ID not found');
      return;
    }

    // For the nearby player, we need to look up their MongoDB ID
    // Since we only have their socket ID, we'll need to find them by name/avatar
    // For now, let's try to find them by creating a lookup
    // Actually, the best approach is to store MongoDB IDs in socket player data
    // But for now, let's try to find the player by matching socket ID or name
    
    try {
      // Try to find the other player's MongoDB ID
      // We'll need to search for them by name and avatarColor
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/game/players`);
      const allPlayers = await response.json();
      
      // Find the player by matching name and avatarColor (since socket ID won't match)
      const otherPlayer = allPlayers.find((p: any) => 
        p.name === player.name && p.avatarColor === player.avatarColor
      );
      
      if (!otherPlayer) {
        console.error('Could not find other player in database');
        return;
      }
      
      const otherPlayerMongoId = otherPlayer.id;
      
      // Get or create chat with the nearby player using MongoDB IDs
      const chat = await getOrCreateChat(currentPlayerMongoId, otherPlayerMongoId);
      
      if (chat) {
        // Determine which participant is the other player
        const otherPlayerId = chat.participant1Id === playerId ? chat.participant2Id : chat.participant1Id;
        const otherPlayerName = chat.participant1Id === playerId ? chat.participant2Name : chat.participant1Name;
        const otherPlayerAvatarColor = chat.participant1Id === playerId ? chat.participant2AvatarColor : chat.participant1AvatarColor;

        const activeChat: ActivePlayerChat = {
          chatId: chat.id,
          otherPlayerId: otherPlayerId || player.id,
          otherPlayerName: otherPlayerName || player.name,
          otherPlayerAvatarColor: otherPlayerAvatarColor || player.avatarColor
        };

        setActivePlayerChat(activeChat);
        setActiveTab('conversations');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
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
    // Also get the MongoDB ID
    const mongoId = getMongoDBPlayerId();
    setMongoDBPlayerId(mongoId);
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
        <MenuBar autoMode={autoMode} onAutoModeToggle={setAutoMode} walletAddress={walletAddress || 'No wallet'} />
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
          activePlayerChat={activePlayerChat}
          onActivePlayerChatChange={setActivePlayerChat}
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
