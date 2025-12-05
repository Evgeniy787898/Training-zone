# Документация по миграциям БД

Этот документ описывает, как разрабатывать, тестировать и выкатывать SQL-миграции для базы данных TZONA V2. Он дополняет `docs/deployment-and-configuration.md` и предназначен для всех инженеров, которые меняют структуру данных или индексы.

## Стек и расположение файлов

- **СУБД**: PostgreSQL 14+
- **ORM**: Prisma 5
- **Каталог миграций**: `backend/migrations/*.sql` (файлы применяются в лексикографическом порядке).
- **Схема Prisma**: `backend/prisma/schema.prisma`
- **Проверка миграций**: `npm run test:migrations --prefix backend` (см. `backend/src/tests/migrations`).

Каждая миграция хранится в виде самостоятельного SQL-файла с именем `YYYYMMDDHHMMSS_short-description.sql`. Таймстамп гарантирует порядок применения, а короткое описание помогает быстро понять назначение.

## Рабочий процесс

1. **Проектирование**
   - Оцените влияние на текущую схему и данные.
   - Убедитесь, что изменения отражены в `schema.prisma`, если они затрагивают модели Prisma.
   - Подготовьте план отката (например, обратная миграция или скрипт очистки).

2. **Создание миграции**
   - Для простых изменений используйте `npx prisma migrate diff --from-empty --to-schema-datamodel-path=backend/prisma/schema.prisma --script > backend/migrations/<timestamp>_<name>.sql` либо другой SQL-генератор.
   - Для сложных операций (материализованные представления, специфичные индексы, данные для отчётов) напишите SQL вручную.
   - Все миграции должны быть идемпотентными: проверяйте наличие объектов (`IF NOT EXISTS`) и не полагайтесь на внешнее состояние.

3. **Локальное применение**
   - Настройте `DATABASE_URL` в `.env`.
   - Выполните `psql $DATABASE_URL -f backend/migrations/<file>.sql` или прогоните все миграции через `npm run test:migrations --prefix backend` (см. раздел ниже).
   - После применения миграций перегенерируйте Prisma клиент: `npm run db:generate --prefix backend`.

4. **Тестирование**
   - Обязателен запуск `npm run test:migrations --prefix backend`. Тесты:
     - Сбрасывают схему в тестовой базе (используется `MIGRATIONS_TEST_DATABASE_URL` либо `TEST_DATABASE_URL`).
     - Применяют **все** SQL-файлы по порядку.
     - Проверяют наличие обязательных таблиц, индексов, materialized views и enum-типов.
   - Если миграция меняет бизнес-логику, дополняйте unit/integration тесты, чтобы убедиться, что Prisma и сервисы используют новую схему.

5. **Доставка**
   - **Development**: `npm run db:push --prefix backend` для синхронизации схемы, затем выполните SQL-модуль (например, `psql` или миграционный контейнер).
   - **Staging/Production**:
     - Скопируйте новый файл в каталог миграций сервера (либо используйте CD-пайплайн).
     - Выполните SQL в транзакции: `psql $DATABASE_URL -v ON_ERROR_STOP=1 -f backend/migrations/<file>.sql`.
     - Наблюдайте за мониторингом и прогоните smoke-тесты/`npm run test:e2e --prefix backend` против обновлённого окружения.

6. **Откат**
   - При необходимости создайте *обратную* миграцию (ещё один SQL-файл), которая отменяет изменения.
   - Никогда не редактируйте уже опубликованные файлы — все правки делайте через новую миграцию.

## Миграции, генерируемые Prisma

Для feature-веток можно использовать `npm run db:migrate --prefix backend`, чтобы Prisma создал временную миграцию. Перед merge необходимо преобразовать результат в финальный SQL-файл (либо зафиксировать вывод `prisma migrate diff`) и удалить локальные артефакты `.prisma/migrations`.

## Согласование со скриптами

Некоторые runtime-скрипты зависят от готовых объектов:

- Materialized views (`session_volume_mv`, `profile_rpe_distribution_mv`)
- Индексы для JSON-колонок (`dialog_states_session_status_idx`, `assistant_notes_metadata_archived_idx`)
- Партиционированные таблицы журналов (`operation_log`, `observability_events`) — используются hash-партиции по `id` с четырьмя
  сегментами (`_p0`…`_p3`) и требуются индексы `operation_log_profile_created_at_idx`, `operation_log_status_created_at_idx`,
  `observability_events_profile_id_idx`, `observability_events_category_severity_recorded_at_idx`.

При изменении этих сущностей обязательно обновляйте:

1. Тест `backend/src/tests/migrations/migrations.spec.ts`
2. Любые скрипты/сервисы, которые читают данные из новых таблиц или индексов

## Чек-лист перед merge

- [ ] SQL-файл размещён в `backend/migrations/` и отсортирован по таймстампу
- [ ] Схема Prisma обновлена и `npm run type-check --prefix backend` выполняется успешно
- [ ] Прогнан `npm run test:migrations --prefix backend`
- [ ] Обновлены связанные тесты/документация
- [ ] Описано влияние миграции в PR (какие таблицы/индексы созданы, есть ли даунтайм)

Соблюдение этих правил гарантирует, что база данных развивается предсказуемо, а изменения безопасно выкатываются на все окружения.
