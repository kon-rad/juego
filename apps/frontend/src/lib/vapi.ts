import Vapi from '@vapi-ai/web'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Vapi instance (singleton)
let vapiInstance: Vapi | null = null

export interface AICharacter {
    id: string
    _id?: string
    name: string
    personality: string
    systemPrompt: string
    voiceSettings: {
        voiceId?: string
        speed?: number
        stability?: number
        similarityBoost?: number
    }
    avatar?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface VoiceCallState {
    status: 'idle' | 'connecting' | 'active' | 'ended' | 'error'
    callId?: string
    error?: string
}

export interface VapiWebToken {
    token: string
    assistantConfig: {
        name: string
        firstMessage: string
        model: {
            provider: string
            model: string
            messages: { role: string; content: string }[]
        }
        voice: {
            provider: string
            voiceId: string
        }
    }
}

/**
 * Get or create Vapi instance
 */
export function getVapiInstance(token?: string): Vapi | null {
    if (!vapiInstance && token) {
        vapiInstance = new Vapi(token)
    }
    return vapiInstance
}

/**
 * Clean up Vapi instance
 */
export function destroyVapiInstance(): void {
    if (vapiInstance) {
        vapiInstance.stop()
        vapiInstance = null
    }
}

/**
 * Get web token and assistant config from backend
 */
export async function getVapiWebToken(
    characterId: string,
    userId: string
): Promise<VapiWebToken | null> {
    try {
        const response = await fetch(`${API_URL}/api/vapi/web-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId, userId })
        })

        if (!response.ok) {
            console.error('Failed to get Vapi web token:', response.statusText)
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('Error getting Vapi web token:', error)
        return null
    }
}

/**
 * Start a voice call with an AI character
 */
export async function startVoiceCall(
    characterId: string,
    userId: string,
    onStateChange?: (state: VoiceCallState) => void
): Promise<Vapi | null> {
    try {
        onStateChange?.({ status: 'connecting' })

        // Get token and config from backend
        const tokenData = await getVapiWebToken(characterId, userId)
        
        if (!tokenData) {
            onStateChange?.({ status: 'error', error: 'Failed to get voice token' })
            return null
        }

        // Create or get Vapi instance
        const vapi = getVapiInstance(tokenData.token)
        
        if (!vapi) {
            onStateChange?.({ status: 'error', error: 'Failed to initialize Vapi' })
            return null
        }

        // Set up event handlers
        vapi.on('call-start', () => {
            onStateChange?.({ status: 'active' })
        })

        vapi.on('call-end', () => {
            onStateChange?.({ status: 'ended' })
        })

        vapi.on('error', (error) => {
            console.error('Vapi error:', error)
            onStateChange?.({ status: 'error', error: String(error) })
        })

        vapi.on('speech-start', () => {
            console.log('AI started speaking')
        })

        vapi.on('speech-end', () => {
            console.log('AI stopped speaking')
        })

        // Start the call with the assistant config
        await vapi.start({
            name: tokenData.assistantConfig.name,
            firstMessage: tokenData.assistantConfig.firstMessage,
            model: tokenData.assistantConfig.model as any,
            voice: tokenData.assistantConfig.voice as any
        })

        return vapi
    } catch (error) {
        console.error('Error starting voice call:', error)
        onStateChange?.({ status: 'error', error: String(error) })
        return null
    }
}

/**
 * End the current voice call
 */
export function endVoiceCall(): void {
    if (vapiInstance) {
        vapiInstance.stop()
    }
}

/**
 * Check if a call is currently active
 */
export function isCallActive(): boolean {
    return vapiInstance !== null
}

/**
 * Fetch all AI characters from backend
 */
export async function getAICharacters(): Promise<AICharacter[]> {
    try {
        const response = await fetch(`${API_URL}/api/ai-character`)

        if (!response.ok) {
            console.error('Failed to fetch AI characters:', response.statusText)
            return []
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching AI characters:', error)
        return []
    }
}

/**
 * Fetch a specific AI character by ID
 */
export async function getAICharacter(id: string): Promise<AICharacter | null> {
    try {
        const response = await fetch(`${API_URL}/api/ai-character/${id}`)

        if (!response.ok) {
            console.error('Failed to fetch AI character:', response.statusText)
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching AI character:', error)
        return null
    }
}

/**
 * Seed default AI characters (Teacher and Genie)
 */
export async function seedAICharacters(): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/api/ai-character/seed`, {
            method: 'POST'
        })

        if (!response.ok) {
            console.error('Failed to seed AI characters:', response.statusText)
            return false
        }

        return true
    } catch (error) {
        console.error('Error seeding AI characters:', error)
        return false
    }
}
