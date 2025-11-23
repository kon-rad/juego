import { Hono } from 'hono'
import { getChatsCollection, getChatMessagesCollection, getPlayersCollection, ObjectId } from '../lib/mongodb.js'
import type { Chat, ChatMessage } from '../lib/mongodb.js'
import { getSocketServer } from '../lib/socket.js'

const chat = new Hono()

// Get or create a chat between two players
chat.post('/conversation', async (c) => {
    try {
        const body = await c.req.json()
        let { participant1Id, participant2Id } = body

        if (!participant1Id || !participant2Id) {
            return c.json({ error: 'Both participant IDs are required' }, 400)
        }

        if (participant1Id === participant2Id) {
            return c.json({ error: 'Cannot create chat with yourself' }, 400)
        }

        const chatsCollection = await getChatsCollection()
        const playersCollection = await getPlayersCollection()

        // Try to convert to MongoDB ObjectIds
        // If they're not valid ObjectIds, we need to look them up
        let mongoId1: string | null = null
        let mongoId2: string | null = null

        try {
            const player1 = await playersCollection.findOne({ _id: new ObjectId(participant1Id) })
            if (player1) {
                mongoId1 = player1._id.toString()
            }
        } catch (e) {
            // Not a valid ObjectId, try to find by other means
            console.log('participant1Id is not a valid ObjectId, trying alternative lookup')
        }

        try {
            const player2 = await playersCollection.findOne({ _id: new ObjectId(participant2Id) })
            if (player2) {
                mongoId2 = player2._id.toString()
            }
        } catch (e) {
            // Not a valid ObjectId, try to find by other means
            console.log('participant2Id is not a valid ObjectId, trying alternative lookup')
        }

        // If we couldn't find MongoDB IDs, return error
        if (!mongoId1 || !mongoId2) {
            return c.json({ 
                error: 'Could not find MongoDB player IDs. Please ensure both players exist in the database.',
                details: { participant1Id, participant2Id, mongoId1, mongoId2 }
            }, 400)
        }

        // Normalize participant IDs (sort to ensure consistent chat lookup)
        const [id1, id2] = [mongoId1, mongoId2].sort()

        // Check if chat already exists
        let chatDoc = await chatsCollection.findOne({
            participant1Id: id1,
            participant2Id: id2
        })

        if (!chatDoc) {
            // Get player info for the other participant
            const otherPlayerId = mongoId1 === id1 ? mongoId2 : mongoId1
            const currentPlayerId = mongoId1 === id1 ? mongoId1 : mongoId2
            
            const otherPlayer = await playersCollection.findOne({ _id: new ObjectId(otherPlayerId) })
            const currentPlayer = await playersCollection.findOne({ _id: new ObjectId(currentPlayerId) })
            
            if (!otherPlayer || !currentPlayer) {
                return c.json({ error: 'One or both players not found in database' }, 404)
            }

            // Create new chat
            const newChat: Chat = {
                participant1Id: id1,
                participant2Id: id2,
                participant1Name: id1 === mongoId1 ? currentPlayer.name : otherPlayer.name,
                participant2Name: id2 === mongoId2 ? currentPlayer.name : otherPlayer.name,
                participant1AvatarColor: id1 === mongoId1 ? currentPlayer.avatarColor : otherPlayer.avatarColor,
                participant2AvatarColor: id2 === mongoId2 ? currentPlayer.avatarColor : otherPlayer.avatarColor,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            const result = await chatsCollection.insertOne(newChat)
            chatDoc = { ...newChat, _id: result.insertedId }
        } else {
            // Update participant names/colors if they've changed
            const otherPlayerId = mongoId1 === chatDoc.participant1Id ? chatDoc.participant2Id : chatDoc.participant1Id
            const currentPlayerId = mongoId1 === chatDoc.participant1Id ? chatDoc.participant1Id : chatDoc.participant2Id
            
            const otherPlayer = await playersCollection.findOne({ _id: new ObjectId(otherPlayerId) })
            const currentPlayer = await playersCollection.findOne({ _id: new ObjectId(currentPlayerId) })
            
            if (!otherPlayer || !currentPlayer) {
                return c.json({ error: 'One or both players not found in database' }, 404)
            }

            await chatsCollection.updateOne(
                { _id: chatDoc._id },
                {
                    $set: {
                        participant1Name: chatDoc.participant1Id === currentPlayerId ? currentPlayer?.name : otherPlayer?.name,
                        participant2Name: chatDoc.participant2Id === currentPlayerId ? currentPlayer?.name : otherPlayer?.name,
                        participant1AvatarColor: chatDoc.participant1Id === currentPlayerId ? currentPlayer?.avatarColor : otherPlayer?.avatarColor,
                        participant2AvatarColor: chatDoc.participant2Id === currentPlayerId ? currentPlayer?.avatarColor : otherPlayer?.avatarColor,
                        updatedAt: new Date()
                    }
                }
            )
        }

        return c.json({
            ...chatDoc,
            id: chatDoc._id.toString()
        })
    } catch (error) {
        console.error('Error getting/creating chat:', error)
        return c.json({ error: 'Failed to get/create chat' }, 500)
    }
})

// Get all chats for a player
chat.get('/:playerId/conversations', async (c) => {
    try {
        const playerId = c.req.param('playerId')
        const chatsCollection = await getChatsCollection()

        const chats = await chatsCollection
            .find({
                $or: [
                    { participant1Id: playerId },
                    { participant2Id: playerId }
                ]
            })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .toArray()

        return c.json(chats.map(chat => ({
            ...chat,
            id: chat._id.toString(),
            otherParticipantId: chat.participant1Id === playerId ? chat.participant2Id : chat.participant1Id,
            otherParticipantName: chat.participant1Id === playerId ? chat.participant2Name : chat.participant1Name,
            otherParticipantAvatarColor: chat.participant1Id === playerId ? chat.participant2AvatarColor : chat.participant1AvatarColor
        })))
    } catch (error) {
        console.error('Error fetching conversations:', error)
        return c.json({ error: 'Failed to fetch conversations' }, 500)
    }
})

// Get messages for a chat
chat.get('/:chatId/messages', async (c) => {
    try {
        const chatId = c.req.param('chatId')
        const messagesCollection = await getChatMessagesCollection()

        const messages = await messagesCollection
            .find({ chatId })
            .sort({ createdAt: 1 })
            .toArray()

        return c.json(messages.map(msg => ({
            ...msg,
            id: msg._id.toString()
        })))
    } catch (error) {
        console.error('Error fetching messages:', error)
        return c.json({ error: 'Failed to fetch messages' }, 500)
    }
})

// Send a message
chat.post('/:chatId/messages', async (c) => {
    try {
        const chatId = c.req.param('chatId')
        const body = await c.req.json()
        const { senderId, content } = body

        if (!senderId || !content) {
            return c.json({ error: 'senderId and content are required' }, 400)
        }

        const chatsCollection = await getChatsCollection()
        const messagesCollection = await getChatMessagesCollection()
        const playersCollection = await getPlayersCollection()

        // Verify chat exists
        const chatDoc = await chatsCollection.findOne({ _id: new ObjectId(chatId) })
        if (!chatDoc) {
            return c.json({ error: 'Chat not found' }, 404)
        }

        // Verify sender is a participant
        if (chatDoc.participant1Id !== senderId && chatDoc.participant2Id !== senderId) {
            return c.json({ error: 'Sender is not a participant in this chat' }, 403)
        }

        // Get sender info
        const sender = await playersCollection.findOne({ _id: new ObjectId(senderId) })
        if (!sender) {
            return c.json({ error: 'Sender not found' }, 404)
        }

        // Create message
        const message: ChatMessage = {
            chatId,
            senderId,
            senderName: sender.name,
            senderAvatarColor: sender.avatarColor,
            content,
            createdAt: new Date()
        }

        const result = await messagesCollection.insertOne(message)

        // Update chat's last message
        await chatsCollection.updateOne(
            { _id: new ObjectId(chatId) },
            {
                $set: {
                    lastMessage: content,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                }
            }
        )

        const newMessage = { ...message, _id: result.insertedId }

        // Emit socket event to both participants
        const io = getSocketServer()
        if (io) {
            // Emit to the other participant (not the sender)
            const recipientId = chatDoc.participant1Id === senderId ? chatDoc.participant2Id : chatDoc.participant1Id
            io.emit('chat:message', {
                chatId,
                message: {
                    ...newMessage,
                    id: newMessage._id.toString()
                },
                recipientId
            })
        }

        return c.json({
            ...newMessage,
            id: newMessage._id.toString()
        })
    } catch (error) {
        console.error('Error sending message:', error)
        return c.json({ error: 'Failed to send message' }, 500)
    }
})

export { chat }

