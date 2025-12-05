# Архитектура TZONA V2

Документ описывает актуальное состояние всей платформы: Telegram WebApp, Express API, кеширующие уровни, фоновую
инфраструктуру и микросервисы. Цель — дать общее понимание того, как компоненты взаимодействуют и где искать нужные части в
репозитории.

## 1. Карта системы

```mermaid
flowchart LR
    subgraph Client
        TG[Telegram WebApp (Vue PWA)]
    end
    subgraph Backend
        API[Express API + Middleware]
        Cache[(Redis + Memory Cache)]
        DB[(Postgres / Supabase)]
        Monitor[(Monitoring + Webhooks)]
    end
    subgraph Services
        IMG[Image Processor (FastAPI)]
        AI[AI Advisor]
        Analytics[Analytics Worker]
    end

    TG -->|HTTPS /api| API
    API -->|Prisma| DB
    API -->|cacheStrategy| Cache
    API -->|HTTP| IMG
    API -->|HTTP| AI
    API -->|Supabase client| Analytics
    API --> Monitor
```

* Frontend — Vue 3 + Vite PWA, запускается внутри Telegram WebApp и общается только с нашим API.
* Backend — Node.js 20 + Express + Prisma; включает DI контейнер, сервисы, репозитории и обширный набор middleware.
* Redis — основной слой распределённого кеша c fallback на локальную память.
* Postgres (Supabase) — единственный источник данных. Миграции, индексы и материализованные представления хранятся в
  `backend/migrations/` и `prisma/schema.prisma`.
* Python микросервисы (image-processor и пр.) обслуживают тяжёлые задачи и вызываются через HTTP с circuit breaker.

## 2. Поток запроса

1. **Transport & Trace** — `traceContext` присваивает `trace_id`, логирует ресурс и прокидывает контекст во все слои.
2. **Безопасность** — на ранней стадии проходят CORS, CSP, body-size guard, request timeout, IP rate limiter, CSRF middleware и
   валидация Telegram initData/JWT.
3. **Валидация** — `validateRequest` + `RequestValidationService` парсят query/body/params через Zod, URL guard и sanitize
   middleware чистит строки и экранирует XSS перед записью в Prisma.
4. **Business layer** — роут вызывает сервис (через DI контейнер), который опирается на репозиторий/Prisma. Сервис может
   использовать кеши, adaptive TTL, batch операции, circuit breaker, monitoring hooks.
5. **Кеш** — ответы GET проходят через `cacheStrategy` (remember/invalidations, versioning, Redis pub/sub). Stampede защита и
   адаптивные TTL снижают нагрузку на БД.
6. **Ответ** — `apiResponses` применяет removeNullFields, устанавливает Cache-Control/ETag, вычисляет user-friendly сообщение при
   ошибке и отдаёт JSON. Error handler логирует структурированно и сообщает monitoring сервису.

## 3. Backend слои

| Слой | Директории | Роль |
| --- | --- | --- |
| Конфигурация | `backend/src/config`, `backend/src/types/config.ts`, `backend/src/config/env.ts` | Константы, типы и валидация окружения (Zod). |
| Middleware | `backend/src/middleware` | CORS, CSP, CSRF, trace, request timeout, body-size limits, rate limiting, compression, URL guard, profile context. |
| Сервисы | `backend/src/services` | Кеш, мониторинг, circuit breaker, databaseAvailability, adaptive TTL, pagination, profile summary, sessionService и пр. |
| Репозитории | `backend/src/repositories` | Инкапсулируют Prisma (`SessionRepository` и др.), запрещают raw запросы, обеспечивают типизацию. |
| Вспомогательные утилиты | `backend/src/utils` | ETag, cache headers, exercise helpers, type guards, memoизация. |
| Тесты | `backend/src/tests`, `backend/src/services/__tests__`, `backend/src/middleware/__tests__` | Unit, integration, e2e, perf, security, миграции. |

### Бизнес‑критичные сервисы
- **SessionService + SessionRepository** — CRUD сессий, валидация structured notes, batch upserts упражнений, инвалидация кеша.
- **ProfileSummary / TrainingCatalog / AchievementsFeed** — переиспользуются HTTP-роутами, cache warming и prefetch задачами.
- **Cache stack** — `cacheStrategy`, `cacheInvalidation`, `cacheWarming`, `cacheAdaptiveTtl`, `cacheMetrics`.
- **Resilience** — `circuitBreaker`, `databaseRetry`, `databaseAvailability`, `requestTimeout`, `monitoring`.
- **Security** — `tokenService`, `accessControl`, `pathSecurity`, `sensitiveDataEncryption`, `stringSanitization`, `xssProtection`.

## 4. Работа с данными

* Prisma схема (`backend/prisma/schema.prisma`) описывает таблицы для профилей, сессий, прогресса упражнений, достижений, советов,
  заметок ассистента и аналитики. Дополнительные enumы и индексы поддерживают статус сессий, JSON фильтры и materialized views.
* Миграции (`backend/migrations/*.sql`) фиксируют индексы, материализованные представления, enum статусы и JSON expression индексы.
* Материализованные представления и отчёты обновляются службами `materializedViews` и `supabaseService`.
* Slow-query и N+1 анализ запускаются скриптами `npm run report:slow-queries` и `npm run audit:nplusone`, отчёты лежат в `docs/`.

