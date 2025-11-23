'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain, MessageSquare, Settings, Phone, Send } from 'lucide-react';
import AICharacterList from './AICharacterList';
import GenieSvg from './GenieSvg';
import { createTeacher, checkTeacherPosition, Teacher, chatWithTeacher } from '@/lib/mongodb-api';

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

interface AgentPanelProps {
    logs: AgentLog[];
    playerId?: string;
    isGenieActive?: boolean;
    playerPosition?: { x: number; y: number };
    onTeacherCreated?: (teacher: Teacher) => void;
    activeTab?: 'thinking' | 'conversations' | 'voice' | 'settings';
    onTabChange?: (tab: 'thinking' | 'conversations' | 'voice' | 'settings') => void;
    activeTeacher?: ActiveTeacher | null;
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
    activeTeacher
}: AgentPanelProps) {
    const [internalActiveTab, setInternalActiveTab] = useState<'thinking' | 'conversations' | 'voice' | 'settings'>('thinking');
    const activeTab = externalActiveTab ?? internalActiveTab;

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
    const [learningTopic, setLearningTopic] = useState<string | null>(null);
    const [teacherCreated, setTeacherCreated] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
    }, [chatMessages]);

    // Create teacher when learning topic is identified
    useEffect(() => {
        const createTeacherForTopic = async () => {
            if (!learningTopic || teacherCreated || !playerId || !playerPosition) return;

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

                // Create the teacher
                const teacher = await createTeacher(
                    learningTopic,
                    playerPosition.x + 60,
                    playerPosition.y,
                    playerId
                );

                if (teacher) {
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
    }, [learningTopic, teacherCreated, playerId, playerPosition, onTeacherCreated]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
        const messageText = inputValue;
        setInputValue('');
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

                            {/* Regular conversation logs when genie/teacher is not active */}
                            {!isGenieActive && !activeTeacher && logs.filter(l => l.type === 'converse').map((log) => (
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

                            {!isGenieActive && !activeTeacher && logs.filter(l => l.type === 'converse').length === 0 && (
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

                {/* Chat Input - Show in conversations tab when genie or teacher is active */}
                {activeTab === 'conversations' && (isGenieActive || activeTeacher) && (
                    <div className="p-4 border-t border-amber-400/30 bg-gradient-to-r from-amber-900/20 to-amber-950/20">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={activeTeacher 
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
