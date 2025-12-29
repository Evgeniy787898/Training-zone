// TZONA V2 - Natural Language Understanding Service
// Ported from V1 nlu.js - FULL VERSION
const INTENT_PATTERNS = [
    {
        intent: 'plan.today',
        keywords: [/план/i, /сегодня/i],
        priority: 90,
    },
    {
        intent: 'plan.week',
        keywords: [/план/i, /(недел|распис)/i],
        priority: 80,
    },
    {
        intent: 'report.start',
        keywords: [/(отч[её]т|завершил|закончил)/i],
        priority: 70,
    },
    {
        intent: 'stats.show',
        keywords: [/(прогресс|статистик|аналит)/i],
        priority: 70,
    },
    {
        intent: 'settings.open',
        keywords: [/настройк/i, /(уведомлен|напоминан)/i],
        priority: 60,
    },
    {
        intent: 'plan.setup',
        keywords: [/(настро|обнови|подстрои)/i, /(план|цель|оборуд)/i],
        priority: 65,
    },
    {
        intent: 'schedule.reschedule',
        keywords: [/(перенес|перестав|завтра|позже)/i],
        priority: 90,
    },
    {
        intent: 'recovery.mode',
        keywords: [/(болит|травм|простыл|устал)/i],
        priority: 80,
    },
    {
        intent: 'remind.later',
        keywords: [/напомни/i, /(через|позже)/i],
        priority: 75,
    },
    {
        intent: 'motivation',
        keywords: [/(мотивац|поддерж)/i],
        priority: 40,
    },
    {
        intent: 'help',
        keywords: [/помощь/i, /что ты умеешь/i],
        priority: 30,
    },
    {
        intent: 'note.save',
        keywords: [/(сохрани|заметк|запиши)/i],
        priority: 85,
    },
    {
        intent: 'triggers.help',
        keywords: [/(триггер|ключев|как сохранять|что написать)/i],
        priority: 35,
    },
    // NLU-001: Body metrics intent (weight, measurements)
    {
        intent: 'body.metrics',
        keywords: [/(вес|масс|обхват|замер|измерен)/i],
        priority: 75,
    },
    {
        intent: 'body.weight',
        keywords: [/вес/i, /(сколько|как|мой)/i],
        priority: 78,
    },
    {
        intent: 'body.update',
        keywords: [/(запиши|обнови|изменил)/i, /(вес|обхват|замер)/i],
        priority: 82,
    },
    // NEW-013: Mood detection intent
    {
        intent: 'mood.check',
        keywords: [/(настроение|чувств|эмоц|как ты|как дела)/i],
        priority: 45,
    },
    {
        intent: 'mood.low',
        keywords: [/(грустн|устал|лень|не хочу|плох|тяжело|депресс)/i],
        priority: 70,
    },
    {
        intent: 'mood.high',
        keywords: [/(отличн|супер|круто|заряжен|мотивирован|энерги)/i],
        priority: 55,
    },
];

const REMIND_LATER_PATTERNS = [
    { regex: /(через)\s+(\d{1,2})\s*(?:час|ч)/i, unit: 'hours' },
    { regex: /(через)\s+(\d{1,2})\s*(?:минут|мин)/i, unit: 'minutes' },
    { regex: /(в|к)\s+(\d{1,2})[:.](\d{2})/i, unit: 'clock' },
];

function matchIntent(text: string) {
    const matches: Array<{ intent: string; priority: number }> = [];

    for (const pattern of INTENT_PATTERNS) {
        const matched = pattern.keywords.every(regex => regex.test(text));
        if (matched) {
            matches.push({ intent: pattern.intent, priority: pattern.priority });
        }
    }

    if (matches.length === 0) {
        return { intent: 'unknown', confidence: 0, candidates: [] };
    }

    matches.sort((a, b) => b.priority - a.priority);
    const best = matches[0];
    const confidence = Math.min(1, best.priority / 100);

    const candidates = matches.map(match => ({
        intent: match.intent,
        confidence: Math.min(1, match.priority / 100),
    }));

    return { intent: best.intent, confidence, candidates };
}

function extractRemindLater(text: string): any {
    for (const pattern of REMIND_LATER_PATTERNS) {
        const match = pattern.regex.exec(text);
        if (!match) {
            continue;
        }

        if (pattern.unit === 'clock') {
            const hours = parseInt(match[2], 10);
            const minutes = parseInt(match[3], 10);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                continue;
            }
            return { unit: 'clock', hours, minutes };
        }

        const value = parseInt(match[2], 10);
        if (Number.isNaN(value)) {
            continue;
        }

        return { unit: pattern.unit, value };
    }

    return null;
}

// NLU-004: Confidence threshold configuration
export const NLU_CONFIG = {
    MIN_CONFIDENCE: 0.6,  // Minimum confidence to use detected intent
    HIGH_CONFIDENCE: 0.8, // High confidence threshold
};

