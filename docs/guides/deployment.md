# Руководство по развёртыванию и конфигурации TZONA V2

Документ описывает минимальные требования, переменные окружения и рекомендуемые сценарии развёртывания проекта. Он дополняет README и `DEPLOYMENT.md`, собирая в одном месте информацию о backend, frontend, CDN и сторонних сервисах.

## 1. Компоненты и инфраструктура

| Компонент | Минимальные требования | Рекомендации
| --- | --- | --- |
| Backend (Node.js) | Node 18+, 2 CPU, 2 GB RAM | Docker image или systemd‑unit, reverse proxy c TLS (Nginx/Caddy) |
| Frontend (Vite + SSR/PWA) | Любой статический хостинг | Отдавать через CDN, включить HTTP/2 или HTTP/3 |
| PostgreSQL | 14+ | Управляемый сервис (Supabase, RDS). Включить регулярные бэкапы |
| Redis | 6+ | Выделенный инстанс с AOF + мониторинг задержек |
| Image Processor | Python microservice | Размещать рядом с backend, ограничить объём памяти |
| Telegram Bot | @BotFather token | Использовать `start-with-ngrok.sh` только для локальных тестов |

Дополнительно: объектное хранилище для CDN, monitoring/webhook endpoint, Supabase project (если используете аналитику через Supabase).

## 2. Конфигурация окружения

### 2.1 Backend `.env`

1. Скопируйте шаблон: `cp backend/env.example backend/.env`.
2. Заполните ключевые секции:
   - **База данных**: `DATABASE_URL`, `DIRECT_URL`, `PGBOUNCER_URL` (по желанию), `DATABASE_POOL_*` для пула соединений.
   - **Материализованные представления**: `MATERIALIZED_VIEW_SESSION_VOLUME_REFRESH_MS`,
     `MATERIALIZED_VIEW_PROFILE_SUMMARY_REFRESH_MS`, `MATERIALIZED_VIEW_RPE_REFRESH_MS` (периоды обновления MV для объёмов,
     сводки профилей и RPE распределений).
   - **Безопасность**: `JWT_SECRET`, `JWT_ROTATION_*`, `CSRF_SECRET`, `ENCRYPTION_SECRET`, `ALLOWED_ORIGINS`, `TELEGRAM_WEBAPP_SECRET`.
   - **Telegram**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_BOT_BASE_URL` (для proxy).
   - **Кеш и Redis**: `REDIS_URL`, `CACHE_*` (strategy, invalidation, compression, versioning, fallback, adaptive TTL).
   - **API‑ограничения**: `RATE_LIMIT_*`, `BODY_LIMIT_*`, `REQUEST_TIMEOUT_*`.
   - **Мониторинг и логирование**: `MONITORING_*`, `LOG_ENABLED`, `LOG_LEVEL`, `LOG_FILE_PATH`, `LOG_FILE_MAX_BYTES`, `LOG_FILE_MAX_BACKUPS`, `LOG_REDACT_KEYS`.
   - **Производительные метрики**: `PERF_METRICS_LATENCY_SAMPLE_SIZE`, `PERF_METRICS_THROUGHPUT_WINDOW_MS`, `PERF_METRICS_SLOW_THRESHOLD_MS`, `PERF_METRICS_SLOW_SAMPLE_SIZE` (объём сэмплов, окно throughput и границы «медленных» запросов для `/health`).
   - **Ресурсные метрики**: `RESOURCE_METRICS_SAMPLE_INTERVAL_MS`, `RESOURCE_METRICS_SNAPSHOT_TTL_MS` (интервал опроса CPU/памяти и TTL снапшота для `/health.resources`).
   - **Дашборды метрик**: `METRICS_DASHBOARD_SAMPLE_INTERVAL_MS`, `METRICS_DASHBOARD_HISTORY_SIZE` (частота и глубина истории для `/api/metrics/dashboard`).
   - **Архивирование**: `ARCHIVE_OPERATION_LOG_DAYS`, `ARCHIVE_OBSERVABILITY_DAYS`, `ARCHIVE_BATCH_SIZE`, `ARCHIVE_DRY_RUN` (retention и dry‑run для `npm run archive:data`).
   - **Health-check**: `HEALTH_SNAPSHOT_TTL_MS`, `HEALTH_MICROSERVICE_TIMEOUT_MS` (TTL кеша ответа `/health` и таймаут проверки микросервисов).
   - **CDN/медиа**: `MEDIA_BASE_URL`, `MEDIA_CDN_BASE_URL`, `MEDIA_CDN_SIGNING_*`.
    - **Image Processor**: `IMAGE_PROCESSOR_URL`, `IMAGE_PROCESSOR_MAX_WIDTH/HEIGHT`, `IMAGE_PROCESSOR_DEFAULT_FORMAT`, `IMAGE_PROCESSOR_ALLOWED_FORMATS`, `IMAGE_PROCESSOR_CACHE_TTL_SECONDS`.
  - **AI Advisor**: `AI_ADVISOR_PROVIDER`, `AI_ADVISOR_MODEL`, `AI_ADVISOR_BASE_PROMPT`, `AI_ADVISOR_TEMPERATURE`, `AI_ADVISOR_MAX_TOKENS`, `AI_ADVISOR_CONTEXT_MAX_ENTRIES`, `AI_ADVISOR_CONTEXT_TTL_MS`, `AI_ADVISOR_CONTEXT_MAX_CHARS`, пороги мониторинга `AI_ADVISOR_LATENCY_WARN_MS/CRITICAL_MS`, `AI_ADVISOR_COST_WARN_USD/CRITICAL_USD`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`.
   - **Документация**: `OPENAPI_SPEC_PATH` (если спецификация хранится вне репо).

