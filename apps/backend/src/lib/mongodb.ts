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

// Export ObjectId for use in routes
export { ObjectId }
