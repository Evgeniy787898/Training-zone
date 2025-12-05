# Руководство по мониторингу и логированию TZONA V2

Документ описывает все слои наблюдаемости платформы, правила конфигурации
и практики реагирования. Система построена на связке структурированных логов,
встроенного сервиса мониторинга и внешних алёртов (webhook/Telegram).

## 1. Структурированные логи

- Все HTTP‑запросы проходят через `traceContext` и централизованный
  `errorHandler`, которые присваивают `trace_id`, фиксируют `resource`,
  `profile_id`, код ошибки и классификацию (`validation`, `auth`,
  `dependency`, `internal`).
- Новый сервис `logger` пишет каждую запись в формате NDJSON и одновременно
  выводит её в stdout (можно отключить через `LOG_ECHO_TO_CONSOLE=false`).
- Логи сохраняются в `logs/application.ndjson` и автоматически ротируются:
  `LOG_FILE_MAX_BYTES` контролирует размер файла (по умолчанию 5 МБ),
  `LOG_FILE_MAX_BACKUPS` — количество архивов. Ротация не требует перезапуска.
- Все чувствительные поля (headers `Authorization`, токены, пароли) и строки,
  совпадающие с паттернами `LOG_REDACT_KEYS/LOG_REDACT_PATTERNS`,
  автоматически заменяются на `[redacted]`.
- Критические ошибки (`level=error`) автоматически отправляют событие в
  `monitoring` и могут триггерить Telegram/webhook алёрты через
  `LOG_ALERT_ON_ERROR=true`.
- Конфигурация:
  - `LOG_ENABLED` — глобальный флаг.
  - `LOG_LEVEL` — минимальный уровень (`debug`, `info`, `warn`, `error`).
  - `LOG_FILE_PATH` — путь к NDJSON‑файлу.
  - `LOG_ECHO_TO_CONSOLE` — выводить ли записи в stdout.
  - `LOG_REDACT_KEYS`, `LOG_REDACT_PATTERNS` — списки ключей/regex для
    скрытия секретов.
- Для локального поиска и разбора используйте `npm run analyze:logs --prefix backend`:
  ```bash
  npm run analyze:logs --prefix backend -- --level=warn --text=profile --limit=20
  npm run analyze:logs --prefix backend -- --trace=TRACE_ID --json
  ```

## 2. Мониторинг и события

Сервис `monitoring` принимает структурированные события:

- `error` — все 5xx, таймауты, circuit breaker, неудачные запросы к БД
  (см. `monitoring.emitError`).
- `cache` — показатели `hit/miss`, fallback Redis → memory, адаптивный TTL.
- `performance` — медленные запросы Prisma (`prismaQueryLogging`) и отчёт
  `docs/slow-query-report.md`.
- `performance_metrics` — агрегаты latency/throughput HTTP‑запросов
  (сервис `performanceMetrics`, данные доступны на `/health.performance`).
- `business_metrics` — активные пользователи, статус сессий и награды за
  скользящее окно (`/health.business`, сервис `businessMetrics`).
- `dependencies` — состояние Redis (fallback/режим), микросервисы (latency,
  код ошибки), база данных и SLA здорового состояния (`/health.dependencies`).
- `security` — попытки обхода валидации, XSS, CSRF.
- `ai_advisor` — `ai_advice_generated` и `ai_advice_fallback` фиксируют latency и стоимость вызовов LLM по порогам `AI_ADVISOR_LATENCY_*`/`AI_ADVISOR_COST_*`.

События сохраняются в таблицу Prisma (JSON column) и, при необходимости,
могут быть ретранслированы во внешние системы.

## 3. Алерты

- Webhook: `MONITORING_WEBHOOK_URL`, `MONITORING_WEBHOOK_TOKEN`.
- Telegram: `MONITORING_TELEGRAM_BOT_TOKEN`, `MONITORING_TELEGRAM_CHAT_ID`.
- Триггеры: критические ошибки, деградация БД, cache fallback, низкий hit
  ratio, превышение SLA по времени ответа.