> Совет: храните секреты в менеджере секретов (1Password, AWS Secrets Manager, Doppler). В CI передавайте их через `env` или GitHub Actions Secrets. Для Docker Secrets или внешних хранилищ используйте переменные с суффиксом `_FILE` (например, `TELEGRAM_BOT_TOKEN_FILE=/run/secrets/telegram_token`, `SUPABASE_SERVICE_KEY_FILE=/run/secrets/supabase_service_key`) — backend при старте прочитает содержимое файла и подставит его вместо обычной переменной.

### 2.2 Frontend `.env`

```
cp frontend/.env.example frontend/.env
```

- `VITE_API_BASE_URL` — публичный домен backend (`https://api.example.com/api`).
- `VITE_ASSET_BASE` — базовый путь для ассетов (по умолчанию `/`).
- `VITE_STATIC_CDN_BASE` — домен для статики (`https://cdn.example.com/`, если отличается от `VITE_API_BASE_URL`).
- `VITE_TELEGRAM_BOT_USERNAME` — для deep‑linking.
- `VITE_SERVICE_WORKER` и `ANALYZE_BUNDLE` — включают PWA и bundle reports по необходимости.

### 2.3 Telegram и WebApp

1. Создайте бота через @BotFather.
2. Настройте WebApp URL на публичный HTTPS фронтенд (или ngrok в dev).
3. Заполните `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_SECRET` и список доверенных пользователей (`TELEGRAM_ALLOWED_USER_IDS`).

### 2.4 AI Advisor microservice `.env`

1. Скопируйте шаблон: `cp services/ai-advisor/.env.example services/ai-advisor/.env`.
2. Укажите провайдера (`AI_ADVISOR_PROVIDER=openai|claude`), модель (`AI_ADVISOR_MODEL`), базовый prompt, температуру (`AI_ADVISOR_TEMPERATURE`) и лимит токенов (`AI_ADVISOR_MAX_TOKENS`).
3. Добавьте ключ `OPENAI_API_KEY` или `ANTHROPIC_API_KEY` в зависимости от выбранного провайдера и задайте `LOG_LEVEL/ENVIRONMENT` при необходимости.
4. При необходимости скорректируйте хранение контекста (`AI_ADVISOR_CONTEXT_MAX_ENTRIES`, `AI_ADVISOR_CONTEXT_TTL_MS`, `AI_ADVISOR_CONTEXT_MAX_CHARS`) и экономику вызовов (`AI_ADVISOR_COST_INPUT_PER_1K_USD`, `AI_ADVISOR_COST_OUTPUT_PER_1K_USD`), чтобы контролировать объём истории и фиксировать стоимость каждого ответа, которую backend отправляет в мониторинг.

