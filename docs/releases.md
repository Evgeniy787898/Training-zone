# Release Process

## Версионирование

Проект использует [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (например, 2.1.0)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## Conventional Commits

Все коммиты должны следовать формату:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types
| Type | Описание | Версия |
|------|----------|--------|
| `feat` | Новая функция | MINOR |
| `fix` | Исправление бага | PATCH |
| `docs` | Документация | - |
| `style` | Форматирование | - |
| `refactor` | Рефакторинг | - |
| `perf` | Оптимизация | PATCH |
| `test` | Тесты | - |
| `chore` | Прочее | - |
| `BREAKING CHANGE` | В footer | MAJOR |

### Примеры
```bash
feat(auth): add Telegram OAuth
fix(sessions): correct RPE calculation
docs(readme): update installation guide
feat(ai)!: new advisor API (breaking change)
```

## Создание релиза

### 1. Подготовка
```bash
# Убедиться что main актуален
git checkout main
git pull origin main

# Проверить что тесты проходят
npm run test --workspaces
npm run type-check --workspace=tzona-v2-frontend
```

### 2. Обновить CHANGELOG
```bash
# Добавить запись в CHANGELOG.md
# Формат:
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

### 3. Создать тег
```bash
# Обновить версию в package.json (если нужно)
npm version <major|minor|patch>

# Или вручную
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

### 4. GitHub Release
1. Перейти в Releases
2. Create new release
3. Выбрать тег
4. Скопировать changelog в описание
5. Publish release

## Автоматизация (будущее)

При настройке semantic-release:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```json
// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

## См. также

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [docs/git-hooks.md](/docs/git-hooks.md)
