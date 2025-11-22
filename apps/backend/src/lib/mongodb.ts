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

// Export ObjectId for use in routes
export { ObjectId }
