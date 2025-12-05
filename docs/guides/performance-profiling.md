# Профилирование производительности TZONA

Этот документ описывает, как снимать CPU профили для выявления узких мест в API. Скрипт не стартует сервер самостоятельно — перед запуском убедитесь, что backend уже поднят со всеми зависимостями (Postgres, Redis) и использует реальные данные.

## Скрипт профилирования

Запуск:

```bash
npm run profile:api --prefix backend
```

Параметры настраиваются через переменные окружения:

| Переменная | Значение по умолчанию | Описание |
| --- | --- | --- |
| `PROFILE_TARGET_URL` | `http://localhost:3000` | Базовый URL поднятого backend. |
| `PROFILE_TARGET_PATH` | `/api/health` | Маршрут, который будет нагружаться. |
| `PROFILE_DURATION_SECONDS` | `15` | Длительность прогона autocannon в секундах. |
| `PROFILE_CONNECTIONS` | `20` | Количество одновременных соединений. |
| `PROFILE_METHOD` | `GET` | HTTP-метод нагрузки. |
| `PROFILE_OUTPUT_DIR` | `.profiles` | Каталог для сохранения `.cpuprofile` файлов. |

Результат выполнения — CPU профиль в формате Chrome DevTools (`.cpuprofile`), путь выводится в консоль. Файлы автоматически сохраняются в каталоге `.profiles` (игнорируется в Git).

## Heap snapshots (анализ памяти)

Запуск:

```bash
npm run profile:heap --prefix backend
```

Переменные окружения:

| Переменная | Значение по умолчанию | Описание |
| --- | --- | --- |
| `HEAP_SNAPSHOT_DIR` | `.profiles` | Каталог, куда будет сохранён снимок. |
| `HEAP_SNAPSHOT_NAME` | `heap-<timestamp>.heapsnapshot` | Имя файла; можно задать вручную. |
| `HEAP_SNAPSHOT_DELAY_MS` | `0` | Задержка перед снятием снапшота, полезна для воспроизведения утечек. |

Снимок сохраняется в формате, совместимом с Chrome DevTools/Node.js Heap snapshot viewer. Каталог `.profiles/` уже исключён из Git.

## Bundle size budget

Для контроля размеров фронтенд-сборки используйте бюджетный чек:

```bash
npm run check:bundle --prefix frontend
```

Параметры:

| Переменная | Значение по умолчанию | Описание |
| --- | --- | --- |
| `VITE_BUNDLE_BUDGET_KB` | `900` | Совокупный бюджет для JS/CSS/asset-файлов по manifest.json. |
| `VITE_DROP_CONSOLE` | `true` | Удалять `console`/`debugger` при сборке для уменьшения бандла. |

Скрипт читает `dist/manifest.json` после `npm run build` и возвращает ошибку, если бюджет превышен.

## EXPLAIN ANALYZE отчёты

Для точечной оптимизации SQL запросов используйте утилиту `explainAnalyze`:

```bash
npm run audit:explain --prefix backend -- --file backend/sql/explain-queries.sql
```

- Требуется подключение к базе через `DATABASE_URL`.
- Входной файл содержит набор запросов с директивами `-- name:` для подписей в отчёте.
- Результат записывается в `docs/explain-analyze-report.md` и включает `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` для каждого запроса.
- Перед запуском подставьте реальные значения параметров (например, `profile_id`, диапазоны дат) в файл запросов.

## Анализ результата

1. Откройте Chrome DevTools → Performance → Load profile и выберите полученный файл.
2. Ищите горячие функции, долгие запросы к внешним сервисам и непрерывные GC-паузы.
3. Сопоставляйте пики с логами (`npm run analyze:logs --prefix backend`).
4. Фиксируйте найденные узкие места в `PLAN_IMPROVEMENTS.md` и переносите карточки по Trello-доске `docs/team-collaboration-board.md`.

## Рекомендации

- Прогоняйте профилирование на staging с максимально приближёнными к прод данным.
- Используйте целевые сценарии (например, `PROFILE_TARGET_PATH=/api/sessions?page=1&page_size=50`).
- При сравнении результатов сохраняйте файлы в отдельных подкаталогах `.profiles/<дата>/`.
- После оптимизаций повторяйте прогон для подтверждения улучшений.
