'use client';

import { useState } from 'react';
import { Brain, MessageSquare, Settings, Phone } from 'lucide-react';
import AICharacterList from './AICharacterList';

export interface AgentLog {
    id: string;
    timestamp: Date;
    type: 'move' | 'think' | 'plan' | 'converse';
    content: any;
}

interface AgentPanelProps {
    logs: AgentLog[];
    playerId?: string;
}

export default function AgentPanel({ logs, playerId }: AgentPanelProps) {
    const [activeTab, setActiveTab] = useState<'thinking' | 'conversations' | 'voice' | 'settings'>('thinking');

    return (
        <div className="flex h-full w-full bg-terminal-black text-matrix-green border-l-2 border-matrix-green/30">
            {/* Vertical Tabs */}
            <div className="flex flex-col w-16 border-r border-matrix-green/30 bg-code-black">
                <button
                    onClick={() => setActiveTab('thinking')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'thinking'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Thinking"
                >
                    <Brain size={24} />
                </button>
                <button
                    onClick={() => setActiveTab('conversations')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'conversations'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Conversations"
                >
                    <MessageSquare size={24} />
                </button>
                <button
                    onClick={() => setActiveTab('voice')}
                    className={`p-4 flex justify-center transition-all duration-200 ${activeTab === 'voice'
                            ? 'bg-matrix-dark border-l-2 border-matrix-green text-matrix-green'
                            : 'text-ghost-green hover:text-dim-green hover:bg-dark-green'
                        }`}
                    title="Voice Calls"
                >
                    <Phone size={24} />
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
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
                            {logs.filter(l => l.type === 'converse').map((log) => (
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
                            {logs.filter(l => l.type === 'converse').length === 0 && (
                                <div className="text-ghost-green text-center mt-10 font-mono uppercase text-sm tracking-wider">
                                    No conversations yet...
                                </div>
                            )}
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
            </div>
        </div>
    );
}
