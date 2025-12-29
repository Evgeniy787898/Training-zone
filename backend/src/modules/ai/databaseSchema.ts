/**
 * COMPLETE Database Schema Documentation for AI Context
 * All 28 tables from Prisma schema with detailed usage instructions
 */

export interface TableDescription {
    name: string;
    russianName: string;
    description: string;
    keyFields: string[];
    useCases: string[];
    dataAccessPatterns: string[];
}

/**
 * ALL database tables with full descriptions for AI context
 */
export const DATABASE_TABLES: TableDescription[] = [
    // ============ USER & PROFILE ============
    {
        name: 'Profile',
        russianName: 'Профиль',
        description: 'Основная таблица пользователя. Содержит все персональные данные.',
        keyFields: ['telegramId', 'firstName', 'lastName', 'goals', 'equipment', 'timezone', 'preferences', 'aiSummary'],
        useCases: [
            'Приветствие по имени',
            'Учёт часового пояса для уведомлений',
            'Персонализация на основе целей и оборудования',
            'Использование aiSummary для контекста',
        ],
        dataAccessPatterns: [
            'Всегда доступен через context.profile',
            'aiSummary содержит сжатую статистику',
        ],
    },
    {
        name: 'RefreshToken',
        russianName: 'Токены обновления',
        description: 'Токены авторизации. НЕ ИСПОЛЬЗОВАТЬ в AI ответах.',
        keyFields: ['token', 'expiresAt', 'revoked'],
        useCases: [],
        dataAccessPatterns: ['⛔ ЗАПРЕЩЕНО для AI'],
    },

    // ============ TRAINING SESSIONS ============
    {
        name: 'TrainingSession',
        russianName: 'Тренировка',
        description: 'Запланированные и выполненные тренировки. Ключевой источник статистики.',
        keyFields: ['plannedAt', 'status', 'disciplineId', 'programId', 'notes', 'comment'],
        useCases: [
            'Сколько тренировок выполнено (status=done)',
            'Сколько пропущено (status=skipped)',
            'Что запланировано на сегодня/завтра',
            'Серия (streak) тренировок подряд',
            'Последняя тренировка',
        ],
        dataAccessPatterns: [
            'Доступно через context.sessions или aiSummary.ses',
            'status: planned → in_progress → done/skipped',
        ],
    },
    {
        name: 'TrainingSessionExercise',
        russianName: 'Упражнение в тренировке',
        description: 'Конкретное упражнение внутри тренировки с целью и результатом.',
        keyFields: ['exerciseKey', 'levelCode', 'targetSets', 'targetReps', 'completedSets', 'completedReps'],
        useCases: [
            'Что делал на тренировке',
            'Выполнил ли цель по подходам/повторам',
            'Общий объём тренировки',
        ],
        dataAccessPatterns: ['Связано с TrainingSession'],
    },
    {
        name: 'ExerciseProgress',
        russianName: 'Прогресс по упражнению',
        description: 'Запись прогресса после каждой тренировки с решением по уровню.',
        keyFields: ['exerciseKey', 'levelTarget', 'levelResult', 'volumeTarget', 'volumeActual', 'rpe', 'decision', 'streakSuccess'],
        useCases: [
            'Текущий уровень в упражнении',
            'Динамика прогресса',
            'RPE (воспринимаемая нагрузка)',
            'Серия успехов (streakSuccess)',
        ],
        dataAccessPatterns: ['Доступно через aiSummary.prog'],
    },

    // ============ EXERCISES & PROGRAMS ============
    {
        name: 'Exercise',
        russianName: 'Упражнение',
        description: 'Справочник всех упражнений.',
        keyFields: ['exerciseKey', 'title', 'focus', 'description', 'cue', 'equipment'],
        useCases: [
            'Описание техники',
            'Какие мышцы работают (focus)',
            'Советы по выполнению (cue)',
            'Необходимое оборудование',
        ],
        dataAccessPatterns: ['exerciseKey — уникальный идентификатор'],
    },
    {
        name: 'ExerciseLevel',
        russianName: 'Уровень упражнения',
        description: 'Уровни сложности для каждого упражнения.',
        keyFields: ['exerciseKey', 'level', 'title', 'sets', 'reps', 'execution', 'technique', 'improvement'],
        useCases: [
            'Параметры текущего уровня',
            'Техника выполнения',
            'Как перейти на следующий уровень',
        ],
        dataAccessPatterns: ['level — код уровня (L1, L2...)'],
    },
    {
        name: 'TrainingProgram',
        russianName: 'Программа тренировок',
        description: 'Шаблон программы (например, 6x6 calisthenics).',
        keyFields: ['name', 'description', 'frequency', 'restDay', 'programData'],
        useCases: [
            'Описание программы',
            'Сколько дней в неделю',
            'Какой день отдыха',
        ],
        dataAccessPatterns: ['programData содержит структуру дней'],
    },
    {
        name: 'TrainingDiscipline',
        russianName: 'Дисциплина',
        description: 'Вид тренировок (калистеника, силовые, кардио).',
        keyFields: ['name', 'description', 'imageUrl'],
        useCases: ['Категоризация программ и упражнений'],
        dataAccessPatterns: [],
    },
    {
        name: 'UserTrainingProgram',
        russianName: 'Программа пользователя',
        description: 'Текущая активная программа пользователя.',
        keyFields: ['disciplineId', 'programId', 'initialLevels', 'currentLevels', 'isActive'],
        useCases: [
            'Какая программа сейчас',
            'Начальные и текущие уровни',
            'Активна ли программа',
        ],
        dataAccessPatterns: ['Только одна активная на пользователя'],
    },

    // ============ BODY METRICS ============
    {
        name: 'Metric',
        russianName: 'Метрика',
        description: 'Измерения тела (вес, обхваты и др.).',
        keyFields: ['metricType', 'value', 'recordedAt', 'unit'],
        useCases: [
            'Динамика веса',
            'Изменения в обхватах',
            'Графики прогресса тела',
        ],
        dataAccessPatterns: [
            'metricType: weight, chest, waist, hips, biceps',
            'Доступно через aiSummary.met',
        ],
    },
    {
        name: 'ProgressPhoto',
        russianName: 'Фото прогресса',
        description: 'Фотографии тела с датой и весом.',
        keyFields: ['imageUrl', 'capturedAt', 'note', 'weightKg', 'bodyFat'],
        useCases: [
            'Визуальный прогресс',
            'Сравнение до/после',
        ],
        dataAccessPatterns: ['Доступно через aiSummary.ph'],
    },
    {
        name: 'BodyScanSession',
        russianName: 'Сканирование тела',
        description: 'Полное сканирование тела с 4 ракурсов + AI анализ.',
        keyFields: ['frontImageUrl', 'backImageUrl', 'leftImageUrl', 'rightImageUrl', 'heightCm', 'weightKg', 'analysis'],
        useCases: [
            'Полный анализ телосложения',
            'AI оценка типа тела и осанки',
        ],
        dataAccessPatterns: ['analysis содержит AI insights'],
    },
    {
        name: 'Evolution360Scan',
        russianName: '360° скан эволюции',
        description: 'Анимированный 360° скан тела.',
        keyFields: ['scanType', 'frameCount', 'uploadedAt'],
        useCases: [
            'Текущее состояние (current)',
            'Цель (goal)',
        ],
        dataAccessPatterns: ['scanType: current | goal'],
    },
    {
        name: 'Evolution360Frame',
        russianName: 'Кадр 360° скана',
        description: 'Отдельный кадр 360° сканирования.',
        keyFields: ['frameIndex', 'imageUrl'],
        useCases: [],
        dataAccessPatterns: ['Связан с Evolution360Scan'],
    },

    // ============ GAMIFICATION ============
    {
        name: 'Achievement',
        russianName: 'Достижение',
        description: 'Полученные награды и достижения.',
        keyFields: ['title', 'description', 'awardedAt', 'triggerSource'],
        useCases: [
            'Мотивация достижениями',
            'Список полученных наград',
        ],
        dataAccessPatterns: ['Доступно через aiSummary.ach'],
    },
    {
        name: 'FavoriteExercise',
        russianName: 'Избранное упражнение',
        description: 'Упражнения, добавленные в избранное.',
        keyFields: ['exerciseKey', 'createdAt'],
        useCases: ['Любимые упражнения пользователя'],
        dataAccessPatterns: ['Доступно через aiSummary.fav'],
    },

    // ============ AI & DIALOG ============
    {
        name: 'DialogState',
        russianName: 'Состояние диалога',
        description: 'Персистентное состояние чата (история, контекст).',
        keyFields: ['stateType', 'statePayload', 'expiresAt'],
        useCases: [
            'История сообщений',
            'Контекст разговора',
        ],
        dataAccessPatterns: ['stateType: trainer_chat_history | assistant_session'],
    },
    {
        name: 'DialogEvent',
        russianName: 'Событие диалога',
        description: 'Логирование событий в диалоге.',
        keyFields: ['eventType', 'payload', 'abGroup', 'responseLatencyMs'],
        useCases: ['Аналитика использования AI'],
        dataAccessPatterns: [],
    },
    {
        name: 'AssistantNote',
        russianName: 'Заметка ассистента',
        description: 'Заметки, созданные через AI.',
        keyFields: ['title', 'content', 'tags', 'source'],
        useCases: [
            'Сохранённые советы',
            'Планы и цели',
        ],
        dataAccessPatterns: [],
    },
    {
        name: 'MessageFeedback',
        russianName: 'Обратная связь',
        description: 'Реакции пользователя на ответы AI (лайки/дизлайки).',
        keyFields: ['messageId', 'reaction', 'comment', 'userMessage', 'aiResponse', 'aiMood'],
        useCases: [
            'Обучение на реакциях',
            'Улучшение качества ответов',
        ],
        dataAccessPatterns: ['reaction: like | dislike | emoji'],
    },

    // ============ DAILY ADVICE ============
    {
        name: 'DailyAdvice',
        russianName: 'Совет дня',
        description: 'Справочник советов по категориям.',
        keyFields: ['adviceType', 'shortText', 'fullText', 'ideas', 'theme'],
        useCases: ['Генерация совета дня'],
        dataAccessPatterns: [],
    },
    {
        name: 'DailyAdviceSelection',
        russianName: 'Показанный совет',
        description: 'Какой совет был показан пользователю в какой день.',
        keyFields: ['date', 'adviceId', 'selectedAt'],
        useCases: ['Не повторять советы'],
        dataAccessPatterns: [],
    },

    // ============ NOTIFICATIONS ============
    {
        name: 'Notification',
        russianName: 'Уведомление',
        description: 'Уведомления для пользователя.',
        keyFields: ['type', 'title', 'message', 'data', 'isRead'],
        useCases: [
            'Напоминания о тренировках',
            'Мотивационные сообщения',
            'Достижения',
        ],
        dataAccessPatterns: ['type: training_reminder | motivation | achievement | weekly_report | daily_tip'],
    },

    // ============ SYSTEM & AUDIT ============
    {
        name: 'OperationLog',
        russianName: 'Лог операций',
        description: 'Логирование API операций.',
        keyFields: ['action', 'status', 'errorCode'],
        useCases: [],
        dataAccessPatterns: ['⛔ Технический лог'],
    },
    {
        name: 'ObservabilityEvent',
        russianName: 'Событие мониторинга',
        description: 'События для мониторинга системы.',
        keyFields: ['category', 'severity', 'payload', 'traceId'],
        useCases: [],
        dataAccessPatterns: ['⛔ Технический лог'],
    },
    {
        name: 'WorkoutAuditLog',
        russianName: 'Аудит тренировок',
        description: 'История изменений тренировок для отката.',
        keyFields: ['entityType', 'entityId', 'action', 'previousState', 'newState'],
        useCases: ['Откат изменений при ошибке'],
        dataAccessPatterns: [],
    },
    {
        name: 'SensitiveAuditLog',
        russianName: 'Безопасный аудит',
        description: 'Логирование чувствительных операций (PIN, авторизация).',
        keyFields: ['event', 'status', 'ip', 'userAgent'],
        useCases: [],
        dataAccessPatterns: ['⛔ ЗАПРЕЩЕНО для AI'],
    },
];

