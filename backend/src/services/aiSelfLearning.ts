/**
 * AI Self-Learning System (SELF-001, ML-001, LEARN-001)
 * 
 * This module enables the AI trainer to continuously improve itself by:
 * 1. Learning from user feedback (likes/dislikes)
 * 2. Auto-generating new instructions from successful interactions
 * 3. Adapting to user communication patterns
 * 4. Maintaining an experience replay buffer for training
 */

import { PrismaClient } from '@prisma/client';

// Types for the learning system
export interface Interaction {
    id: string;
    profileId: string;
    userMessage: string;
    aiResponse: string;
    rating: 'positive' | 'negative' | 'neutral';
    reactionEmoji?: string;
    feedback?: string;
    intent: string;
    latencyMs: number;
    timestamp: Date;
    metadata: InteractionMetadata;
}

export interface InteractionMetadata {
    tokensUsed: number;
    model: string;
    promptVersion: string;
    instructionIds: string[];
    context: {
        timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
        dayOfWeek: number;
        userMood?: string;
        sessionNumber: number;
    };
}

export interface LearnedInstruction {
    id: string;
    profileId?: string; // null = global instruction
    content: string;
    category: 'response_style' | 'topic_handling' | 'error_recovery' | 'personalization' | 'safety';
    confidence: number; // 0.0 - 1.0
    successRate: number; // ratio of positive feedback when used
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
    source: 'auto_generated' | 'user_feedback' | 'admin' | 'baseline';
    isActive: boolean;
    parentInstructionId?: string; // for version tracking
    metadata: InstructionMetadata;
}

export interface InstructionMetadata {
    generatedFrom?: string[]; // interaction IDs that led to this instruction
    keywords: string[];
    testResults?: {
        aVariant: { score: number; samples: number };
        bVariant: { score: number; samples: number };
    };
}

export interface UserLearningProfile {
    profileId: string;
    communicationStyle: {
        preferredLength: 'short' | 'medium' | 'long';
        formalityLevel: number; // 0-1, 0 = casual, 1 = formal
        humorAppreciation: number; // 0-1
        emojiUsage: number; // 0-1
        technicalLevel: number; // 0-1
    };
    topics: {
        interested: string[];
        avoided: string[];
        expertiseAreas: string[];
    };
    patterns: {
        activeHours: number[]; // hours of day when active (0-23)
        activeDays: number[]; // days of week (0-6)
        avgSessionLength: number; // minutes
        avgMessagesPerSession: number;
    };
    emotionalPatterns: {
        typicalMood: string;
        motivationTriggers: string[];
        stressIndicators: string[];
    };
    lastUpdated: Date;
}

export interface ExperienceBuffer {
    id: string;
    profileId: string;
    interactions: BufferedInteraction[];
    maxSize: number;
    createdAt: Date;
    lastCleanup: Date;
}

export interface BufferedInteraction {
    interactionId: string;
    score: number; // -1 to +1, computed from feedback
    isExemplar: boolean; // true = use as few-shot example
    usedAsExample: number; // times used in prompts
}

// Configuration
const CONFIG = {
    // Experience buffer settings
    BUFFER_MAX_SIZE: 1000,
    EXEMPLAR_THRESHOLD: 0.8, // score above which interaction becomes exemplar
    MIN_EXEMPLARS_PER_INTENT: 3,
    MAX_EXEMPLARS_PER_INTENT: 10,

    // Instruction generation settings
    MIN_INTERACTIONS_FOR_LEARNING: 50,
    INSTRUCTION_CONFIDENCE_THRESHOLD: 0.7,
    INSTRUCTION_DEPRECATION_THRESHOLD: 0.3,
    INSTRUCTION_A_B_SAMPLE_SIZE: 100,

    // Personalization settings
    LEARNING_RATE: 0.1, // how fast to adapt
    DECAY_FACTOR: 0.95, // gradual forgetting of old patterns

    // Cleanup settings
    CLEANUP_INTERVAL_HOURS: 24,
    MAX_INTERACTION_AGE_DAYS: 90,
};

/**
 * AI Self-Learning Engine
 * Core class that orchestrates all learning operations
 */
export class AiSelfLearningEngine {
    private prisma: PrismaClient;
    private profileId: string;

    constructor(prisma: PrismaClient, profileId: string) {
        this.prisma = prisma;
        this.profileId = profileId;
    }

    // ==========================================
    // FEEDBACK PROCESSING (ML-001)
    // ==========================================

    /**
     * Process user feedback and update learning systems
     */
    async processFeedback(params: {
        interactionId: string;
        rating: 'positive' | 'negative' | 'neutral';
        emoji?: string;
        comment?: string;
    }): Promise<void> {
        const { interactionId, rating, emoji, comment } = params;

        // 1. Store the feedback
        await this.storeInteractionFeedback(interactionId, rating, emoji, comment);

        // 2. Update experience buffer
        await this.updateExperienceBuffer(interactionId, rating);

        // 3. If negative, analyze for instruction improvement
        if (rating === 'negative') {
            await this.analyzeNegativeFeedback(interactionId, comment);
        }

        // 4. If positive and high quality, mark as potential exemplar
        if (rating === 'positive') {
            await this.evaluateAsExemplar(interactionId);
        }

        // 5. Update user learning profile
        await this.updateUserProfile(rating);
    }

    private async storeInteractionFeedback(
        interactionId: string,
        rating: 'positive' | 'negative' | 'neutral',
        emoji?: string,
        comment?: string
    ): Promise<void> {
        // Store in interaction log
        await this.prisma.aIInteraction.update({
            where: { id: interactionId },
            data: {
                rating,
                reactionEmoji: emoji,
                feedbackComment: comment,
                updatedAt: new Date(),
            },
        }).catch(() => {
            // Interaction might not exist in DB yet, create it
            console.warn(`[SelfLearning] Interaction ${interactionId} not found for feedback`);
        });
    }

    private async updateExperienceBuffer(
        interactionId: string,
        rating: 'positive' | 'negative' | 'neutral'
    ): Promise<void> {
        const score = rating === 'positive' ? 1.0 : rating === 'negative' ? -1.0 : 0.0;

        // Get or create buffer
        let buffer = await this.getOrCreateExperienceBuffer();

        // Add to buffer
        const newInteraction: BufferedInteraction = {
            interactionId,
            score,
            isExemplar: score >= CONFIG.EXEMPLAR_THRESHOLD,
            usedAsExample: 0,
        };

        buffer.interactions.push(newInteraction);

        // Trim if exceeds max size (keep highest scored)
        if (buffer.interactions.length > CONFIG.BUFFER_MAX_SIZE) {
            buffer.interactions.sort((a, b) => b.score - a.score);
            buffer.interactions = buffer.interactions.slice(0, CONFIG.BUFFER_MAX_SIZE);
        }

        await this.saveExperienceBuffer(buffer);
    }