- Пороговые значения задаются через `MONITORING_ALERT_THRESHOLD_*` и
  конфигурацию в `constants.ts`.

## 4. Метрики кеша

- `cacheMetrics` собирает hits/misses для Redis и памяти, экспортирует
  агрегаты в мониторинг и пишет structured log с `namespace`, `scope`,
  `hit_ratio`. Интервалы регулируются `CACHE_METRICS_INTERVAL_MS`.
- Для расследования проблем доступны команды:
  ```bash
  npm run check:duplicates --prefix backend   # контроль дубликатов логики
  npm run audit:nplusone --prefix backend     # отчёт по N+1
  npm run report:slow-queries --prefix backend
  ```

## 5. Dashboards и артефакты

- `/api/metrics/dashboard` — агрегированный срез метрик для графиков. Возвращает
  последние `METRICS_DASHBOARD_HISTORY_SIZE` измерений, собранных раз в
  `METRICS_DASHBOARD_SAMPLE_INTERVAL_MS`. Содержит производительные,
  ресурсные и бизнес-метрики плюс статусы зависимостей.
- `docs/performance-report.md` — результаты нагрузочных тестов.
- `docs/prisma-n-plus-one-audit.md`, `docs/slow-query-report.md` — отчёты по
  БД.
- `docs/duplicate-code-report.md` — контроль архитектурных правил.
- Эти файлы публикуются в CI и должны храниться как артефакты релиза.

## 6. Мониторинг контейнеров

- В docker-compose включён `cadvisor` (порт 8080) для метрик CPU/Memory/IO по
  всем контейнерам. Формат совместим с Prometheus, можно подключать scrape.
- Если облачная платформа уже снимает метрики контейнеров, отключите сервис
  через профиль или удалите его из `docker-compose.yml`.

## 7. Настройка окружения

| Переменная | Назначение |
| --- | --- |
| `LOG_ENABLED`, `LOG_LEVEL` | Управление логированием и минимальным уровнем |
| `LOG_FILE_PATH`, `LOG_FILE_MAX_BYTES`, `LOG_FILE_MAX_BACKUPS` | Путь и параметры ротации файлов |
| `LOG_ECHO_TO_CONSOLE` | Дублировать ли логи в stdout |
| `LOG_ALERT_ON_ERROR` | Включить алёрты на уровне логгера |
| `LOG_REDACT_KEYS`, `LOG_REDACT_PATTERNS` | Маскирование конфиденциальных данных |
| `MONITORING_WEBHOOK_URL/AUTH_HEADER` | Параметры webhook‑интеграции |
| `MONITORING_TELEGRAM_BOT_TOKEN/CHAT_ID` | Telegram уведомления |
| `CACHE_METRICS_INTERVAL_MS` | Частота отправки hit/miss |
| `PERF_METRICS_LATENCY_SAMPLE_SIZE`, `PERF_METRICS_THROUGHPUT_WINDOW_MS`, `PERF_METRICS_SLOW_THRESHOLD_MS`, `PERF_METRICS_SLOW_SAMPLE_SIZE` | Управляют размером сэмплов и окном для `/health.performance` |
| `BUSINESS_METRICS_LOOKBACK_DAYS`, `BUSINESS_METRICS_CACHE_TTL_MS` | Окно активности и TTL кеша для `/health.business` |
| `RESOURCE_METRICS_SAMPLE_INTERVAL_MS`, `RESOURCE_METRICS_SNAPSHOT_TTL_MS` | Частота и TTL снапшота CPU/память/DB (`/health.resources`) |
| `METRICS_DASHBOARD_SAMPLE_INTERVAL_MS`, `METRICS_DASHBOARD_HISTORY_SIZE` | Частота и глубина истории для `/api/metrics/dashboard` |
| `HEALTH_SNAPSHOT_TTL_MS`, `HEALTH_MICROSERVICE_TIMEOUT_MS` | TTL кеша ответа `/health` и таймаут проверки микросервисов |
| `CACHE_STAMPEDE_*`, `CACHE_ADAPTIVE_TTL_*` | Тонкая настройка кеша |

