# Переменные окружения TZONA

Документ описывает все переменные окружения, используемые проектом. Для точных значений по умолчанию смотрите соответствующие
`*.env.example` файлы; там же указаны комментарии и рекомендуемые диапазоны. Поддерживаются Docker Secrets через `_FILE` переменные,
если указано отдельно.

### Fallback для опциональных значений (backend)

- `FRONTEND_URL` автоматически берётся из `WEBAPP_URL`, если не задана напрямую.
- `WEBAPP_URL` по умолчанию использует первый origin из `FRONTEND_URL`, если явное значение отсутствует.
- `MEDIA_BASE_URL` подставляется из `MEDIA_CDN_BASE_URL`, либо из `WEBAPP_URL`/`FRONTEND_URL`, если не задана.
- `MEDIA_CDN_BASE_URL` наследует значение `MEDIA_BASE_URL`, если собственное значение не указано.
- `IMAGE_REGISTRY_PREFIX` по умолчанию принимает `tzona` (локальные сборки) или `${REGISTRY}/${OWNER}` в workflow.
- `BACKEND_HOST_PORT`, `IMAGE_PROCESSOR_HOST_PORT`, `AI_ADVISOR_HOST_PORT`, `ANALYTICS_HOST_PORT`, `CADVISOR_HOST_PORT` получают стандартные значения `3001-3004` и `8080`, если не заданы в `.env`/CI.

### Обязательные переменные (backend)

Используйте `npm run validate:env --prefix backend` для явной проверки перед запуском: скрипт выдаст ошибки, если отсутствуют
критичные значения (Supabase URL/ключи, Telegram токены, секреты шифрования/CSRF, Redis/AI/analytics при включённых сервисах).

## Backend (`backend/env.example`)

