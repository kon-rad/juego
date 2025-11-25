import { Hono } from 'hono'
import { getPlayersCollection, ObjectId } from '../lib/mongodb.js'
import type { PlayerProfile } from '../lib/mongodb.js'
import { ethers } from 'ethers';
import { getAdminCollection } from '../lib/mongodb.js';
import crypto from 'crypto';

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
        const { biography, score, interests, level, name, avatarColor, userName } = body
        
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
        if (userName !== undefined) updateData.userName = userName
        
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

// Generate or retrieve a server wallet for the user
player.post('/wallet', async (c) => {
    try {
        const { publicAddress, playerId } = await c.req.json();
        const playersCollection = await getPlayersCollection();
        const adminCollection = await getAdminCollection();

        // Fetch or create the master key from the admin collection
        let adminDoc = await adminCollection.findOne({ key: 'masterKey' });
        let masterKey: string;

        if (!adminDoc) {
            // Generate a master key if it doesn't exist
            masterKey = crypto.randomBytes(32).toString('hex');
            await adminCollection.insertOne({
                key: 'masterKey',
                value: masterKey,
                createdAt: new Date()
            });
            console.log('Master key initialized in database');
        } else {
            masterKey = adminDoc.value;
        }

        if (publicAddress) {
            // Retrieve the encrypted private key for the existing wallet
            // First try to find by playerId if provided
            let playerDoc = null;
            if (playerId) {
                playerDoc = await playersCollection.findOne({ _id: new ObjectId(playerId), walletAddress: publicAddress });
            }
            // If not found by playerId, try by walletAddress only
            if (!playerDoc) {
                playerDoc = await playersCollection.findOne({ walletAddress: publicAddress });
            }
            
            if (!playerDoc || !playerDoc.encryptedPrivateKey) {
                return c.json({ error: 'Wallet not found or not stored on server' }, 404);
            }

            // Decrypt the private key
            const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
            let decrypted = decipher.update(playerDoc.encryptedPrivateKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return c.json({ walletAddress: publicAddress, privateKey: decrypted });
        } else {
            // Generate a new wallet
            const wallet = ethers.Wallet.createRandom();

            // Encrypt the private key
            const cipher = crypto.createCipher('aes-256-cbc', masterKey);
            let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // If playerId is provided, update existing player, otherwise create new
            if (playerId) {
                await playersCollection.updateOne(
                    { _id: new ObjectId(playerId) },
                    { 
                        $set: { 
                            walletAddress: wallet.address,
                            encryptedPrivateKey: encrypted,
                            lastActive: new Date()
                        } 
                    }
                );
            } else {
                // Save the wallet in the database as new player
                const newPlayer = {
                    walletAddress: wallet.address,
                    encryptedPrivateKey: encrypted,
                    createdAt: new Date(),
                };
                await playersCollection.insertOne(newPlayer);
            }

            return c.json({ walletAddress: wallet.address });
        }
    } catch (error) {
        console.error('Error handling wallet:', error);
        return c.json({ error: 'Failed to handle wallet' }, 500);
    }
});

export { player }