## 8. Процесс реагирования

1. Алёрт приходит в выбранный канал (webhook или Telegram) с `trace_id`.
2. По `trace_id` ищем соответствующие записи в логах (stdout/observability
   стек) и, при необходимости, в `monitoring_events` БД.
3. Используем отчёты (`docs/*`) для дополнительного контекста.
4. После исправления фиксируем результат в changelog и запускаем набор
   тестов: `npm run type-check`, `npm run test:unit`, `npm run test:integration`.

## 9. Лучшие практики

- Для длительных задач включайте `traceContext.runWithTrace` — так фоновые
  процессы будут логировать с тем же trace id.
- Любые новые сервисы должны отправлять события через `monitoring.emit*`.
- В PR проверяйте, что новые переменные окружения добавлены в `env.example`
  и задокументированы в `docs/deployment-and-configuration.md`.

### 9.1 Мониторинг медленных запросов Prisma

- Сервис `prismaQueryLogging` фиксирует все запросы, превышающие порог
  `PRISMA_SLOW_QUERY_THRESHOLD_MS`, и пробрасывает их в `monitoring`.
- Агрегированные метрики (`total`, последний слоупрос, P95 по последним
  длительностям) попадают в `health.metrics.slowQueries` и видны на
  `/health`/`/api/health` вместе с остальными метриками.
- История и лог‑файл управляются через `PRISMA_SLOW_QUERY_*` переменные;
  включайте их при расследовании регрессий БД.

## 10. Метрики микросервисов

- Каждый Python‑сервис (image-processor, analytics, AI advisor) подключает
  общее middleware `MetricsMiddleware`, которое считает длительность HTTP
  запросов, статусы и ошибки.
- Метрики доступны по `GET /api/metrics` в JSON‑виде: `totals`, детализация
  по endpoint, кастомные счётчики (`advices.generated`, `stats.generated`,
  `image_processor.bytes_in/out`) и агрегаты по операциям (`optimize`,
  `fetch_stats`, `generate_advice`).
- Эндпоинты совместимы с внешними сборщиками (Prometheus pushgateway,
  мониторинговые агенты) — просто опрашивайте URL и публикуйте данные в
  нужную систему.

## Web Vitals

- Frontend отправляет Core Web Vitals на `/api/metrics/web-vitals` (SSE не требуется).
- Поддерживаемые метрики: CLS, FID, INP, LCP, TTFB, FCP; значения и рейтинг (good/needs-improvement/poor) попадают в мониторинг.
- Настройка: метрики включены по умолчанию после загрузки клиента, запросы отправляются с `keepalive` и привязаны к `trace_id`.

## 11. Синтетический мониторинг

- Скрипт `npm run synthetic:monitor --prefix backend` читает `SYNTHETIC_MONITOR_TARGETS`
  (JSON массив либо строки `name|url|type|method|statuses|timeout`) и
  последовательно пингует API/CDN эндпоинты с заданными таймаутами и
  статусами. При ошибке или неожиданном статусе создаётся событие
  `synthetic-monitor` через встроенный сервис мониторинга.
- Глобальные заголовки можно задать через
  `SYNTHETIC_MONITOR_DEFAULT_HEADERS` (JSON словарь), таймаут по умолчанию —
  `SYNTHETIC_MONITOR_DEFAULT_TIMEOUT_MS` (значение из `.env`).
- Workflow `synthetic-monitor.yml` в GitHub Actions запускается каждые 15
  минут (и вручную через `workflow_dispatch`). Передайте секрет
  `SYNTHETIC_MONITOR_TARGETS`, а также существующие `MONITORING_WEBHOOK_URL`
  / `MONITORING_TELEGRAM_*`, чтобы получать алёрты.
