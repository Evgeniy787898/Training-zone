import type { AssistantAdviceResponse } from '../../types/apiResponses.js';
import type { AiAdvisorContextEntry } from '../../types/aiAdvisor.js';
import type { AiAdviceRequest } from './aiAdvisorGateway.js';

export type AiAdvisorFallbackReason =
    | 'microservice_unavailable'
    | 'microservice_timeout'
    | 'microservice_error'
    | 'provider_error'
    | 'unknown';

export interface AiAdvisorFallbackOptions {
    reason?: AiAdvisorFallbackReason;
    metadata?: Record<string, unknown>;
}

const DEFAULT_TIPS = [
    'Следите за дыханием и контролируйте амплитуду.',
    'Записывайте ощущения после тренировки, чтобы отслеживать прогресс.',
    'Уделите внимание разминке и восстановлению между подходами.',
];

const DEFAULT_NEXT_STEPS = [
    'Сфокусируйтесь на технике выполнения и зафиксируйте результаты в приложении.',
    'Сохраните текущий уровень ещё 1–2 тренировки, прежде чем увеличивать нагрузку.',
];

const uniqueNonEmpty = (values: (string | null | undefined)[]): string[] => {
    const seen = new Set<string>();
    for (const value of values) {
        if (!value) {
            continue;
        }
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) {
            continue;
        }
        seen.add(trimmed);
    }
    return Array.from(seen);
};

const pickLatestContext = (entries?: AiAdvisorContextEntry[] | null): AiAdvisorContextEntry | null => {
    if (!entries?.length) {
        return null;
    }
    return entries[entries.length - 1];
};

const describeGoals = (goals?: string[] | null): string | null => {
    if (!Array.isArray(goals) || !goals.length) {
        return null;
    }
    const trimmed = goals.map((goal) => goal?.trim()).filter(Boolean) as string[];
    if (!trimmed.length) {
        return null;
    }
    if (trimmed.length === 1) {
        return trimmed[0];
    }
    return `${trimmed[0]} и ещё ${trimmed.length - 1} цель(и)`;
};

const describePerformance = (performance?: Record<string, unknown> | null): string | null => {
    if (!performance) {
        return null;
    }
    const entries = Object.entries(performance)
        .map(([key, value]) => ({ key: key.trim(), value: String(value ?? '').trim() }))
        .filter((entry) => entry.key && entry.value);
    if (!entries.length) {
        return null;
    }
    const top = entries.slice(0, 2).map(({ key, value }) => `${key}: ${value}`);
    return top.join(', ');
};

export const buildFallbackAdvice = (
    request: Pick<AiAdviceRequest, 'exerciseKey' | 'currentLevel' | 'goals' | 'performance' | 'context'>,
    options: AiAdvisorFallbackOptions = {},
): AssistantAdviceResponse => {
    const contextEntries = (request.context ?? []).map((entry) => ({
        ...entry,
        goals: entry.goals ?? [],
        nextSteps: entry.nextSteps ?? [],
        tips: entry.tips ?? [],
        performance: entry.performance ?? {},
    }));
    const latest = pickLatestContext(contextEntries);
    const goalDescription = describeGoals(request.goals);
    const performanceSummary = describePerformance(request.performance as Record<string, unknown>);

    const adviceSegments: string[] = [
        `Продолжайте прорабатывать ${request.exerciseKey} на уровне ${request.currentLevel}, удерживая ровную технику и ритм.`,
    ];
    if (latest?.advice) {
        adviceSegments.push(`Учтите последний совет: «${latest.advice}».`);
    }
    if (goalDescription) {
        adviceSegments.push(`Главная цель сейчас — ${goalDescription}.`);
    }
    if (performanceSummary) {
        adviceSegments.push(`Ориентируйтесь на последние показатели (${performanceSummary}).`);
    }

    const nextSteps = uniqueNonEmpty([
        ...(latest?.nextSteps ?? []),
        DEFAULT_NEXT_STEPS[0],
        DEFAULT_NEXT_STEPS[1],
    ]);
    const tips = uniqueNonEmpty([...(latest?.tips ?? []), ...DEFAULT_TIPS]);

    return {
        advice: adviceSegments.join(' '),
        nextSteps: nextSteps.length ? nextSteps : DEFAULT_NEXT_STEPS,
        tips: tips.length ? tips : DEFAULT_TIPS,
        metadata: {
            status: 'fallback',
            reason: options.reason ?? 'unknown',
            ...(options.metadata ?? {}),
        },
    };
};
