'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain, MessageSquare, Settings, Phone, Send, ChevronLeft, Bug } from 'lucide-react';
import AICharacterList from './AICharacterList';
import GenieSvg from './GenieSvg';
import { Teacher, chatWithTeacher, getPlayerConversations, getChatMessages, sendChatMessage, getTeachers, getPlayerTeacherChatHistories, saveTeacherChatHistory, getPlayerProfile, updatePlayerProfile, type Chat, type ChatMessage as PlayerChatMessage, type TeacherChatHistoryResponse } from '@/lib/mongodb-api';
import { onChatMessage, type ChatMessageEvent } from '@/lib/socket';
import { getMongoDBPlayerId } from '@/lib/player';
import { mintTokens, mintNFT } from '@/lib/blockchain-api';

export interface AgentLog {
    id: string;
    timestamp: Date;
    type: 'move' | 'think' | 'plan' | 'converse';
    content: any;
}

interface ChatMessage {
    id: string;
    role: 'genie' | 'user' | 'teacher' | 'reward';
    content: string;
    timestamp: Date;
    speakerName?: string;
    tokensAwarded?: number;
    nftAwarded?: boolean;
}

// Store chat history per teacher
interface TeacherChatHistory {
    teacherId: string;
    teacherName: string;
    topic: string;
    messages: ChatMessage[];
    lastMessageAt: Date;
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
    walletAddress?: string;
    isGenieActive?: boolean;
    playerPosition?: { x: number; y: number };
    onTeacherCreated?: (teacher: Teacher) => void;
    activeTab?: 'thinking' | 'conversations' | 'voice' | 'settings';
    onTabChange?: (tab: 'thinking' | 'conversations' | 'voice' | 'settings') => void;
    activeTeacher?: ActiveTeacher | null;
    activePlayerChat?: ActivePlayerChat | null;
    onActivePlayerChatChange?: (chat: ActivePlayerChat | null) => void;
    onScoreUpdate?: (newScore: number) => void;
    onBalanceRefresh?: () => void;
}

const GENIE_INTRO = `Greetings, seeker of knowledge! I am the Learning Genie. Tell me, what subject or skill do you wish to master today? I shall summon the perfect guide to teach you!`;

