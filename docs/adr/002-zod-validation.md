# ADR-002: Zod для валидации

**Статус:** Принято
**Дата:** 2025-12-06
**Авторы:** TZONA Team

## Контекст

API endpoints принимают данные от клиентов, которые нужно валидировать. При ошибках нужны понятные сообщения. Также нужна синхронизация типов с TypeScript.

## Решение

Использовать **Zod** для:
- Валидации request body, query params, route params
- Автоматической генерации TypeScript типов из схем
- Consistent error messages с `ZodError`

Middleware `validateRequest` применяется ко всем endpoints.

```typescript
const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

type Input = z.infer<typeof schema>; // TypeScript тип
```

## Альтернативы

### Вариант A: Joi
- **Плюсы:** Зрелая библиотека, много плагинов
- **Минусы:** Нет нативной TypeScript интеграции, runtime-only
- **Почему отклонено:** Типы приходится дублировать вручную

### Вариант B: class-validator + class-transformer
- **Плюсы:** Декораторы, интеграция с NestJS
- **Минусы:** Зависимость от декораторов, сложнее тестировать
- **Почему отклонено:** Более громоздкий API, не функциональный стиль

## Последствия

### Положительные
- Единый источник истины для типов и валидации
- TypeScript inference из схем
- Composable: схемы можно комбинировать

### Отрицательные
- Ещё одна зависимость
- Learning curve для сложных кастомных валидаций

## Связанные документы

- [backend/src/middleware/validateRequest.ts](/backend/src/middleware/validateRequest.ts)
- [backend/src/dto/](/backend/src/dto/)