| Группа | Переменные | Назначение/значения по умолчанию |
| --- | --- | --- |
| Подключение к БД | `DATABASE_URL`, `DATABASE_POOL_URL`, `DATABASE_DIRECT_URL`, `DIRECT_URL`, `SHADOW_DATABASE_URL`, `PRISMA_POOL_URL`, `PRISMA_DIRECT_URL`, `PRISMA_RUNTIME_URL`, `PRISMA_PREFER_POOL`, `PRISMA_POOL_WARMUP_TIMEOUT_MS`, `PRISMA_POOL_FALLBACK_ENABLED`, `PRISMA_CONNECTION_HEADROOM`, `PRISMA_MAX_CONCURRENCY`, `PRISMA_QUEUE_WARN_SIZE` | Настройка PgBouncer/Direct URL, warmup и headroom для Prisma, лимиты очереди. |
| Лог медленных запросов | `PRISMA_SLOW_QUERY_*` | Порог, лимит истории, путь логов, предпросмотр параметров, сэмплирование, отправка в мониторинг. |
| Логирование | `LOG_ENABLED`, `LOG_LEVEL`, `LOG_ECHO_TO_CONSOLE`, `LOG_FILE_PATH`, `LOG_FILE_MAX_BYTES`, `LOG_FILE_MAX_BACKUPS`, `LOG_ALERT_ON_ERROR`, `LOG_REDACT_KEYS`, `LOG_REDACT_PATTERNS` | Структурированные логи NDJSON, ротация и маскирование чувствительных данных. |
| Метрики и аномалии | `PERF_METRICS_*`, `ANOMALY_*`, `METRICS_DASHBOARD_*`, `RESOURCE_METRICS_*`, `BUSINESS_METRICS_*`, `SLA_SAMPLE_WINDOW_MS`, `CAPACITY_*` | Настройка latency/throughput, аномалий, dashbord, ресурсов, бизнес‑метрик, SLA и capacity planning. |
| Материализованные вью | `MATERIALIZED_VIEW_*_REFRESH_MS` | Период обновления precomputed вью. |
| Graceful degradation | `DATABASE_DEGRADED_*`, `DATABASE_RETRY_*`, `HEALTH_*` | Поведение при недоступности БД, кеширование health, retry‑параметры. |
| HTTP клиент | `HTTP_KEEP_ALIVE`, `HTTP_MAX_CONNECTIONS`, `HTTP_PIPELINING`, `HTTP_*_TIMEOUT_MS`, `HTTP_KEEP_ALIVE_TIMEOUT_MS`, `HTTP_KEEP_ALIVE_MAX_TIMEOUT_MS` | Параметры undici (keep-alive, таймауты, коннекты). |
| Circuit breaker | `CIRCUIT_BREAKER_*` | Порог срабатывания/восстановления для внешних сервисов. |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_ALLOWED_IDS`, `TELEGRAM_WEBAPP_SECRET`, `TELEGRAM_BOT_TOKEN_FILE`, `TELEGRAM_WEBAPP_SECRET_FILE` | Токены/секреты бота и WebApp, ограничение пользователей. |
| Сервер | `PORT`, `NODE_ENV`, `APP_ENV`, `HOST`, `WEBAPP_URL`, `MEDIA_BASE_URL`, `MEDIA_CDN_BASE_URL`, `MEDIA_CDN_SIGNING_SECRET`, `MEDIA_CDN_SIGNING_PARAM`, `MEDIA_CDN_EXPIRES_PARAM`, `MEDIA_CDN_SIGNATURE_TTL_SECONDS` | Хост/порт, профиль окружения, публичные URL, параметры CDN‑подписи. |
| Docker compose/registry | `IMAGE_REGISTRY_PREFIX`, `IMAGE_TAG`, `COMPOSE_PROJECT_NAME`, `BACKEND_HOST_PORT`, `IMAGE_PROCESSOR_HOST_PORT`, `AI_ADVISOR_HOST_PORT`, `ANALYTICS_HOST_PORT`, `CADVISOR_HOST_PORT` | Управляют тем, какие образы и порты использует `docker-compose.yml` (применяются в prod/staging/preview workflow и при локальном деплое). |
| Image processor | `IMAGE_PROCESSOR_*` | URL сервиса, допущенные форматы/режимы, размеры, таймауты, TTL кэша. |
| Кэш | `CACHE_REDIS_URL`, `CACHE_NAMESPACE`, `CACHE_MEMORY_*`, `CACHE_REDIS_*`, `CACHE_FALLBACK_*`, `CACHE_STAMPEDE_*`, `CACHE_MONITORING_*`, `CACHE_ASSISTANT_AI_ADVICE_TTL_SECONDS`, `CACHE_ADAPTIVE_TTL_*`, `CACHE_COMPRESSION_*`, `CACHE_VERSION_*` | Настройки Redis/памяти, защита от stampede, мониторинг hit/miss, адаптивные TTL, сжатие и версионирование ключей. |
| AI Advisor клиент | `AI_ADVISOR_BASE_URL`, `AI_ADVISOR_ENABLED`, `AI_ADVISOR_API_TOKEN`, `AI_ADVISOR_API_TOKEN_FILE`, `AI_ADVISOR_TIMEOUT_MS`, `AI_ADVISOR_CONTEXT_*`, `AI_ADVISOR_LATENCY_*`, `AI_ADVISOR_COST_*` | Вызовы микросервиса, контекст, таймауты, бюджет. |
| Analytics клиент | `ANALYTICS_BASE_URL`, `ANALYTICS_ENABLED`, `ANALYTICS_API_TOKEN`, `ANALYTICS_TIMEOUT_MS` | Доступ к аналитическому сервису. |
| Cache warming | `CACHE_WARMING_*` | Стартовое прогревание основных ресурсов. |
| Безопасность (JWT/шифрование) | `JWT_SECRET`, `JWT_SECRET_KEYS`, `JWT_SECRET_ACTIVE_ID`, `JWT_SECRET_LEGACY_ID`, `JWT_SECRET_FILE`, `JWT_SECRET_KEYS_FILE`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_REVOKED_*`, `ENCRYPTION_SECRET`, `ENCRYPTION_SECRET_PREVIOUS`, `GLOBAL_RATE_LIMIT_MAX` | Секреты JWT (в т.ч. ротация), срок действия, аудитория/issuer, retention отозванных токенов, ключ шифрования + плавная ротация. |
| CSRF | `CSRF_SECRET`, `CSRF_SECRET_PREVIOUS`, `CSRF_TOKEN_TTL`, `CSRF_TOKEN_REFRESH_THRESHOLD`, `CSRF_COOKIE_NAME`, `CSRF_COOKIE_SECURE`, `CSRF_COOKIE_SAMESITE`, `CSRF_HEADER_NAMES` | Двойная отправка токена, имя/атрибуты cookie, список заголовков, плавная ротация секрета. |
| Ограничения запросов | `REQUEST_BODY_*_LIMIT`, `REQUEST_TIMEOUT_*`, `REQUEST_TIMEOUT_HEADER` | Лимиты тела, soft/hard таймауты и заголовок для запросов. |
| Сжатие/безопасность ответа | `COMPRESSION_*`, `CSP_*` | Настройки gzip/brotli и директив CSP. |
| Rate limiting PIN | `PIN_RATE_LIMIT_MAX`, `PIN_MAX_ATTEMPTS`, `PIN_BLOCK_DURATION_MS` | Ограничения по PIN-коду. |
| Мониторинг/алёрты | `MONITORING_*`, `ALERT_TELEGRAM_*` | Вебхуки/Telegram для критических ошибок и событий. |
| Синтетический мониторинг | `SYNTHETIC_MONITOR_TARGETS`, `SYNTHETIC_MONITOR_DEFAULT_TIMEOUT_MS`, `SYNTHETIC_MONITOR_DEFAULT_HEADERS` | Перечень проверяемых API/CDN эндпоинтов, дефолтный таймаут и заголовки (формат JSON или pipe‑delimited строки). |
| Архивирование | `ARCHIVE_OPERATION_LOG_DAYS`, `ARCHIVE_OBSERVABILITY_DAYS`, `ARCHIVE_BATCH_SIZE`, `ARCHIVE_DRY_RUN` | Параметры бэкапа логов и наблюдаемости. |
| Профилирование | `PROFILE_API_TARGET`, `HEAP_SNAPSHOT_*` | CPU/heap профилирование при необходимости. |
| Assistant | `ASSISTANT_SUCCESS_THRESHOLD`, `ASSISTANT_SLUMP_THRESHOLD` | Пороговые значения для рекомендаций ассистента. |
| Frontend | `FRONTEND_URL` | Базовый адрес SPA, используемый в редиректах. |
| OpenAPI | `OPENAPI_SPEC_PATH` (опционально) | Переопределение пути к спецификации для сервера `/api/openapi.json`. |

