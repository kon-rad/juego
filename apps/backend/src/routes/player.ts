import { Hono } from 'hono'
import { getPlayersCollection, ObjectId } from '../lib/mongodb.js'
import type { PlayerProfile } from '../lib/mongodb.js'

const player = new Hono()

// Get player profile by ID
player.get('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const collection = await getPlayersCollection()
        
        const playerDoc = await collection.findOne({ _id: new ObjectId(id) })
        
        if (!playerDoc) {
            return c.json({ error: 'Player not found' }, 404)
        }
        
        return c.json({
            ...playerDoc,
            id: playerDoc._id.toString()
        })
    } catch (error) {
        console.error('Error fetching player:', error)
        return c.json({ error: 'Failed to fetch player' }, 500)
    }
})

// Update player profile (biography, score, interests, level)
player.put('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { biography, score, interests, level, name, avatarColor } = body
        
        const collection = await getPlayersCollection()
        
        const updateData: Partial<PlayerProfile> = {
            lastActive: new Date()
        }
        
        if (biography !== undefined) updateData.biography = biography
        if (score !== undefined) updateData.score = score
        if (interests !== undefined) updateData.interests = interests
        if (level !== undefined) updateData.level = level
        if (name !== undefined) updateData.name = name
        if (avatarColor !== undefined) updateData.avatarColor = avatarColor
        
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updateData },
            { returnDocument: 'after' }
        )
        
        if (!result) {
            return c.json({ error: 'Player not found' }, 404)
        }
        
        return c.json({
            ...result,
            id: result._id.toString()
        })
    } catch (error) {
        console.error('Error updating player profile:', error)
        return c.json({ error: 'Failed to update player profile' }, 500)
    }
})

// Add score to player
player.post('/:id/score', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { points } = body
        
        if (typeof points !== 'number') {
            return c.json({ error: 'points must be a number' }, 400)
        }
        
        const collection = await getPlayersCollection()
        
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { 
                $inc: { score: points },
                $set: { lastActive: new Date() }
            },
            { returnDocument: 'after' }
        )
        
        if (!result) {
            return c.json({ error: 'Player not found' }, 404)
        }
        
        return c.json({
            ...result,
            id: result._id.toString()
        })
    } catch (error) {
        console.error('Error updating player score:', error)
        return c.json({ error: 'Failed to update player score' }, 500)
    }
})

// Add interest to player
player.post('/:id/interests', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { interest } = body
        
        if (typeof interest !== 'string' || !interest.trim()) {
            return c.json({ error: 'interest must be a non-empty string' }, 400)
        }
        
        const collection = await getPlayersCollection()
        
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { 
                $addToSet: { interests: interest.trim() },
                $set: { lastActive: new Date() }
            },
            { returnDocument: 'after' }
        )
        
        if (!result) {
            return c.json({ error: 'Player not found' }, 404)
        }
        
        return c.json({
            ...result,
            id: result._id.toString()
        })
    } catch (error) {
        console.error('Error adding player interest:', error)
        return c.json({ error: 'Failed to add player interest' }, 500)
    }
})

export { player }
