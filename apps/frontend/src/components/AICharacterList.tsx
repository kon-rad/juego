'use client'

import { useState, useEffect } from 'react'
import { User, Sparkles, RefreshCw } from 'lucide-react'
import { AICharacter, getAICharacters, seedAICharacters } from '../lib/vapi'
import VoiceCallButton from './VoiceCallButton'

interface AICharacterListProps {
    userId: string
}

export default function AICharacterList({ userId }: AICharacterListProps) {
    const [characters, setCharacters] = useState<AICharacter[]>([])
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState(false)

    const loadCharacters = async () => {
        setLoading(true)
        const chars = await getAICharacters()
        setCharacters(chars)
        setLoading(false)
    }

    const handleSeedCharacters = async () => {
        setSeeding(true)
        const success = await seedAICharacters()
        if (success) {
            await loadCharacters()
        }
        setSeeding(false)
    }

    useEffect(() => {
        loadCharacters()
    }, [])

    const getCharacterIcon = (name: string) => {
        if (name.toLowerCase().includes('genie')) {
            return <Sparkles className="w-8 h-8 text-purple-400" />
        }
        return <User className="w-8 h-8 text-blue-400" />
    }

    const getCharacterGradient = (name: string) => {
        if (name.toLowerCase().includes('genie')) {
            return 'from-purple-900/50 to-indigo-900/50 border-purple-500/30'
        }
        return 'from-blue-900/50 to-cyan-900/50 border-blue-500/30'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin text-matrix-green" />
                <span className="ml-2 text-ghost-green">Loading characters...</span>
            </div>
        )
    }

    if (characters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <p className="text-ghost-green text-center">
                    No AI characters found. Seed default characters to get started.
                </p>
                <button
                    onClick={handleSeedCharacters}
                    disabled={seeding}
                    className="flex items-center gap-2 px-4 py-2 bg-matrix-green hover:bg-neon-green text-black font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                    {seeding ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Seeding...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            <span>Seed Characters</span>
                        </>
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-matrix-green uppercase tracking-wider">
                    AI Characters
                </h3>
                <button
                    onClick={loadCharacters}
                    className="p-2 text-ghost-green hover:text-matrix-green transition-colors"
                    title="Refresh characters"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid gap-4">
                {characters.map((character) => (
                    <div
                        key={character.id}
                        className={`p-4 rounded-lg bg-gradient-to-br ${getCharacterGradient(character.name)} border backdrop-blur-sm`}
                    >
                        <div className="flex items-start gap-4">
                            {/* Character Avatar */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
                                {getCharacterIcon(character.name)}
                            </div>

                            {/* Character Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-lg font-semibold text-white mb-1">
                                    {character.name}
                                </h4>
                                <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                                    {character.personality}
                                </p>

                                {/* Voice Call Button */}
                                <VoiceCallButton
                                    characterId={character.id}
                                    characterName={character.name}
                                    userId={userId}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
