import { VapiClient } from '@vapi-ai/server-sdk'
import { getAICharactersCollection, getPlayersCollection, getVapiCallsCollection, ObjectId, VapiCall } from '../lib/mongodb.js'

// Initialize Vapi client
const vapiApiKey = process.env.VAPI_API_KEY || ''
const vapi = vapiApiKey ? new VapiClient({ token: vapiApiKey }) : null

export interface InitiateCallResult {
    success: boolean
    callId?: string
    status?: string
    error?: string
}

export interface CallStatusResult {
    success: boolean
    status?: string
    call?: VapiCall
    error?: string
}

/**
 * Build system prompt with user profile context
 */
function buildSystemPromptWithUserContext(
    characterSystemPrompt: string,
    userProfile: {
        name: string
        biography?: string
        score?: number
        interests?: string[]
        level?: number
    }
): string {
    const userContext = `

User Profile:
- Name: ${userProfile.name}
${userProfile.biography ? `- Biography: ${userProfile.biography}` : ''}
${userProfile.score !== undefined ? `- Score: ${userProfile.score}` : ''}
${userProfile.interests && userProfile.interests.length > 0 ? `- Interests: ${userProfile.interests.join(', ')}` : ''}
${userProfile.level !== undefined ? `- Level: ${userProfile.level}` : ''}

Please personalize your responses based on this user's profile.`

    return characterSystemPrompt + userContext
}

/**
 * Initiate a voice call with an AI character
 */
export async function initiateCall(
    characterId: string,
    userId: string
): Promise<InitiateCallResult> {
    if (!vapi) {
        return { success: false, error: 'Vapi client not configured. Set VAPI_API_KEY environment variable.' }
    }

    try {
        // Fetch AI character
        const charactersCollection = await getAICharactersCollection()
        const character = await charactersCollection.findOne({ _id: new ObjectId(characterId) })
        
        if (!character) {
            return { success: false, error: 'AI character not found' }
        }

        // Fetch user profile
        const playersCollection = await getPlayersCollection()
        const player = await playersCollection.findOne({ _id: new ObjectId(userId) })
        
        if (!player) {
            return { success: false, error: 'Player not found' }
        }

        // Build system prompt with user context
        const systemPrompt = buildSystemPromptWithUserContext(
            character.systemPrompt,
            {
                name: player.name,
                biography: player.biography,
                score: player.score,
                interests: player.interests,
                level: player.level
            }
        )

        // Create Vapi call
        const call = await vapi.calls.create({
            assistant: {
                name: character.name,
                firstMessage: `Hello ${player.name}! I'm ${character.name}. How can I help you today?`,
                model: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        }
                    ]
                },
                voice: {
                    provider: 'openai',
                    voiceId: character.voiceSettings?.voiceId || 'alloy'
                }
            }
        })

        // Store call record in MongoDB
        const callsCollection = await getVapiCallsCollection()
        const callRecord: VapiCall = {
            callId: call.id,
            characterId,
            userId,
            status: 'initiating',
            startedAt: new Date(),
            metadata: {
                characterName: character.name,
                playerName: player.name
            }
        }
        await callsCollection.insertOne(callRecord)

        return {
            success: true,
            callId: call.id,
            status: 'initiating'
        }
    } catch (error) {
        console.error('Error initiating Vapi call:', error)
        return { success: false, error: `Failed to initiate call: ${String(error)}` }
    }
}

/**
 * Get call status
 */
export async function getCallStatus(callId: string): Promise<CallStatusResult> {
    if (!vapi) {
        return { success: false, error: 'Vapi client not configured' }
    }

    try {
        // Get call from Vapi
        const vapiCall = await vapi.calls.get(callId)
        
        // Get call record from MongoDB
        const callsCollection = await getVapiCallsCollection()
        const callRecord = await callsCollection.findOne({ callId })

        // Map Vapi status to our status
        let status: VapiCall['status'] = 'initiating'
        if (vapiCall.status === 'ringing') status = 'ringing'
        else if (vapiCall.status === 'in-progress') status = 'in-progress'
        else if (vapiCall.status === 'ended') status = 'ended'
        else if (vapiCall.status === 'forwarding') status = 'in-progress'

        // Update status in MongoDB if changed
        if (callRecord && callRecord.status !== status) {
            const updateData: Partial<VapiCall> = { status }
            if (status === 'ended') {
                updateData.endedAt = new Date()
            }
            await callsCollection.updateOne(
                { callId },
                { $set: updateData }
            )
        }

        return {
            success: true,
            status,
            call: callRecord ? { ...callRecord, status } as VapiCall : undefined
        }
    } catch (error) {
        console.error('Error getting call status:', error)
        return { success: false, error: `Failed to get call status: ${String(error)}` }
    }
}