## 3. Сценарии развёртывания

### 3.1 Локальная разработка

```bash
./start-dev.sh
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Postgres: используйте Docker (`docker compose up db redis`).
- Redis: локальный контейнер `redis:7`.
- Нажмите `npm run type-check --prefix backend/frontend` и соответствующие тестовые команды перед коммитом.

Для Telegram WebApp используйте `./start-with-ngrok.sh` — скрипт автоматически запускает ngrok и обновляет URL через Bot API.

### 3.2 Staging

1. Создайте отдельные базы и Redis инстансы.
2. Настройте CI workflow для ветки staging: `npm run type-check`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` (требуется staging DB).
3. Задеплойте backend через Docker image или PM2 (см. пример ниже).
4. Включите `CACHE_MONITORING_*`, `MONITORING_WEBHOOK_URL` с приватным Slack/Telegram каналом.

Пример systemd unit для backend:

```
[Service]
EnvironmentFile=/etc/tzona/backend.env
ExecStart=/usr/bin/npm run start --prefix /var/www/tzona/backend
Restart=on-failure
WorkingDirectory=/var/www/tzona/backend
```

### 3.3 Production

1. **Build**
   - Backend: `npm run build --prefix backend` (создаёт `dist/`).
   - Frontend: `npm run generate --prefix frontend` (SSR + SPA + offline manifest).
2. **Database**
   - Выполните `npm run prisma:migrate deploy --prefix backend` или прогоните SQL из `backend/migrations/`.
3. **Deploy**
   - Backend: выкладывайте содержимое `backend/dist` (или Docker image) за reverse proxy с TLS и HTTP/2 push отключён.
   - Frontend: загрузите `frontend/dist` и `frontend/dist/client` в CDN (`npm run deploy:cdn`).
4. **Post‑deploy**
   - Выполните cache warming: `npm run cache:warm --prefix backend` или перезапустите сервис (при включённом `CACHE_WARMING_ENABLED`).
   - Проверьте `/api/health`, `/api/docs`, `/api/profile/summary`.

### 3.4 Preview окружения (per PR)

Для каждого pull request можно автоматически поднять отдельный стек через workflow `deploy-preview.yml`:

1. **Хост**: подготовьте сервер с Docker/Compose и отдельным каталогом (по умолчанию `/opt/tzona/previews`). Убедитесь, что диапазон портов 40000+ доступен или задайте собственные значения через `BACKEND_HOST_PORT` и т.д. в `.env` превью.
2. **Секреты**: добавьте в Secrets репозитория `PREVIEW_DEPLOY_HOST`, `PREVIEW_DEPLOY_USER`, `PREVIEW_DEPLOY_KEY`, опционально `PREVIEW_DEPLOY_BASE_DIR`, `PREVIEW_SECRETS_DIR`, `PREVIEW_DEPLOY_REGISTRY_USER`/`PREVIEW_DEPLOY_REGISTRY_PASSWORD`, `PREVIEW_URL_TEMPLATE`. Workflow сам построит `IMAGE_REGISTRY_PREFIX=${REGISTRY}/${OWNER}` и передаст его в compose.
3. **Сборка и деплой**: workflow собирает все образы, пушит в реестр, копирует `docker-compose.yml`, создаёт `.env` с `IMAGE_TAG`, `IMAGE_REGISTRY_PREFIX` и динамическими портами, затем выполняет `docker compose pull/up` в каталоге превью.
4. **Комментарии и зачистка**: после выката публикуется комментарий в PR (URL и порт бэкенда). После закрытия PR job `cleanup` останавливает compose и удаляет директорию.

