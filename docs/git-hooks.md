# Git Hooks

В проекте TZONA настроены автоматические проверки через Husky и lint-staged.

## Обзор

| Hook | Когда срабатывает | Что делает |
|------|-------------------|------------|
| `pre-commit` | Перед каждым коммитом | Форматирование, линтинг, type-check |

## Как это работает

```
git commit → .husky/pre-commit → lint-staged → проверки файлов
```

1. **Husky** перехватывает `git commit`
2. Запускает `.husky/pre-commit`
3. Вызывает `lint-staged`
4. lint-staged обрабатывает только staged файлы по правилам из `.lintstagedrc`

## Проверки по типам файлов

### Backend (`.ts`, `.tsx`)
```bash
prettier --write           # Форматирование
npm run lint --workspace=tzona-v2-backend    # ESLint
npm run typecheck --workspace=tzona-v2-backend  # TypeScript
```

### Frontend (`.ts`, `.tsx`, `.vue`)
```bash
prettier --write           # Форматирование
npm run lint --workspace=tzona-v2-frontend   # ESLint
npm run type-check --workspace=tzona-v2-frontend  # TypeScript
```

### Другие файлы (`.json`, `.md`, `.yaml`)
```bash
prettier --write           # Только форматирование
```

## Troubleshooting

### Hooks не запускаются
```bash
# Переустановить husky
npm run prepare  # Если есть такой скрипт в package.json
# или
npx husky install
```

### "Command not found: lint-staged"
```bash
npm install  # Установить зависимости
```

### Ошибка "tsc: command not found"
```bash
npm install --workspace=tzona-v2-backend
npm install --workspace=tzona-v2-frontend
```

### Хочу пропустить проверки (НЕ РЕКОМЕНДУЕТСЯ)
```bash
git commit --no-verify -m "emergency fix"
```
⚠️ Используйте только в экстренных случаях!

### Долгий pre-commit
lint-staged проверяет только staged файлы. Если долго:
1. Проверьте, не добавили ли слишком много файлов
2. Запустите `npm run typecheck` отдельно, чтобы увидеть ошибки

### Type errors при коммите
```bash
# Сначала исправьте ошибки локально
cd frontend && npm run type-check
cd backend && npm run typecheck
```

## Конфигурационные файлы

| Файл | Назначение |
|------|------------|
| `.husky/pre-commit` | Скрипт хука |
| `.lintstagedrc` | Правила lint-staged |
| `.prettierrc` | Настройки форматирования |
| `.prettierignore` | Исключения для Prettier |
| `frontend/.eslintrc.js` | ESLint для frontend |
| `backend/.eslintrc.cjs` | ESLint для backend |

## Добавление нового хука

```bash
# Например, добавить commit-msg хук
npx husky add .husky/commit-msg 'npx commitlint --edit "$1"'
```

## См. также

- [docs/onboarding.md](/docs/onboarding.md) — Быстрый старт
- [ARCHITECTURE_IMPROVEMENT_PLAN.md](/ARCHITECTURE_IMPROVEMENT_PLAN.md) — План улучшений
