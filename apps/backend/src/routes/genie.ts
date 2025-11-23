import { Hono } from 'hono'
import { genieService } from '../services/genie.service.js'

const genie = new Hono()

genie.post('/chat', async (c) => {
    try {
        const body = await c.req.json()
        const { message, learningTopic, conversationHistory, playerId, playerPosition } = body

        if (!message) {
            return c.json({ error: 'Message is required' }, 400)
        }

        const response = await genieService.chat(
            message,
            learningTopic || null,
            conversationHistory || [],
            playerId,
            playerPosition
        )

        return c.json(response)
    } catch (error) {
        console.error('Error in genie chat:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export { genie }
