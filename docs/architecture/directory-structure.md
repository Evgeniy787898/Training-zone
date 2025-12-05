# Directory Structure Guide

## Backend (`backend/`)
- `src/index.ts` — точка входа HTTP сервера и регистрация middleware.
- `src/app/` — инфраструктура жизненного цикла (ApplicationLifecycle и тесты).
- `src/routes/` — все HTTP-маршруты; общие вспомогательные модули перенесены в `src/routes/shared/`.
- `src/modules/<feature>/` — доменно-ориентированные слои (например, `modules/sessions` содержит `application/` и `infrastructure/`). Доменные типы располагаются в `domain/` (при необходимости). Только application-слой может ссылаться на инфраструктуру, а маршруты обращаются к application через DI.
- `src/services/` — кросс-доменные сервисы (Prisma, кеш, мониторинг, security utilities).
- `src/scripts/` — одноразовые и утилитарные скрипты (аудиты, миграции, бэкапы).
- `src/tests/` — e2e, performance и вспомогательные утилиты для тестов.
- `docs/` — архитектурные планы и отчёты (см. flow/security audit).

## Frontend (`frontend/`)
- `src/modules/` — feature-модули (auth, training, profile).
- `src/composables/` — переиспользуемые Composition API хуки (напр. `useTrainingDisciplines`).
- `src/services/` — HTTP клиенты, перфоманс монитор.
- `src/features/` — инфраструктурные фичи (prefetch, core hooks).
- `src/pages/` — маршруты приложения.

## Документы
- `docs/flow-audit-2025-11-20.md` — актуальный аудит пользовательских флоу.
- `docs/security-audit-2025-11-20.md` — аудит безопасности API.
- `docs/directory-structure.md` — текущий документ.
