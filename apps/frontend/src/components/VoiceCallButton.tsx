'use client'

import { useState, useCallback } from 'react'
import { Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react'
import { startVoiceCall, endVoiceCall, VoiceCallState, destroyVapiInstance } from '../lib/vapi'

interface VoiceCallButtonProps {
    characterId: string
    characterName: string
    userId: string
    onCallStateChange?: (state: VoiceCallState) => void
}

export default function VoiceCallButton({
    characterId,
    characterName,
    userId,
    onCallStateChange
}: VoiceCallButtonProps) {
    const [callState, setCallState] = useState<VoiceCallState>({ status: 'idle' })
    const [isMuted, setIsMuted] = useState(false)

    const handleStateChange = useCallback((state: VoiceCallState) => {
        setCallState(state)
        onCallStateChange?.(state)
        
        // Clean up when call ends
        if (state.status === 'ended' || state.status === 'error') {
            setTimeout(() => {
                destroyVapiInstance()
                setCallState({ status: 'idle' })
            }, 2000)
        }
    }, [onCallStateChange])

    const handleStartCall = async () => {
        if (callState.status !== 'idle') return
        
        await startVoiceCall(characterId, userId, handleStateChange)
    }

    const handleEndCall = () => {
        endVoiceCall()
        handleStateChange({ status: 'ended' })
    }

    const toggleMute = () => {
        setIsMuted(!isMuted)
        // Note: Vapi Web SDK handles mute through the instance
        // You can access it via getVapiInstance() if needed
    }

    const getButtonContent = () => {
        switch (callState.status) {
            case 'connecting':
                return (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Connecting...</span>
                    </>
                )
            case 'active':
                return (
                    <>
                        <PhoneOff className="w-5 h-5" />
                        <span>End Call</span>
                    </>
                )
            case 'ended':
                return (
                    <>
                        <Phone className="w-5 h-5" />
                        <span>Call Ended</span>
                    </>
                )
            case 'error':
                return (
                    <>
                        <Phone className="w-5 h-5" />
                        <span>Try Again</span>
                    </>
                )
            default:
                return (
                    <>
                        <Phone className="w-5 h-5" />
                        <span>Call {characterName}</span>
                    </>
                )
        }
    }

    const getButtonStyle = () => {
        switch (callState.status) {
            case 'connecting':
                return 'bg-yellow-600 hover:bg-yellow-500 cursor-wait'
            case 'active':
                return 'bg-red-600 hover:bg-red-500'
            case 'ended':
                return 'bg-gray-600 cursor-not-allowed'
            case 'error':
                return 'bg-orange-600 hover:bg-orange-500'
            default:
                return 'bg-matrix-green hover:bg-neon-green'
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={callState.status === 'active' ? handleEndCall : handleStartCall}
                disabled={callState.status === 'connecting' || callState.status === 'ended'}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 ${getButtonStyle()}`}
            >
                {getButtonContent()}
            </button>

            {/* Mute button - only show during active call */}
            {callState.status === 'active' && (
                <button
                    onClick={toggleMute}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isMuted 
                            ? 'bg-red-600/50 text-red-300 hover:bg-red-600/70' 
                            : 'bg-matrix-dark text-matrix-green hover:bg-matrix-green/20'
                    }`}
                >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
            )}

            {/* Status indicator */}
            {callState.status === 'active' && (
                <div className="flex items-center gap-2 text-sm text-matrix-green">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span>Speaking with {characterName}</span>
                </div>
            )}

            {/* Error message */}
            {callState.status === 'error' && callState.error && (
                <div className="text-sm text-red-400 mt-1">
                    {callState.error}
                </div>
            )}
        </div>
    )
}
