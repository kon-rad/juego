'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, GraduationCap } from 'lucide-react';
import GenieSvg from './GenieSvg';
import { createTeacher, checkTeacherPosition, Teacher } from '@/lib/mongodb-api';

interface Message {
    id: string;
    role: 'genie' | 'user';
    content: string;
    timestamp: Date;
}

interface GenieChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerPosition: { x: number; y: number };
    playerId?: string;
    onTeacherCreated?: (teacher: Teacher) => void;
}

const GENIE_TEACHER_INTRO = `Greetings, seeker of knowledge! I am the Learning Genie. Tell me, what subject or skill do you wish to master today? I shall summon the perfect guide to teach you, quiz you, and help you grow wiser!

You can ask me about anything: programming, mathematics, history, languages, science, art, or any other topic that sparks your curiosity.`;

export default function GenieChatModal({ isOpen, onClose, playerPosition, playerId, onTeacherCreated }: GenieChatModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [learningTopic, setLearningTopic] = useState<string | null>(null);
    const [teacherCreated, setTeacherCreated] = useState(false);
    const [creatingTeacher, setCreatingTeacher] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize with genie intro message
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                id: 'intro',
                role: 'genie',
                content: GENIE_TEACHER_INTRO,
                timestamp: new Date()
            }]);
        }
    }, [isOpen, messages.length]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Create teacher when learning topic is set
    useEffect(() => {
        const createTeacherForTopic = async () => {
            if (!learningTopic || teacherCreated || creatingTeacher || !playerId) return;

            setCreatingTeacher(true);

            try {
                // Check if position is available (100px radius)
                const positionCheck = await checkTeacherPosition(playerPosition.x + 60, playerPosition.y);

                if (!positionCheck.available) {
                    const nearbyMsg: Message = {
                        id: `system-${Date.now()}`,
                        role: 'genie',
                        content: `I sense another teacher nearby (${positionCheck.nearbyTeacher?.name} - ${positionCheck.nearbyTeacher?.topic}). Move to a different location and try again to summon a new teacher!`,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, nearbyMsg]);
                    setCreatingTeacher(false);
                    return;
                }

                // Create the teacher at position next to player
                const teacher = await createTeacher(
                    learningTopic,
                    playerPosition.x + 60,
                    playerPosition.y,
                    playerId
                );

                if (teacher) {
                    setTeacherCreated(true);
                    onTeacherCreated?.(teacher);

                    const successMsg: Message = {
                        id: `system-${Date.now()}`,
                        role: 'genie',
                        content: `I have summoned ${teacher.name} to guide you in ${learningTopic}! They will remain here permanently to help anyone who seeks knowledge. Approach them anytime to continue your learning journey. You can close this window and find the teacher on the map!`,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, successMsg]);
                } else {
                    const errorMsg: Message = {
                        id: `error-${Date.now()}`,
                        role: 'genie',
                        content: 'My magic faltered. I could not summon the teacher. Please try again.',
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, errorMsg]);
                }
            } catch (error) {
                console.error('Error creating teacher:', error);
            } finally {
                setCreatingTeacher(false);
            }
        };

        createTeacherForTopic();
    }, [learningTopic, teacherCreated, creatingTeacher, playerId, playerPosition, onTeacherCreated]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/genie/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: inputValue,
                    learningTopic,
                    conversationHistory: messages.map(m => ({
                        role: m.role === 'genie' ? 'assistant' : 'user',
                        content: m.content
                    }))
                })
            });

            const data = await response.json();

            // If this is the first real user message, extract the learning topic
            if (!learningTopic && data.learningTopic) {
                setLearningTopic(data.learningTopic);
            }

            const genieMessage: Message = {
                id: `genie-${Date.now()}`,
                role: 'genie',
                content: data.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, genieMessage]);
        } catch (error) {
            console.error('Error chatting with genie:', error);
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'genie',
                content: 'My magical powers seem to be fluctuating. Please try again in a moment.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
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

    const handleReset = () => {
        setMessages([{
            id: 'intro',
            role: 'genie',
            content: GENIE_TEACHER_INTRO,
            timestamp: new Date()
        }]);
        setLearningTopic(null);
        setTeacherCreated(false);
        setCreatingTeacher(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl h-[600px] bg-gradient-to-b from-amber-900/90 to-amber-950/95 border-2 border-amber-400/50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-amber-400/30 bg-gradient-to-r from-amber-800/50 to-amber-900/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <GenieSvg size={48} />
                            <div className="absolute -top-1 -right-1">
                                <Sparkles size={16} className="text-amber-300 animate-pulse" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-amber-200">Learning Genie</h2>
                            {learningTopic && (
                                <div className="flex items-center gap-1 text-sm text-amber-400/80">
                                    <GraduationCap size={14} />
                                    <span>Teaching: {learningTopic}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="px-3 py-1 text-xs text-amber-300 border border-amber-400/30 rounded hover:bg-amber-400/20 transition-colors"
                        >
                            New Topic
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-amber-300 hover:text-amber-100 hover:bg-amber-400/20 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {message.role === 'genie' ? (
                                <div className="flex-shrink-0">
                                    <GenieSvg size={32} />
                                </div>
                            ) : (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center">
                                    <span className="text-xs text-blue-200">You</span>
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                    message.role === 'genie'
                                        ? 'bg-amber-800/50 border border-amber-400/30 text-amber-100'
                                        : 'bg-blue-800/50 border border-blue-400/30 text-blue-100'
                                }`}
                            >
                                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                <span className="text-xs opacity-50 mt-1 block">
                                    {message.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3">
                            <GenieSvg size={32} />
                            <div className="bg-amber-800/50 border border-amber-400/30 rounded-lg p-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-amber-400/30 bg-gradient-to-r from-amber-900/50 to-amber-950/50">
                    <div className="flex gap-2">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask the genie what you want to learn..."
                            className="flex-1 p-3 bg-amber-950/50 border border-amber-400/30 rounded-lg text-amber-100 placeholder-amber-400/50 resize-none focus:outline-none focus:border-amber-400/60 text-sm"
                            rows={2}
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
            </div>
        </div>
    );
}
