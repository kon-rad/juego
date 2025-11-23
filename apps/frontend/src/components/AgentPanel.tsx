'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain, MessageSquare, Settings, Phone, Send, Users } from 'lucide-react';
import AICharacterList from './AICharacterList';
import GenieSvg from './GenieSvg';
import { createTeacher, checkTeacherPosition, Teacher, chatWithTeacher, getOrCreateChat, getPlayerConversations, getChatMessages, sendChatMessage, type Chat, type ChatMessage as PlayerChatMessage } from '@/lib/mongodb-api';
import { onChatMessage, type ChatMessageEvent } from '@/lib/socket';

export interface AgentLog {
    id: string;
    timestamp: Date;
    type: 'move' | 'think' | 'plan' | 'converse';
    content: any;
}

interface ChatMessage {
    id: string;
    role: 'genie' | 'user' | 'teacher';
    content: string;
    timestamp: Date;
    speakerName?: string;
}

export interface ActiveTeacher {
    id: string;
    name: string;
    topic: string;
}

export interface ActivePlayerChat {
    chatId: string;
    otherPlayerId: string;
    otherPlayerName: string;
    otherPlayerAvatarColor: string;
}

interface AgentPanelProps {
    logs: AgentLog[];
    playerId?: string;
    isGenieActive?: boolean;
    playerPosition?: { x: number; y: number };
    onTeacherCreated?: (teacher: Teacher) => void;
    activeTab?: 'thinking' | 'conversations' | 'voice' | 'settings';
    onTabChange?: (tab: 'thinking' | 'conversations' | 'voice' | 'settings') => void;
    activeTeacher?: ActiveTeacher | null;
    activePlayerChat?: ActivePlayerChat | null;
    onActivePlayerChatChange?: (chat: ActivePlayerChat | null) => void;
}

const GENIE_INTRO = `Greetings, seeker of knowledge! I am the Learning Genie. Tell me, what subject or skill do you wish to master today? I shall summon the perfect guide to teach you!`;

