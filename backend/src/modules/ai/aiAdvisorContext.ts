import { aiAdvisorContextConfig } from '../../config/constants.js';
import type { AiAdvisorContextEntry } from '../../types/aiAdvisor.js';
import { DatabaseService } from '../integrations/supabase.js';

export interface AiAdvisorContextInput {
    exerciseKey: string;
    currentLevel: string;
    goals?: string[];
    performance?: Record<string, unknown>;
    advice: string;
    nextSteps?: string[];
    tips?: string[];
    createdAt?: string;
}

const CONTEXT_STATE_KEY = 'ai_advisor_context';
const TEXT_LIMITS = {
    exerciseKey: 64,
    currentLevel: 48,
    advice: 480,
    step: 200,
    tip: 160,
    goal: 64,
};
const MAX_LIST_ITEMS = {
    goals: 8,
    nextSteps: 4,
    tips: 4,
};
const PERFORMANCE_LIMIT = 8;
const PERFORMANCE_VALUE_LIMIT = 80;
const PERFORMANCE_KEY_LIMIT = 32;

export class AiAdvisorContextService {
    constructor(private readonly db: DatabaseService) { }

    async loadContext(profileId: string | null | undefined): Promise<AiAdvisorContextEntry[]> {
        if (!profileId) {
            return [];
        }

        try {
            const state = await this.db.getDialogState(profileId, CONTEXT_STATE_KEY);
            const payload = (state?.statePayload as Record<string, unknown>) || {};
            const entries = Array.isArray(payload.entries) ? payload.entries : [];
            return entries
                .map((entry) => this.normalizeEntry(entry))
                .filter((entry): entry is AiAdvisorContextEntry => Boolean(entry));
        } catch (error) {
            console.error('Failed to load AI advisor context:', error);
            return [];
        }
    }

    async recordInteraction(profileId: string | null | undefined, input: AiAdvisorContextInput): Promise<void> {
        if (!profileId) {
            return;
        }

        const normalized = this.normalizeEntry(input);
        if (!normalized) {
            return;
        }

        const existing = await this.loadContext(profileId);
        const nextEntries = [...existing, normalized].slice(-aiAdvisorContextConfig.maxEntries);
        await this.db.saveDialogState(
            profileId,
            CONTEXT_STATE_KEY,
            { entries: nextEntries },
            new Date(Date.now() + aiAdvisorContextConfig.ttlMs),
        );
    }

    private normalizeEntry(raw: any): AiAdvisorContextEntry | null {
        const exerciseKey = sanitizeText(raw?.exerciseKey, TEXT_LIMITS.exerciseKey);
        const currentLevel = sanitizeText(raw?.currentLevel, TEXT_LIMITS.currentLevel);
        const advice = sanitizeText(raw?.advice, TEXT_LIMITS.advice);

        if (!exerciseKey || !currentLevel || !advice) {
            return null;
        }

        const goals = sanitizeList(raw?.goals, MAX_LIST_ITEMS.goals, TEXT_LIMITS.goal);
        const nextSteps = sanitizeList(raw?.nextSteps, MAX_LIST_ITEMS.nextSteps, TEXT_LIMITS.step);
        const tips = sanitizeList(raw?.tips, MAX_LIST_ITEMS.tips, TEXT_LIMITS.tip);
        const createdAt = sanitizeText(raw?.createdAt, 64) || new Date().toISOString();
        const performance = this.sanitizePerformance(raw?.performance);

        return {
            exerciseKey,
            currentLevel,
            advice,
            goals,
            nextSteps,
            tips,
            createdAt,
            performance,
        };
    }

    private sanitizePerformance(value: any): Record<string, string> {
        if (!value || typeof value !== 'object') {
            return {};
        }

        const entries: [string, string][] = [];
        for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
            const normalizedKey = sanitizeText(key, PERFORMANCE_KEY_LIMIT);
            if (!normalizedKey) {
                continue;
            }
            const normalizedValue = sanitizeText(this.describePerformanceValue(entryValue), PERFORMANCE_VALUE_LIMIT);
            if (!normalizedValue) {
                continue;
            }
            entries.push([normalizedKey, normalizedValue]);
            if (entries.length >= PERFORMANCE_LIMIT) {
                break;
            }
        }

        return Object.fromEntries(entries);
    }

    private describePerformanceValue(value: unknown): string {
        if (value === null || typeof value === 'undefined') {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value
                .map((item) => this.describePerformanceValue(item))
                .filter((entry) => Boolean(entry))
                .join(', ');
        }
        if (typeof value === 'object') {
            return Object.entries(value as Record<string, unknown>)
                .slice(0, 3)
                .map(([key, nestedValue]) => `${key}: ${this.describePerformanceValue(nestedValue)}`)
                .join('; ');
        }
        return String(value);
    }
}

const sanitizeText = (value: unknown, limit: number): string => {
    if (typeof value === 'undefined' || value === null) {
        return '';
    }
    const normalized = String(value).trim();
    if (!normalized) {
        return '';
    }
    if (normalized.length <= limit) {
        return normalized;
    }
    return normalized.slice(0, limit);
};

const sanitizeList = (value: unknown, maxItems: number, limit: number): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const entries: string[] = [];
    for (const item of value) {
        const normalized = sanitizeText(item, limit);
        if (normalized) {
            entries.push(normalized);
        }
        if (entries.length >= maxItems) {
            break;
        }
    }
    return entries;
};
