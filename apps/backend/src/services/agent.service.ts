// AgentService supports Ollama (local) and Together AI (production)

export interface GameState {
    player: { x: number; y: number };
    world: {
        width: number;
        height: number;
        obstacles: { x: number; y: number; width: number; height: number }[];
    };
}

export interface AgentAction {
    type: 'move' | 'think' | 'plan' | 'converse';
    payload: any;
}

export class AgentService {
    private provider: 'ollama' | 'together';
    private model: string;
    private apiKey?: string;

    constructor() {
        const providerEnv = process.env.AI_PROVIDER?.toLowerCase();
        this.provider = providerEnv === 'together' ? 'together' : 'ollama';
        // Default model: llama3.3 for Together, llama3 for Ollama
        this.model = process.env.AI_MODEL ?? (this.provider === 'together' ? 'llama3.3' : 'llama3');
        if (this.provider === 'together') {
            this.apiKey = process.env.TOGETHER_API_KEY;
            if (!this.apiKey) {
                console.warn('TOGETHER_API_KEY is not set; Together requests will fail.');
            }
        }
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
    `;
        try {
            if (this.provider === 'together') {
                const payload = {
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                };
                const response = await fetch('https://api.together.xyz/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(payload),
                });
                const json = await response.json();
                const content = json?.choices?.[0]?.message?.content;
                return JSON.parse(content);
            } else {
                // Ollama fallback
                const { Ollama } = await import('ollama');
                const ollama = new Ollama();
                const ollamaResponse = await ollama.chat({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    format: 'json',
                    stream: false,
                });
                return JSON.parse(ollamaResponse.message.content);
            }
        } catch (error) {
            console.error('Error deciding action:', error);
            return { type: 'think', payload: 'I am confused.' };
        }
    }
}

export const agentService = new AgentService();
