import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prisma } from './lib/prisma.js'
import { agent } from './routes/agent.js'
import { game } from './routes/game.js'

const app = new Hono()

app.use('/*', cors())

app.route('/api/agent', agent)
app.route('/api/game', game)

app.get('/', (c) => {
  return c.text('Juego Backend API')
})

app.get('/health', async (c) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`
    return c.json({ status: 'ok', db: 'connected' })
  } catch (e) {
    return c.json({ status: 'error', db: 'disconnected', error: String(e) }, 500)
  }
})

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
