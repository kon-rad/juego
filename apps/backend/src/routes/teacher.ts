import { Hono } from 'hono'
import { getTeachersCollection, getGameWorldsCollection, ObjectId } from '../lib/mongodb.js'
import type { Teacher } from '../lib/mongodb.js'

const teacher = new Hono()

const TEACHER_RADIUS = 100 // Minimum distance between teachers

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
        const { topic, x, y, createdBy } = body

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

        // Generate teacher name and personality based on topic
        const teacherName = `${topic} Master`
        const personality = `An expert ${topic} teacher who is passionate about helping students learn. Patient, encouraging, and uses practical examples.`
        const systemPrompt = `You are ${teacherName}, a dedicated teacher specializing in ${topic}.

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
            systemPrompt,
            personality,
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