    private async analyzeNegativeFeedback(
        interactionId: string,
        comment?: string
    ): Promise<void> {
        // Get the interaction details
        const interaction = await this.prisma.aIInteraction.findUnique({
            where: { id: interactionId },
        });

        if (!interaction) return;

        // Analyze what went wrong
        const analysis = this.analyzeFailure(
            interaction.userMessage,
            interaction.aiResponse,
            comment
        );

        // Store for pattern detection
        await this.storeFailurePattern(analysis);

        // Check if we have enough failures of this type to generate fix instruction
        const similarFailures = await this.countSimilarFailures(analysis.category);

        if (similarFailures >= 5) {
            await this.generateCorrectiveInstruction(analysis);
        }
    }

    private analyzeFailure(
        userMessage: string,
        aiResponse: string,
        comment?: string
    ): FailureAnalysis {
        // Categorize the failure
        let category: FailureCategory = 'unknown';
        let confidence = 0.5;

        // Check for common failure patterns
        if (comment?.toLowerCase().includes('неправил') ||
            comment?.toLowerCase().includes('ошиб')) {
            category = 'factual_error';
            confidence = 0.8;
        } else if (comment?.toLowerCase().includes('длинн') ||
            comment?.toLowerCase().includes('коротк')) {
            category = 'length_issue';
            confidence = 0.9;
        } else if (comment?.toLowerCase().includes('не понял') ||
            comment?.toLowerCase().includes('не ответил')) {
            category = 'missed_intent';
            confidence = 0.85;
        } else if (comment?.toLowerCase().includes('груб') ||
            comment?.toLowerCase().includes('тон')) {
            category = 'tone_issue';
            confidence = 0.9;
        } else if (aiResponse.length > 1000) {
            category = 'too_verbose';
            confidence = 0.7;
        }

        return {
            category,
            confidence,
            userMessage,
            aiResponse,
            comment,
            timestamp: new Date(),
        };
    }

    private async storeFailurePattern(analysis: FailureAnalysis): Promise<void> {
        await this.prisma.aIFailurePattern.create({
            data: {
                profileId: this.profileId,
                category: analysis.category,
                confidence: analysis.confidence,
                userMessage: analysis.userMessage.slice(0, 500),
                aiResponse: analysis.aiResponse.slice(0, 500),
                comment: analysis.comment?.slice(0, 500),
                createdAt: analysis.timestamp,
            },
        }).catch(() => {
            // Table might not exist yet
            console.warn('[SelfLearning] Cannot store failure pattern - table missing');
        });
    }

