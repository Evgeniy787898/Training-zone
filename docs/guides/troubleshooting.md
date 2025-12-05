# Руководство по устранению неполадок TZONA V2

Документ помогает быстро диагностировать и устранять проблемы, возникающие при разработке,
тестировании и эксплуатации платформы. Следуйте разделам в порядке возникновения симптомов.

## 1. Общие принципы

1. **Проверяйте план** — убедитесь, что актуальные переменные окружения и миграции применены.
2. **Трассируйте запросы** — каждый HTTP-запрос имеет `trace_id`; ищите его в логах и мониторинге.
3. **Не отключайте защиту** — все middleware (CSRF, rate limiting, trace, timeout) должны быть активны.
4. **Используйте реальную инфраструктуру** — локальные заглушки запрещены планом; работаем только с API и БД.

## 2. Настройка окружения

| Симптом | Проверки | Решение |
| --- | --- | --- |
| Backend не стартует | `ENCRYPTION_SECRET`, `JWT_SECRETS`, `CACHE_REDIS_URL` отсутствуют | Заполните обязательные переменные и запустите `npm run validate:env --prefix backend` |
| Ошибки TLS/прокси | Неверные `PUBLIC_URL`, `BOT_WEBHOOK_URL` | Укажите публичные адреса без лишних слешей, перезапустите бота |
| Migrations fail | Несовместимые версии Postgres/Prisma | Выполните `npm run prisma:migrate --prefix backend`, затем `npm run test:migrations --prefix backend` |

## 3. База данных и Prisma

1. **Connectivity**: убедитесь, что `DATABASE_URL` доступен и PgBouncer/connection pooling включены (`USE_DATABASE_POOLING`).
2. **Slow queries**: запустите `npm run report:slow-queries --prefix backend`; см. `docs/slow-query-report.md`.
3. **N+1**: проверьте `docs/prisma-n-plus-one-audit.md` и обновите select/pagination/relations.
4. **Health degradation**: middleware `databaseAvailability` переводит API в режим `Retry-After`; смотрите логи категории `database_unavailable`.

## 4. Кеш и Redis

- **Redis offline**: cache store переходит в режим fallback (событие `cache:fallback`). Проверьте `CACHE_REDIS_URL` и мониторинг.
- **Несвежие данные**: вызовите соответствующие функции инвалидции (например, `invalidateTrainingCatalogCache`).
- **Низкий hit ratio**: `cacheMetrics` пишет предупреждения при падении ниже порога `CACHE_MONITORING_WARN_RATIO`.

## 5. Backend (Node.js)

1. Запуск: `npm run dev --prefix backend` (или `start-dev.sh`). При ошибках проверяйте `logs/server.log` и `trace_id`.
2. Тесты: используйте `npm run test:unit|integration|e2e|performance|migrations --prefix backend`.
3. Популярные ошибки:
   - **CSRF 403**: проверьте, что фронтенд отправляет `x-csrf-token` и cookie `csrf_token` не истёк.
   - **JWT 401**: запустите `npm run tokens:revoke` и перевыпустите токен.
   - **Timeout 504**: оптимизируйте handler или расширьте `REQUEST_TIMEOUT_SOFT_MS`/`HARD_MS` в конфиге.

## 6. Frontend (Vue + VitePWA)

1. Запуск: `npm run dev --prefix frontend`.
2. Сервис-воркер: удалите `frontend/dist/.vite-pwa` и перезапустите dev-сервер, если stale ресурсы.
3. Проблемы с кешированием: очистите IndexedDB `tzona-cache` и localStorage ключи `tzona:*`.
4. Снимки/тесты: `npm run test:snapshot --prefix frontend`.
5. Ошибки сборки: запускайте `npm run analyze:bundle --prefix frontend` для поиска тяжёлых зависимостей.

## 7. Интеграции и микросервисы

- **Telegram бот**: убедитесь, что `BOT_TOKEN`, `TELEGRAM_WEBAPP_SECRET`, `BOT_WEBHOOK_URL` указаны. Перезапустите `telegrafBridge`.
- **Image processor**: проверьте `IMAGE_PROCESSOR_URL` и health-check; при недоступности отдаётся оригинал с логированием события `image_processor_unavailable`.

## 8. Мониторинг и логирование

1. Включите `MONITORING_WEBHOOK_URL` или Telegram-уведомления для критических событий.
2. Используйте `docs/performance-report.md`, `docs/duplicate-code-report.md`, `docs/prisma-n-plus-one-audit.md`.
3. Ошибки уровня 5xx автоматически создают записи в мониторинге; проверяйте `monitoring_events` таблицу.

## 9. Частые сценарии восстановления

| Сценарий | Действия |
| --- | --- |
| Повреждённый кеш | Очистите Redis (`FLUSHDB`), перезапустите `cacheWarmingService`, следите за hit ratio |
| Неконсистентные миграции | Откатите последнюю SQL-миграцию, примените заново, выполните `npm run test:migrations --prefix backend` |
| Проблемы с PWA | Выполните `navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))` в DevTools и перезагрузите |
| Не грузятся изображения | Проверьте `/api/media/...` в браузере, убедитесь, что `MEDIA_BASE_URL` верен и CDN проксирует заголовки |

## 10. Связанные документы

- [system-architecture.md](./system-architecture.md)
- [deployment-and-configuration.md](./deployment-and-configuration.md)
- [database-migrations.md](./database-migrations.md)
- [openapi.yaml](./openapi.yaml)
- [performance-report.md](./performance-report.md)

Поддерживайте документ в актуальном состоянии, фиксируйте новые сценарии и ссылки на автоматические отчёты.
