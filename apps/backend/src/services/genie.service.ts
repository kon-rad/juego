// GenieService - AI Learning Teacher that creates personalized quizzes and lessons

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface GenieResponse {
    response: string;
    learningTopic?: string;
}

export class GenieService {
    private provider: 'ollama' | 'together';
    private model: string;
    private apiKey?: string;

    constructor() {
        const providerEnv = process.env.AI_PROVIDER?.toLowerCase();
        this.provider = providerEnv === 'together' ? 'together' : 'ollama';
        this.model = process.env.AI_MODEL ?? (this.provider === 'together' ? 'meta-llama/Llama-3.3-70B-Instruct-Turbo' : 'llama3');
        if (this.provider === 'together') {
            this.apiKey = process.env.TOGETHER_API_KEY;
            if (!this.apiKey) {
                console.warn('TOGETHER_API_KEY is not set; Together requests will fail.');
            }
        }
    }

    async chat(
        userMessage: string,
        learningTopic: string | null,
        conversationHistory: ConversationMessage[]
    ): Promise<GenieResponse> {
        const systemPrompt = this.buildSystemPrompt(learningTopic);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userMessage }
        ];

        try {
            let responseContent: string;

            if (this.provider === 'together') {
                const payload = {
                    model: this.model,
                    messages,
                    max_tokens: 1024,
                    temperature: 0.7,
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
                responseContent = json?.choices?.[0]?.message?.content || 'I seem to have lost my magical connection. Please try again.';
            } else {
                // Ollama fallback
                const { Ollama } = await import('ollama');
                const ollama = new Ollama();
                const ollamaResponse = await ollama.chat({
                    model: this.model,
                    messages: messages as any,
                    stream: false,
                });
                responseContent = ollamaResponse.message.content;
            }

            // Try to extract learning topic from first interaction
            let extractedTopic = learningTopic;
            if (!learningTopic && conversationHistory.length === 0) {
                extractedTopic = this.extractLearningTopic(userMessage);
            }

            return {
                response: responseContent,
                learningTopic: extractedTopic || undefined
            };
        } catch (error) {
            console.error('Error in genie chat:', error);
            return {
                response: 'My magical powers seem to be fluctuating. Please try asking again in a moment.',
                learningTopic: learningTopic || undefined
            };
        }
    }

    private buildSystemPrompt(learningTopic: string | null): string {
        if (learningTopic) {
            return `You are the Learning Genie, a magical AI teacher specializing in ${learningTopic}. Your role is to:

1. Guide the learner through the topic with clear explanations
2. Ask thought-provoking questions to test their understanding
3. Provide quizzes and exercises when appropriate
4. Give encouraging but honest feedback
5. Adapt your teaching style to the learner's level

You are warm, encouraging, and wise. You use magical metaphors occasionally to make learning fun.
When you ask quiz questions, wait for the user's answer before revealing the correct answer.
Keep responses concise but informative - around 2-3 paragraphs maximum.
Format any code examples or lists clearly.`;
        }

        return `You are the Learning Genie, a magical AI teacher who helps people learn any subject.

Your first task is to discover what the user wants to learn. Ask them warmly about their learning goals.

Once they tell you what they want to learn, you will:
1. Create a personalized learning plan
2. Guide them through lessons with clear explanations
3. Quiz them to test their understanding
4. Provide encouragement and feedback

You are warm, encouraging, and wise. Keep your first response brief - just ask what they want to learn.
Respond in a friendly, magical way that makes learning feel like an adventure.`;
    }

    private extractLearningTopic(message: string): string | null {
        // Simple topic extraction - look for key phrases
        const lowerMessage = message.toLowerCase();

        // Common learning request patterns
        const patterns = [
            /(?:learn|study|understand|master|practice)\s+(?:about\s+)?(.+)/i,
            /(?:teach|help|show)\s+(?:me\s+)?(?:about\s+)?(.+)/i,
            /(?:how\s+to|how\s+do\s+i)\s+(.+)/i,
            /(?:what\s+is|what\s+are)\s+(.+)/i,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                // Clean up and capitalize the topic
                const topic = match[1].trim().replace(/[?.!]$/, '');
                return topic.charAt(0).toUpperCase() + topic.slice(1);
            }
        }

        // If no pattern matches but the message is short, use it as the topic
        if (message.length < 50 && !lowerMessage.includes('hello') && !lowerMessage.includes('hi ')) {
            return message.trim().replace(/[?.!]$/, '');
        }

        return null;
    }
}

export const genieService = new GenieService();