> Примечание: если нужно добавить собственные секреты (`backend.env`, `ai-advisor.env` и т.д.), положите их в локальный каталог и укажите `PREVIEW_SECRETS_DIR` — workflow скопирует файлы на сервер перед запуском compose.

## 4. Управление базой данных и миграциями

- В dev/staging используйте `npx prisma migrate dev`.
- В production рекомендуем pipeline:
  1. `npm run prisma:generate --prefix backend`
  2. `npm run prisma:migrate deploy --prefix backend`
  3. `npm run test:migrations --prefix backend` (использует отдельный URL `MIGRATIONS_DATABASE_URL`).
- SQL файлы в `backend/migrations/` исполняются в алфавитном порядке; префиксуйте файлы датой.

## 5. Логи, мониторинг и алёрты

- Логи backend: stdout + JSON (подхватывайте Fluent Bit/Vector).
- Мониторинг критических ошибок: задайте `MONITORING_WEBHOOK_URL` (Slack/Telegram) и `MONITORING_STORAGE_URL` (Supabase/Prisma таблица).
- Cache hit/miss: включите `CACHE_METRICS_ENABLED`, метрики отправляются в monitoring service.
- Slow query/Prisma telemetry: задайте `PRISMA_LOG_SLOW_QUERY_THRESHOLD_MS` и периодически запускайте `npm run report:slow-queries --prefix backend`.
- Connection pooling: после нагрузочного тестирования запускайте `npm run audit:pool --prefix backend` — отчёт `docs/connection-pool-report.md` покажет распределение подключений и доступный запас для пула.
- `/health` возвращает `database`, `logs` и `performance` (totals/latency/throughput/slowRequests).
Настройте окно и объём сэмплов через `PERF_METRICS_LATENCY_SAMPLE_SIZE`,
`PERF_METRICS_THROUGHPUT_WINDOW_MS`, `PERF_METRICS_SLOW_THRESHOLD_MS`,
`PERF_METRICS_SLOW_SAMPLE_SIZE`, чтобы health-check отражал нужный горизонт времени.
- Для всех исходящих HTTP-запросов backend включите keep-alive/пулинг через `HTTP_KEEP_ALIVE`, `HTTP_MAX_CONNECTIONS`,
`HTTP_KEEP_ALIVE_TIMEOUT_MS`, `HTTP_KEEP_ALIVE_MAX_TIMEOUT_MS`, `HTTP_CONNECT_TIMEOUT_MS`, `HTTP_HEADERS_TIMEOUT_MS` и
`HTTP_BODY_TIMEOUT_MS`, чтобы сократить накладные расходы на микросервисы и внешние API.

Для вкладки `resources` того же `/health` задайте частоту измерений и TTL кэша через
`RESOURCE_METRICS_SAMPLE_INTERVAL_MS` и `RESOURCE_METRICS_SNAPSHOT_TTL_MS`, чтобы операторы
видели актуальные CPU/память и очередь Prisma.

## 6. CDN, медиа и image-processor

