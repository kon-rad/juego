import { Hono } from 'hono'
import { getAICharactersCollection, ObjectId } from '../lib/mongodb.js'
import type { AICharacter } from '../lib/mongodb.js'

const aiCharacter = new Hono()

// Get all AI characters
aiCharacter.get('/', async (c) => {
    try {
        const collection = await getAICharactersCollection()
        const characters = await collection.find({}).toArray()
        
        return c.json(characters.map(char => ({
            ...char,
            id: char._id.toString()
        })))
    } catch (error) {
        console.error('Error fetching AI characters:', error)
        return c.json({ error: 'Failed to fetch AI characters' }, 500)
    }
})

// Get specific AI character by ID
aiCharacter.get('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const collection = await getAICharactersCollection()
        
        const character = await collection.findOne({ _id: new ObjectId(id) })
        
        if (!character) {
            return c.json({ error: 'AI character not found' }, 404)
        }
        
        return c.json({
            ...character,
            id: character._id.toString()
        })
    } catch (error) {
        console.error('Error fetching AI character:', error)
        return c.json({ error: 'Failed to fetch AI character' }, 500)
    }
})

// Create new AI character
aiCharacter.post('/', async (c) => {
    try {
        const body = await c.req.json()
        const { name, personality, systemPrompt, voiceSettings, avatar } = body
        
        if (!name || !personality || !systemPrompt) {
            return c.json({ error: 'name, personality, and systemPrompt are required' }, 400)
        }
        
        const collection = await getAICharactersCollection()
        
        const newCharacter: AICharacter = {
            name,
            personality,
            systemPrompt,
            voiceSettings: voiceSettings || {},
            avatar,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        
        const result = await collection.insertOne(newCharacter)
        
        return c.json({
            ...newCharacter,
            _id: result.insertedId,
            id: result.insertedId.toString()
        }, 201)
    } catch (error) {
        console.error('Error creating AI character:', error)
        return c.json({ error: 'Failed to create AI character' }, 500)
    }
})

// Update AI character
aiCharacter.put('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { name, personality, systemPrompt, voiceSettings, avatar } = body
        
        const collection = await getAICharactersCollection()
        
        const updateData: Partial<AICharacter> = {
            updatedAt: new Date()
        }
        
        if (name) updateData.name = name
        if (personality) updateData.personality = personality
        if (systemPrompt) updateData.systemPrompt = systemPrompt
        if (voiceSettings) updateData.voiceSettings = voiceSettings
        if (avatar !== undefined) updateData.avatar = avatar
        
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updateData },
            { returnDocument: 'after' }
        )
        
        if (!result) {
            return c.json({ error: 'AI character not found' }, 404)
        }
        
        return c.json({
            ...result,
            id: result._id.toString()
        })
    } catch (error) {
        console.error('Error updating AI character:', error)
        return c.json({ error: 'Failed to update AI character' }, 500)
    }
})

// Delete AI character
aiCharacter.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const collection = await getAICharactersCollection()
        
        const result = await collection.deleteOne({ _id: new ObjectId(id) })
        
        if (result.deletedCount === 0) {
            return c.json({ error: 'AI character not found' }, 404)
        }
        
        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting AI character:', error)
        return c.json({ error: 'Failed to delete AI character' }, 500)
    }
})

// Seed default AI characters (Teacher and Genie)
aiCharacter.post('/seed', async (c) => {
    try {
        const collection = await getAICharactersCollection()
        
        // Check if characters already exist
        const existingCount = await collection.countDocuments()
        if (existingCount > 0) {
            return c.json({ message: 'AI characters already seeded', count: existingCount })
        }
        
        const defaultCharacters: AICharacter[] = [
            {
                name: 'Teacher',
                personality: 'A wise and patient educator who loves to help students learn. Speaks clearly and encourages curiosity. Uses examples and analogies to explain complex topics.',
                systemPrompt: `You are a friendly and knowledgeable Teacher in an educational game. Your role is to:
- Help players learn new concepts
- Answer questions about various subjects
- Provide encouragement and positive reinforcement
- Explain complex topics in simple terms
- Guide players through challenges with hints rather than direct answers
- Keep conversations educational but engaging

Always be patient, supportive, and enthusiastic about learning. Use age-appropriate language and examples.`,
                voiceSettings: {
                    voiceId: 'alloy',
                    speed: 1.0,
                    stability: 0.75,
                    similarityBoost: 0.75
                },
                avatar: '/teacher-avatar.png',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Genie',
                personality: 'A magical and playful genie who grants wisdom instead of wishes. Speaks in a mystical yet friendly manner. Loves riddles and challenges.',
                systemPrompt: `You are a magical Genie in an educational game. Your role is to:
- Present players with fun riddles and challenges
- Reward correct answers with virtual prizes or points
- Make learning feel like a magical adventure
- Use mystical language and phrases like "Your wish for knowledge shall be granted!"
- Create an atmosphere of wonder and excitement
- Celebrate player achievements with enthusiasm

Be playful, mysterious, and encouraging. Make every interaction feel special and magical.`,
                voiceSettings: {
                    voiceId: 'shimmer',
                    speed: 1.1,
                    stability: 0.65,
                    similarityBoost: 0.8
                },
                avatar: '/genie-avatar.png',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]
        
        const result = await collection.insertMany(defaultCharacters)
        
        return c.json({
            message: 'Default AI characters seeded successfully',
            insertedCount: result.insertedCount,
            ids: Object.values(result.insertedIds).map(id => id.toString())
        }, 201)
    } catch (error) {
        console.error('Error seeding AI characters:', error)
        return c.json({ error: 'Failed to seed AI characters' }, 500)
    }
})

export { aiCharacter }
