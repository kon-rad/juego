import { Hono } from 'hono'
import { prisma } from '../lib/prisma.js'

const game = new Hono()

// Get or create the default game world
game.get('/world', async (c) => {
    try {
        let world = await prisma.gameWorld.findFirst({
            where: { name: 'default' },
            include: {
                players: {
                    where: {
                        lastActive: {
                            gte: new Date(Date.now() - 5 * 60 * 1000) // Active in last 5 minutes
                        }
                    }
                },
                objects: true
            }
        })

        if (!world) {
            // Create default world
            world = await prisma.gameWorld.create({
                data: {
                    name: 'default',
                    width: 4000,
                    height: 4000
                },
                include: {
                    players: true,
                    objects: true
                }
            })
        }

        return c.json(world)
    } catch (error) {
        console.error('Error fetching world:', error)
        return c.json({ error: 'Failed to fetch world' }, 500)
    }
})

// Get all active players
game.get('/players', async (c) => {
    try {
        const players = await prisma.player.findMany({
            where: {
                lastActive: {
                    gte: new Date(Date.now() - 5 * 60 * 1000) // Active in last 5 minutes
                }
            },
            orderBy: { lastActive: 'desc' }
        })

        return c.json(players)
    } catch (error) {
        console.error('Error fetching players:', error)
        return c.json({ error: 'Failed to fetch players' }, 500)
    }
})

// Create or update player position
game.post('/player', async (c) => {
    try {
        const body = await c.req.json()
        const { id, name, x, y, isAI } = body

        // Get or create world
        let world = await prisma.gameWorld.findFirst({
            where: { name: 'default' }
        })

        if (!world) {
            world = await prisma.gameWorld.create({
                data: {
                    name: 'default',
                    width: 4000,
                    height: 4000
                }
            })
        }

        // Use upsert to create or update player atomically
        const player = await prisma.player.upsert({
            where: { id: id || 'new-player' },
            update: {
                x,
                y,
                lastActive: new Date()
            },
            create: {
                id: id,
                worldId: world.id,
                name: name || `Player ${Math.floor(Math.random() * 1000)}`,
                x,
                y,
                isAI: isAI || false
            }
        })

        return c.json(player)
    } catch (error) {
        console.error('Error updating player:', error)
        return c.json({ error: 'Failed to update player' }, 500)
    }
})

// Delete player
game.delete('/player/:id', async (c) => {
    try {
        const id = c.req.param('id')

        await prisma.player.delete({
            where: { id }
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting player:', error)
        return c.json({ error: 'Failed to delete player' }, 500)
    }
})

// Initialize world with obstacles
game.post('/world/init', async (c) => {
    try {
        const body = await c.req.json()
        const { obstacles } = body

        // Get or create world
        let world = await prisma.gameWorld.findFirst({
            where: { name: 'default' }
        })

        if (!world) {
            world = await prisma.gameWorld.create({
                data: {
                    name: 'default',
                    width: 4000,
                    height: 4000
                }
            })
        }

        // Delete existing obstacles
        await prisma.worldObject.deleteMany({
            where: { worldId: world.id }
        })

        // Create new obstacles
        if (obstacles && obstacles.length > 0) {
            await prisma.worldObject.createMany({
                data: obstacles.map((obs: any) => ({
                    worldId: world.id,
                    type: 'obstacle',
                    x: obs.x,
                    y: obs.y,
                    width: obs.width,
                    height: obs.height
                }))
            })
        }

        return c.json({ success: true, worldId: world.id })
    } catch (error) {
        console.error('Error initializing world:', error)
        return c.json({ error: 'Failed to initialize world' }, 500)
    }
})

export { game }