    private async countSimilarFailures(category: string): Promise<number> {
        try {
            return await this.prisma.aIFailurePattern.count({
                where: {
                    profileId: this.profileId,
                    category,
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
                    },
                },
            });
        } catch {
            return 0;
        }
    }

    private async generateCorrectiveInstruction(analysis: FailureAnalysis): Promise<void> {
        // Generate instruction based on failure category
        let instructionContent = '';

        switch (analysis.category) {
            case 'too_verbose':
                instructionContent = 'Пользователь предпочитает короткие ответы. Ограничивайся 2-3 предложениями, если не просят подробнее.';
                break;
            case 'tone_issue':
                instructionContent = 'Следи за тоном — будь дружелюбным и поддерживающим, избегай категоричных формулировок.';
                break;
            case 'missed_intent':
                instructionContent = 'Если не уверен в запросе, задай уточняющий вопрос вместо предположения.';
                break;
            case 'factual_error':
                instructionContent = 'Если не уверен в фактах, прямо скажи "Я не уверен" вместо придумывания.';
                break;
            default:
                return; // Don't generate for unknown categories
        }

        await this.createLearnedInstruction({
            content: instructionContent,
            category: 'response_style',
            source: 'auto_generated',
            confidence: analysis.confidence * 0.8, // slightly lower confidence for auto-generated
        });
    }

    private async evaluateAsExemplar(interactionId: string): Promise<void> {
        const buffer = await this.getOrCreateExperienceBuffer();

        // Find the interaction in buffer
        const idx = buffer.interactions.findIndex(i => i.interactionId === interactionId);
        if (idx === -1) return;

        // Mark as exemplar if score is high
        if (buffer.interactions[idx].score >= CONFIG.EXEMPLAR_THRESHOLD) {
            buffer.interactions[idx].isExemplar = true;
            await this.saveExperienceBuffer(buffer);
        }
    }

    // ==========================================
    // AUTO-INSTRUCTION GENERATION (SELF-001)
    // ==========================================

    /**
     * Analyze successful interactions and generate new instructions
     */
    async runInstructionGeneration(): Promise<LearnedInstruction[]> {
        const generatedInstructions: LearnedInstruction[] = [];

        // Get positive interactions
        const positiveInteractions = await this.getPositiveInteractions(100);

        if (positiveInteractions.length < CONFIG.MIN_INTERACTIONS_FOR_LEARNING) {
            console.log('[SelfLearning] Not enough interactions for instruction generation');
            return [];
        }

        // Analyze patterns
        const patterns = this.analyzeSuccessPatterns(positiveInteractions);

        // Generate instructions from patterns
        for (const pattern of patterns) {
            if (pattern.confidence >= CONFIG.INSTRUCTION_CONFIDENCE_THRESHOLD) {
                const instruction = await this.createLearnedInstruction({
                    content: pattern.instructionText,
                    category: pattern.category,
                    source: 'auto_generated',
                    confidence: pattern.confidence,
                });

                if (instruction) {
                    generatedInstructions.push(instruction);
                }
            }
        }

        return generatedInstructions;
    }

    private async getPositiveInteractions(limit: number): Promise<Interaction[]> {
        try {
            const dbInteractions = await this.prisma.aIInteraction.findMany({
                where: {
                    profileId: this.profileId,
                    rating: 'positive',
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });

            return dbInteractions.map(this.mapDbInteractionToInterface);
        } catch {
            return [];
        }
    }

    private mapDbInteractionToInterface(db: any): Interaction {
        return {
            id: db.id,
            profileId: db.profileId,
            userMessage: db.userMessage,
            aiResponse: db.aiResponse,
            rating: db.rating || 'neutral',
            reactionEmoji: db.reactionEmoji,
            feedback: db.feedbackComment,
            intent: db.intent || 'unknown',
            latencyMs: db.latencyMs || 0,
            timestamp: db.createdAt,
            metadata: db.metadata || {},
        };
    }

    private analyzeSuccessPatterns(interactions: Interaction[]): PatternAnalysis[] {
        const patterns: PatternAnalysis[] = [];

        // Pattern 1: Response length preference
        const avgLength = interactions.reduce((sum, i) => sum + i.aiResponse.length, 0) / interactions.length;
        if (avgLength < 200) {
            patterns.push({
                type: 'length',
                category: 'response_style',
                instructionText: 'Пользователь предпочитает краткие ответы (до 200 символов). Будь лаконичен.',
                confidence: 0.75,
                sampleSize: interactions.length,
            });
        } else if (avgLength > 500) {
            patterns.push({
                type: 'length',
                category: 'response_style',
                instructionText: 'Пользователь ценит развёрнутые ответы. Давай подробные объяснения.',
                confidence: 0.75,
                sampleSize: interactions.length,
            });
        }

        // Pattern 2: Emoji usage
        const emojiResponses = interactions.filter(i => /[\u{1F300}-\u{1F9FF}]/u.test(i.aiResponse));
        const emojiRatio = emojiResponses.length / interactions.length;
        if (emojiRatio > 0.5) {
            patterns.push({
                type: 'emoji',
                category: 'response_style',
                instructionText: 'Пользователю нравятся эмодзи в ответах. Используй их уместно. 😊',
                confidence: emojiRatio,
                sampleSize: interactions.length,
            });
        }

        // Pattern 3: Technical depth
        const technicalKeywords = ['подход', 'повтор', 'сет', 'вес', 'кг', 'калори', 'белок'];
        const technicalResponses = interactions.filter(i =>
            technicalKeywords.some(kw => i.aiResponse.toLowerCase().includes(kw))
        );
        const technicalRatio = technicalResponses.length / interactions.length;
        if (technicalRatio > 0.6) {
            patterns.push({
                type: 'technical',
                category: 'topic_handling',
                instructionText: 'Пользователь ценит технические детали. Включай конкретные цифры и термины.',
                confidence: technicalRatio,
                sampleSize: interactions.length,
            });
        }

        return patterns;
    }

    // ==========================================
    // EXPERIENCE BUFFER (LEARN-001)
    // ==========================================

    private async getOrCreateExperienceBuffer(): Promise<ExperienceBuffer> {
        try {
            const existing = await this.prisma.aIExperienceBuffer.findUnique({
                where: { profileId: this.profileId },
            });

            if (existing) {
                return {
                    id: existing.id,
                    profileId: existing.profileId,
                    interactions: JSON.parse(existing.interactions as string || '[]'),
                    maxSize: CONFIG.BUFFER_MAX_SIZE,
                    createdAt: existing.createdAt,
                    lastCleanup: existing.lastCleanup,
                };
            }
        } catch {
            // Table might not exist
        }

        // Return new buffer
        return {
            id: `buffer_${this.profileId}`,
            profileId: this.profileId,
            interactions: [],
            maxSize: CONFIG.BUFFER_MAX_SIZE,
            createdAt: new Date(),
            lastCleanup: new Date(),
        };
    }

    private async saveExperienceBuffer(buffer: ExperienceBuffer): Promise<void> {
        try {
            await this.prisma.aIExperienceBuffer.upsert({
                where: { profileId: this.profileId },
                create: {
                    id: buffer.id,
                    profileId: buffer.profileId,
                    interactions: JSON.stringify(buffer.interactions),
                    maxSize: buffer.maxSize,
                    createdAt: buffer.createdAt,
                    lastCleanup: buffer.lastCleanup,
                },
                update: {
                    interactions: JSON.stringify(buffer.interactions),
                    lastCleanup: buffer.lastCleanup,
                },
            });
        } catch {
            console.warn('[SelfLearning] Cannot save experience buffer - table missing');
        }
    }

    /**
     * Get exemplar interactions for few-shot prompting
     */
    async getExemplars(intent: string, count: number = 3): Promise<Interaction[]> {
        const buffer = await this.getOrCreateExperienceBuffer();

        // Filter exemplars
        const exemplars = buffer.interactions
            .filter(i => i.isExemplar)
            .sort((a, b) => b.score - a.score)
            .slice(0, count);

        // Load full interaction data
        const interactions: Interaction[] = [];
        for (const ex of exemplars) {
            try {
                const interaction = await this.prisma.aIInteraction.findUnique({
                    where: { id: ex.interactionId },
                });
                if (interaction) {
                    interactions.push(this.mapDbInteractionToInterface(interaction));
                }
            } catch {
                // Skip if not found
            }
        }

        return interactions;
    }

    // ==========================================
    // USER LEARNING PROFILE (ADAPT-001)
    // ==========================================

    private async updateUserProfile(latestRating: 'positive' | 'negative' | 'neutral'): Promise<void> {
        const profile = await this.getOrCreateUserLearningProfile();

        // Update patterns based on current time
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        // Update active hours (exponential moving average)
        if (!profile.patterns.activeHours.includes(hour)) {
            profile.patterns.activeHours.push(hour);
            // Keep only last 10 unique hours
            if (profile.patterns.activeHours.length > 10) {
                profile.patterns.activeHours.shift();
            }
        }

        // Update active days
        if (!profile.patterns.activeDays.includes(day)) {
            profile.patterns.activeDays.push(day);
        }

        profile.lastUpdated = now;
        await this.saveUserLearningProfile(profile);
    }

    private async getOrCreateUserLearningProfile(): Promise<UserLearningProfile> {
        try {
            const existing = await this.prisma.aIUserLearningProfile.findUnique({
                where: { profileId: this.profileId },
            });

            if (existing) {
                return {
                    profileId: existing.profileId,
                    communicationStyle: JSON.parse(existing.communicationStyle as string || '{}'),
                    topics: JSON.parse(existing.topics as string || '{}'),
                    patterns: JSON.parse(existing.patterns as string || '{}'),
                    emotionalPatterns: JSON.parse(existing.emotionalPatterns as string || '{}'),
                    lastUpdated: existing.lastUpdated,
                };
            }
        } catch {
            // Table might not exist
        }

        // Return default profile
        return {
            profileId: this.profileId,
            communicationStyle: {
                preferredLength: 'medium',
                formalityLevel: 0.3,
                humorAppreciation: 0.5,
                emojiUsage: 0.5,
                technicalLevel: 0.5,
            },
            topics: {
                interested: [],
                avoided: [],
                expertiseAreas: [],
            },
            patterns: {
                activeHours: [],
                activeDays: [],
                avgSessionLength: 0,
                avgMessagesPerSession: 0,
            },
            emotionalPatterns: {
                typicalMood: 'neutral',
                motivationTriggers: [],
                stressIndicators: [],
            },
            lastUpdated: new Date(),
        };
    }

    private async saveUserLearningProfile(profile: UserLearningProfile): Promise<void> {
        try {
            await this.prisma.aIUserLearningProfile.upsert({
                where: { profileId: this.profileId },
                create: {
                    profileId: profile.profileId,
                    communicationStyle: JSON.stringify(profile.communicationStyle),
                    topics: JSON.stringify(profile.topics),
                    patterns: JSON.stringify(profile.patterns),
                    emotionalPatterns: JSON.stringify(profile.emotionalPatterns),
                    lastUpdated: profile.lastUpdated,
                },
                update: {
                    communicationStyle: JSON.stringify(profile.communicationStyle),
                    topics: JSON.stringify(profile.topics),
                    patterns: JSON.stringify(profile.patterns),
                    emotionalPatterns: JSON.stringify(profile.emotionalPatterns),
                    lastUpdated: profile.lastUpdated,
                },
            });
        } catch {
            console.warn('[SelfLearning] Cannot save user learning profile - table missing');
        }
    }

    // ==========================================
    // INSTRUCTION MANAGEMENT (SELF-002, SELF-003, SELF-004)
    // ==========================================

    private async createLearnedInstruction(params: {
        content: string;
        category: LearnedInstruction['category'];
        source: LearnedInstruction['source'];
        confidence: number;
    }): Promise<LearnedInstruction | null> {
        const instruction: LearnedInstruction = {
            id: `instr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            profileId: this.profileId,
            content: params.content,
            category: params.category,
            confidence: params.confidence,
            successRate: 0.5, // neutral starting point
            usageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            source: params.source,
            isActive: true,
            metadata: {
                keywords: this.extractKeywords(params.content),
            },
        };

        try {
            await this.prisma.aILearnedInstruction.create({
                data: {
                    id: instruction.id,
                    profileId: instruction.profileId,
                    content: instruction.content,
                    category: instruction.category,
                    confidence: instruction.confidence,
                    successRate: instruction.successRate,
                    usageCount: instruction.usageCount,
                    createdAt: instruction.createdAt,
                    updatedAt: instruction.updatedAt,
                    source: instruction.source,
                    isActive: instruction.isActive,
                    metadata: JSON.stringify(instruction.metadata),
                },
            });

            return instruction;
        } catch {
            console.warn('[SelfLearning] Cannot create learned instruction - table missing');
            return null;
        }
    }

    private extractKeywords(text: string): string[] {
        const stopWords = ['и', 'в', 'на', 'с', 'по', 'для', 'к', 'от', 'из', 'о', 'а', 'но', 'не', 'что', 'это'];
        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .slice(0, 10);
    }

    /**
     * Get all active learned instructions for this user
     */
    async getActiveInstructions(): Promise<LearnedInstruction[]> {
        try {
            const dbInstructions = await this.prisma.aILearnedInstruction.findMany({
                where: {
                    OR: [
                        { profileId: this.profileId },
                        { profileId: null }, // global instructions
                    ],
                    isActive: true,
                    confidence: { gte: CONFIG.INSTRUCTION_DEPRECATION_THRESHOLD },
                },
                orderBy: { confidence: 'desc' },
            });

            return dbInstructions.map(db => ({
                id: db.id,
                profileId: db.profileId ?? undefined, // Convert null to undefined
                content: db.content,
                category: db.category as LearnedInstruction['category'],
                confidence: db.confidence,
                successRate: db.successRate,
                usageCount: db.usageCount,
                createdAt: db.createdAt,
                updatedAt: db.updatedAt,
                source: db.source as LearnedInstruction['source'],
                isActive: db.isActive,
                parentInstructionId: db.parentInstructionId ?? undefined, // Convert null to undefined
                metadata: JSON.parse(db.metadata as string || '{}'),
            }));
        } catch {
            return [];
        }
    }

    /**
     * Update instruction performance after usage
     */
    async recordInstructionUsage(
        instructionId: string,
        wasSuccessful: boolean
    ): Promise<void> {
        try {
            const instruction = await this.prisma.aILearnedInstruction.findUnique({
                where: { id: instructionId },
            });

            if (!instruction) return;

            // Update success rate using exponential moving average
            const alpha = 0.1; // learning rate
            const newSuccessRate = instruction.successRate * (1 - alpha) + (wasSuccessful ? 1 : 0) * alpha;

            await this.prisma.aILearnedInstruction.update({
                where: { id: instructionId },
                data: {
                    usageCount: instruction.usageCount + 1,
                    successRate: newSuccessRate,
                    confidence: Math.max(
                        CONFIG.INSTRUCTION_DEPRECATION_THRESHOLD,
                        instruction.confidence * 0.99 + newSuccessRate * 0.01
                    ),
                    updatedAt: new Date(),
                    // Auto-deprecate if success rate drops too low
                    isActive: newSuccessRate > CONFIG.INSTRUCTION_DEPRECATION_THRESHOLD,
                },
            });
        } catch {
            console.warn('[SelfLearning] Cannot update instruction usage');
        }
    }

    /**
     * Get instructions formatted for inclusion in AI prompt
     */
    async getInstructionsForPrompt(): Promise<string> {
        const instructions = await this.getActiveInstructions();

        if (instructions.length === 0) return '';

        const formatted = instructions
            .slice(0, 10) // limit to top 10
            .map((inst, i) => `${i + 1}. ${inst.content}`)
            .join('\n');

        return `\n\n## Персональные обучённые правила\n${formatted}`;
    }

    // ==========================================
    // SELF-002: Instruction Confidence Scoring & Decay
    // ==========================================

    /**
     * Apply confidence decay to stale instructions (not used recently)
     * Instructions lose 5% confidence per week of inactivity
     */
    async applyConfidenceDecay(): Promise<{ decayed: number; deprecated: number }> {
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const DECAY_RATE = 0.05; // 5% per week

        try {
            const instructions = await this.prisma.aILearnedInstruction.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { profileId: this.profileId },
                        { profileId: null }
                    ]
                }
            });

            let decayed = 0;
            let deprecated = 0;

            for (const inst of instructions) {
                const ageMs = Date.now() - inst.updatedAt.getTime();
                const weeks = Math.floor(ageMs / ONE_WEEK_MS);

                if (weeks > 0 && inst.usageCount < 5) {
                    const newConfidence = Math.max(0.1, inst.confidence - (DECAY_RATE * weeks));
                    const shouldDeprecate = newConfidence < CONFIG.INSTRUCTION_DEPRECATION_THRESHOLD;

                    await this.prisma.aILearnedInstruction.update({
                        where: { id: inst.id },
                        data: {
                            confidence: newConfidence,
                            isActive: !shouldDeprecate,
                            updatedAt: new Date(),
                        }
                    });

                    decayed++;
                    if (shouldDeprecate) deprecated++;
                }
            }

            console.log(`[SelfLearning] Confidence decay: ${decayed} decayed, ${deprecated} deprecated`);
            return { decayed, deprecated };
        } catch (err) {
            console.warn('[SelfLearning] Confidence decay failed:', (err as Error).message);
            return { decayed: 0, deprecated: 0 };
        }
    }

    // ==========================================
    // ADAPT-002: Topic Interest Tracking
    // ==========================================

    /**
     * Track topics the user is interested in based on conversation patterns
     */
    async trackTopicInterests(userMessage: string, intent: string): Promise<void> {
        const topics = this.extractTopics(userMessage);
        if (topics.length === 0) return;

        try {
            const profile = await this.getOrCreateUserLearningProfile();

            const currentTopics = (profile as any).topics as UserLearningProfile['topics'] || {
                interested: [],
                avoided: [],
                expertiseAreas: []
            };

            // Add new topics (avoid duplicates)
            topics.forEach(topic => {
                if (!currentTopics.interested.includes(topic)) {
                    currentTopics.interested.push(topic);
                }
            });

            // Keep only last 50 topics
            currentTopics.interested = currentTopics.interested.slice(-50);

            await this.prisma.aIUserLearningProfile.update({
                where: { profileId: this.profileId },
                data: {
                    topics: JSON.stringify(currentTopics),
                    lastUpdated: new Date(),
                }
            });
        } catch (err) {
            console.debug('[SelfLearning] Topic tracking failed:', (err as Error).message);
        }
    }

    /**
     * Extract topics from user message using keyword matching
     */
    private extractTopics(message: string): string[] {
        const topics: string[] = [];
        const lowered = message.toLowerCase();

        // Training topics
        const trainingKeywords = ['тренировка', 'упражнение', 'подход', 'повтор', 'жим', 'присед', 'тяга', 'кардио', 'разминка'];
        trainingKeywords.forEach(kw => {
            if (lowered.includes(kw)) topics.push('training');
        });

        // Nutrition topics
        const nutritionKeywords = ['питание', 'диета', 'калории', 'белок', 'углеводы', 'жиры', 'еда', 'приём пищи'];
        nutritionKeywords.forEach(kw => {
            if (lowered.includes(kw)) topics.push('nutrition');
        });

        // Recovery topics
        const recoveryKeywords = ['отдых', 'восстановлен', 'сон', 'массаж', 'растяжка', 'боль', 'травма'];
        recoveryKeywords.forEach(kw => {
            if (lowered.includes(kw)) topics.push('recovery');
        });

        // Progress topics
        const progressKeywords = ['прогресс', 'результат', 'рекорд', 'максимум', 'рост', 'вес'];
        progressKeywords.forEach(kw => {
            if (lowered.includes(kw)) topics.push('progress');
        });

        // Motivation topics
        const motivationKeywords = ['мотивация', 'настроение', 'устал', 'лень', 'не хочу', 'молодец'];
        motivationKeywords.forEach(kw => {
            if (lowered.includes(kw)) topics.push('motivation');
        });

        return [...new Set(topics)]; // Unique topics only
    }

    /**
     * Get user's top interested topics for prompt context
     */
    async getTopInterests(): Promise<string[]> {
        try {
            const profile = await this.prisma.aIUserLearningProfile.findUnique({
                where: { profileId: this.profileId }
            });

            if (!profile) return [];

            const topics = JSON.parse((profile as any).topics || '{}');
            return topics.interested?.slice(-10) || [];
        } catch {
            return [];
        }
    }

    // ==========================================
    // LEARN-005: Self-Evaluation System
    // ==========================================

    /**
     * AI evaluates its own response quality before sending
     * Returns a score 0-1 and suggestions for improvement
     */
    async selfEvaluateResponse(userMessage: string, aiResponse: string, intent: string): Promise<{
        score: number;
        issues: string[];
        shouldRetry: boolean;
    }> {
        let score = 1.0;
        const issues: string[] = [];

        // 1. Length check
        if (aiResponse.length < 20) {
            score -= 0.2;
            issues.push('too_short');
        } else if (aiResponse.length > 2000) {
            score -= 0.1;
            issues.push('too_long');
        }

        // 2. Empty response check
        if (!aiResponse.trim()) {
            score = 0;
            issues.push('empty_response');
        }

        // 3. Repetition check (same sentence repeated)
        const sentences = aiResponse.split(/[.!?]/).filter(s => s.trim().length > 10);
        const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
        if (sentences.length > 2 && uniqueSentences.size < sentences.length * 0.7) {
            score -= 0.15;
            issues.push('repetitive');
        }

        // 4. Question answering check (if user asked a question, response should have answer)
        const isQuestion = /[?]|как|что|почему|когда|сколько|где/i.test(userMessage);
        const hasAnswer = /\d|потому|можно|нужно|стоит|рекомендую/.test(aiResponse);
        if (isQuestion && !hasAnswer && aiResponse.length < 100) {
            score -= 0.1;
            issues.push('question_not_answered');
        }

        // 5. Training-specific checks
        if (intent.includes('plan') || intent.includes('workout')) {
            const hasNumbers = /\d+\s*(подход|повтор|кг|мин|сек|раз)/i.test(aiResponse);
            if (!hasNumbers) {
                score -= 0.1;
                issues.push('missing_specifics');
            }
        }

        // 6. Mood matching (if user is frustrated, response should be supportive)
        const userFrustrated = /не получает|сложно|трудно|не могу|устал|надоело/i.test(userMessage);
        const responseSupportive = /понимаю|поддержк|помогу|получится|вместе|давай/i.test(aiResponse);
        if (userFrustrated && !responseSupportive) {
            score -= 0.15;
            issues.push('lacks_empathy');
        }

        score = Math.max(0, Math.min(1, score));

        return {
            score,
            issues,
            shouldRetry: score < 0.5
        };
    }

    /**
     * Log self-evaluation results for learning
     */
    async logSelfEvaluation(
        interactionId: string,
        evaluation: { score: number; issues: string[]; shouldRetry: boolean }
    ): Promise<void> {
        try {
            await this.prisma.aIInteraction.update({
                where: { id: interactionId },
                data: {
                    metadata: {
                        selfEvaluation: evaluation
                    }
                }
            });
        } catch {
            // Interaction might not exist yet - that's OK
        }
    }

    // ==========================================
    // ADAPT-003: Response Length Adaptation
    // ==========================================

    /**
     * Learn user's preferred response length from feedback patterns
     */
    async learnPreferredLength(): Promise<'short' | 'medium' | 'long'> {
        try {
            // Get recent positive interactions
            const positiveInteractions = await this.prisma.aIInteraction.findMany({
                where: {
                    profileId: this.profileId,
                    rating: 'positive'
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { aiResponse: true }
            });

            if (positiveInteractions.length < 5) return 'medium';

            const avgLength = positiveInteractions.reduce(
                (sum, i) => sum + i.aiResponse.length, 0
            ) / positiveInteractions.length;

            if (avgLength < 150) return 'short';
            if (avgLength > 500) return 'long';
            return 'medium';
        } catch {
            return 'medium';
        }
    }

    /**
     * Get response length modifier for prompts
     */
    async getResponseLengthHint(): Promise<string> {
        const preferred = await this.learnPreferredLength();

        switch (preferred) {
            case 'short':
                return 'Пользователь предпочитает короткие, лаконичные ответы (1-2 предложения).';
            case 'long':
                return 'Пользователь любит подробные, развёрнутые ответы с деталями.';
            default:
                return '';
        }
    }

    // ==========================================
    // SELF-003: Instruction A/B Testing
    // ==========================================

    /**
     * Run A/B test for instruction variants
     * Randomly selects variant A or B and tracks performance
     */
    async runABTest(instructionId: string): Promise<{ variant: 'a' | 'b'; content: string } | null> {
        try {
            const instruction = await this.prisma.aILearnedInstruction.findUnique({
                where: { id: instructionId }
            });

            if (!instruction) return null;

            const metadata = JSON.parse((instruction as any).metadata || '{}');
            if (!metadata.abTest) return null;

            // Random assignment
            const variant = Math.random() > 0.5 ? 'a' : 'b';
            const content = variant === 'a' ? instruction.content : metadata.abTest.variantB;

            // Log experiment assignment
            await this.logABTestAssignment(instructionId, variant);

            return { variant, content };
        } catch {
            return null;
        }
    }

    /**
     * Create A/B test for an instruction
     */
    async createABTest(instructionId: string, variantBContent: string): Promise<boolean> {
        try {
            const instruction = await this.prisma.aILearnedInstruction.findUnique({
                where: { id: instructionId }
            });

            if (!instruction) return false;

            const metadata = JSON.parse((instruction as any).metadata || '{}');
            metadata.abTest = {
                variantB: variantBContent,
                startedAt: new Date().toISOString(),
                aScore: 0,
                bScore: 0,
                aSamples: 0,
                bSamples: 0,
            };

            await this.prisma.aILearnedInstruction.update({
                where: { id: instructionId },
                data: { metadata: JSON.stringify(metadata) }
            });

            console.log(`[SelfLearning] A/B test created for instruction ${instructionId}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Record A/B test result based on user feedback
     */
    async recordABTestResult(instructionId: string, variant: 'a' | 'b', success: boolean): Promise<void> {
        try {
            const instruction = await this.prisma.aILearnedInstruction.findUnique({
                where: { id: instructionId }
            });

            if (!instruction) return;

            const metadata = JSON.parse((instruction as any).metadata || '{}');
            if (!metadata.abTest) return;

            // Update scores
            if (variant === 'a') {
                metadata.abTest.aSamples++;
                if (success) metadata.abTest.aScore++;
            } else {
                metadata.abTest.bSamples++;
                if (success) metadata.abTest.bScore++;
            }

            // Check if we have enough samples to conclude (min 10 each)
            const minSamples = 10;
            if (metadata.abTest.aSamples >= minSamples && metadata.abTest.bSamples >= minSamples) {
                const aSuccessRate = metadata.abTest.aScore / metadata.abTest.aSamples;
                const bSuccessRate = metadata.abTest.bScore / metadata.abTest.bSamples;

                // If B is significantly better (>10% improvement), promote it
                if (bSuccessRate > aSuccessRate * 1.1) {
                    await this.prisma.aILearnedInstruction.update({
                        where: { id: instructionId },
                        data: {
                            content: metadata.abTest.variantB,
                            metadata: JSON.stringify({ ...metadata, abTest: { ...metadata.abTest, concluded: true, winner: 'b' } })
                        }
                    });
                    console.log(`[SelfLearning] A/B test concluded: variant B won for ${instructionId}`);
                } else if (metadata.abTest.aSamples >= 20) {
                    // A is better or equal, conclude test
                    metadata.abTest.concluded = true;
                    metadata.abTest.winner = 'a';
                    await this.prisma.aILearnedInstruction.update({
                        where: { id: instructionId },
                        data: { metadata: JSON.stringify(metadata) }
                    });
                }
            } else {
                await this.prisma.aILearnedInstruction.update({
                    where: { id: instructionId },
                    data: { metadata: JSON.stringify(metadata) }
                });
            }
        } catch {
            // Silent fail
        }
    }

    private async logABTestAssignment(instructionId: string, variant: 'a' | 'b'): Promise<void> {
        console.debug(`[SelfLearning] A/B test: assigned variant ${variant} for instruction ${instructionId}`);
    }

    // ==========================================
    // ML-004: Reward Model (Response Quality Scoring)
    // ==========================================

    /**
     * Calculate reward score for a response
     * Combines multiple quality signals into a single score
     */
    calculateRewardScore(params: {
        userMessage: string;
        aiResponse: string;
        intent: string;
        latencyMs: number;
        hasCards: boolean;
        hasActions: boolean;
    }): number {
        let score = 0.5; // Base score

        const { userMessage, aiResponse, intent, latencyMs, hasCards, hasActions } = params;

        // 1. Length appropriateness (+/- 0.1)
        const idealLength = this.getIdealLength(intent);
        const lengthDiff = Math.abs(aiResponse.length - idealLength);
        score += Math.max(-0.1, 0.1 - (lengthDiff / idealLength) * 0.2);

        // 2. Latency penalty (0 to -0.15)
        if (latencyMs > 5000) score -= 0.15;
        else if (latencyMs > 3000) score -= 0.1;
        else if (latencyMs > 2000) score -= 0.05;

        // 3. Rich response bonus (+0.1)
        if (hasCards || hasActions) score += 0.1;

        // 4. Question answering (+0.1)
        const isQuestion = /[?]|как|что|почему|когда|сколько/i.test(userMessage);
        const hasNumbers = /\d+/.test(aiResponse);
        if (isQuestion && hasNumbers) score += 0.1;

        // 5. Empathy detection (+0.1)
        const needsEmpathy = /устал|трудно|сложно|не могу|болит/i.test(userMessage);
        const hasEmpathy = /понимаю|поддерж|помогу|давай вместе/i.test(aiResponse);
        if (needsEmpathy && hasEmpathy) score += 0.1;

        // 6. Penalty for generic responses (-0.1)
        const genericPhrases = ['не знаю', 'попробуйте', 'возможно', 'наверное'];
        const isGeneric = genericPhrases.some(p => aiResponse.toLowerCase().includes(p));
        if (isGeneric) score -= 0.1;

        // Clamp to 0-1
        return Math.max(0, Math.min(1, score));
    }

    private getIdealLength(intent: string): number {
        // Target response lengths by intent type
        const lengthMap: Record<string, number> = {
            'greeting': 100,
            'help': 300,
            'plan.today': 400,
            'plan.week': 600,
            'stats.show': 300,
            'motivation': 200,
            'unknown': 250,
        };
        return lengthMap[intent] || 250;
    }

    /**
     * Get average reward score for recent interactions
     */
    async getAverageRewardScore(): Promise<number> {
        try {
            const interactions = await this.prisma.aIInteraction.findMany({
                where: { profileId: this.profileId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                select: { metadata: true }
            });

            const scores = interactions
                .map(i => {
                    const meta = JSON.parse((i as any).metadata || '{}');
                    return meta.rewardScore || 0.5;
                })
                .filter(s => s > 0);

            if (scores.length === 0) return 0.5;
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        } catch {
            return 0.5;
        }
    }

    // ==========================================
    // ADAPT-004: Time Pattern Learning
    // ==========================================

    /**
     * Track user activity time for pattern learning
     */
    async trackActivityTime(): Promise<void> {
        try {
            const now = new Date();
            const hour = now.getHours();
            const dayOfWeek = now.getDay(); // 0 = Sunday

            const profile = await this.getOrCreateUserLearningProfile();
            const patterns = (profile as any).patterns ? JSON.parse((profile as any).patterns) : {
                activeHours: Array(24).fill(0),
                activeDays: Array(7).fill(0),
                avgSessionLength: 0,
                avgMessagesPerSession: 0,
                totalSessions: 0,
                lastActivityAt: null,
            };

            // Increment activity counters
            patterns.activeHours[hour] = (patterns.activeHours[hour] || 0) + 1;
            patterns.activeDays[dayOfWeek] = (patterns.activeDays[dayOfWeek] || 0) + 1;
            patterns.lastActivityAt = now.toISOString();

            await this.prisma.aIUserLearningProfile.update({
                where: { profileId: this.profileId },
                data: {
                    patterns: JSON.stringify(patterns),
                    lastUpdated: now,
                }
            });
        } catch (err) {
            console.debug('[SelfLearning] Activity tracking failed:', (err as Error).message);
        }
    }

    /**
     * Get user's most active hours
     */
    async getMostActiveHours(): Promise<number[]> {
        try {
            const profile = await this.prisma.aIUserLearningProfile.findUnique({
                where: { profileId: this.profileId }
            });

            if (!profile) return [];

            const patterns = JSON.parse((profile as any).patterns || '{}');
            const hours = patterns.activeHours || [];

            // Find top 3 most active hours
            return hours
                .map((count: number, hour: number) => ({ hour, count }))
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 3)
                .map((h: any) => h.hour);
        } catch {
            return [];
        }
    }

    /**
     * Check if current time is user's typical active time
     */
    async isTypicalActiveTime(): Promise<boolean> {
        const activeHours = await this.getMostActiveHours();
        const currentHour = new Date().getHours();
        return activeHours.includes(currentHour);
    }

    /**
     * Get time-based greeting based on patterns
     */
    async getTimeBasedGreeting(): Promise<string> {
        const hour = new Date().getHours();
        const isTypical = await this.isTypicalActiveTime();

        if (hour >= 5 && hour < 12) {
            return isTypical ? 'Доброе утро! Рад видеть тебя как обычно.' : 'Доброе утро! Рано сегодня!';
        } else if (hour >= 12 && hour < 18) {
            return isTypical ? 'Привет! Как обычно в это время.' : 'Привет! Обеденный перерыв?';
        } else if (hour >= 18 && hour < 23) {
            return isTypical ? 'Добрый вечер! Ты как по расписанию.' : 'Добрый вечер! Вечерняя тренировка?';
        } else {
            return isTypical ? 'Привет, ночная сова!' : 'Поздновато! Всё хорошо?';
        }
    }

    // ==========================================
    // ADAPT-005: Emotional Pattern Recognition
    // ==========================================

    /**
     * Detect emotional state from message
     */
    detectEmotionalState(message: string): {
        state: 'positive' | 'negative' | 'neutral' | 'frustrated' | 'excited' | 'tired';
        confidence: number;
    } {
        const lowered = message.toLowerCase();

        // Positive indicators
        const positiveWords = ['отлично', 'супер', 'класс', 'круто', 'да!', '💪', '🔥', 'молодец', 'получилось'];
        const positiveScore = positiveWords.filter(w => lowered.includes(w)).length;

        // Negative indicators
        const negativeWords = ['плохо', 'ужас', 'не могу', 'устал', 'надоело', 'отстой'];
        const negativeScore = negativeWords.filter(w => lowered.includes(w)).length;

        // Frustrated indicators
        const frustratedWords = ['блин', 'черт', 'опять', 'снова не', 'почему не'];
        const frustratedScore = frustratedWords.filter(w => lowered.includes(w)).length;

        // Excited indicators
        const excitedWords = ['ура', 'вау', 'наконец', 'рекорд', '!!!', 'победа'];
        const excitedScore = excitedWords.filter(w => lowered.includes(w)).length;

        // Tired indicators
        const tiredWords = ['устал', 'сил нет', 'вымотан', 'засыпаю', 'тяжело'];
        const tiredScore = tiredWords.filter(w => lowered.includes(w)).length;

        // Determine dominant state
        const scores = [
            { state: 'positive' as const, score: positiveScore },
            { state: 'negative' as const, score: negativeScore },
            { state: 'frustrated' as const, score: frustratedScore },
            { state: 'excited' as const, score: excitedScore },
            { state: 'tired' as const, score: tiredScore },
        ];

        const maxScore = Math.max(...scores.map(s => s.score));
        if (maxScore === 0) {
            return { state: 'neutral', confidence: 0.5 };
        }

        const winner = scores.find(s => s.score === maxScore)!;
        return {
            state: winner.state,
            confidence: Math.min(1, 0.5 + maxScore * 0.15)
        };
    }

    /**
     * Get emotional support hint for prompt
     */
    async getEmotionalSupportHint(message: string): Promise<string> {
        const { state, confidence } = this.detectEmotionalState(message);

        if (confidence < 0.6) return '';

        switch (state) {
            case 'frustrated':
                return 'Пользователь выглядит расстроенным. Будь особенно поддерживающим и предложи помощь.';
            case 'tired':
                return 'Пользователь устал. Предложи облегчённый вариант или отдых.';
            case 'excited':
                return 'Пользователь в отличном настроении! Поддержи энтузиазм.';
            case 'negative':
                return 'Пользователь в негативном настроении. Будь мягким и понимающим.';
            default:
                return '';
        }
    }

    // ==========================================
    // ML-003: Preference Learning
    // ==========================================

    /**
     * Learn user preferences from interaction history
     * Builds a preference model based on positive/negative feedback
     */
    async learnPreferences(): Promise<{
        preferredTopics: string[];
        preferredStyle: string;
        preferredTimeOfDay: string;
        confidenceLevel: number;
    }> {
        try {
            // Get recent interactions with ratings
            const interactions = await this.prisma.aIInteraction.findMany({
                where: { profileId: this.profileId },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });

            if (interactions.length < 10) {
                return {
                    preferredTopics: [],
                    preferredStyle: 'balanced',
                    preferredTimeOfDay: 'any',
                    confidenceLevel: 0.3,
                };
            }

            // Analyze positive interactions
            const positive = interactions.filter(i => i.rating === 'positive');
            const negative = interactions.filter(i => i.rating === 'negative');

            // Topic preferences
            const topicCounts: Record<string, { positive: number; negative: number }> = {};
            for (const i of interactions) {
                const topics = this.extractTopics(i.userMessage);
                for (const topic of topics) {
                    if (!topicCounts[topic]) topicCounts[topic] = { positive: 0, negative: 0 };
                    if (i.rating === 'positive') topicCounts[topic].positive++;
                    if (i.rating === 'negative') topicCounts[topic].negative++;
                }
            }

            const preferredTopics = Object.entries(topicCounts)
                .filter(([_, counts]) => counts.positive > counts.negative * 2)
                .map(([topic]) => topic);

            // Style preference (short vs long)
            const avgPositiveLength = positive.length > 0
                ? positive.reduce((sum, i) => sum + i.aiResponse.length, 0) / positive.length
                : 250;

            const preferredStyle = avgPositiveLength < 150 ? 'concise'
                : avgPositiveLength > 500 ? 'detailed' : 'balanced';

            // Time of day preference
            const hourCounts = Array(24).fill(0);
            for (const i of positive) {
                const hour = new Date(i.createdAt).getHours();
                hourCounts[hour]++;
            }
            const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
            const preferredTimeOfDay = peakHour < 12 ? 'morning'
                : peakHour < 18 ? 'afternoon' : 'evening';

            const confidenceLevel = Math.min(1, 0.3 + (positive.length / 50) * 0.7);

            return {
                preferredTopics,
                preferredStyle,
                preferredTimeOfDay,
                confidenceLevel,
            };
        } catch {
            return {
                preferredTopics: [],
                preferredStyle: 'balanced',
                preferredTimeOfDay: 'any',
                confidenceLevel: 0.3,
            };
        }
    }

    /**
     * Get preference-based prompt additions
     */
    async getPreferenceHints(): Promise<string> {
        const prefs = await this.learnPreferences();

        if (prefs.confidenceLevel < 0.5) return '';

        const hints: string[] = [];

        if (prefs.preferredStyle === 'concise') {
            hints.push('Пользователь предпочитает короткие ответы.');
        } else if (prefs.preferredStyle === 'detailed') {
            hints.push('Пользователь любит подробные объяснения.');
        }

        if (prefs.preferredTopics.length > 0) {
            hints.push(`Интересуется: ${prefs.preferredTopics.join(', ')}.`);
        }

        return hints.length > 0 ? `\n## ПРЕДПОЧТЕНИЯ\n${hints.join(' ')}` : '';
    }

    /**
     * Store learned preferences in profile
     */
    async storePreferences(): Promise<void> {
        try {
            const prefs = await this.learnPreferences();

            await this.prisma.aIUserLearningProfile.update({
                where: { profileId: this.profileId },
                data: {
                    communicationStyle: JSON.stringify({
                        preferredLength: prefs.preferredStyle,
                        formalityLevel: 0.5,
                        humorAppreciation: 0.5,
                        emojiUsage: 0.5,
                        technicalLevel: 0.5,
                    }),
                    lastUpdated: new Date(),
                }
            });
        } catch {
            // Profile may not exist yet
        }
    }

    // ==========================================
    // SELF-004: Automatic Instruction Deprecation
    // ==========================================

    /**
     * Automatically deprecate instructions that are underperforming
     */
    async autoDeprecateInstructions(): Promise<{ deprecated: number; kept: number }> {
        try {
            const instructions = await this.prisma.aILearnedInstruction.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { profileId: this.profileId },
                        { profileId: null }
                    ]
                }
            });

            let deprecated = 0;
            let kept = 0;

            for (const inst of instructions) {
                const shouldDeprecate = this.shouldDeprecateInstruction(inst);

                if (shouldDeprecate) {
                    await this.prisma.aILearnedInstruction.update({
                        where: { id: inst.id },
                        data: {
                            isActive: false,
                            updatedAt: new Date(),
                        }
                    });
                    deprecated++;
                    console.log(`[SelfLearning] Deprecated instruction: ${inst.id} (${inst.content.slice(0, 50)}...)`);
                } else {
                    kept++;
                }
            }

            return { deprecated, kept };
        } catch (err) {
            console.warn('[SelfLearning] Auto-deprecation failed:', (err as Error).message);
            return { deprecated: 0, kept: 0 };
        }
    }

    /**
     * Determine if an instruction should be deprecated
     */
    private shouldDeprecateInstruction(instruction: any): boolean {
        // Deprecate if:
        // 1. Confidence below threshold
        if (instruction.confidence < CONFIG.INSTRUCTION_DEPRECATION_THRESHOLD) {
            return true;
        }

        // 2. Success rate too low after many uses
        if (instruction.usageCount > 10 && instruction.successRate < 0.3) {
            return true;
        }

        // 3. Not used in 30+ days and low usage count
        const daysSinceUpdate = (Date.now() - new Date(instruction.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 30 && instruction.usageCount < 5) {
            return true;
        }

        return false;
    }

    /**
     * Get deprecation report
     */
    async getDeprecationReport(): Promise<{
        activeCount: number;
        deprecatedCount: number;
        atRiskCount: number;
        atRiskInstructions: Array<{ id: string; content: string; reason: string }>;
    }> {
        try {
            const all = await this.prisma.aILearnedInstruction.findMany({
                where: {
                    OR: [
                        { profileId: this.profileId },
                        { profileId: null }
                    ]
                }
            });

            const active = all.filter(i => i.isActive);
            const deprecated = all.filter(i => !i.isActive);
            const atRisk = active.filter(i => {
                const daysSinceUpdate = (Date.now() - new Date(i.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                return i.confidence < 0.5 || (daysSinceUpdate > 14 && i.usageCount < 3);
            });

            return {
                activeCount: active.length,
                deprecatedCount: deprecated.length,
                atRiskCount: atRisk.length,
                atRiskInstructions: atRisk.slice(0, 5).map(i => ({
                    id: i.id,
                    content: i.content.slice(0, 100),
                    reason: i.confidence < 0.5 ? 'low_confidence' : 'low_usage',
                })),
            };
        } catch {
            return {
                activeCount: 0,
                deprecatedCount: 0,
                atRiskCount: 0,
                atRiskInstructions: [],
            };
        }
    }
}

// ==========================================
// Helper Types
// ==========================================

type FailureCategory =
    | 'factual_error'
    | 'length_issue'
    | 'tone_issue'
    | 'missed_intent'
    | 'too_verbose'
    | 'too_brief'
    | 'off_topic'
    | 'unknown';

interface FailureAnalysis {
    category: FailureCategory;
    confidence: number;
    userMessage: string;
    aiResponse: string;
    comment?: string;
    timestamp: Date;
}

interface PatternAnalysis {
    type: string;
    category: LearnedInstruction['category'];
    instructionText: string;
    confidence: number;
    sampleSize: number;
}

// ==========================================
// Factory function
// ==========================================

export function createSelfLearningEngine(
    prisma: PrismaClient,
    profileId: string
): AiSelfLearningEngine {
    return new AiSelfLearningEngine(prisma, profileId);
}
