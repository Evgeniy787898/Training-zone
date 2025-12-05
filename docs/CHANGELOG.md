# Changelog

Этот документ фиксирует все значимые изменения TZONA V2. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/)
и подразумевает нумерацию версий по дате релиза. Все записи должны описывать реальные изменения без ссылок на несуществующие
фичи.

## [Unreleased]
- Плановые улучшения из блоков 12–13 (микросервисы и AI advisor) готовятся и будут добавлены в будущие релизы.
- Следите за `PLAN_IMPROVEMENTS.md` для оперативного статуса незавершённых задач.
- Добавлены профили окружений через `APP_ENV` (development/staging/production) с профильными порогами логов, rate limits и namespace кэша.
- operation_log и observability_events переведены на hash-партиционирование для разгрузки горячих журналов.
- Экспорт аналитики теперь доступен через `/api/export` с поддержкой JSON и CSV форматов и обновлённой документацией.
- Добавлен автодеплой workflow `deploy.yml`, который после успешных проверок собирает и публикует образы (backend, image-processor, AI advisor, analytics) и выкатывает их через SSH на целевой хост.
- Добавлен отдельный staging workflow `deploy-staging.yml`, который собирает образы с тегом `staging-*`/`:staging` и выкатывает их на тестовое окружение с собственными секретами.
- Добавлен post-deploy `smoke.yml`, который после успешного выката (или вручную) вызывает `npm run test:smoke --prefix backend` для проверки `/api/health`, `/api/openapi.json` и health микросервисов.
- Workflow деплоя (production/staging) теперь в финальном job отправляет событие в мониторинг через `npm run report:deployment --prefix backend`, используя `MONITORING_WEBHOOK_URL` или Telegram.
- Уведомления деплоя поддерживают `ALERT_TELEGRAM_*`, а Buildx шаги используют cache-to/from (gha) вместе с кешом Prisma engines в CI job для ускорения сборок.
- Workflow деплоя теперь сохраняет предыдущий тег и автоматически откатывает docker-compose до него при неудачной выкладке; добавлены инструкции по ручному rollback.
- Добавлен workflow `deploy-preview.yml`, который собирает образы для каждого PR, разворачивает стек с динамическими портами/`IMAGE_REGISTRY_PREFIX` на preview-хосте, публикует комментарий и удаляет окружение после закрытия PR.
- Workflow `synthetic-monitor.yml` и CLI `npm run synthetic:monitor --prefix backend` реализуют синтетический мониторинг ключевых API/CDN эндпоинтов (SYNTHETIC_MONITOR_TARGETS + alerting через webhook/Telegram) с обновлёнными README/DEPLOYMENT/environment docs.
- `deploy-staging.yml` и preview workflow теперь передают `IMAGE_REGISTRY_PREFIX`, чтобы docker-compose consistently использовал один и тот же реестр.
- Добавлен realtime SSE-поток `/api/realtime/metrics` в analytics сервисе с документацией, примерами и конфигурацией.
- В analytics микросервисе появились фильтры и группировка `/api/grouped-metrics` с официальной схемой, примерами запросов и новыми переменными окружения для кэша.
- Появился API визуализаций `/api/visualizations`, который отдаёт готовые диаграммы (тренды, дисциплины, завершённость программ) вместе с новым примером использования и настройкой TTL кэша.
- Добавлен документ `docs/design-redesign.md` с компактным редизайном (токены, сетка, состояния) и ссылкой из README.
- Централизованное JSON-логирование с ротацией файлов, маскированием секретов, метриками `/health` и CLI `npm run analyze:logs --prefix backend`.
- Добавлен архиватор исторических логов/событий (`npm run archive:data --prefix backend`) с настраиваемыми retention и batch-параметрами.
- Добавлено материализованное представление `profile_summary_mv` с конфигурируемым обновлением для ускорения расчёта сводок профилей.
- Добавлена Prisma-мидлварь для оптимизации JSON полей (очистка undefined, сортировка ключей) перед шифрованием/записью.
- Аудит индексов Postgres через `npm run audit:indexes --prefix backend` c отчётом в `docs/database-index-audit.md`.
- Добавлен аудит connection pooling через `npm run audit:pool --prefix backend` с отчётом в `docs/connection-pool-report.md`.
- Добавлен аудит размера БД через `npm run audit:db-size --prefix backend` с отчётом в `docs/database-size-report.md`.
- Добавлен CLI `npm run backup:database --prefix backend` и регламент `docs/backup-strategy.md` для резервного копирования и восстановления Postgres.
- README/DEPLOYMENT/docs/environment-variables обновлены: описаны preview секреты, новые переменные `IMAGE_REGISTRY_PREFIX` и `*_HOST_PORT`, а также инструкция по настройке preview окружений.
- `/health` теперь включает агрегаты latency/throughput/slowRequests благодаря новому middleware `performanceMetrics`; настройки доступны через `PERF_METRICS_*` и задокументированы в README/DEPLOYMENT.
- Docker-окружение теперь поддерживает версионирование образов через `IMAGE_TAG`, загрузку секретов через Docker secrets, graceful shutdown/stop grace, сервис `cadvisor` для мониторинга ресурсов и обновлённые инструкции по запуску.
- `/health` теперь дополнен разделом `resources` (CPU, память, очередь Prisma) с настраиваемыми интервалами через `RESOURCE_METRICS_*` и обновлённой документацией.
- `/api/metrics/dashboard` публикует историю производительных, ресурсных и бизнес-метрик для построения графиков; интервалы и глубина истории управляются `METRICS_DASHBOARD_*` и задокументированы в руководстве по мониторингу.
- Добавлена утилита `npm run audit:explain --prefix backend` для генерации EXPLAIN ANALYZE отчётов в `docs/explain-analyze-report.md`.

