# Preview Environments

Guide for setting up preview deployments for pull requests.

## Overview

Preview environments позволяют тестировать каждый PR в изолированном окружении до merge.

## Варианты реализации

### Vercel (Рекомендуется для Frontend)

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend

      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed: ${{ steps.deploy.outputs.preview-url }}'
            })
```

### Railway (Full-Stack)

```yaml
# Для полного стека с backend
name: Railway Preview

on:
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-action@v0.4.0
        with:
          service: tzona-preview
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Docker Compose (Self-Hosted)

```yaml
# Для self-hosted preview
name: Docker Preview

on:
  pull_request:

jobs:
  preview:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and Run
        run: |
          docker-compose -f docker-compose.preview.yml up -d
          echo "Preview: http://preview-pr-${{ github.event.number }}.local"
```

## Настройка

### 1. Vercel Setup
```bash
# Установить Vercel CLI
npm i -g vercel

# Линкануть проект
cd frontend
vercel link

# Получить токен и IDs
vercel whoami
```

### 2. GitHub Secrets
Добавить в Settings → Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### 3. Cleanup
Previews автоматически удаляются при закрытии PR через Vercel/Railway.

## Текущее состояние

- ✅ CI запускается на `pull_request`
- ⏳ Preview deployment — готово к активации
- 📝 Требует: Vercel/Railway аккаунт и secrets

## См. также

- [.github/workflows/ci.yml](/.github/workflows/ci.yml)
- [docs/releases.md](/docs/releases.md)
