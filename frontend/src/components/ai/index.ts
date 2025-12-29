// AI Card Components
export { default as AiStatsCard } from './AiStatsCard.vue';
export { default as AiProgressCard } from './AiProgressCard.vue';
export { default as AiExerciseCard } from './AiExerciseCard.vue';
export { default as AiActionButton } from './AiActionButton.vue';
export { default as AiChartCard } from './AiChartCard.vue';
export { default as AiTableCard } from './AiTableCard.vue';

// AI Settings & Voice Components
export { default as AiInstructionsEditor } from './AiInstructionsEditor.vue';
export { default as VoiceConversationMode } from './VoiceConversationMode.vue';
export { default as AiLearningStatus } from './AiLearningStatus.vue';

// Types
export interface AIResponse {
    reply: string;
    reaction?: string;
    mood?: 'excited' | 'calm' | 'concerned' | 'proud' | 'playful';
    cards?: AICard[];
    actions?: AIAction[];
}

export interface AICard {
    type: 'stats' | 'progress' | 'exercise' | 'chart' | 'table';
    title?: string;
    icon?: string;
    data: Record<string, any>;
}

export interface AIAction {
    label: string;
    icon?: string;
    action: 'navigate' | 'startWorkout' | 'openExercise' | 'custom';
    target?: string;
}

/**
 * Parse AI response - tries JSON first, falls back to plain text
 */
export function parseAIResponse(raw: string): AIResponse {
    // Try to extract JSON from markdown code block
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.reply) return parsed;
        } catch { }
    }

    // Try direct JSON parse
    try {
        const parsed = JSON.parse(raw);
        if (parsed.reply) return parsed;
    } catch { }

    // Fallback: plain text
    return { reply: raw };
}