## Frontend (Vite)

| Переменная | Назначение |
| --- | --- |
| `VITE_API_BASE_URL` | Базовый URL backend API (обязательная). |
| `VITE_STATIC_CDN_BASE` | База CDN для статики (если отлична от origin). |
| `VITE_ASSET_BASE` | Пользовательский базовый путь для ассетов (например, при прокси). |
| `BASE_URL` | Внутренний базовый путь приложения (по умолчанию `/`). |

## AI Advisor (`services/ai-advisor/.env.example`)

| Переменная | Назначение |
| --- | --- |
| `AI_ADVISOR_PROVIDER` | openai/claude выбор провайдера. |
| `AI_ADVISOR_MODEL` | Имя модели. |
| `AI_ADVISOR_BASE_PROMPT` | Базовый prompt для генерации советов. |
| `AI_ADVISOR_TEMPERATURE` | Температура генерации. |
| `AI_ADVISOR_MAX_TOKENS` | Лимит токенов ответа. |
| `AI_ADVISOR_COST_INPUT_PER_1K_USD`, `AI_ADVISOR_COST_OUTPUT_PER_1K_USD` | Учёт стоимости входных/выходных токенов. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Ключи для провайдеров (поддерживаются Docker Secrets через `_FILE` из backend). |
| `LOG_LEVEL`, `ENVIRONMENT` | Уровень логов и стадия окружения. |

## Analytics (`services/analytics/.env.example`)

| Переменная | Назначение |
| --- | --- |
| `ANALYTICS_DATABASE_URL` | Подключение к Postgres. |
| `ANALYTICS_DB_POOL_MIN/MAX`, `ANALYTICS_DB_STATEMENT_TIMEOUT_MS` | Пул и таймауты запросов. |
| `ANALYTICS_STATS_*`, `ANALYTICS_AGGREGATE_*`, `ANALYTICS_TOP_EXERCISE_LIMIT` | Пределы выборок для API статистики. |
| `ANALYTICS_CACHE_*` | TTL и лимиты кэша (общий/профиль/агрегации/тренды/группировки/визуализации). |
| `ANALYTICS_GROUPED_RESULTS_LIMIT`, `ANALYTICS_BATCH_PROFILE_LIMIT` | Ограничения размера выборок. |
| `ANALYTICS_REALTIME_*` | Интервалы/таймауты SSE трансляций и лимит клиентов. |
| `ANALYTICS_RATE_LIMIT_*` | Ограничение запросов к сервису. |

## Image Processor

Сервис использует настройки из backend через `IMAGE_PROCESSOR_*` (см. таблицу backend) и поддерживает те же параметры формата/размера/таймаута.

## Общие секреты и Docker

- `_FILE` переменные (`*_FILE`) можно задать для JWT/CSRF/Supabase/AI токенов и других чувствительных значений, чтобы читать их из Docker Secrets или внешнего хранилища.
- Для multi-stage Docker сборок и запусков см. `DEPLOYMENT.md`; переменные `APP_ENV` и stage‑override профили применяются на старте.
- Preview workflow использует secrets `PREVIEW_DEPLOY_HOST`, `PREVIEW_DEPLOY_USER`, `PREVIEW_DEPLOY_KEY`, опционально `PREVIEW_DEPLOY_BASE_DIR`, `PREVIEW_SECRETS_DIR`, `PREVIEW_DEPLOY_REGISTRY_USER/PASSWORD`, `PREVIEW_URL_TEMPLATE`, а также `IMAGE_REGISTRY_PREFIX` и `*_HOST_PORT`, чтобы поднимать временные окружения на выделенном сервере.

## Быстрые ссылки

- Подробные комментарии: `backend/env.example`, `frontend/` (Vite), `services/ai-advisor/.env.example`, `services/analytics/.env.example`.
- Чек‑листы по конфигурации и деплою: `DEPLOYMENT.md`, `docs/deployment-and-configuration.md`.