/**
 * Get comprehensive schema description for AI prompt
 */
export function getSchemaForPrompt(): string {
    const userTables = DATABASE_TABLES.filter(t =>
        !t.dataAccessPatterns.includes('⛔ ЗАПРЕЩЕНО для AI') &&
        !t.dataAccessPatterns.includes('⛔ Технический лог')
    );

    const sections = [
        '## 📊 ДОСТУПНЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:\n',
    ];

    // Group by category
    const categories: Record<string, TableDescription[]> = {
        'Профиль': userTables.filter(t => ['Profile', 'UserTrainingProgram'].includes(t.name)),
        'Тренировки': userTables.filter(t => ['TrainingSession', 'TrainingSessionExercise', 'ExerciseProgress'].includes(t.name)),
        'Упражнения': userTables.filter(t => ['Exercise', 'ExerciseLevel', 'FavoriteExercise'].includes(t.name)),
        'Тело': userTables.filter(t => ['Metric', 'ProgressPhoto', 'BodyScanSession'].includes(t.name)),
        'Достижения': userTables.filter(t => ['Achievement', 'Notification'].includes(t.name)),
    };

    for (const [category, tables] of Object.entries(categories)) {
        if (tables.length === 0) continue;
        sections.push(`### ${category}:`);
        for (const t of tables) {
            sections.push(`• **${t.russianName}** (${t.name}): ${t.description}`);
            if (t.useCases.length > 0) {
                sections.push(`  Примеры: ${t.useCases.slice(0, 2).join('; ')}`);
            }
        }
        sections.push('');
    }

    sections.push(`
## 🎯 КАК ОТВЕЧАТЬ НА ВОПРОСЫ О ДАННЫХ:
1. **Статистика тренировок** → TrainingSession (done/skipped)
2. **Прогресс в упражнении** → ExerciseProgress
3. **Текущий уровень** → aiSummary.prog
4. **План на сегодня** → TrainingSession (planned)
5. **Достижения** → Achievement
6. **Вес/обхваты** → Metric
7. **Фото прогресса** → ProgressPhoto

## ⚠️ ВАЖНО:
- НИКОГДА не перенаправляй на другие разделы
- Всегда показывай данные ПРЯМО В ЧАТЕ
- Используй карточки (chart, table, stats) для визуализации
- Если данных нет — скажи прямо и предложи начать отслеживать
`);

    return sections.join('\n');
}

/**
 * Get intent-specific data requirements
 */
export function getDataRequirements(intent: string): string[] {
    const requirements: Record<string, string[]> = {
        stats: ['TrainingSession', 'ExerciseProgress', 'Metric'],
        progress: ['ExerciseProgress', 'Metric', 'ProgressPhoto'],
        plan: ['TrainingSession', 'UserTrainingProgram', 'Exercise'],
        workout: ['TrainingSession', 'TrainingSessionExercise', 'ExerciseProgress'],
        motivation: ['Achievement', 'TrainingSession', 'ExerciseProgress'],
        exercise: ['Exercise', 'ExerciseLevel', 'ExerciseProgress'],
        body: ['Metric', 'ProgressPhoto', 'BodyScanSession'],
    };

    return requirements[intent] || [];
}
