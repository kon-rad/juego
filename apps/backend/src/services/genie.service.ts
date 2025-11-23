// GenieService - AI Learning Teacher that creates personalized quizzes and lessons
import { getGameWorldsCollection, getTeachersCollection } from '../lib/mongodb.js'
import type { Teacher } from '../lib/mongodb.js'
import type { Collection, WithId } from 'mongodb'

const TEACHER_RADIUS = 100;
const DEFAULT_WORLD_WIDTH = 4000;
const DEFAULT_WORLD_HEIGHT = 4000;
const TEACHER_SPAWN_OFFSETS = [
    { x: 80, y: 0 },
    { x: -80, y: 0 },
    { x: 0, y: 80 },
    { x: 0, y: -80 },
    { x: 80, y: 80 },
    { x: -80, y: 80 },
    { x: 80, y: -80 },
    { x: -80, y: -80 },
    { x: 0, y: 0 }
];

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface PlayerPosition {
    x: number;
    y: number;
}

export interface TeacherInfo {
    name: string;
    systemPrompt: string;
    personality: string;
}

export interface SummonedTeacher {
    id: string;
    topic: string;
    name: string;
    systemPrompt: string;
    personality: string;
    x: number;
    y: number;
    avatarColor: string;
    worldId: string;
    createdBy: string;
}

