/**
 * AI Function Calling Definitions (BE-005/BE-006)
 * OpenAI-compatible function/tool definitions for structured data extraction
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Tool definitions for OpenAI function calling
 * These enable structured data extraction from AI responses
 */
export const AI_TOOLS: ChatCompletionTool[] = [
    // Tool 1: Show statistics card
    {
        type: 'function',
        function: {
            name: 'show_stats_card',
            description: 'Показать карточку со статистикой тренировок пользователя (количество тренировок, серия, пропуски и т.д.)',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Заголовок карточки, например "Статистика за неделю"',
                    },
                    stats: {
                        type: 'array',
                        description: 'Массив статистических показателей',
                        items: {
                            type: 'object',
                            properties: {
                                value: { type: ['number', 'string'], description: 'Значение показателя' },
                                label: { type: 'string', description: 'Название показателя' },
                                icon: { type: 'string', description: 'Эмодзи иконка' },
                                trend: { type: 'string', enum: ['up', 'down', 'neutral'], description: 'Тренд' },
                            },
                            required: ['value', 'label'],
                        },
                    },
                    period: {
                        type: 'string',
                        enum: ['day', 'week', 'month', 'year', 'all'],
                        description: 'Период статистики',
                    },
                },
                required: ['title', 'stats'],
            },
        },
    },

    // Tool 2: Show chart
    {
        type: 'function',
        function: {
            name: 'show_chart',
            description: 'Показать график прогресса или данных (столбчатый, линейный и т.д.)',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Заголовок графика' },
                    chartType: {
                        type: 'string',
                        enum: ['bar', 'line', 'pie', 'area'],
                        description: 'Тип графика',
                    },
                    data: {
                        type: 'array',
                        description: 'Данные для графика',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string', description: 'Метка точки данных' },
                                value: { type: 'number', description: 'Значение' },
                                color: { type: 'string', description: 'Цвет (опционально)' },
                            },
                            required: ['label', 'value'],
                        },
                    },
                    xLabel: { type: 'string', description: 'Подпись оси X' },
                    yLabel: { type: 'string', description: 'Подпись оси Y' },
                },
                required: ['title', 'chartType', 'data'],
            },
        },
    },

    // Tool 3: Show exercise info
    {
        type: 'function',
        function: {
            name: 'show_exercise_info',
            description: 'Показать информацию об упражнении (техника, советы, ошибки)',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Название упражнения' },
                    technique: { type: 'string', description: 'Описание техники выполнения' },
                    tips: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Советы по выполнению',
                    },
                    commonMistakes: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Типичные ошибки',
                    },
                    muscleGroups: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Задействованные группы мышц',
                    },
                    difficulty: {
                        type: 'string',
                        enum: ['beginner', 'intermediate', 'advanced'],
                        description: 'Уровень сложности',
                    },
                },
                required: ['name', 'technique'],
            },
        },
    },

    // Tool 4: Show progress
    {
        type: 'function',
        function: {
            name: 'show_progress',
            description: 'Показать прогресс пользователя в упражнении или цели',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Название прогресса' },
                    current: { type: 'number', description: 'Текущее значение' },
                    target: { type: 'number', description: 'Целевое значение' },
                    unit: { type: 'string', description: 'Единица измерения (кг, раз, и т.д.)' },
                    percentage: { type: 'number', description: 'Процент выполнения (0-100)' },
                    milestone: { type: 'string', description: 'Описание следующей вехи' },
                },
                required: ['title', 'current', 'target'],
            },
        },
    },

    // Tool 5: Create workout plan
    {
        type: 'function',
        function: {
            name: 'suggest_workout',
            description: 'Предложить план тренировки на сегодня',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Название тренировки' },
                    duration: { type: 'number', description: 'Продолжительность в минутах' },
                    exercises: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Название упражнения' },
                                sets: { type: 'number', description: 'Количество подходов' },
                                reps: { type: 'number', description: 'Количество повторений' },
                                weight: { type: 'number', description: 'Вес (если применимо)' },
                                duration: { type: 'number', description: 'Длительность в секундах (если применимо)' },
                                rest: { type: 'number', description: 'Отдых между подходами (сек)' },
                            },
                            required: ['name'],
                        },
                    },
                    targetMuscles: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Целевые группы мышц',
                    },
                    intensity: {
                        type: 'string',
                        enum: ['light', 'moderate', 'intense'],
                        description: 'Интенсивность',
                    },
                },
                required: ['title', 'exercises'],
            },
        },
    },

    // Tool 6: Record body measurement
    {
        type: 'function',
        function: {
            name: 'record_body_measurement',
            description: 'Записать измерение тела (вес, обхваты)',
            parameters: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['weight', 'biceps', 'waist', 'chest', 'hips', 'thigh', 'neck'],
                        description: 'Тип измерения',
                    },
                    value: { type: 'number', description: 'Значение' },
                    unit: { type: 'string', enum: ['kg', 'cm', 'lb', 'in'], description: 'Единица' },
                    date: { type: 'string', description: 'Дата измерения (ISO)' },
                    note: { type: 'string', description: 'Заметка (опционально)' },
                },
                required: ['type', 'value', 'unit'],
            },
        },
    },

    // Tool 7: Set reminder
    {
        type: 'function',
        function: {
            name: 'set_reminder',
            description: 'Установить напоминание о тренировке',
            parameters: {
                type: 'object',
                properties: {
                    message: { type: 'string', description: 'Текст напоминания' },
                    time: { type: 'string', description: 'Время напоминания (HH:MM или ISO)' },
                    recurring: { type: 'boolean', description: 'Повторяющееся напоминание' },
                    days: {
                        type: 'array',
                        items: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
                        description: 'Дни недели для повторения',
                    },
                },
                required: ['message', 'time'],
            },
        },
    },
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): ChatCompletionTool | undefined {
    return AI_TOOLS.find(tool => {
        if (tool.type === 'function') {
            return tool.function.name === name;
        }
        return false;
    });
}

/**
 * Get tool names array
 */
export function getToolNames(): string[] {
    return AI_TOOLS
        .filter((tool): tool is ChatCompletionTool & { type: 'function' } => tool.type === 'function')
        .map(tool => tool.function.name);
}

/**
 * JSON mode system instruction addition
 * Forces the model to respond with valid JSON
 */
export const JSON_MODE_INSTRUCTION = `
## 🔒 ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (JSON Mode):

Ты ДОЛЖЕН ответить в формате JSON. Никакого другого формата.

Структура ответа:
{
  "reply": "Текст твоего ответа пользователю",
  "reaction": "💪", // Эмодзи реакция
  "cards": [], // Опционально: карточки с данными
  "suggestions": [] // Опционально: предложенные действия
}

⚠️ КРИТИЧНО: Если не можешь ответить — верни:
{"reply": "Не могу ответить на этот вопрос. Спроси про тренировки!", "reaction": "🤔"}
`;

/**
 * Build OpenAI API request options for function calling
 */
export function buildFunctionCallingOptions(enableParallelCalls: boolean = false) {
    return {
        tools: AI_TOOLS,
        tool_choice: 'auto' as const,
        parallel_tool_calls: enableParallelCalls,
    };
}

/**
 * Build OpenAI API request options for JSON mode
 */
export function buildJsonModeOptions() {
    return {
        response_format: { type: 'json_object' as const },
    };
}

/**
 * Parse tool call results from OpenAI response
 */
export function parseToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
): Array<{ id: string; name: string; args: Record<string, unknown> }> {
    return toolCalls.map(call => ({
        id: call.id,
        name: call.function.name,
        args: JSON.parse(call.function.arguments),
    }));
}
