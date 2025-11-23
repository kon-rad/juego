import { Hono } from 'hono'
import { getTeachersCollection, getGameWorldsCollection, getPlayersCollection, getTeacherChatHistoriesCollection, ObjectId } from '../lib/mongodb.js'
import type { Teacher, TeacherChatHistory, TeacherChatMessage } from '../lib/mongodb.js'

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

// Tool definition for evaluating and grading student answers
const EVALUATION_TOOL = {
    type: 'function',
    function: {
        name: 'evaluate_student_answer',
        description: 'Evaluate and grade a student\'s answer. Provide a score from 1-10 based on correctness, completeness, and understanding. This function should be called after the student responds to a question.',
        parameters: {
            type: 'object',
            properties: {
                score: {
                    type: 'number',
                    description: 'Score from 1-10. 1-3: Incorrect or very poor understanding. 4-6: Partially correct with some understanding. 7-8: Mostly correct with good understanding. 9-10: Excellent, complete, and demonstrates deep understanding.'
                },
                feedback: {
                    type: 'string',
                    description: 'Detailed feedback about the student\'s answer, explaining what was correct, what could be improved, and why they received this score.'
                }
            },
            required: ['score', 'feedback']
        }
    }
}

// Chat with a teacher
teacher.post('/:id/chat', async (c) => {
    try {
        const id = c.req.param('id')
        const body = await c.req.json()
        const { message, conversationHistory, playerId, walletAddress } = body

        if (!message) {
            return c.json({ error: 'Message is required' }, 400)
        }

        const collection = await getTeachersCollection()
        const teacherDoc = await collection.findOne({ _id: new ObjectId(id) })

        if (!teacherDoc) {
            return c.json({ error: 'Teacher not found' }, 404)
        }

        // Check if the last teacher message was a question (to determine if we need to evaluate)
        const lastTeacherMessage = conversationHistory
            ?.filter((m: any) => m.role === 'assistant' || m.role === 'teacher')
            ?.slice(-1)?.[0]
        const needsEvaluation = lastTeacherMessage && (
            lastTeacherMessage.content.includes('?') ||
            lastTeacherMessage.content.toLowerCase().includes('what') ||
            lastTeacherMessage.content.toLowerCase().includes('how') ||
            lastTeacherMessage.content.toLowerCase().includes('explain') ||
            lastTeacherMessage.content.toLowerCase().includes('describe')
        )

        // System prompt for the teacher (normal conversation)
        // Add instruction to regularly ask questions
        const teacherSystemPrompt = `${teacherDoc.systemPrompt}

IMPORTANT: Regularly ask quiz questions to test the student's understanding. After asking a question, wait for the student's response before providing feedback or moving on.`

        // System prompt for the evaluator (when evaluating answers)
        const evaluatorSystemPrompt = `You are an expert evaluator and grader specializing in ${teacherDoc.topic}.

Your role is to:
1. Evaluate student answers objectively and fairly
2. Provide a score from 1-10 based on:
   - Correctness of the answer
   - Completeness of the response
   - Depth of understanding demonstrated
   - Clarity and articulation
3. Give detailed, constructive feedback
4. Be VERY ENCOURAGING and positive, especially for correct answers (score 7+)
5. When the answer is correct or mostly correct, celebrate their success and provide specific praise
6. Always end with encouragement and suggestions for further learning

SCORING GUIDELINES:
- 1-3: Incorrect, shows little to no understanding, or completely off-topic
- 4-6: Partially correct, shows some understanding but missing key concepts or has significant errors
- 7-8: Mostly correct, demonstrates good understanding with minor gaps or inaccuracies
- 9-10: Excellent answer, complete, accurate, and shows deep understanding

IMPORTANT: 
- You MUST call the evaluate_student_answer function with a score (1-10) and detailed feedback whenever you are evaluating a student's response to a question.
- For scores 7+, be VERY ENCOURAGING and celebrate their achievement. Use phrases like "Excellent work!", "You're absolutely on the right track!", "Impressive understanding!", etc.
- Always provide constructive feedback on how they can improve even more, even when the answer is correct.`

        // Use the AI provider (same as genie service)
        const provider = process.env.AI_PROVIDER?.toLowerCase() === 'together' ? 'together' : 'ollama'
        const model = process.env.AI_MODEL ?? (provider === 'together' ? 'meta-llama/Llama-3.3-70B-Instruct-Turbo' : 'llama3')
        const apiKey = process.env.TOGETHER_API_KEY

        // Step 1: Get teacher's response to the student's message
        const teacherMessages = [
            { role: 'system', content: teacherSystemPrompt },
            ...(conversationHistory || []),
            { role: 'user', content: message }
        ]

        let teacherResponse: string = ''
        let evaluationResult: { score: number; feedback: string } | null = null

        // Get teacher response
        if (provider === 'together') {
            const teacherPayload = {
                model,
                messages: teacherMessages,
                max_tokens: 1024,
                temperature: 0.7,
            }
            const teacherResponseFetch = await fetch('https://api.together.xyz/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(teacherPayload),
            })
            const teacherJson = await teacherResponseFetch.json()
            teacherResponse = teacherJson?.choices?.[0]?.message?.content || 'I seem to have lost my train of thought. Please try again.'
        } else {
            // Ollama fallback
            const { Ollama } = await import('ollama')
            const ollama = new Ollama()
            const ollamaResponse = await ollama.chat({
                model,
                messages: teacherMessages as any,
                stream: false,
            })
            teacherResponse = ollamaResponse.message.content
        }

        // Step 2: If the previous teacher message was a question, evaluate the student's answer
        if (needsEvaluation) {
            const evaluationMessages = [
                { role: 'system', content: evaluatorSystemPrompt },
                ...(conversationHistory || []).slice(-3), // Last few messages for context
                { role: 'user', content: `Student's answer: "${message}"\n\nPlease evaluate this answer and provide a score (1-10) with detailed feedback.` }
            ]

            if (provider === 'together') {
                const evaluationPayload = {
                    model,
                    messages: evaluationMessages,
                    max_tokens: 512,
                    temperature: 0.5,
                    tools: [EVALUATION_TOOL],
                    tool_choice: 'required'
                }
                const evaluationResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(evaluationPayload),
                })
                const evaluationJson = await evaluationResponse.json()
                const assistantMessage = evaluationJson?.choices?.[0]?.message

                if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
                    const toolCall = assistantMessage.tool_calls[0]
                    if (toolCall.function?.name === 'evaluate_student_answer') {
                        try {
                            evaluationResult = JSON.parse(toolCall.function.arguments)
                            // Validate and clamp score to 1-10 range
                            if (evaluationResult && evaluationResult.score !== undefined) {
                                evaluationResult.score = Math.max(1, Math.min(10, Math.round(evaluationResult.score)))
                            }
                            console.log('Evaluation result:', evaluationResult)
                        } catch (parseError) {
                            console.error('Error parsing evaluation tool call:', parseError)
                        }
                    }
                }
            } else {
                // Ollama fallback - extract JSON from response
                const { Ollama } = await import('ollama')
                const ollama = new Ollama()
                const ollamaEvalResponse = await ollama.chat({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: `${evaluatorSystemPrompt}\n\nIMPORTANT: You must include a JSON block in your response:\n\`\`\`json\n{"score": 1-10, "feedback": "your detailed feedback"}\n\`\`\``
                        },
                        ...evaluationMessages.slice(1)
                    ] as any,
                    stream: false,
                })
                const evalContent = ollamaEvalResponse.message.content
                const jsonMatch = evalContent.match(/```json\s*([\s\S]*?)\s*```/)
                if (jsonMatch) {
                    try {
                        evaluationResult = JSON.parse(jsonMatch[1])
                        // Validate and clamp score to 1-10 range
                        if (evaluationResult && evaluationResult.score !== undefined) {
                            evaluationResult.score = Math.max(1, Math.min(10, Math.round(evaluationResult.score)))
                        }
                    } catch (e) {
                        console.error('Error parsing Ollama evaluation JSON:', e)
                    }
                }
            }
        }

        // Combine teacher response with evaluation
        let responseContent = teacherResponse

        // Track rewards based on evaluation score
        let tokensAwarded = 0
        let nftAwarded = false
        let newScore = 0
        const score = evaluationResult?.score || 0
        const isCorrect = score >= 7 // Consider 7+ as "correct"

        // Award tokens based on score (1-10 tokens for scores 1-10)
        // Only award tokens if score is 1 or higher
        if (evaluationResult && score >= 1 && playerId) {
            tokensAwarded = Math.max(1, Math.min(10, Math.round(score))) // Ensure score is between 1-10

            // Update player score in database
            const playersCollection = await getPlayersCollection()
            const player = await playersCollection.findOne({ _id: new ObjectId(playerId) })

            if (player) {
                const currentScore = player.score || 0
                newScore = currentScore + tokensAwarded

                // Check if player earned enough for an NFT badge OR if score is 9 or above
                const previousBadges = Math.floor(currentScore / TOKENS_FOR_NFT_BADGE)
                const newBadges = Math.floor(newScore / TOKENS_FOR_NFT_BADGE)

                // Award NFT if score is 9 or above, or if they reached the token threshold
                if (score >= 9 || newBadges > previousBadges) {
                    nftAwarded = true
                }

                // Update player score
                await playersCollection.updateOne(
                    { _id: new ObjectId(playerId) },
                    {
                        $set: {
                            score: newScore,
                            updatedAt: new Date()
                        }
                    }
                )

                // If wallet address provided, mint tokens on blockchain
                if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                    try {
                        const { blockchainService } = await import('../services/blockchain.service.js')
                        
                        // Generate quiz metadata for the NFT (if needed)
                        const teacherIdHex = id.replace(/[^a-f0-9]/gi, '').slice(0, 8) || '00000000'
                        const quizId = parseInt(teacherIdHex, 16) || 1
                        const correctAnswers = score >= 7 ? 1 : 0
                        const totalQuestions = 1
                        const quizName = `${teacherDoc.topic} Quiz`

                        // If NFT is awarded, use the combined minting function to avoid nonce issues
                        if (nftAwarded) {
                            await blockchainService.mintTokensAndNFT(
                                walletAddress,
                                tokensAwarded.toString(),
                                quizId,
                                correctAnswers,
                                totalQuestions,
                                quizName
                            )
                            console.log(`✅ Minted ${tokensAwarded} tokens and NFT badge to ${walletAddress} for ${teacherDoc.topic} (Quiz ID: ${quizId})`)
                        } else {
                            // Just mint tokens
                            await blockchainService.mintTokens(walletAddress, tokensAwarded.toString())
                            console.log(`✅ Minted ${tokensAwarded} tokens to ${walletAddress}`)
                        }
                    } catch (blockchainError) {
                        console.error('Error minting rewards on blockchain:', blockchainError)
                        // Continue without blockchain rewards - still give in-game points
                        // Add error message to response so user knows
                        responseContent += `\n\n⚠️ Note: Blockchain rewards may be delayed. Your in-game points have been updated.`
                    }
                }

                // Add evaluation and reward notification to response
                if (evaluationResult) {
                    responseContent += `\n\n---\n\n📊 **Evaluation:**\n**Score: ${score}/10**\n\n${evaluationResult.feedback}`
                    
                    if (tokensAwarded > 0) {
                        responseContent += `\n\n🎉 **Reward:** You earned ${tokensAwarded} Learn Token${tokensAwarded !== 1 ? 's' : ''}! (Total: ${newScore})`
                    }
                    
                    if (nftAwarded) {
                        if (score >= 9) {
                            responseContent += `\n\n🏆 **Exceptional Performance!** You've earned a Knowledge Badge NFT for your outstanding answer (score: ${score}/10)!`
                        } else {
                            responseContent += `\n\n🏆 **Achievement Unlocked!** You've earned a Knowledge Badge NFT for reaching ${newBadges * TOKENS_FOR_NFT_BADGE} tokens!`
                        }
                    }
                }
            }
        } else if (evaluationResult && score < 1) {
            // Score is 0 or invalid - show evaluation but no rewards
            responseContent += `\n\n---\n\n📊 **Evaluation:**\n**Score: ${score}/10**\n\n${evaluationResult.feedback}\n\n📚 Keep learning! Try again and you'll earn tokens for correct answers.`
        }

        return c.json({
            response: responseContent,
            teacherName: teacherDoc.name,
            topic: teacherDoc.topic,
            isCorrect,
            score, // Include the score (1-10)
            tokensAwarded,
            nftAwarded,
            newScore,
            evaluationResult // Include the evaluation result for debugging/transparency
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

// ============== Teacher Chat History Endpoints ==============

// Get all chat histories for a player
teacher.get('/chat-history/player/:playerId', async (c) => {
    try {
        const playerId = c.req.param('playerId')
        const collection = await getTeacherChatHistoriesCollection()

        const histories = await collection.find({ playerId }).sort({ lastMessageAt: -1 }).toArray()

        return c.json(histories.map(h => ({
            ...h,
            id: h._id.toString()
        })))
    } catch (error) {
        console.error('Error fetching chat histories:', error)
        return c.json({ error: 'Failed to fetch chat histories' }, 500)
    }
})

// Get chat history for a specific player-teacher pair
teacher.get('/chat-history/:playerId/:teacherId', async (c) => {
    try {
        const playerId = c.req.param('playerId')
        const teacherId = c.req.param('teacherId')
        const collection = await getTeacherChatHistoriesCollection()

        const history = await collection.findOne({ playerId, teacherId })

        if (!history) {
            return c.json({ messages: [] })
        }

        return c.json({
            ...history,
            id: history._id.toString()
        })
    } catch (error) {
        console.error('Error fetching chat history:', error)
        return c.json({ error: 'Failed to fetch chat history' }, 500)
    }
})

// Save/update chat history for a player-teacher pair
teacher.post('/chat-history', async (c) => {
    try {
        const body = await c.req.json()
        const { playerId, teacherId, teacherName, topic, messages } = body

        if (!playerId || !teacherId || !messages) {
            return c.json({ error: 'playerId, teacherId, and messages are required' }, 400)
        }

        const collection = await getTeacherChatHistoriesCollection()

        // Convert messages to proper format
        const formattedMessages: TeacherChatMessage[] = messages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : m.role === 'reward' ? 'reward' : 'teacher',
            content: m.content,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            speakerName: m.speakerName
        }))

        const now = new Date()

        // Upsert the chat history
        const result = await collection.findOneAndUpdate(
            { playerId, teacherId },
            {
                $set: {
                    teacherName: teacherName || 'Teacher',
                    topic: topic || 'Unknown',
                    messages: formattedMessages,
                    lastMessageAt: now,
                    updatedAt: now
                },
                $setOnInsert: {
                    createdAt: now
                }
            },
            { upsert: true, returnDocument: 'after' }
        )

        return c.json({
            ...result,
            id: result?._id?.toString()
        })
    } catch (error) {
        console.error('Error saving chat history:', error)
        return c.json({ error: 'Failed to save chat history' }, 500)
    }
})

// Delete chat history for a player-teacher pair
teacher.delete('/chat-history/:playerId/:teacherId', async (c) => {
    try {
        const playerId = c.req.param('playerId')
        const teacherId = c.req.param('teacherId')
        const collection = await getTeacherChatHistoriesCollection()

        const result = await collection.deleteOne({ playerId, teacherId })

        if (result.deletedCount === 0) {
            return c.json({ error: 'Chat history not found' }, 404)
        }

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting chat history:', error)
        return c.json({ error: 'Failed to delete chat history' }, 500)
    }
})

export { teacher }
