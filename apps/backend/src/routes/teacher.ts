import { Hono } from 'hono'
import { getTeachersCollection, getGameWorldsCollection, getPlayersCollection, ObjectId } from '../lib/mongodb.js'
import type { Teacher } from '../lib/mongodb.js'

const teacher = new Hono()

const TEACHER_RADIUS = 100 // Minimum distance between teachers

// Reward constants
const TOKENS_PER_CORRECT_ANSWER = 10
const TOKENS_FOR_NFT_BADGE = 100 // Award NFT badge every 100 tokens earned

// Get all teachers in the world
teacher.get('/', async (c) => {
    try {
        const collection = await getTeachersCollection()
        const teachers = await collection.find({}).toArray()

        return c.json(teachers.map(t => ({
            ...t,
            id: t._id.toString()
        })))
    } catch (error) {
        console.error('Error fetching teachers:', error)
        return c.json({ error: 'Failed to fetch teachers' }, 500)
    }
})

// Get specific teacher by ID
teacher.get('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const collection = await getTeachersCollection()

        const teacherDoc = await collection.findOne({ _id: new ObjectId(id) })

        if (!teacherDoc) {
            return c.json({ error: 'Teacher not found' }, 404)
        }

        return c.json({
            ...teacherDoc,
            id: teacherDoc._id.toString()
        })
    } catch (error) {
        console.error('Error fetching teacher:', error)
        return c.json({ error: 'Failed to fetch teacher' }, 500)
    }
})

// Check if a position is valid for a new teacher (100px radius check)
teacher.post('/check-position', async (c) => {
    try {
        const body = await c.req.json()
        const { x, y } = body

        if (x === undefined || y === undefined) {
            return c.json({ error: 'x and y coordinates are required' }, 400)
        }

        const collection = await getTeachersCollection()

        // Find any teacher within the radius
        const nearbyTeacher = await collection.findOne({
            $expr: {
                $lte: [
                    {
                        $sqrt: {
                            $add: [
                                { $pow: [{ $subtract: ['$x', x] }, 2] },
                                { $pow: [{ $subtract: ['$y', y] }, 2] }
                            ]
                        }
                    },
                    TEACHER_RADIUS
                ]
            }
        })

        return c.json({
            available: !nearbyTeacher,
            nearbyTeacher: nearbyTeacher ? {
                id: nearbyTeacher._id.toString(),
                name: nearbyTeacher.name,
                topic: nearbyTeacher.topic,
                distance: Math.sqrt(
                    Math.pow(nearbyTeacher.x - x, 2) +
                    Math.pow(nearbyTeacher.y - y, 2)
                )
            } : null
        })
    } catch (error) {
        console.error('Error checking position:', error)
        return c.json({ error: 'Failed to check position' }, 500)
    }
})

// Create new teacher at a position
teacher.post('/', async (c) => {
    try {
        const body = await c.req.json()
        const { topic, x, y, createdBy, name, systemPrompt, personality } = body

        if (!topic || x === undefined || y === undefined || !createdBy) {
            return c.json({ error: 'topic, x, y, and createdBy are required' }, 400)
        }

        const collection = await getTeachersCollection()
        const worldsCollection = await getGameWorldsCollection()

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

        // Check if position is available (100px radius)
        const nearbyTeacher = await collection.findOne({
            $expr: {
                $lte: [
                    {
                        $sqrt: {
                            $add: [
                                { $pow: [{ $subtract: ['$x', x] }, 2] },
                                { $pow: [{ $subtract: ['$y', y] }, 2] }
                            ]
                        }
                    },
                    TEACHER_RADIUS
                ]
            }
        })

        if (nearbyTeacher) {
            return c.json({
                error: 'Position not available',
                nearbyTeacher: {
                    id: nearbyTeacher._id.toString(),
                    name: nearbyTeacher.name,
                    topic: nearbyTeacher.topic
                }
            }, 409)
        }

        // Use provided teacher info or generate defaults
        const teacherName = name || `${topic} Master`
        const teacherPersonality = personality || `An expert ${topic} teacher who is passionate about helping students learn. Patient, encouraging, and uses practical examples.`
        const teacherSystemPrompt = systemPrompt || `You are ${teacherName}, a dedicated teacher specializing in ${topic}.

Your role is to:
1. Teach ${topic} concepts in an engaging, clear way
2. Ask questions to test the student's understanding
3. Provide quizzes and practical exercises
4. Give constructive feedback and encouragement
5. Adapt your teaching to the student's level

Be friendly, patient, and enthusiastic about ${topic}. Use examples and analogies to explain complex concepts. When giving quizzes, wait for the student's answer before revealing the correct answer.

Keep responses concise (2-3 paragraphs max) and focus on one concept at a time.`

        const newTeacher: Teacher = {
            worldId: world!._id.toString(),
            topic,
            name: teacherName,
            systemPrompt: teacherSystemPrompt,
            personality: teacherPersonality,
            x,
            y,
            avatarColor: '#FFD700', // Gold color for teachers
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const result = await collection.insertOne(newTeacher)

        return c.json({
            ...newTeacher,
            _id: result.insertedId,
            id: result.insertedId.toString()
        }, 201)
    } catch (error) {
        console.error('Error creating teacher:', error)
        return c.json({ error: 'Failed to create teacher' }, 500)
    }
})

// Chat with a teacher
teacher.post('/:id/chat', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { message, conversationHistory } = body

        if (!message) {
            return c.json({ error: 'Message is required' }, 400)
        }

        const collection = await getTeachersCollection()
        const teacherDoc = await collection.findOne({ _id: new ObjectId(id) })

        if (!teacherDoc) {
            return c.json({ error: 'Teacher not found' }, 404)
        }

        // Use the teacher's system prompt for the conversation
        const messages = [
            { role: 'system', content: teacherDoc.systemPrompt },
            ...(conversationHistory || []),
            { role: 'user', content: message }
        ]

        // Use the AI provider (same as genie service)
        const provider = process.env.AI_PROVIDER?.toLowerCase() === 'together' ? 'together' : 'ollama'
        const model = process.env.AI_MODEL ?? (provider === 'together' ? 'meta-llama/Llama-3.3-70B-Instruct-Turbo' : 'llama3')

        let responseContent: string

        if (provider === 'together') {
            const apiKey = process.env.TOGETHER_API_KEY
            const payload = {
                model,
                messages,
                max_tokens: 1024,
                temperature: 0.7,
            }
            const response = await fetch('https://api.together.xyz/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            })
            const json = await response.json()
            responseContent = json?.choices?.[0]?.message?.content || 'I seem to have lost my train of thought. Please try again.'
        } else {
            // Ollama fallback
            const { Ollama } = await import('ollama')
            const ollama = new Ollama()
            const ollamaResponse = await ollama.chat({
                model,
                messages: messages as any,
                stream: false,
            })
            responseContent = ollamaResponse.message.content
        }

        return c.json({
            response: responseContent,
            teacherName: teacherDoc.name,
            topic: teacherDoc.topic
        })
    } catch (error) {
        console.error('Error in teacher chat:', error)
        return c.json({ error: 'Failed to chat with teacher' }, 500)
    }
})

// Delete teacher
teacher.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const collection = await getTeachersCollection()

        const result = await collection.deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
            return c.json({ error: 'Teacher not found' }, 404)
        }

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting teacher:', error)
        return c.json({ error: 'Failed to delete teacher' }, 500)
    }
})

export { teacher }
