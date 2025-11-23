import { MongoClient, Db, Collection, ObjectId } from 'mongodb'
import 'dotenv/config'

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB_NAME || 'juego'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db
  
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)
  console.log('Connected to MongoDB')
  return db
}

export async function getDb(): Promise<Db> {
  if (!db) {
    return connectToMongoDB()
  }
  return db
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

// Collection helpers
export async function getGameWorldsCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('gameWorlds')
}

export async function getPlayersCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('players')
}

export async function getWorldObjectsCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('worldObjects')
}

export async function getAICharactersCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('aiCharacters')
}

export async function getVapiCallsCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('vapiCalls')
}

export async function getTeachersCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('teachers')
}

export async function getAdminCollection(): Promise<Collection> {
  const database = await getDb();
  return database.collection('admin');
}

export async function getChatsCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('chats')
}

export async function getChatMessagesCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('chatMessages')
}

// Type definitions for AI Characters and Players
export interface AICharacter {
  _id?: ObjectId
  name: string
  personality: string
  systemPrompt: string
  voiceSettings: {
    voiceId?: string
    speed?: number
    stability?: number
    similarityBoost?: number
  }
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface PlayerProfile {
  _id?: ObjectId
  worldId?: string
  name: string
  userName?: string
  avatarColor: string
  x: number
  y: number
  isAI: boolean
  biography?: string
  score: number
  interests?: string[]
  level?: number
  lastActive?: Date
  createdAt?: Date
}

export interface VapiCall {
  _id?: ObjectId
  callId: string
  characterId: string
  userId: string
  status: 'initiating' | 'ringing' | 'in-progress' | 'ended' | 'failed'
  startedAt: Date
  endedAt?: Date
  metadata?: Record<string, any>
}

export interface Teacher {
  _id?: ObjectId
  worldId: string
  topic: string
  name: string
  systemPrompt: string
  personality: string
  x: number
  y: number
  avatarColor: string
  createdBy: string  // Player ID who created this teacher
  createdAt: Date
  updatedAt: Date
}

export interface Chat {
  _id?: ObjectId
  participant1Id: string  // MongoDB ObjectId as string
  participant2Id: string  // MongoDB ObjectId as string
  participant1Name?: string
  participant2Name?: string
  participant1AvatarColor?: string
  participant2AvatarColor?: string
  lastMessage?: string
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  _id?: ObjectId
  chatId: string  // MongoDB ObjectId as string
  senderId: string  // MongoDB ObjectId as string
  senderName?: string
  senderAvatarColor?: string
  content: string
  createdAt: Date
}

export interface TeacherChatMessage {
  role: 'user' | 'teacher'
  content: string
  timestamp: Date
  speakerName?: string
}

export interface TeacherChatHistory {
  _id?: ObjectId
  playerId: string  // MongoDB ObjectId as string
  teacherId: string  // MongoDB ObjectId as string
  teacherName: string
  topic: string
  messages: TeacherChatMessage[]
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

export async function getTeacherChatHistoriesCollection(): Promise<Collection> {
  const database = await getDb()
  return database.collection('teacherChatHistories')
}

// Export ObjectId for use in routes
export { ObjectId }