export default function AgentPanel({
    logs,
    playerId,
    isGenieActive = false,
    playerPosition,
    onTeacherCreated,
    activeTab: externalActiveTab,
    onTabChange,
    activeTeacher,
    activePlayerChat: externalActivePlayerChat,
    onActivePlayerChatChange
}: AgentPanelProps) {
    const [internalActiveTab, setInternalActiveTab] = useState<'thinking' | 'conversations' | 'voice' | 'settings'>('thinking');
    const activeTab = externalActiveTab ?? internalActiveTab;

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
    const [learningTopic, setLearningTopic] = useState<string | null>(null);
    const [teacherInfo, setTeacherInfo] = useState<{ name: string; systemPrompt: string; personality: string } | null>(null);
    const [teacherCreated, setTeacherCreated] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Player chat state
    const [playerConversations, setPlayerConversations] = useState<Chat[]>([]);
    const [playerChatMessages, setPlayerChatMessages] = useState<PlayerChatMessage[]>([]);
    const [internalActivePlayerChat, setInternalActivePlayerChat] = useState<ActivePlayerChat | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const activePlayerChat = externalActivePlayerChat ?? internalActivePlayerChat;

    const handleTabChange = (tab: 'thinking' | 'conversations' | 'voice' | 'settings') => {
        if (onTabChange) {
            onTabChange(tab);
        } else {
            setInternalActiveTab(tab);
        }
    };

    // Initialize genie chat when genie becomes active
    useEffect(() => {
        if (isGenieActive && chatMessages.length === 0 && !activeTeacher) {
            setChatMessages([{
                id: 'genie-intro',
                role: 'genie',
                content: GENIE_INTRO,
                timestamp: new Date(),
                speakerName: 'Learning Genie'
            }]);
        }
    }, [isGenieActive, chatMessages.length, activeTeacher]);

    // Initialize teacher chat when approaching a teacher
    useEffect(() => {
        if (activeTeacher && activeTeacher.id !== currentTeacherId) {
            setCurrentTeacherId(activeTeacher.id);
            setChatMessages([{
                id: `teacher-intro-${Date.now()}`,
                role: 'teacher',
                content: `Hello! I'm ${activeTeacher.name}, your ${activeTeacher.topic} teacher. How can I help you learn today?`,
                timestamp: new Date(),
                speakerName: activeTeacher.name
            }]);
        } else if (!activeTeacher && currentTeacherId) {
            // Teacher conversation ended (player moved away)
            setCurrentTeacherId(null);
        }
    }, [activeTeacher, currentTeacherId]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, playerChatMessages]);

    // Load player conversations when conversations tab is active and no genie/teacher
    useEffect(() => {
        if (activeTab === 'conversations' && !isGenieActive && !activeTeacher && playerId) {
            loadConversations();
        }
    }, [activeTab, isGenieActive, activeTeacher, playerId]);

    // Load messages when a player chat is selected
    useEffect(() => {
        if (activePlayerChat && activePlayerChat.chatId) {
            loadChatMessages(activePlayerChat.chatId);
        } else {
            setPlayerChatMessages([]);
        }
    }, [activePlayerChat]);

    // Listen for real-time chat messages
    useEffect(() => {
        if (!playerId) return;

        const unsubscribe = onChatMessage((data: ChatMessageEvent) => {
            // Parse date if it's a string
            const message = {
                ...data.message,
                createdAt: typeof data.message.createdAt === 'string' 
                    ? new Date(data.message.createdAt) 
                    : data.message.createdAt
            };

            // Only add message if it's for the current player and the active chat
            if (data.recipientId === playerId && activePlayerChat && data.chatId === activePlayerChat.chatId) {
                setPlayerChatMessages(prev => {
                    // Check if message already exists
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            } else if (data.recipientId === playerId) {
                // Update conversations list if message is for a different chat
                loadConversations();
            }
        });

        return unsubscribe;
    }, [playerId, activePlayerChat]);

    const loadConversations = async () => {
        if (!playerId) return;
        setIsLoadingConversations(true);
        try {
            const conversations = await getPlayerConversations(playerId);
            // Parse dates from strings to Date objects
            const parsedConversations = conversations.map(chat => ({
                ...chat,
                lastMessageAt: chat.lastMessageAt 
                    ? (typeof chat.lastMessageAt === 'string' ? new Date(chat.lastMessageAt) : chat.lastMessageAt)
                    : undefined,
                createdAt: chat.createdAt 
                    ? (typeof chat.createdAt === 'string' ? new Date(chat.createdAt) : chat.createdAt)
                    : undefined,
                updatedAt: chat.updatedAt 
                    ? (typeof chat.updatedAt === 'string' ? new Date(chat.updatedAt) : chat.updatedAt)
                    : undefined
            }));
            setPlayerConversations(parsedConversations);
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setIsLoadingConversations(false);
        }
    };

    const loadChatMessages = async (chatId: string) => {
        setIsLoadingMessages(true);
        try {
            const messages = await getChatMessages(chatId);
            // Parse dates from strings to Date objects
            const parsedMessages = messages.map(msg => ({
                ...msg,
                createdAt: typeof msg.createdAt === 'string' ? new Date(msg.createdAt) : msg.createdAt
            }));
            setPlayerChatMessages(parsedMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const handleSelectConversation = async (chat: Chat) => {
        if (!playerId) return;
        
        const activeChat: ActivePlayerChat = {
            chatId: chat.id,
            otherPlayerId: chat.otherParticipantId || (chat.participant1Id === playerId ? chat.participant2Id : chat.participant1Id),
            otherPlayerName: chat.otherParticipantName || (chat.participant1Id === playerId ? chat.participant2Name : chat.participant1Name) || 'Unknown',
            otherPlayerAvatarColor: chat.otherParticipantAvatarColor || (chat.participant1Id === playerId ? chat.participant2AvatarColor : chat.participant1AvatarColor) || '#4ECDC4'
        };

        if (onActivePlayerChatChange) {
            onActivePlayerChatChange(activeChat);
        } else {
            setInternalActivePlayerChat(activeChat);
        }
    };

    // Create teacher when learning topic is identified
    useEffect(() => {
        const createTeacherForTopic = async () => {
            if (!learningTopic || teacherCreated || !playerId || !playerPosition) {
                console.log('Teacher creation skipped:', { learningTopic, teacherCreated, playerId, playerPosition });
                return;
            }
            
            console.log('Creating teacher for topic:', learningTopic, 'with teacherInfo:', teacherInfo);

            // Wait a bit for teacherInfo if it's expected but not yet available
            // (teacherInfo is generated asynchronously by the genie)
            if (!teacherInfo) {
                // Wait up to 2 seconds for teacherInfo
                await new Promise(resolve => setTimeout(resolve, 500));
                // If still no teacherInfo after waiting, proceed without it (will use defaults)
            }

            try {
                // Check if position is available (100px radius)
                const positionCheck = await checkTeacherPosition(playerPosition.x + 60, playerPosition.y);

                if (!positionCheck.available) {
                    const nearbyMsg: ChatMessage = {
                        id: `system-${Date.now()}`,
                        role: 'genie',
                        content: `I sense another teacher nearby (${positionCheck.nearbyTeacher?.name} - ${positionCheck.nearbyTeacher?.topic}). Move to a different location and summon me again to create a new teacher!`,
                        timestamp: new Date(),
                        speakerName: 'Learning Genie'
                    };
                    setChatMessages(prev => [...prev, nearbyMsg]);
                    return;
                }

                // Create the teacher with generated info if available
                const teacher = await createTeacher(
                    learningTopic,
                    playerPosition.x + 60,
                    playerPosition.y,
                    playerId,
                    teacherInfo || undefined
                );

                if (teacher) {
                    console.log('Teacher created successfully:', teacher);
                    setTeacherCreated(true);
                    onTeacherCreated?.(teacher);

                    const successMsg: ChatMessage = {
                        id: `system-${Date.now()}`,
                        role: 'genie',
                        content: `I have summoned ${teacher.name} to guide you in ${learningTopic}! They have been placed on the map near you. Approach them anytime to start learning. The teacher will now initiate a conversation with you!`,
                        timestamp: new Date(),
                        speakerName: 'Learning Genie'
                    };
                    setChatMessages(prev => [...prev, successMsg]);

                    // Teacher introduces themselves
                    setTimeout(() => {
                        const teacherIntro: ChatMessage = {
                            id: `teacher-intro-${Date.now()}`,
                            role: 'teacher',
                            content: `Hello! I'm your ${learningTopic} teacher. I'm here to help you learn, ask questions, and test your knowledge. What would you like to start with?`,
                            timestamp: new Date(),
                            speakerName: teacher.name
                        };
                        setChatMessages(prev => [...prev, teacherIntro]);
                    }, 1000);
                }
            } catch (error) {
                console.error('Error creating teacher:', error);
            }
        };

        createTeacherForTopic();
    }, [learningTopic, teacherInfo, teacherCreated, playerId, playerPosition, onTeacherCreated]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const messageText = inputValue;
        setInputValue('');

        // If chatting with a player
        if (activePlayerChat && playerId) {
            setIsLoading(true);
            try {
                const message = await sendChatMessage(activePlayerChat.chatId, playerId, messageText);
                if (message) {
                    // Parse date if it's a string
                    const parsedMessage = {
                        ...message,
                        createdAt: typeof message.createdAt === 'string' ? new Date(message.createdAt) : message.createdAt
                    };
                    setPlayerChatMessages(prev => [...prev, parsedMessage]);
                    // Reload conversations to update last message
                    loadConversations();
                }
            } catch (error) {
                console.error('Error sending player message:', error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // If chatting with genie or teacher
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // If chatting with a teacher
            if (activeTeacher) {
                const result = await chatWithTeacher(
                    activeTeacher.id,
                    messageText,
                    chatMessages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content
                    }))
                );

                if (result) {
                    const teacherMessage: ChatMessage = {
                        id: `teacher-${Date.now()}`,
                        role: 'teacher',
                        content: result.response,
                        timestamp: new Date(),
                        speakerName: result.teacherName
                    };
                    setChatMessages(prev => [...prev, teacherMessage]);
                } else {
                    throw new Error('Failed to get response from teacher');
                }
            } else {
                // Chatting with genie
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/genie/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: messageText,
                        learningTopic,
                        conversationHistory: chatMessages.map(m => ({
                            role: m.role === 'user' ? 'user' : 'assistant',
                            content: m.content
                        }))
                    })
                });

                const data = await response.json();

                // If topic is identified and no teacher created yet
                if (!learningTopic && data.learningTopic) {
                    setLearningTopic(data.learningTopic);
                }

                // Store teacher info if provided
                if (data.teacherInfo) {
                    console.log('Received teacher info from genie:', data.teacherInfo);
                    setTeacherInfo(data.teacherInfo);
                }

                const genieMessage: ChatMessage = {
                    id: `genie-${Date.now()}`,
                    role: 'genie',
                    content: data.response,
                    timestamp: new Date(),
                    speakerName: 'Learning Genie'
                };

                setChatMessages(prev => [...prev, genieMessage]);
            }
        } catch (error) {
            console.error('Error chatting:', error);
            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: activeTeacher ? 'teacher' : 'genie',
                content: activeTeacher
                    ? 'I seem to have lost my train of thought. Please try again.'
                    : 'My magical powers seem to be fluctuating. Please try again.',
                timestamp: new Date(),
                speakerName: activeTeacher?.name || 'Learning Genie'
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex h-full w-full bg-terminal-black text-matrix-green border-l-2 border-matrix-green/30">
            {/* Vertical Tabs */}
            <div className="flex flex-col w-16 border-r border-matrix-green/30 bg-code-black">
                <button
                    onClick={() => handleTabChange('thinking')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'thinking'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Thinking"
                >
                    <Brain size={24} />
                </button>
                <button
                    onClick={() => handleTabChange('conversations')}
                    className={`p-4 flex justify-center transition-all duration-200 relative ${activeTab === 'conversations'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Conversations"
                >
                    <MessageSquare size={24} />
                    {isGenieActive && activeTab !== 'conversations' && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    )}
                </button>
                <button
                    onClick={() => handleTabChange('voice')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'voice'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Voice Calls"
                >
                    <Phone size={24} />
                </button>
                <button
                    onClick={() => handleTabChange('settings')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'settings'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Settings"
                >
                    <Settings size={24} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-matrix-green/30 bg-code-black">
                    <h2 className="text-lg font-semibold uppercase tracking-wider text-matrix-green text-glow">
                        {activeTab === 'voice' ? 'Voice Calls' : activeTab}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'thinking' && (
                        <div className="space-y-2">
                            {logs.filter(l => l.type === 'think' || l.type === 'plan' || l.type === 'move').map((log) => (
                                <div key={log.id} className="p-3 rounded bg-matrix-dark/50 border border-matrix-green/20 text-sm glow-green-subtle">
                                    <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                                        <span className={`uppercase font-bold tracking-wider ${log.type === 'think' ? 'text-neon-green' :
                                                log.type === 'plan' ? 'text-matrix-green' :
                                                    'text-dim-green'
                                            }`}>
                                            {log.type}
                                        </span>
                                        <span className="text-ghost-green">{log.timestamp.toLocaleTimeString()}</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap font-mono text-xs text-dim-green">
                                        {typeof log.content === 'string' ? log.content : JSON.stringify(log.content, null, 2)}
                                    </pre>
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-ghost-green text-center mt-10 font-mono uppercase text-sm tracking-wider">
                                    No thoughts yet...
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'conversations' && (
                        <div className="space-y-4">
                            {/* Player Chat Conversations List */}
                            {!isGenieActive && !activeTeacher && !activePlayerChat && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-mono uppercase tracking-wider text-matrix-green mb-3">Player Chats</h3>
                                    {isLoadingConversations ? (
                                        <div className="text-ghost-green text-center py-4">Loading conversations...</div>
                                    ) : playerConversations.length === 0 ? (
                                        <div className="text-ghost-green text-center py-4 font-mono text-sm">No conversations yet. Start chatting with nearby players!</div>
                                    ) : (
                                        playerConversations.map((chat) => (
                                            <button
                                                key={chat.id}
                                                onClick={() => handleSelectConversation(chat)}
                                                className="w-full p-3 rounded bg-matrix-dark/50 border border-matrix-green/20 hover:bg-matrix-dark/70 hover:border-matrix-green/40 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-full border-2 border-matrix-green/30"
                                                        style={{ backgroundColor: chat.otherParticipantAvatarColor || '#4ECDC4' }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-matrix-green font-mono text-sm font-semibold truncate">
                                                            {chat.otherParticipantName || 'Unknown Player'}
                                                        </div>
                                                        {chat.lastMessage && (
                                                            <div className="text-dim-green text-xs truncate mt-1">
                                                                {chat.lastMessage}
                                                            </div>
                                                        )}
                                                        {chat.lastMessageAt && (
                                                            <div className="text-ghost-green text-xs mt-1">
                                                                {new Date(chat.lastMessageAt).toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Player Chat Messages */}
                            {activePlayerChat && playerChatMessages.map((message) => {
                                const isOwnMessage = message.senderId === playerId;
                                return (
                                    <div
                                        key={message.id}
                                        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                                    >
                                        <div
                                            className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-matrix-green/30"
                                            style={{ backgroundColor: message.senderAvatarColor || '#4ECDC4' }}
                                        />
                                        <div className="flex-1">
                                            {message.senderName && (
                                                <div className={`text-xs mb-1 font-mono ${isOwnMessage ? 'text-blue-400' : 'text-matrix-green'}`}>
                                                    {message.senderName}
                                                </div>
                                            )}
                                            <div
                                                className={`p-3 rounded-lg text-sm ${
                                                    isOwnMessage
                                                        ? 'bg-blue-900/30 border border-blue-400/30 text-blue-100'
                                                        : 'bg-matrix-dark/50 border border-matrix-green/30 text-matrix-green'
                                                }`}
                                            >
                                                <p className="whitespace-pre-wrap">{message.content}</p>
                                                <span className="text-xs opacity-50 mt-1 block">
                                                    {new Date(message.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {isLoadingMessages && (
                                <div className="text-ghost-green text-center py-4">Loading messages...</div>
                            )}

                            {/* Genie/Teacher Chat Messages */}
                            {(isGenieActive || activeTeacher) && chatMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                >
                                    {message.role === 'genie' ? (
                                        <div className="flex-shrink-0">
                                            <GenieSvg size={32} />
                                        </div>
                                    ) : message.role === 'teacher' ? (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/30 border border-amber-400/50 flex items-center justify-center">
                                            <span className="text-xs text-amber-200">T</span>
                                        </div>
                                    ) : (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center">
                                            <span className="text-xs text-blue-200">You</span>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        {message.speakerName && (
                                            <div className={`text-xs mb-1 font-mono ${
                                                message.role === 'genie' ? 'text-amber-400' :
                                                message.role === 'teacher' ? 'text-amber-300' : 'text-blue-400'
                                            }`}>
                                                {message.speakerName}
                                            </div>
                                        )}
                                        <div
                                            className={`p-3 rounded-lg text-sm ${
                                                message.role === 'genie'
                                                    ? 'bg-amber-900/30 border border-amber-400/30 text-amber-100'
                                                    : message.role === 'teacher'
                                                    ? 'bg-amber-800/30 border border-amber-400/20 text-amber-100'
                                                    : 'bg-blue-900/30 border border-blue-400/30 text-blue-100'
                                            }`}
                                        >
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                            <span className="text-xs opacity-50 mt-1 block">
                                                {message.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-3">
                                    {activeTeacher ? (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/30 border border-amber-400/50 flex items-center justify-center">
                                            <span className="text-xs text-amber-200">T</span>
                                        </div>
                                    ) : (
                                        <GenieSvg size={32} />
                                    )}
                                    <div className="bg-amber-900/30 border border-amber-400/30 rounded-lg p-3">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Back button for player chat */}
                            {activePlayerChat && (
                                <button
                                    onClick={() => {
                                        if (onActivePlayerChatChange) {
                                            onActivePlayerChatChange(null);
                                        } else {
                                            setInternalActivePlayerChat(null);
                                        }
                                    }}
                                    className="mb-4 px-3 py-2 bg-matrix-dark/50 border border-matrix-green/30 rounded text-matrix-green text-sm hover:bg-matrix-dark/70 transition-colors"
                                >
                                    ← Back to Conversations
                                </button>
                            )}

                            {/* Regular conversation logs when genie/teacher/player chat is not active */}
                            {!isGenieActive && !activeTeacher && !activePlayerChat && logs.filter(l => l.type === 'converse').map((log) => (
                                <div key={log.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-matrix-green/20 flex items-center justify-center text-matrix-green border border-matrix-green/30">
                                        <MessageSquare size={14} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-ghost-green mb-1 font-mono">{log.timestamp.toLocaleTimeString()}</div>
                                        <div className="p-3 rounded bg-matrix-dark/50 border border-matrix-green/20 text-sm font-mono text-dim-green">
                                            {typeof log.content === 'string' ? log.content : JSON.stringify(log.content)}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!isGenieActive && !activeTeacher && !activePlayerChat && logs.filter(l => l.type === 'converse').length === 0 && playerConversations.length === 0 && (
                                <div className="text-ghost-green text-center mt-10 font-mono uppercase text-sm tracking-wider">
                                    No conversations yet...
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {activeTab === 'voice' && (
                        <div className="space-y-4">
                            {playerId ? (
                                <AICharacterList userId={playerId} />
                            ) : (
                                <div className="text-ghost-green text-center mt-10 font-mono uppercase text-sm tracking-wider">
                                    Join the game to access voice calls...
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-dim-green uppercase tracking-wider">Model</label>
                                <select className="w-full p-2 rounded bg-code-black border border-matrix-green/40 text-matrix-green text-sm font-mono focus:outline-none focus:border-matrix-green glow-green-subtle transition-all duration-200">
                                    <option>llama3</option>
                                    <option>mistral</option>
                                    <option>gemma</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-dim-green uppercase tracking-wider">Agent Speed</label>
                                <input type="range" className="w-full accent-matrix-green" />
                                <div className="flex justify-between text-xs text-ghost-green font-mono uppercase">
                                    <span>Slow</span>
                                    <span>Fast</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Input - Show in conversations tab when genie, teacher, or player chat is active */}
                {activeTab === 'conversations' && (isGenieActive || activeTeacher || activePlayerChat) && (
                    <div className="p-4 border-t border-amber-400/30 bg-gradient-to-r from-amber-900/20 to-amber-950/20">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={activePlayerChat
                                    ? `Message ${activePlayerChat.otherPlayerName}...`
                                    : activeTeacher 
                                    ? `Ask ${activeTeacher.name} about ${activeTeacher.topic}...`
                                    : "Ask the genie what you want to learn..."
                                }
                                className="flex-1 p-3 bg-amber-950/30 border border-amber-400/30 rounded-lg text-amber-100 placeholder-amber-400/50 focus:outline-none focus:border-amber-400/60 text-sm"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !inputValue.trim()}
                                className="px-4 bg-gradient-to-b from-amber-500 to-amber-600 text-amber-950 font-semibold rounded-lg hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
