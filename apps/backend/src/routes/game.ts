import { Hono } from 'hono'
import { getGameWorldsCollection, getPlayersCollection, getWorldObjectsCollection, ObjectId } from '../lib/mongodb.js'

const game = new Hono()

// Helper to generate UUID-like string
function generateId(): string {
    return new ObjectId().toString()
}

// Get or create the default game world
game.get('/world', async (c) => {
    try {
        const worldsCollection = await getGameWorldsCollection()
        const playersCollection = await getPlayersCollection()
        const objectsCollection = await getWorldObjectsCollection()

        let world = await worldsCollection.findOne({ name: 'default' })

        if (!world) {
            // Create default world
            const result = await worldsCollection.insertOne({
                name: 'default',
                width: 4000,
                height: 4000,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            world = await worldsCollection.findOne({ _id: result.insertedId })
        }

        // Get active players (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const players = await playersCollection.find({
            worldId: world!._id.toString(),
            lastActive: { $gte: fiveMinutesAgo }
        }).toArray()

        // Get world objects
        const objects = await objectsCollection.find({
            worldId: world!._id.toString()
        }).toArray()

        return c.json({
            ...world,
            id: world!._id.toString(),
            players: players.map(p => ({ ...p, id: p._id.toString() })),
            objects: objects.map(o => ({ ...o, id: o._id.toString() }))
        })
    } catch (error) {
        console.error('Error fetching world:', error)
        return c.json({ error: 'Failed to fetch world' }, 500)
    }
})

// Get all active players
game.get('/players', async (c) => {
    try {
        const playersCollection = await getPlayersCollection()
        
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const players = await playersCollection.find({
            lastActive: { $gte: fiveMinutesAgo }
        }).sort({ lastActive: -1 }).toArray()

        return c.json(players.map(p => ({ ...p, id: p._id.toString() })))
    } catch (error) {
        console.error('Error fetching players:', error)
        return c.json({ error: 'Failed to fetch players' }, 500)
    }
})

// Create or update player position
game.post('/player', async (c) => {
    try {
        const body = await c.req.json()
        const { id, name, avatarColor, x, y, isAI } = body

        const worldsCollection = await getGameWorldsCollection()
        const playersCollection = await getPlayersCollection()

        // Get or create world
        let world = await worldsCollection.findOne({ name: 'default' })

        if (!world) {
            const result = await worldsCollection.insertOne({
                name: 'default',
                width: 4000,
                height: 4000,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            world = await worldsCollection.findOne({ _id: result.insertedId })
        }

        let player
        if (id) {
            // Try to update existing player
            const result = await playersCollection.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { 
                    $set: { 
                        x, 
                        y, 
                        lastActive: new Date() 
                    } 
                },
                { returnDocument: 'after' }
            )
            player = result
        }

        if (!player) {
            // Create new player
            const newPlayer = {
                worldId: world!._id.toString(),
                name: name || `Player ${Math.floor(Math.random() * 1000)}`,
                avatarColor: avatarColor || '#00ff00',
                x,
                y,
                isAI: isAI || false,
                lastActive: new Date(),
                createdAt: new Date()
            }
            const result = await playersCollection.insertOne(newPlayer)
            player = { ...newPlayer, _id: result.insertedId }
        }

        return c.json({ ...player, id: player._id.toString() })
    } catch (error) {
        console.error('Error updating player:', error)
        return c.json({ error: 'Failed to update player' }, 500)
    }
})

// Delete player
game.delete('/player/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const playersCollection = await getPlayersCollection()

        await playersCollection.deleteOne({ _id: new ObjectId(id) })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting player:', error)
        return c.json({ error: 'Failed to delete player' }, 500)
    }
})

// Initialize world with obstacles
game.post('/world/init', async (c) => {
    try {
        const body = await c.req.json()
        const { obstacles } = body

        const worldsCollection = await getGameWorldsCollection()
        const objectsCollection = await getWorldObjectsCollection()

        // Get or create world
        let world = await worldsCollection.findOne({ name: 'default' })

        if (!world) {
            const result = await worldsCollection.insertOne({
                name: 'default',
                width: 4000,
                height: 4000,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            world = await worldsCollection.findOne({ _id: result.insertedId })
        }

        // Delete existing obstacles
        await objectsCollection.deleteMany({ worldId: world!._id.toString() })

        // Create new obstacles
        if (obstacles && obstacles.length > 0) {
            const obstacleDocuments = obstacles.map((obs: any) => ({
                worldId: world!._id.toString(),
                type: 'obstacle',
                x: obs.x,
                y: obs.y,
                width: obs.width,
                height: obs.height,
                createdAt: new Date()
            }))
            await objectsCollection.insertMany(obstacleDocuments)
        }

        return c.json({ success: true, worldId: world!._id.toString() })
    } catch (error) {
        console.error('Error initializing world:', error)
        return c.json({ error: 'Failed to initialize world' }, 500)
    }
})

export { game }
