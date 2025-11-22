import { Ollama } from 'ollama'

export interface GameState {
    player: {
        x: number
        y: number
    }
    world: {
        width: number
        height: number
        obstacles: { x: number; y: number; width: number; height: number }[]
    }
}

export interface AgentAction {
    type: 'move' | 'think' | 'plan' | 'converse'
    payload: any
}

export class AgentService {
    private ollama: Ollama
    private model: string

    constructor() {
        this.ollama = new Ollama()
        this.model = 'llama3' // Or 'mistral', make sure it's pulled locally
    }

    async decideAction(state: GameState): Promise<AgentAction> {
        const prompt = `
      You are an AI agent in a 2D world.
      Your position: (${state.player.x}, ${state.player.y})
      World size: ${state.world.width}x${state.world.height}
      
      Available tools:
      - move(dx, dy): Move the agent. dx/dy between -5 and 5.
      - think(thought): Internal monologue.
      - plan(steps): Create a plan.
      - converse(message): Say something to the world.

      Choose ONE action to take right now. Respond in JSON format:
      {
        "type": "move" | "think" | "plan" | "converse",
        "payload": ...
      }
      
      Example:
      { "type": "move", "payload": { "dx": 5, "dy": 0 } }
      { "type": "think", "payload": "I wonder what is over there." }
    `

        try {
            const response = await this.ollama.chat({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                format: 'json', // Force JSON output
                stream: false,
            })

            const action = JSON.parse(response.message.content)
            return action
        } catch (error) {
            console.error('Error deciding action:', error)
            return { type: 'think', payload: 'I am confused.' }
        }
    }
}

export const agentService = new AgentService()