## 5. Кеширование

1. **Единая стратегия** — `cacheStrategy` выдаёт scope и версию ключей, поддерживает ручной bump, adaptive TTL и compression.
2. **Redis + memory** — `cache` модуль управляет Redis соединением, fallback режимом, stampede защитой и мониторингом hit/miss.
3. **Invalidation** — `cacheInvalidation` и Supabase сервис bumpят scope после любой записи (sessions, exercises, notes, reports).
4. **Warming** — `cacheWarming` запускает recurring task, используя `createRecurringTask` паттерн и profile-aware fetchers.
5. **CDN/Media** — `/api/media/exercise-levels` кеширует оптимизированные изображения, интегрируется с image-processor и CDN.

## 6. Фронтенд

* **Технологии** — Vue 3 + TypeScript + Vite, PWA с Workbox сервис‑воркером (`frontend/src/sw.ts`).
* **Структура** — feature‑папки `src/features/core` (bootstrap, prefetch, Telegram auth, SW) и `src/features/observability` (web vitals),
  доменные модули в `src/modules/*` (exercises, training, profile, today, analytics) и общие UI в `src/modules/shared`.
* **Оптимизации** — code splitting, lazy routes (`router/lazyRoutes.ts`), `createLazyComponent`, `useLazyList`, `useVirtualScroller`,
  request limiter/deduplicator, memo helpers, debounce с flush/cancel.
* **Медиа** — `exerciseImages.ts` генерирует CDN `src/srcset`, Today/Exercises/Progress страницы используют ленивую загрузку.
* **Prefetch** — `startCriticalPrefetch` скачивает профайл, каталоги, ежедневные советы и route chunks после логина.
* **Тесты** — snapshot specs (`frontend/src/modules/**/__tests__`), type-check, bundle analyzer (`npm run analyze:bundle`).

## 7. Микросервисы и интеграции

| Сервис | Технология | Взаимодействие |
| --- | --- | --- |
| Image Processor | FastAPI (services/image-processor) | HTTP `/optimize` эндпоинт, возвращает оптимизированные буферы, backend кэширует и выставляет CDN URL. |
| AI Advisor | FastAPI | Планируется генерация советов/ответов, backend использует circuit breaker и monitoring hooks. |
| Analytics | Python worker | Формирует отчёты Supabase, backend забирает материализованные данные через `supabaseService`. |

Все микросервисы должны иметь health-check, логирование и взаимодействуют только с реальной БД/файлами — заглушки запрещены.

## 8. Наблюдаемость и мониторинг

* **Logger** — `services/logger.ts` пишет JSON с trace_id, профилем, маршрутом и категорией.
* **Monitoring service** — хранит события в БД (`monitoring_events`), отправляет вебхуки/Telegram уведомления по порогам.
* **Trace** — AsyncLocalStorage (`services/trace.ts`) прокидывает идентификатор во все middleware, фоновые задачи и monitoring.
* **Circuit breaker + retries** — защищают внешние HTTP вызовы и Prisma.
* **Timeout handler** — выдаёт 504 с user-friendly текстом и записывает событие мониторинга.

## 9. Тестирование

| Тип | Команда | Покрытие |
| --- | --- | --- |
| Unit | `npm run test:unit --prefix backend` | Сервисы (sessions, cache, profile), Prisma middleware, валидации, guards. |
| Integration | `npm run test:integration --prefix backend` | Middleware, роуты, error handler, CSRF. |
| E2E | `npm run test:e2e --prefix backend` | Полный API с реальной БД (seed + Prisma db push). |
| Performance | `npm run test:performance --prefix backend` | Autocannon сценарии для `/api/profile`, `/api/sessions`, `/api/achievements`. |
| Security | Включены в unit/integration (`services/__tests__/*`, `middleware/__tests__/*`). |
| Migrations | `npm run test:migrations --prefix backend` | Прогоняет весь стек SQL миграций против чистой БД. |
| Frontend snapshots | `npm run test:snapshot --prefix frontend` | Основные компоненты WebApp.

CI (`.github/workflows/type-check.yml`) запускает генерацию Prisma клиента и type-check двух пакетов при каждом push/PR.

## 10. Развёртывание и конфигурация

* **Env валидация** — `config/env.ts` и `validateEnvironment` останавливают сервер, если отсутствуют обязательные ключи Telegram,
  JWT, Redis, Postgres, Supabase и image-processor.
* **Docker Compose** — поднимает Postgres, Redis, backend, frontend и микросервисы (см. `docker-compose.yml`).
* **Deployment** — см. `DEPLOYMENT.md`: описаны шаги для prod/staging, требования к Postgres, Redis, telemetry, cache warming.
* **Ngrok/dev** — `start-dev.sh` и `start-with-ngrok.sh` помогают быстро прокинуть backend в Telegram WebApp.

---

Дополнительные материалы:
- `docs/prisma-n-plus-one-audit.md`, `docs/slow-query-report.md`, `docs/performance-report.md`, `docs/duplicate-code-report.md` —
  автоматические отчёты.
- `SERVICE_DOCUMENTATION.md`, `MIGRATION_PLAN.md`, `DEPLOYMENT.md` — инструкции по сервисам и окружениям.
- `PLAN_IMPROVEMENTS.md` — дорожная карта (на момент обновления выполнены блоки 1–10, в работе блок 11+).
