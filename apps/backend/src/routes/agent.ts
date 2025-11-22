import { Hono } from 'hono'
import { agentService } from '../services/agent.service.js'

const agent = new Hono()

agent.post('/tick', async (c) => {
    try {
        const body = await c.req.json()
        const { state } = body

        if (!state) {
            return c.json({ error: 'State is required' }, 400)
        }

        const action = await agentService.decideAction(state)
        return c.json(action)
    } catch (error) {
        console.error('Error in agent tick:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export { agent }
