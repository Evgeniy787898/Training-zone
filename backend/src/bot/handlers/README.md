# Bot Handlers

Обработчики событий бота, извлечённые из `runtime.ts` согласно ARCHITECTURE_IMPROVEMENT_PLAN.md (BOT-R01, BOT-R03).

## Планируемые файлы:
- `callbackQuery.ts` — обработка callback_query (inline кнопки)
- `message.ts` — обработка текстовых сообщений
- `inline.ts` — обработка inline режима
- `ai.ts` — обработка AI-диалогов
- `index.ts` — barrel export всех handlers