export default function AgentPanel({
    logs,
    playerId,
    walletAddress,
    isGenieActive = false,
    playerPosition,
    onTeacherCreated,
    activeTab: externalActiveTab,
    onTabChange,
    activeTeacher,
    activePlayerChat: externalActivePlayerChat,
    onActivePlayerChatChange,
    onScoreUpdate,
    onBalanceRefresh
}: AgentPanelProps) {
    const [internalActiveTab, setInternalActiveTab] = useState<'thinking' | 'conversations' | 'voice' | 'settings'>('thinking');
    const activeTab = externalActiveTab ?? internalActiveTab;

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
    const [learningTopic, setLearningTopic] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Teacher chat history storage (per teacher)
    const [teacherChatHistories, setTeacherChatHistories] = useState<Map<string, TeacherChatHistory>>(new Map());
    const [selectedTeacherChat, setSelectedTeacherChat] = useState<string | null>(null);
    const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);

    // Player chat state
    const [playerConversations, setPlayerConversations] = useState<Chat[]>([]);
    const [playerChatMessages, setPlayerChatMessages] = useState<PlayerChatMessage[]>([]);
    const [internalActivePlayerChat, setInternalActivePlayerChat] = useState<ActivePlayerChat | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const activePlayerChat = externalActivePlayerChat ?? internalActivePlayerChat;

    // Settings state
    const [userName, setUserName] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [interests, setInterests] = useState<string>('');
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

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

    // Initialize teacher chat when approaching a teacher or selecting from list
    useEffect(() => {
        if (activeTeacher && activeTeacher.id !== currentTeacherId) {
            setCurrentTeacherId(activeTeacher.id);
            setSelectedTeacherChat(activeTeacher.id);

            // Check if we have existing chat history for this teacher
            const existingHistory = teacherChatHistories.get(activeTeacher.id);
            if (existingHistory && existingHistory.messages.length > 0) {
                // Restore existing chat history
                setChatMessages(existingHistory.messages);
            } else {
                // Start new conversation
                const introMessage: ChatMessage = {
                    id: `teacher-intro-${Date.now()}`,
                    role: 'teacher',
                    content: `Hello! I'm ${activeTeacher.name}, your ${activeTeacher.topic} teacher. How can I help you learn today?`,
                    timestamp: new Date(),
                    speakerName: activeTeacher.name
                };
                setChatMessages([introMessage]);

                // Store in history
                setTeacherChatHistories(prev => {
                    const newMap = new Map(prev);
                    newMap.set(activeTeacher.id, {
                        teacherId: activeTeacher.id,
                        teacherName: activeTeacher.name,
                        topic: activeTeacher.topic,
                        messages: [introMessage],
                        lastMessageAt: new Date()
                    });
                    return newMap;
                });
            }
        } else if (!activeTeacher && currentTeacherId) {
            // Teacher conversation ended (player moved away) - save current messages to history
            if (chatMessages.length > 0 && currentTeacherId) {
                const history = teacherChatHistories.get(currentTeacherId);
                if (history) {
                    setTeacherChatHistories(prev => {
                        const newMap = new Map(prev);
                        newMap.set(currentTeacherId, {
                            ...history,
                            messages: chatMessages,
                            lastMessageAt: new Date()
                        });
                        return newMap;
                    });
                }
            }
            setCurrentTeacherId(null);
        }
    }, [activeTeacher, currentTeacherId]);

    // Handle selecting a teacher chat from the list
    const handleSelectTeacherChat = (teacher: Teacher) => {
        setSelectedTeacherChat(teacher.id);

        // Check if we have existing chat history
        const existingHistory = teacherChatHistories.get(teacher.id);
        if (existingHistory && existingHistory.messages.length > 0) {
            setChatMessages(existingHistory.messages);
        } else {
            // Start new conversation
            const introMessage: ChatMessage = {
                id: `teacher-intro-${Date.now()}`,
                role: 'teacher',
                content: `Hello! I'm ${teacher.name}, your ${teacher.topic} teacher. How can I help you learn today?`,
                timestamp: new Date(),
                speakerName: teacher.name
            };
            setChatMessages([introMessage]);

            // Store in history
            setTeacherChatHistories(prev => {
                const newMap = new Map(prev);
                newMap.set(teacher.id, {
                    teacherId: teacher.id,
                    teacherName: teacher.name,
                    topic: teacher.topic,
                    messages: [introMessage],
                    lastMessageAt: new Date()
                });
                return newMap;
            });
        }
    };

    // Go back to chat list
    const handleBackToList = () => {
        // Save current chat before going back
        if (selectedTeacherChat && chatMessages.length > 0) {
            const history = teacherChatHistories.get(selectedTeacherChat);
            if (history) {
                setTeacherChatHistories(prev => {
                    const newMap = new Map(prev);
                    newMap.set(selectedTeacherChat, {
                        ...history,
                        messages: chatMessages,
                        lastMessageAt: new Date()
                    });
                    return newMap;
                });
            }
        }
        setSelectedTeacherChat(null);
        setChatMessages([]);
    };

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, playerChatMessages]);

    // Load player conversations when conversations tab is active and no genie/teacher
    useEffect(() => {
        if (activeTab === 'conversations' && !isGenieActive && !activeTeacher && playerId) {
            loadConversations();
            loadTeachers();
        }
    }, [activeTab, isGenieActive, activeTeacher, playerId]);

    // Load available teachers and their chat histories
    const loadTeachers = async () => {
        try {
            const teachers = await getTeachers();
            setAvailableTeachers(teachers);

            // Load chat histories from backend if player is logged in
            if (mongoDBPlayerId) {
                const histories = await getPlayerTeacherChatHistories(mongoDBPlayerId);
                const historyMap = new Map<string, TeacherChatHistory>();

                histories.forEach((h: TeacherChatHistoryResponse) => {
                    historyMap.set(h.teacherId, {
                        teacherId: h.teacherId,
                        teacherName: h.teacherName,
                        topic: h.topic,
                        messages: h.messages.map(m => {
                            let role: 'genie' | 'user' | 'teacher' | 'reward' = 'teacher';
                            if (m.role === 'user') role = 'user';
                            else if (m.role === 'reward') role = 'reward';
                            else if (m.role === 'teacher') role = 'teacher';
                            
                            return {
                                id: `${m.role}-${m.timestamp.getTime()}`,
                                role,
                                content: m.content,
                                timestamp: m.timestamp,
                                speakerName: m.speakerName
                            };
                        }),
                        lastMessageAt: h.lastMessageAt
                    });
                });

                setTeacherChatHistories(historyMap);
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
        }
    };

    // Get MongoDB player ID for chat operations
    const mongoDBPlayerId = playerId ? getMongoDBPlayerId() : null;

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
        if (!mongoDBPlayerId) return;

        const unsubscribe = onChatMessage((data: ChatMessageEvent) => {
            // Parse date if it's a string
            const message = {
                ...data.message,
                createdAt: typeof data.message.createdAt === 'string' 
                    ? new Date(data.message.createdAt) 
                    : data.message.createdAt
            };

            // Only add message if it's for the current player and the active chat
            if (data.recipientId === mongoDBPlayerId && activePlayerChat && data.chatId === activePlayerChat.chatId) {
                setPlayerChatMessages(prev => {
                    // Check if message already exists
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            } else if (data.recipientId === mongoDBPlayerId) {
                // Update conversations list if message is for a different chat
                loadConversations();
            }
        });

        return unsubscribe;
    }, [mongoDBPlayerId, activePlayerChat]);

    const loadConversations = async () => {
        if (!mongoDBPlayerId) return;
        setIsLoadingConversations(true);
        try {
            const conversations = await getPlayerConversations(mongoDBPlayerId);
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
        if (!mongoDBPlayerId) return;
        
        const activeChat: ActivePlayerChat = {
            chatId: chat.id,
            otherPlayerId: chat.otherParticipantId || (chat.participant1Id === mongoDBPlayerId ? chat.participant2Id : chat.participant1Id),
            otherPlayerName: chat.otherParticipantName || (chat.participant1Id === mongoDBPlayerId ? chat.participant2Name : chat.participant1Name) || 'Unknown',
            otherPlayerAvatarColor: chat.otherParticipantAvatarColor || (chat.participant1Id === mongoDBPlayerId ? chat.participant2AvatarColor : chat.participant1AvatarColor) || '#4ECDC4'
        };

        if (onActivePlayerChatChange) {
            onActivePlayerChatChange(activeChat);
        } else {
            setInternalActivePlayerChat(activeChat);
        }
    };


    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const messageText = inputValue;
        setInputValue('');

        // If chatting with a player
        if (activePlayerChat && mongoDBPlayerId) {
            setIsLoading(true);
            try {
                const message = await sendChatMessage(activePlayerChat.chatId, mongoDBPlayerId, messageText);
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
            // If chatting with a teacher (either active or selected from list)
            const teacherId = activeTeacher?.id || selectedTeacherChat;
            if (teacherId) {
                const result = await chatWithTeacher(
                    teacherId,
                    messageText,
                    chatMessages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content
                    })),
                    playerId,
                    walletAddress
                );

                if (result) {
                    const teacherMessage: ChatMessage = {
                        id: `teacher-${Date.now()}`,
                        role: 'teacher',
                        content: result.response,
                        timestamp: new Date(),
                        speakerName: result.teacherName
                    };
                    let newMessages = [...chatMessages, userMessage, teacherMessage];

                    // Add reward message if tokens or NFT were awarded
                    if ((result.tokensAwarded && result.tokensAwarded > 0) || result.nftAwarded) {
                        const rewardMessage: ChatMessage = {
                            id: `reward-${Date.now()}`,
                            role: 'reward',
                            content: `🎉 You've been awarded ${result.tokensAwarded || 0} $LEARN token${(result.tokensAwarded || 0) !== 1 ? 's' : ''}${result.nftAwarded ? ' and 1 NFT badge' : ''} for your solid answer!`,
                            timestamp: new Date(),
                            tokensAwarded: result.tokensAwarded,
                            nftAwarded: result.nftAwarded
                        };
                        newMessages = [...newMessages, rewardMessage];
                    }

                    setChatMessages(newMessages);

                    // Update chat history in state
                    const updatedHistory: TeacherChatHistory = {
                        teacherId,
                        teacherName: result.teacherName,
                        topic: result.topic,
                        messages: newMessages,
                        lastMessageAt: new Date()
                    };

                    setTeacherChatHistories(prev => {
                        const newMap = new Map(prev);
                        newMap.set(teacherId, updatedHistory);
                        return newMap;
                    });

                    // Persist to backend
                    if (playerId) {
                        saveTeacherChatHistory(
                            playerId,
                            teacherId,
                            result.teacherName,
                            result.topic,
                            newMessages.map(m => ({
                                role: m.role,
                                content: m.content,
                                timestamp: m.timestamp,
                                speakerName: m.speakerName
                            }))
                        ).catch(err => console.error('Error saving chat history:', err));
                    }

                    // Update score if tokens were awarded
                    if (result.newScore !== undefined && onScoreUpdate) {
                        onScoreUpdate(result.newScore);
                    }

                    // Refresh balances if tokens or NFT were awarded
                    if ((result.tokensAwarded && result.tokensAwarded > 0) || result.nftAwarded) {
                        // Wait a bit for blockchain transaction to complete, then refresh
                        setTimeout(() => {
                            if (onBalanceRefresh) {
                                onBalanceRefresh();
                            }
                        }, 2000); // 2 second delay to allow transaction to be mined
                    }
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
                        })),
                        playerId,
                        playerPosition
                    })
                });

                const data = await response.json();

                // If topic is identified and no teacher created yet
                if (!learningTopic && data.learningTopic) {
                    setLearningTopic(data.learningTopic);
                }

                if (data.teacher) {
                    console.log('Genie returned summoned teacher:', data.teacher);
                    onTeacherCreated?.(data.teacher);
                    setAvailableTeachers(prev => {
                        if (prev.find(t => t.id === data.teacher.id)) {
                            return prev;
                        }
                        return [...prev, data.teacher];
                    });
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

    const handleDebugMint = async () => {
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            alert('Please connect a valid wallet address first.');
            return;
        }

        setIsLoading(true);
        try {
            // Mint 10 tokens first
            const tokensAmount = '10';
            const tokenResult = await mintTokens(walletAddress, tokensAmount);

            // Wait a bit to ensure the transaction is processed before minting NFT
            // This helps avoid nonce issues
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Mint 1 NFT badge
            const teacherId = activeTeacher?.id || selectedTeacherChat;
            const teacherIdHex = teacherId ? teacherId.replace(/[^a-f0-9]/gi, '').slice(0, 8) || '00000000' : '00000000';
            const quizId = parseInt(teacherIdHex, 16) || 1;
            const quizName = activeTeacher ? `${activeTeacher.topic} Quiz` : 'Learning Quiz';

            const nftResult = await mintNFT(walletAddress, quizId, 1, 1, quizName);

            // Build explorer links (Ronin mainnet: app.roninchain.com, Saigon testnet: saigon-app.roninchain.com)
            const explorerBaseUrl = 'https://app.roninchain.com/tx/';
            const tokenTxLink = tokenResult.txHash ? `${explorerBaseUrl}${tokenResult.txHash}` : null;
            const nftTxLink = nftResult.txHash ? `${explorerBaseUrl}${nftResult.txHash}` : null;

            // Add reward message to chat with transaction links
            const txLinksText = [
                tokenTxLink ? `Tokens: ${tokenTxLink}` : null,
                nftTxLink ? `NFT: ${nftTxLink}` : null
            ].filter(Boolean).join('\n');

            const rewardMessage: ChatMessage = {
                id: `reward-debug-${Date.now()}`,
                role: 'reward',
                content: `🎉 Debug: You've been awarded 10 $LEARN tokens and 1 NFT badge!${txLinksText ? `\n\nView on Ronin Explorer:\n${txLinksText}` : ''}`,
                timestamp: new Date(),
                tokensAwarded: 10,
                nftAwarded: true
            };
            setChatMessages(prev => [...prev, rewardMessage]);

            // Update chat history if we're in a teacher chat
            if (teacherId) {
                const history = teacherChatHistories.get(teacherId);
                if (history) {
                    setTeacherChatHistories(prev => {
                        const newMap = new Map(prev);
                        newMap.set(teacherId, {
                            ...history,
                            messages: [...history.messages, rewardMessage],
                            lastMessageAt: new Date()
                        });
                        return newMap;
                    });
                }
            }

            // Refresh balance after a delay
            setTimeout(() => {
                if (onBalanceRefresh) {
                    onBalanceRefresh();
                }
            }, 2000);
        } catch (error) {
            console.error('Error in debug mint:', error);
            const errorMessage: ChatMessage = {
                id: `error-debug-${Date.now()}`,
                role: 'reward',
                content: `❌ Debug mint failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate a random username like 'cleverFox'
    const generateUserName = (): string => {
        const adjectives = ['clever', 'swift', 'brave', 'bold', 'quick', 'wise', 'silent', 'mighty', 'bright', 'sharp'];
        const nouns = ['Fox', 'Wolf', 'Eagle', 'Tiger', 'Bear', 'Hawk', 'Lion', 'Dragon', 'Falcon', 'Raven'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj}${noun}`;
    };

    // Load player profile when settings tab is opened
    useEffect(() => {
        if (activeTab === 'settings' && playerId) {
            loadPlayerProfile();
        }
    }, [activeTab, playerId]);

    const loadPlayerProfile = async () => {
        const mongoId = getMongoDBPlayerId();
        if (!mongoId) return;

        setIsLoadingProfile(true);
        try {
            const profile = await getPlayerProfile(mongoId);
            if (profile) {
                // Set userName, generate if not exists
                if (profile.userName) {
                    setUserName(profile.userName);
                } else {
                    const generatedName = generateUserName();
                    setUserName(generatedName);
                    // Auto-save the generated name
                    await savePlayerProfile(mongoId, { userName: generatedName });
                }
                
                setBio(profile.biography || '');
                setInterests(profile.interests?.join(', ') || '');
            }
        } catch (error) {
            console.error('Error loading player profile:', error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const savePlayerProfile = async (mongoId: string, updates?: { userName?: string; biography?: string; interests?: string[] }) => {
        setIsSavingProfile(true);
        try {
            const profileData: any = {};
            
            if (updates?.userName !== undefined) {
                profileData.userName = updates.userName;
            } else {
                profileData.userName = userName;
            }
            
            if (updates?.biography !== undefined) {
                profileData.biography = updates.biography;
            } else {
                profileData.biography = bio;
            }
            
            if (updates?.interests !== undefined) {
                profileData.interests = updates.interests;
            } else {
                // Parse interests from comma-separated string
                const interestsArray = interests.split(',').map(i => i.trim()).filter(i => i.length > 0);
                profileData.interests = interestsArray;
            }

            await updatePlayerProfile(mongoId, profileData);
        } catch (error) {
            console.error('Error saving player profile:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        const mongoId = getMongoDBPlayerId();
        if (!mongoId) {
            alert('Player ID not found. Please join the game first.');
            return;
        }
        await savePlayerProfile(mongoId);
    };

    const handleConnectWallet = async () => {
        try {
            const mongoId = getMongoDBPlayerId();
            if (!mongoId) {
                alert('Player ID not found. Please join the game first.');
                return;
            }

            // Generate a new wallet and save it to the player document
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/player/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: mongoId })
            });

            const data = await response.json();
            if (response.ok && data.walletAddress) {
                // Store the new wallet address
                localStorage.setItem('walletAddress', data.walletAddress);
                alert(`New wallet connected: ${data.walletAddress}\n\nPlease save this address securely.`);
                // Optionally reload the page or update wallet display
                window.location.reload();
            } else {
                alert(data.error || 'Failed to connect wallet. Please try again.');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Error connecting wallet. Please try again.');
        }
    };

    const handleExportSeedPhrase = async () => {
        try {
            const mongoId = getMongoDBPlayerId();
            const currentWalletAddress = walletAddress || localStorage.getItem('walletAddress');
            
            if (!currentWalletAddress) {
                alert('No wallet found. Please connect a wallet first.');
                return;
            }

            // Get the private key from the backend
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/player/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    publicAddress: currentWalletAddress,
                    playerId: mongoId || undefined
                })
            });

            const data = await response.json();
            if (response.ok && data.privateKey) {
                // Show the private key in a prompt (in production, this should be more secure)
                const confirmed = confirm(
                    'WARNING: Your private key is sensitive information. Never share it with anyone.\n\n' +
                    'Click OK to copy your private key to clipboard, or Cancel to view it here.'
                );
                
                if (confirmed) {
                    await navigator.clipboard.writeText(data.privateKey);
                    alert('Private key copied to clipboard!');
                } else {
                    // Show in an alert (not ideal for security, but functional)
                    alert(`Your private key:\n\n${data.privateKey}\n\nPlease save this securely.`);
                }
            } else {
                alert(data.error || 'Failed to retrieve seed phrase. The wallet may not be stored on the server.');
            }
        } catch (error) {
            console.error('Error exporting seed phrase:', error);
            alert('Error exporting seed phrase. Please try again.');
        }
    };

    const handleStartPlayerChat = async (playerId: string, otherPlayerId: string) => {
        if (!playerId || !otherPlayerId) {
            console.error('Player IDs are required to start a chat.');
            return;
        }

        try {
            // Call backend to create or retrieve the chat
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participant1Id: playerId, participant2Id: otherPlayerId })
            });

            if (!response.ok) {
                console.error('Failed to start chat:', response.statusText);
                return;
            }

            const chat = await response.json();

            // Update the active player chat state
            const activeChat: ActivePlayerChat = {
                chatId: chat.id,
                otherPlayerId: chat.participant1Id === playerId ? chat.participant2Id : chat.participant1Id,
                otherPlayerName: chat.participant1Id === playerId ? chat.participant2Name : chat.participant1Name,
                otherPlayerAvatarColor: chat.participant1Id === playerId ? chat.participant2AvatarColor : chat.participant1AvatarColor
            };

            if (onActivePlayerChatChange) {
                onActivePlayerChatChange(activeChat);
            } else {
                setInternalActivePlayerChat(activeChat);
            }
        } catch (error) {
            console.error('Error starting player chat:', error);
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
                            {/* Chat List View - Show when no active chat */}
                            {!isGenieActive && !activeTeacher && !activePlayerChat && !selectedTeacherChat && (
                                <div className="space-y-4">
                                    {/* Teacher Chats Section */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-mono uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                                            Teacher Chats
                                        </h3>
                                        {availableTeachers.length === 0 ? (
                                            <div className="text-ghost-green text-center py-4 font-mono text-sm">
                                                No teachers yet. Ask the Learning Genie to summon one!
                                            </div>
                                        ) : (
                                            availableTeachers.map((teacher) => {
                                                const history = teacherChatHistories.get(teacher.id);
                                                const lastMessage = history?.messages[history.messages.length - 1];
                                                return (
                                                    <button
                                                        key={teacher.id}
                                                        onClick={() => handleSelectTeacherChat(teacher)}
                                                        className="w-full p-3 rounded bg-amber-900/20 border border-amber-400/20 hover:bg-amber-900/40 hover:border-amber-400/40 transition-all text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-amber-500/30 border-2 border-amber-400/50 flex items-center justify-center">
                                                                <span className="text-amber-200 font-bold text-sm">
                                                                    {teacher.name.charAt(0)}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-amber-300 font-mono text-sm font-semibold truncate">
                                                                    {teacher.name}
                                                                </div>
                                                                <div className="text-amber-400/60 text-xs truncate">
                                                                    {teacher.topic}
                                                                </div>
                                                                {lastMessage && (
                                                                    <div className="text-amber-200/50 text-xs truncate mt-1">
                                                                        {lastMessage.content.substring(0, 50)}...
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {history && (
                                                                <div className="text-amber-400/40 text-xs">
                                                                    {history.messages.length} msgs
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-matrix-green/20 my-4"></div>

                                    {/* Player Chats Section */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-mono uppercase tracking-wider text-matrix-green mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-matrix-green rounded-full"></span>
                                            Player Chats
                                        </h3>
                                        {isLoadingConversations ? (
                                            <div className="text-ghost-green text-center py-4">Loading conversations...</div>
                                        ) : playerConversations.length === 0 ? (
                                            <div className="text-ghost-green text-center py-4 font-mono text-sm">
                                                No player chats yet. Walk up to other players to start chatting!
                                            </div>
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
                            {(isGenieActive || activeTeacher || selectedTeacherChat) && (
                                <>
                                    {/* Back button for selected teacher chat (not when actively near teacher) */}
                                    {selectedTeacherChat && !activeTeacher && !isGenieActive && (
                                        <button
                                            onClick={handleBackToList}
                                            className="mb-4 px-3 py-2 bg-amber-900/30 border border-amber-400/30 rounded text-amber-300 text-sm hover:bg-amber-900/50 transition-colors flex items-center gap-2"
                                        >
                                            <ChevronLeft size={16} />
                                            Back to Chats
                                        </button>
                                    )}

                                    {chatMessages.map((message) => {
                                        // Special rendering for reward messages
                                        if (message.role === 'reward') {
                                            return (
                                                <div
                                                    key={message.id}
                                                    className="flex gap-3 justify-center my-4"
                                                >
                                                    <div className="flex-1 max-w-full">
                                                        <div className="p-4 rounded-lg text-sm bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-2 border-green-400/50 text-green-100 shadow-lg break-words overflow-wrap-anywhere">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xl">🎉</span>
                                                                <span className="font-bold text-green-300">Reward Notification</span>
                                                            </div>
                                                            <p className="whitespace-pre-wrap mb-2 break-words overflow-wrap-anywhere">
                                                                {message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                                                                    part.match(/^https?:\/\//) ? (
                                                                        <a
                                                                            key={i}
                                                                            href={part}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-300 hover:text-blue-200 underline break-all"
                                                                        >
                                                                            {part}
                                                                        </a>
                                                                    ) : (
                                                                        <span key={i}>{part}</span>
                                                                    )
                                                                )}
                                                            </p>
                                                            {message.tokensAwarded && message.tokensAwarded > 0 && (
                                                                <div className="text-xs text-green-200 mt-2 pt-2 border-t border-green-400/30 break-words">
                                                                    💰 {message.tokensAwarded} $LEARN tokens
                                                                </div>
                                                            )}
                                                            {message.nftAwarded && (
                                                                <div className="text-xs text-green-200 mt-1 break-words">
                                                                    🏆 1 NFT Badge
                                                                </div>
                                                            )}
                                                            <span className="text-xs opacity-50 mt-2 block">
                                                                {message.timestamp.toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        
                                        // Regular message rendering
                                        return (
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
                                        );
                                    })}
                                </>
                            )}

                            {isLoading && (isGenieActive || activeTeacher || selectedTeacherChat) && (
                                <div className="flex gap-3">
                                    {(activeTeacher || selectedTeacherChat) ? (
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
                            {isLoadingProfile ? (
                                <div className="text-ghost-green text-center py-4 font-mono text-sm">
                                    Loading profile...
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-dim-green uppercase tracking-wider">User Name</label>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            className="w-full p-2 rounded bg-code-black border border-matrix-green/40 text-matrix-green text-sm font-mono focus:outline-none focus:border-matrix-green glow-green-subtle transition-all duration-200"
                                            placeholder="cleverFox"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-dim-green uppercase tracking-wider">Bio</label>
                                        <textarea
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            rows={4}
                                            className="w-full p-2 rounded bg-code-black border border-matrix-green/40 text-matrix-green text-sm font-mono focus:outline-none focus:border-matrix-green glow-green-subtle transition-all duration-200 resize-none"
                                            placeholder="Tell us about yourself..."
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-dim-green uppercase tracking-wider">Interests</label>
                                        <input
                                            type="text"
                                            value={interests}
                                            onChange={(e) => setInterests(e.target.value)}
                                            className="w-full p-2 rounded bg-code-black border border-matrix-green/40 text-matrix-green text-sm font-mono focus:outline-none focus:border-matrix-green glow-green-subtle transition-all duration-200"
                                            placeholder="coding, gaming, learning (comma-separated)"
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isSavingProfile}
                                        className="w-full px-4 py-2 bg-gradient-to-b from-matrix-green to-green-600 text-terminal-black font-semibold rounded-lg hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                    </button>
                                    
                                    <div className="border-t border-matrix-green/20 pt-4 space-y-3">
                                        <button
                                            onClick={handleConnectWallet}
                                            className="w-full px-4 py-2 bg-gradient-to-b from-amber-500 to-amber-600 text-amber-950 font-semibold rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all"
                                        >
                                            Connect Another Crypto Wallet
                                        </button>
                                        
                                        <button
                                            onClick={handleExportSeedPhrase}
                                            className="w-full px-4 py-2 bg-gradient-to-b from-red-600 to-red-700 text-white font-semibold rounded-lg hover:from-red-500 hover:to-red-600 transition-all"
                                        >
                                            Export Seed Phrase
                                        </button>
                                    </div>
                                    
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
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Chat Input - Show in conversations tab when genie, teacher, or player chat is active */}
                {activeTab === 'conversations' && (isGenieActive || activeTeacher || activePlayerChat || selectedTeacherChat) && (
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
                                    : selectedTeacherChat
                                    ? `Continue learning...`
                                    : "Ask the genie what you want to learn..."
                                }
                                className="flex-1 p-3 bg-amber-950/30 border border-amber-400/30 rounded-lg text-amber-100 placeholder-amber-400/50 focus:outline-none focus:border-amber-400/60 text-sm"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleDebugMint}
                                disabled={isLoading || !walletAddress}
                                className="px-0.5 py-0.5 bg-gradient-to-b from-purple-500 to-purple-600 text-white rounded hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                title="Debug: Mint tokens and NFT"
                            >
                                <Bug size={8} />
                            </button>
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