- Настройте CDN правило: `/api/media/*` → backend origin.
- Image processor деплойте рядом с backend, укажите `IMAGE_PROCESSOR_URL` и ключ подписи (если требуется авторизация).
- Для управления качеством и форматом укажите `IMAGE_PROCESSOR_DEFAULT_FORMAT`, `IMAGE_PROCESSOR_ALLOWED_FORMATS`, `IMAGE_PROCESSOR_DEFAULT_MODE`, `IMAGE_PROCESSOR_ALLOWED_MODES`, `IMAGE_PROCESSOR_DEFAULT_BACKGROUND` и `IMAGE_PROCESSOR_STRIP_METADATA_DEFAULT` — backend автоматически проставит эти параметры в запросах к сервису.
- Кеширование ответов AI Advisor настраивается переменными `CACHE_ASSISTANT_AI_ADVICE_TTL_SECONDS` (TTL) и `CACHE_VERSION_AI_ADVISOR_ADVICE` (глобальный сброс при изменении формата ответа).
- Analytics микросервису требуется подключение к той же БД Postgres: укажите `ANALYTICS_DATABASE_URL`, размеры пула (`ANALYTICS_DB_POOL_MIN/MAX`), таймауты (`ANALYTICS_DB_STATEMENT_TIMEOUT_MS`) и ограничения выдачи (`ANALYTICS_STATS_WEEKLY_LIMIT`, `ANALYTICS_STATS_PROGRESS_LIMIT`, `ANALYTICS_AGGREGATE_WEEKLY_LIMIT`, `ANALYTICS_TOP_EXERCISE_LIMIT`).
- Кеширование ответов analytics настраивается переменными `ANALYTICS_CACHE_MAX_ENTRIES`, `ANALYTICS_CACHE_DEFAULT_TTL_SECONDS`, `ANALYTICS_CACHE_PROFILE_TTL_SECONDS`, `ANALYTICS_CACHE_AGGREGATE_TTL_SECONDS`, `ANALYTICS_CACHE_TRENDS_TTL_SECONDS`, `ANALYTICS_CACHE_GROUPED_TTL_SECONDS` и `ANALYTICS_CACHE_VISUALIZATION_TTL_SECONDS`. Предел результатов для сгруппированных выборок контролируется `ANALYTICS_GROUPED_RESULTS_LIMIT`.
- SSE-поток `/api/realtime/metrics` регулируется `ANALYTICS_REALTIME_UPDATE_INTERVAL_SECONDS`, `ANALYTICS_REALTIME_HEARTBEAT_SECONDS`, `ANALYTICS_REALTIME_IDLE_TIMEOUT_SECONDS` и `ANALYTICS_REALTIME_MAX_CLIENTS`.
- Чтобы ограничить нагрузку при батч-запросах статистики, задайте `ANALYTICS_BATCH_PROFILE_LIMIT` (по умолчанию 25 профилей за один запрос).
- Ограничьте запросы в микросервисах через переменные `*_RATE_LIMIT_REQUESTS`, `*_RATE_LIMIT_WINDOW_SECONDS`, `*_RATE_LIMIT_BLOCK_SECONDS` и `*_RATE_LIMIT_SKIP_PATHS` (например, `IMAGE_PROCESSOR_RATE_LIMIT_REQUESTS=120`). Те же префиксы (`AI_ADVISOR_`, `ANALYTICS_`) поддерживают собственные лимиты.
- Для фронтенда храните `cdn-manifest.json` и выполняйте `npm run deploy:cdn`, чтобы CDN получал правильные заголовки.

## 7. Полезные команды

| Операция | Команда |
| --- | --- |
| Проверка типов | `npm run type-check --prefix backend/frontend` |
| Линт кешей | `npm run check:duplicates --prefix backend` |
| Unit тесты | `npm run test:unit --prefix backend` |
| Integration тесты | `npm run test:integration --prefix backend` |
| E2E тесты | `npm run test:e2e --prefix backend` |
| Performance | `npm run test:performance --prefix backend` |
| Snapshot UI | `npm run test:snapshot --prefix frontend` |
| Аудит размера БД | `npm run audit:db-size --prefix backend` |
| Резервная копия БД | `npm run backup:database --prefix backend` |
| Генерация OpenAPI | (хранится в `docs/openapi.yaml`, отдаётся `/api/openapi.json`) |

## 8. Чек-лист перед релизом

1. Все переменные окружения заполнены (backend + frontend).
2. Prisma миграции применены, материализованные представления обновлены (`npm run views:refresh --prefix backend`).
3. Redis доступен, `CACHE_FALLBACK_ENABLED=true`.
4. `npm run type-check` и все тестовые пакеты прошли.
5. CDN содержит актуальные артефакты, `CACHE_VERSION_*` обновлены при изменении схемы.
6. Swagger `/api/docs` и `/api/health` возвращают 200.
7. Мониторинг получает тестовый инцидент (отправьте пробный `MONITORING_TEST_EVENT=true`).

Следуя этой инструкции, можно развернуть TZONA V2 на локальной машине, staging и production окружениях без обращения к исходному коду.
