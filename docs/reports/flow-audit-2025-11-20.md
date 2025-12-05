# TZONA V2 — Аудит пользовательских флоу (20.11.2025)

## Методология
- Проанализированы основные frontend composables/страницы (`frontend/src/services/api.ts`, `frontend/src/pages/ExercisesPage.vue`, `frontend/src/modules/profile/components/PinScreen.vue`) и backend маршруты (`backend/src/index.ts`, `backend/src/routes/*.ts`).
- Поиск по коду (`rg placeholder`, `rg mock`, `rg todo`) показал, что заглушки ограничены UI-placeholder'ами и dev-инструментами.
- Проверен результат `npm run check:prisma-drift` — синхронизация схемы подтверждена (см. `backend/src/scripts/checkPrismaDrift.ts`).

## Ключевые пользовательские сценарии

### 1. Аутентификация и PIN
- Frontend: `frontend/src/services/api.ts:177-220` использует реальный POST `/auth/verify-pin` и `/auth/telegram`.
- Backend: `backend/src/routes/auth.ts:310-715` хэширует PIN, использует Prisma и выдает JWT/CSRF.
- Вывод: флоу полностью «боевой», заглушек нет.

### 2. Каталог направлений и программ
- Frontend обращается к `/training-disciplines` и `/training-programs` (см. `frontend/src/services/api.ts:555-575`, `frontend/src/pages/ExercisesPage.vue:944-1282`).
- Backend реализует `GET /api/training-disciplines` и `GET /api/training-programs` с Prisma и кешированием (`backend/src/index.ts:701-779`).
- Единственный placeholder — `placeholderProgram` в UI (`frontend/src/composables/useTrainingDisciplines.ts:71-93`). Он отображается только до прихода реальных данных и не подменяет API.

### 3. Управление тренировочными сессиями
- Frontend методы `/sessions` (`frontend/src/services/api.ts:420-466`) используются экранами планирования.
- Backend маршруты `/api/sessions/*` (`backend/src/routes/sessions.ts:69-262`) читают/пишут данные через `SessionService`.
- Заглушек нет, все операции идут через БД.

### 4. Профиль, достижения, метрики
- Frontend (`frontend/src/services/api.ts:470-520`) обращается к `/profile/summary`, `/achievements`, `/metrics`.
- Backend обрабатывает через `backend/src/routes/profile.ts` и `backend/src/routes/achievements.ts`.
- Ответы содержат реальные вычисленные данные и завязаны на Prisma/Redis.

### 5. Daily Advice и тренировочные рекомендации
- Frontend вызывает `/daily-advice` (`frontend/src/services/api.ts:611-619`) и `/assistant/*`.
- Backend (`backend/src/routes/dailyAdvice.ts`, `backend/src/routes/assistant.ts`) подключает Supabase/AI сервисы.
- Placeholder'ов нет, кроме fallback'ов при недоступности сервисов (сообщаются пользователю).

## Выявленные остаточные placeholder'ы

| Модуль | Тип | Детали | Риск |
| --- | --- | --- | --- |
| `frontend/src/composables/useTrainingDisciplines.ts:71-93` | UI placeholder | Карточка «Новое направление» до загрузки данных | Низкий, пользователь получает сообщение «Скоро». |
| `frontend/src/services/performance.ts:160-173` | Dev logging | `reportToAnalytics()` пока только пишет в консоль | Низкий, не влияет на UX. Можно завести задачу на интеграцию с analytics. |

Других заглушек/моков в production-пути не обнаружено.

## Рекомендации
1. **Мониторинг аналитики** — интегрировать `performanceMonitor.reportToAnalytics()` с бекендом или внешним сервисом (P2).
2. **Документация** — добавить раздел о placeholder-карточке в storybook/design-doc, чтобы новые разработчики понимали её назначение (P2).

## Пост-аудит изменения
- Карточка «Новое направление» отображается только при пустом списке направлений, так что пользователь всегда видит реальные данные из API.
- `performanceMonitor.reportToAnalytics()` отправляет метрики в `/api/metrics/performance`, где они логируются через систему мониторинга.

## Итог
Задача 7.1 выполнена: проведен аудит ключевых пользовательских сценариев, подтверждено отсутствие критичных заглушек в продакшн-флоу. Оставшиеся placeholder'ы являются осознанными UX-элементами и не блокируют пользователей.