export interface GenieResponse {
    response: string;
    learningTopic?: string;
    teacherInfo?: TeacherInfo;
    teacher?: SummonedTeacher;
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
        conversationHistory: ConversationMessage[],
        playerId?: string,
        playerPosition?: PlayerPosition
    ): Promise<GenieResponse> {
        // If no topic yet, try to extract from the user's message first
        let extractedTopic = learningTopic;
        if (!learningTopic) {
            extractedTopic = this.extractLearningTopic(userMessage);
        }

        // If we found a topic and don't have a teacher yet, summon or reuse one immediately
        if (extractedTopic && !learningTopic) {
            const { teacherInfo, teacher } = await this.ensureTeacherSummoned(
                extractedTopic,
                playerId,
                playerPosition
            );

            const responseContent = this.buildSummonResponse(
                extractedTopic,
                teacherInfo,
                teacher,
                playerPosition
            );

            return {
                response: responseContent,
                learningTopic: extractedTopic,
                teacherInfo,
                teacher
            };
        }

        // If topic already exists, continue conversation normally
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

            return {
                response: responseContent,
                learningTopic: learningTopic || undefined
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

    private async generateTeacherInfo(topic: string): Promise<TeacherInfo> {
        const teacherPrompt = `You are the Learning Genie. A student wants to learn about "${topic}". 

Your task is to create the perfect teacher for this topic. Generate:
1. A teacher name - preferably a historical figure who was an expert in this topic (e.g., "Leonardo da Vinci" for art/engineering, "Albert Einstein" for physics, "Marie Curie" for chemistry). If no suitable historical figure exists, create a memorable fictional character name that fits the topic.
2. A detailed system prompt that describes who this teacher is - their background, expertise, teaching style, and personality. Make them feel like a real historical or fictional character who is passionate about ${topic}.
3. A brief personality description (1-2 sentences).

Format your response as JSON with these exact keys:
{
  "name": "Teacher Name",
  "systemPrompt": "Detailed system prompt describing the teacher...",
  "personality": "Brief personality description"
}

The systemPrompt should be comprehensive and describe:
- Who the teacher is (historical figure or fictional character)
- Their expertise and background related to ${topic}
- Their teaching style and approach
- How they interact with students
- Their personality traits

Make it engaging and immersive. The teacher should feel authentic and knowledgeable.`;

        try {
            const messages = [
                { role: 'system', content: teacherPrompt },
                { role: 'user', content: `Generate teacher info for topic: ${topic}` }
            ];

            let responseContent: string;

            if (this.provider === 'together') {
                const payload = {
                    model: this.model,
                    messages,
                    max_tokens: 1024,
                    temperature: 0.8,
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
                responseContent = json?.choices?.[0]?.message?.content || '';
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

            // Try to parse JSON from response
            let teacherInfo: TeacherInfo;
            try {
                // Extract JSON from response (might be wrapped in markdown code blocks)
                const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    teacherInfo = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                // Fallback if JSON parsing fails
                console.warn('Failed to parse teacher info JSON, using fallback:', parseError);
                teacherInfo = {
                    name: `${topic} Master`,
                    systemPrompt: `You are an expert teacher specializing in ${topic}. You are passionate, patient, and use clear explanations with practical examples. Your role is to teach ${topic} concepts, ask questions to test understanding, provide quizzes, and give constructive feedback. Adapt your teaching to the student's level and keep responses concise (2-3 paragraphs max).`,
                    personality: `An expert ${topic} teacher who is passionate about helping students learn. Patient, encouraging, and uses practical examples.`
                };
            }

            // Ensure all required fields are present
            if (!teacherInfo.name || !teacherInfo.systemPrompt || !teacherInfo.personality) {
                throw new Error('Missing required teacher info fields');
            }

            return teacherInfo;
        } catch (error) {
            console.error('Error generating teacher info:', error);
            // Fallback teacher info
            return {
                name: `${topic} Master`,
                systemPrompt: `You are an expert teacher specializing in ${topic}. You are passionate, patient, and use clear explanations with practical examples. Your role is to teach ${topic} concepts, ask questions to test understanding, provide quizzes, and give constructive feedback. Adapt your teaching to the student's level and keep responses concise (2-3 paragraphs max).`,
                personality: `An expert ${topic} teacher who is passionate about helping students learn. Patient, encouraging, and uses practical examples.`
            };
        }
    }

    private async ensureTeacherSummoned(
        topic: string,
        playerId?: string,
        playerPosition?: PlayerPosition
    ): Promise<{ teacherInfo: TeacherInfo; teacher?: SummonedTeacher }> {
        const teachersCollection = await getTeachersCollection() as Collection<Teacher>;
        const existingTeacher = await this.findTeacherByTopic(topic, teachersCollection);

        if (existingTeacher) {
            return {
                teacherInfo: {
                    name: existingTeacher.name,
                    systemPrompt: existingTeacher.systemPrompt,
                    personality: existingTeacher.personality
                },
                teacher: this.toSummonedTeacher(existingTeacher)
            };
        }

        const teacherInfo = await this.generateTeacherInfo(topic);

        if (playerId && playerPosition) {
            try {
                const createdTeacher = await this.createTeacherRecord(
                    topic,
                    teacherInfo,
                    playerId,
                    playerPosition,
                    teachersCollection
                );

                if (createdTeacher) {
                    return {
                        teacherInfo,
                        teacher: createdTeacher
                    };
                }

                console.warn(`Unable to place teacher ${teacherInfo.name}; no valid positions available.`);
            } catch (error) {
                console.error('Failed to create teacher document:', error);
            }
        } else {
            console.warn('Missing playerId or playerPosition; cannot anchor teacher in the world.');
        }

        return { teacherInfo };
    }

    private buildSummonResponse(
        topic: string,
        teacherInfo: TeacherInfo,
        teacher?: SummonedTeacher,
        playerPosition?: PlayerPosition
    ): string {
        if (teacher) {
            const coords = `(${Math.round(teacher.x)}, ${Math.round(teacher.y)})`;
            const proximityHint = playerPosition
                ? `They are near your current location—head towards the glowing marker to reach them.`
                : `They will appear on your map with a golden glow.`;

            return `Excellent choice! I sense your desire to learn about ${topic}.

I have summoned **${teacher.name}** to be your guide! ${proximityHint}

Location: ${coords}

${teacherInfo.personality}

Walk over to them to begin your learning journey! They will teach you about ${topic}, ask you questions to test your understanding, and reward you with tokens and NFT badges when you demonstrate mastery.`;
        }

        return `Excellent choice! I am preparing **${teacherInfo.name}** to teach you about ${topic}, but I need a clear sense of your position to place them in the world. Take a few steps in the world and ask me again so I can anchor them nearby.`;
    }

    private async findTeacherByTopic(
        topic: string,
        teachersCollection?: Collection<Teacher>
    ): Promise<WithId<Teacher> | null> {
        const collection = teachersCollection ?? await getTeachersCollection() as Collection<Teacher>;
        const sanitizedTopic = this.escapeRegex(topic);

        return collection.findOne({
            topic: { $regex: new RegExp(`^${sanitizedTopic}$`, 'i') }
        }) as Promise<WithId<Teacher> | null>;
    }

    private async createTeacherRecord(
        topic: string,
        teacherInfo: TeacherInfo,
        playerId: string,
        playerPosition: PlayerPosition,
        teachersCollection: Collection<Teacher>
    ): Promise<SummonedTeacher | null> {
        const world = await this.ensureDefaultWorld();
        const worldWidth = world?.width ?? DEFAULT_WORLD_WIDTH;
        const worldHeight = world?.height ?? DEFAULT_WORLD_HEIGHT;

        const candidatePositions = this.getCandidatePositions(playerPosition, worldWidth, worldHeight);

        for (const candidate of candidatePositions) {
            const available = await this.isPositionAvailable(teachersCollection, candidate.x, candidate.y);
            if (!available) {
                continue;
            }

            const now = new Date();
            const teacherDoc: Teacher = {
                worldId: world?._id?.toString?.() ?? 'default',
                topic,
                name: teacherInfo.name,
                systemPrompt: teacherInfo.systemPrompt,
                personality: teacherInfo.personality,
                x: candidate.x,
                y: candidate.y,
                avatarColor: '#FFD700',
                createdBy: playerId,
                createdAt: now,
                updatedAt: now
            };

            const result = await teachersCollection.insertOne(teacherDoc);
            return this.toSummonedTeacher({
                ...teacherDoc,
                _id: result.insertedId
            } as WithId<Teacher>);
        }

        return null;
    }

    private async ensureDefaultWorld() {
        const worldsCollection = await getGameWorldsCollection();
        let world = await worldsCollection.findOne({ name: 'default' });

        if (!world) {
            const now = new Date();
            const insertResult = await worldsCollection.insertOne({
                name: 'default',
                width: DEFAULT_WORLD_WIDTH,
                height: DEFAULT_WORLD_HEIGHT,
                createdAt: now,
                updatedAt: now
            });
            world = await worldsCollection.findOne({ _id: insertResult.insertedId });
        }

        return world;
    }

    private getCandidatePositions(position: PlayerPosition, worldWidth: number, worldHeight: number): PlayerPosition[] {
        const positions = TEACHER_SPAWN_OFFSETS.map(offset => ({
            x: this.clampToBounds(position.x + offset.x, worldWidth),
            y: this.clampToBounds(position.y + offset.y, worldHeight)
        }));

        // Add a few random fallbacks in case the nearby spots are occupied
        for (let i = 0; i < 5; i++) {
            positions.push({
                x: this.clampToBounds(Math.random() * worldWidth, worldWidth),
                y: this.clampToBounds(Math.random() * worldHeight, worldHeight)
            });
        }

        return positions;
    }

    private clampToBounds(value: number, max: number): number {
        const margin = 40;
        if (!Number.isFinite(value)) return margin;
        return Math.min(Math.max(value, margin), Math.max(margin, max - margin));
    }

    private toSummonedTeacher(doc: WithId<Teacher>): SummonedTeacher {
        return {
            id: doc._id.toString(),
            topic: doc.topic,
            name: doc.name,
            systemPrompt: doc.systemPrompt,
            personality: doc.personality,
            x: doc.x,
            y: doc.y,
            avatarColor: doc.avatarColor,
            worldId: doc.worldId,
            createdBy: doc.createdBy
        };
    }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async isPositionAvailable(
        teachersCollection: Collection<Teacher>,
        x: number,
        y: number
    ): Promise<boolean> {
        const nearbyTeacher = await teachersCollection.findOne({
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
        });

        return !nearbyTeacher;
    }
}

export const genieService = new GenieService();
