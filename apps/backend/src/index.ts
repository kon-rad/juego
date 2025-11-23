import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createServer } from 'http'
import { connectToMongoDB } from './lib/mongodb.js'
import { initSocketServer } from './lib/socket.js'
import { agent } from './routes/agent.js'
import { game } from './routes/game.js'
import { aiCharacter } from './routes/ai-character.js'
import { player } from './routes/player.js'
import { vapi } from './routes/vapi.js'
import { genie } from './routes/genie.js'
import { teacher } from './routes/teacher.js'

const app = new Hono()

app.use('/*', cors())

app.route('/api/agent', agent)
app.route('/api/game', game)
app.route('/api/ai-character', aiCharacter)
app.route('/api/player', player)
app.route('/api/vapi', vapi)
app.route('/api/genie', genie)
app.route('/api/teacher', teacher)

app.get('/', (c) => {
  return c.text('Juego Backend API')
})

app.get('/health', async (c) => {
  try {
    // Check DB connection
    const db = await connectToMongoDB()
    await db.command({ ping: 1 })
    return c.json({ status: 'ok', db: 'connected' })
  } catch (e) {
    return c.json({ status: 'error', db: 'disconnected', error: String(e) }, 500)
  }
})

const port = Number(process.env.PORT) || 3001

// Create HTTP server manually to support both Hono and Socket.IO
const httpServer = createServer(async (req, res) => {
  // Convert Node request to fetch Request
  // Use the actual host from the request headers, or fallback to localhost for local dev
  // Railway sets x-forwarded-proto header for HTTPS connections
  const host = req.headers.host || `localhost:${port}`
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const url = `${protocol}://${host}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v))
      } else {
        headers.set(key, value)
      }
    }
  }
  
  let body: string | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks).toString()
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body
  })

  const response = await app.fetch(request)
  
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  
  const responseBody = await response.text()
  res.end(responseBody)
})

// Initialize Socket.IO
initSocketServer(httpServer)

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