## [2024-12-17] — Полная стабилизация платформы
### Добавлено
- Официальная OpenAPI 3.1 спецификация (`docs/openapi.yaml`) и Swagger UI по `/api/docs`.
- Новый CDN-ориентированный медиа-роут `/api/media/exercise-levels/:exerciseKey/:level/:slot` с поддержкой image-processor.
- Полный набор документации: архитектура, деплой, миграции, troubleshooting, мониторинг и практические примеры API.
- Автоматические проверки: type-check GitHub Actions, duplicate-code аудит, N+1 и slow-query репорты.
- Единый cacheStrategy с distributed Redis, adaptive TTL, warming, stampede protection и fallback на memory store.
- Service worker, lazy routes/components, виртуальные списки, memo helpers и критический prefetch на фронтенде.

### Исправлено
- Устранены все обнаруженные дублирования кода, введены единые утилиты/паттерны.
- Закрыты все блоки по безопасности (JWT ротация, CSRF, CSP, XSS, body limits, path security, access control).
- Устранены «сырые» Prisma запросы и добавлены missing indexes, JSON выражения и материализованные представления.
- Восстановлен корректный прогрев кэша и синхронизация Supabase отчётов с материализованными view.

### Тесты
- Введены unit, integration, E2E, perf, security, migration и snapshot тесты, которые выполняются отдельными npm-скриптами.

## [2024-11-30] — Базовый релиз TZONA V2
### Добавлено
- Express + Prisma backend, Vue 3 WebApp, Redis и Postgres инфраструктура.
- Telegram WebApp PIN-аутентификация, базовые сессии/программы/достижения/советы.
- Первые скрипты миграций, seed и apply content.

### Известные ограничения
- Требовалась серьёзная работа по безопасности, кешированию, тестам и документации (закрыто в последующих релизах).

---

## Как обновлять этот файл
1. Создавайте новый раздел с датой релиза после завершения набора задач.
2. Группируйте изменения по блокам «Добавлено», «Изменено/Исправлено», «Удалено», «Безопасность», «Тесты» и т.д.
3. Ссылайтесь на конкретные файлы/подсистемы и избегайте расплывчатых формулировок.
4. Не переносите в changelog незавершённые работы — их место в `PLAN_IMPROVEMENTS.md`.
