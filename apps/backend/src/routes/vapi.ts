import { Hono } from 'hono'
import { initiateCall, getCallStatus, endCall, handleWebhook, getWebToken } from '../services/vapi.service.js'

const vapi = new Hono()

// Initiate a voice call
vapi.post('/initiate', async (c) => {
    try {
        const body = await c.req.json()
        const { characterId, userId } = body
        
        if (!characterId || !userId) {
            return c.json({ error: 'characterId and userId are required' }, 400)
        }
        
        const result = await initiateCall(characterId, userId)
        
        if (!result.success) {
            return c.json({ error: result.error }, 400)
        }
        
        return c.json({
            callId: result.callId,
            status: result.status
        })
    } catch (error) {
        console.error('Error initiating voice call:', error)
        return c.json({ error: 'Failed to initiate voice call' }, 500)
    }
})

// Get web token for client-side Vapi integration
vapi.post('/web-token', async (c) => {
    try {
        const body = await c.req.json()
        const { characterId, userId } = body
        
        if (!characterId || !userId) {
            return c.json({ error: 'characterId and userId are required' }, 400)
        }
        
        const result = await getWebToken(characterId, userId)
        
        if (!result.success) {
            return c.json({ error: result.error }, 400)
        }
        
        return c.json({
            token: result.token,
            assistantConfig: result.assistantConfig
        })
    } catch (error) {
        console.error('Error getting web token:', error)
        return c.json({ error: 'Failed to get web token' }, 500)
    }
})

// Get call status
vapi.get('/call/:callId', async (c) => {
    try {
        const callId = c.req.param('callId')
        
        const result = await getCallStatus(callId)
        
        if (!result.success) {
            return c.json({ error: result.error }, 400)
        }
        
        return c.json({
            status: result.status,
            call: result.call
        })
    } catch (error) {
        console.error('Error getting call status:', error)
        return c.json({ error: 'Failed to get call status' }, 500)
    }
})

// End a call
vapi.post('/call/:callId/end', async (c) => {
    try {
        const callId = c.req.param('callId')
        
        const result = await endCall(callId)
        
        if (!result.success) {
            return c.json({ error: result.error }, 400)
        }
        
        return c.json({ success: true })
    } catch (error) {
        console.error('Error ending call:', error)
        return c.json({ error: 'Failed to end call' }, 500)
    }
})

// Vapi webhook handler
vapi.post('/webhook', async (c) => {
    try {
        const body = await c.req.json()
        const { message } = body
        
        if (!message || !message.type) {
            return c.json({ error: 'Invalid webhook payload' }, 400)
        }
        
        const result = await handleWebhook(message.type, message)
        
        if (!result.success) {
            console.error('Webhook handling error:', result.error)
        }
        
        // Always return 200 to acknowledge receipt
        return c.json({ received: true })
    } catch (error) {
        console.error('Error handling webhook:', error)
        // Still return 200 to prevent retries
        return c.json({ received: true, error: 'Processing error' })
    }
})

export { vapi }
