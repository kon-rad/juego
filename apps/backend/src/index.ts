import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prisma } from './lib/prisma.js'

const app = new Hono()

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