/**
 * End a call
 */
export async function endCall(callId: string): Promise<{ success: boolean; error?: string }> {
    if (!vapi) {
        return { success: false, error: 'Vapi client not configured' }
    }

    try {
        // End call via Vapi - Note: Vapi SDK may not have direct end call method
        // We'll update our records and the call will end naturally or via webhook
        
        // Update call record in MongoDB
        const callsCollection = await getVapiCallsCollection()
        await callsCollection.updateOne(
            { callId },
            { 
                $set: { 
                    status: 'ended',
                    endedAt: new Date()
                } 
            }
        )

        return { success: true }
    } catch (error) {
        console.error('Error ending call:', error)
        return { success: false, error: `Failed to end call: ${String(error)}` }
    }
}

/**
 * Handle Vapi webhook events
 */
export async function handleWebhook(
    event: string,
    data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
    try {
        const callsCollection = await getVapiCallsCollection()

        switch (event) {
            case 'call-started':
                await callsCollection.updateOne(
                    { callId: data.call?.id },
                    { $set: { status: 'in-progress' } }
                )
                break

            case 'call-ended':
                await callsCollection.updateOne(
                    { callId: data.call?.id },
                    { 
                        $set: { 
                            status: 'ended',
                            endedAt: new Date(),
                            metadata: {
                                ...data.call,
                                duration: data.call?.duration,
                                endReason: data.call?.endedReason
                            }
                        } 
                    }
                )
                break

            case 'speech-update':
            case 'transcript':
                // Optionally store transcripts
                break

            default:
                console.log('Unhandled Vapi webhook event:', event)
        }

        return { success: true }
    } catch (error) {
        console.error('Error handling webhook:', error)
        return { success: false, error: `Failed to handle webhook: ${String(error)}` }
    }
}

/**
 * Get Vapi Web SDK token for client-side integration
 * This allows the frontend to connect directly to Vapi
 */
export async function getWebToken(
    characterId: string,
    userId: string
): Promise<{ success: boolean; token?: string; assistantConfig?: any; error?: string }> {
    if (!vapiApiKey) {
        return { success: false, error: 'Vapi API key not configured' }
    }

    try {
        // Fetch AI character
        const charactersCollection = await getAICharactersCollection()
        const character = await charactersCollection.findOne({ _id: new ObjectId(characterId) })
        
        if (!character) {
            return { success: false, error: 'AI character not found' }
        }

        // Fetch user profile
        const playersCollection = await getPlayersCollection()
        const player = await playersCollection.findOne({ _id: new ObjectId(userId) })
        
        if (!player) {
            return { success: false, error: 'Player not found' }
        }

        // Build system prompt with user context
        const systemPrompt = buildSystemPromptWithUserContext(
            character.systemPrompt,
            {
                name: player.name,
                biography: player.biography,
                score: player.score,
                interests: player.interests,
                level: player.level
            }
        )

        // Return the API key and assistant configuration for client-side use
        // In production, you might want to use Vapi's ephemeral tokens instead
        const assistantConfig = {
            name: character.name,
            firstMessage: `Hello ${player.name}! I'm ${character.name}. How can I help you today?`,
            model: {
                provider: 'openai',
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    }
                ]
            },
            voice: {
                provider: 'openai',
                voiceId: character.voiceSettings?.voiceId || 'alloy'
            }
        }

        return {
            success: true,
            token: vapiApiKey, // In production, use ephemeral/scoped tokens
            assistantConfig
        }
    } catch (error) {
        console.error('Error getting web token:', error)
        return { success: false, error: `Failed to get web token: ${String(error)}` }
    }
}