export interface IntentResult {
    intent: string;
    confidence: number;
    isConfident: boolean;      // NLU-004: Whether confidence meets threshold
    isHighConfidence: boolean; // NLU-004: High confidence flag
    entities: Record<string, unknown>;
    candidates: Array<{ intent: string; confidence: number }>;
}

/**
 * Extract body metrics entities (NLU-001)
 */
function extractBodyEntities(text: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    // Weight extraction: "вес 75", "75 кг", "вешу 75"
    const weightMatch = text.match(/(?:вес|вешу|масса)?\s*(\d{2,3}(?:[.,]\d)?)\s*(?:кг|кило)?/i);
    if (weightMatch) {
        entities.weight = parseFloat(weightMatch[1].replace(',', '.'));
    }

    // Measurement type: biceps, waist, chest, etc.
    const measurementTypes: Record<string, RegExp> = {
        biceps: /бицепс|рук[аи]/i,
        waist: /тали[яю]|живот/i,
        chest: /грудь|груди/i,
        hips: /бедр[аоы]/i,
        neck: /ше[яю]/i,
        thigh: /бедр[оа]|ног[аи]/i,
    };

    for (const [type, pattern] of Object.entries(measurementTypes)) {
        if (pattern.test(text)) {
            entities.measurementType = type;
            break;
        }
    }

    // Measurement value: "обхват 40 см"
    const measureMatch = text.match(/(\d{2,3})\s*(?:см|сантиметр)/i);
    if (measureMatch) {
        entities.measurementValue = parseInt(measureMatch[1], 10);
    }

    return entities;
}

/**
 * Extract mood entities (NEW-013)
 */
function extractMoodEntities(text: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    // Mood level detection
    const moodPatterns: Array<{ level: number; pattern: RegExp }> = [
        { level: 1, pattern: /ужасн|депресс|плох|отвратительн/i },
        { level: 2, pattern: /грустн|устал|вымотан|лень|не хочу/i },
        { level: 3, pattern: /нормальн|так себе|средн|ничего/i },
        { level: 4, pattern: /хорош|неплох|готов|настро/i },
        { level: 5, pattern: /отличн|супер|замечательн|заряжен|мотивирован|огонь/i },
    ];

    for (const { level, pattern } of moodPatterns) {
        if (pattern.test(text)) {
            entities.moodLevel = level;
            entities.moodCategory = level <= 2 ? 'low' : level >= 4 ? 'high' : 'neutral';
            break;
        }
    }

    // Energy level
    if (/энерги|сил|бодр/i.test(text)) {
        entities.hasEnergyMention = true;
    }

    // Sleep mention
    if (/сп[ал]|выспал|не выспал|сон/i.test(text)) {
        entities.hasSleepMention = true;
        entities.sleptWell = /выспал|хорошо спал/i.test(text);
    }

    return entities;
}

export function detectIntent(text: string): IntentResult {
    if (!text || typeof text !== 'string') {
        return {
            intent: 'unknown',
            confidence: 0,
            isConfident: false,
            isHighConfidence: false,
            entities: {},
            candidates: [],
        };
    }

    const normalized = text.trim().toLowerCase();
    const base = matchIntent(normalized);
    let entities: Record<string, unknown> = {};

    // Extract entities based on intent type
    if (base.intent === 'remind.later') {
        const reminder = extractRemindLater(normalized);
        if (reminder) {
            entities.reminder = reminder;
        }
    }

    if (base.intent === 'schedule.reschedule') {
        const tomorrowMatch = /(завтра|tomorrow)/i.test(text);
        if (tomorrowMatch) {
            entities.preferredShiftDays = 1;
        }
        const dayMatch = /(пятниц|суббот|воскресень|будущ)/i.exec(text);
        if (dayMatch) {
            entities.preferredDay = dayMatch[0];
        }
    }

    // NLU-001: Body metrics entity extraction
    if (base.intent.startsWith('body.')) {
        entities = { ...entities, ...extractBodyEntities(normalized) };
    }

    // NEW-013: Mood entity extraction
    if (base.intent.startsWith('mood.')) {
        entities = { ...entities, ...extractMoodEntities(normalized) };
    }

    // NLU-004: Apply confidence threshold
    const isConfident = base.confidence >= NLU_CONFIG.MIN_CONFIDENCE;
    const isHighConfidence = base.confidence >= NLU_CONFIG.HIGH_CONFIDENCE;

    // If not confident enough, fallback to 'general' intent but keep candidates
    const effectiveIntent = isConfident ? base.intent : 'general';

    return {
        intent: effectiveIntent,
        confidence: base.confidence,
        isConfident,
        isHighConfidence,
        entities,
        candidates: base.candidates || [],
    };
}

/**
 * Update confidence thresholds at runtime
 */
export function setConfidenceThresholds(min?: number, high?: number): void {
    if (min !== undefined && min >= 0 && min <= 1) {
        NLU_CONFIG.MIN_CONFIDENCE = min;
    }
    if (high !== undefined && high >= 0 && high <= 1) {
        NLU_CONFIG.HIGH_CONFIDENCE = high;
    }
}

export default { detectIntent, NLU_CONFIG, setConfidenceThresholds };

