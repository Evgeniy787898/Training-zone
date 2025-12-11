# 🏋️ TZONA — Платформа Персональных Тренировок

> **Telegram WebApp для персональных тренировок**  
> Микросервисная архитектура: Node.js (Backend + Frontend) + Python (AI/ML Services)

![Status](https://img.shields.io/badge/status-active%20development-brightgreen)
![Node](https://img.shields.io/badge/node-18%2B-green)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Оглавление

- [Обзор](#-обзор)
- [Архитектура](#-архитектура)
- [Быстрый старт](#-быстрый-старт)
- [Технологический стек](#-технологический-стек)
- [Структура проекта](#-структура-проекта)
- [Frontend](#-frontend)
- [Backend](#-backend)
- [Микросервисы](#-микросервисы)
- [Запуск через ngrok](#-запуск-через-ngrok)
- [Конфигурация](#-конфигурация)
- [Тестирование](#-тестирование)
- [Документация](#-документация)
- [План развития](#-план-развития)

---

## 🌟 Обзор

TZONA — это платформа для персональных тренировок, работающая как Telegram WebApp. Позволяет:

- 📅 **Планировать тренировки** — следуй программам или создавай свои
- 🏃 **Отслеживать прогресс** — веса, повторения, персональные рекорды
- 🤖 **Получать AI-советы** — персонализированные рекомендации от AI-тренера
- 📊 **Анализировать результаты** — детальная статистика и тренды
- 🔔 **Не забывать о тренировках** — умные уведомления через Telegram

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    Telegram WebApp (Vue 3 PWA)                  │
│               11 страниц │ 34 composables │ Pinia               │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS (ngrok)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express API Gateway (3001)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Auth/JWT │ │ 28 Routes│ │41 Services│ │ Prisma (20 models)│   │
│  └──────────┘ └──────────┘ └──────────┘ └────────┬─────────┘    │
└────────┬────────────────────────────────────────┬───────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌──────────────────────────┐
│  Redis Cache    │                    │  PostgreSQL (Supabase)   │
└─────────────────┘                    │     with pgbouncer       │
         │                             └──────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Python Microservices (FastAPI)              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ AI Advisor   │ │   Analytics  │ │    Image Processor      │  │
│  │    :3003     │ │     :3004    │ │        :3002            │  │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Ключевые компоненты

| Компонент | Технология | Порт | Назначение |
|-----------|------------|------|------------|
| **Frontend** | Vue 3 + Vite + Pinia | 3000 | PWA для Telegram WebApp |
| **Backend** | Express + Prisma | 3001 | API Gateway, бизнес-логика, Telegram Bot |
| **Image Processor** | FastAPI | 3002 | Оптимизация изображений |
| **AI Advisor** | FastAPI + LLM | 3003 | AI-советы и рекомендации |
| **Analytics** | FastAPI | 3004 | Сложная аналитика и метрики |
| **PostgreSQL** | Supabase | 5432/6543 | Основная БД (через pgbouncer) |
| **Redis** | Redis | 6379 | Кеширование |

---

## 🚀 Быстрый старт

### Предварительные требования

- **Node.js 18+** (проверьте: `node -v`)
- **Python 3.10+** (проверьте: `python3 --version`)
- **Docker & Docker Compose** (для PostgreSQL и Redis)
- **ngrok** (установлен и авторизован)

### Установка

```bash
# 1. Клонируй репозиторий
git clone <repo-url>
cd TZONA

# 2. Скопируй конфигурацию
cp .env.example .env
# Заполни .env своими значениями (см. раздел Конфигурация)

# 3. Установи зависимости Node.js
cd backend && npm install
cd ../frontend && npm install
cd ..

# 4. Настрой Python venv для микросервисов
for service in ai-advisor analytics image-processor; do
  cd services/$service
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  deactivate
  cd ../..
done
```

### Запуск

```bash
# Единый скрипт запуска ВСЕХ сервисов
./start-with-ngrok.sh
```

После успешного запуска увидишь:
```
═══════════════════════════════════════════════════════════
✅ ALL SERVICES READY!
═══════════════════════════════════════════════════════════
📱 Telegram WebApp: https://xxxx.ngrok.io
🌐 Frontend:        http://localhost:3000
🔧 Backend API:     http://localhost:3001/api
🖼️  Image Processor: http://localhost:3002
🤖 AI Advisor:      http://localhost:3003
📊 Analytics:       http://localhost:3004
═══════════════════════════════════════════════════════════
```

---

## 🛠 Технологический стек

### Backend
| Технология | Версия | Назначение |
|------------|--------|------------|
| Node.js | 20+ | Runtime |
| Express.js | 4.x | Web framework |
| Prisma | 5.x | ORM (20+ моделей) |
| PostgreSQL | 15 | База данных |
| Redis | 7 | Кеширование |
| Zod | 3.x | Валидация |

### Frontend
| Технология | Версия | Назначение |
|------------|--------|------------|
| Vue 3 | 3.4+ | Framework (Composition API) |
| Vite | 5.x | Сборка |
| Pinia | 2.x | State management |
| Tailwind CSS | 3.x | Стилизация |
| Vue Router | 4.x | Маршрутизация |

### Microservices (Python)
| Технология | Версия | Назначение |
|------------|--------|------------|
| FastAPI | 0.100+ | Web framework |
| OpenAI/Anthropic | — | LLM провайдеры |
| Pillow | — | Обработка изображений |

---

## 📁 Структура проекта

```
TZONA/
├── backend/                    # Express + Prisma API
│   ├── prisma/                 # Схема БД (20+ моделей)
│   │   ├── schema.prisma       # Модели данных
│   │   └── seed.ts             # Начальные данные
│   └── src/
│       ├── bot/                # Telegram Bot (192KB — требует декомпозиции)
│       ├── modules/            # 86 бизнес-модулей
│       ├── routes/             # 28 API endpoints
│       ├── services/           # 41 сервис
│       └── middleware/         # Auth, CORS, Rate limit
│
├── frontend/                   # Vue 3 + Vite PWA
│   └── src/
│       ├── App.vue             # Главный контейнер (1416 строк — требует декомпозиции)
│       ├── pages/              # 11 страниц
│       │   ├── TodayPage.vue   # Тренировка дня (477 строк)
│       │   ├── ExercisesPage.vue # Каталог программ (899 строк)
│       │   ├── SettingsPage.vue  # Настройки (1504 строки — требует декомпозиции)
│       │   └── ...
│       ├── composables/        # 34 Vue composables (~140KB)
│       ├── services/           # 14 API-сервисов
│       └── style.css           # Дизайн-система (GPT Atlas, 351 строка)
│
├── services/                   # Python микросервисы
│   ├── ai-advisor/             # LLM советник (FastAPI)
│   ├── analytics/              # Аналитика (FastAPI)
│   ├── image-processor/        # Обработка изображений (FastAPI)
│   └── python_shared/          # Общий код Python
│
├── docs/                       # Документация (49 файлов)
│   ├── architecture/           # 12 архитектурных документов
│   ├── api/                    # API документация
│   ├── adr/                    # Architecture Decision Records
│   └── guides/                 # Руководства
│
├── start-with-ngrok.sh         # 🚀 Единый скрипт запуска (297 строк)
├── docker-compose.yml          # Инфраструктура
└── ARCHITECTURE_IMPROVEMENT_PLAN.md  # 📋 План развития (150+ задач)
```

---

## 🎨 Frontend

### Дизайн-система

Вдохновлена **ChatGPT / GPT Atlas** — минималистичный стиль, фокус на контенте.

**Темы:**
- ☀️ Светлая тема
- 🌙 Тёмная тема
- 🎨 Настраиваемые акцентные цвета

**Ключевые токены (style.css):**
```css
/* Цвета */
--color-bg, --color-bg-secondary, --color-bg-elevated
--color-text-primary, --color-text-secondary, --color-text-muted
--color-accent, --color-accent-hover

/* Spacing */
--space-xs (8px), --space-sm (12px), --space-md (16px), --space-lg (24px)

/* Transitions */
--transition-fast (150ms), --transition-base (200ms), --transition-slow (300ms)
```

### Основные страницы

| Страница | Файл | Описание |
|----------|------|----------|
| `/today` | TodayPage.vue | Тренировка дня — этапы, таймер, результаты |
| `/exercises` | ExercisesPage.vue | Каталог программ и упражнений |
| `/progress` | ProgressPage.vue | Фото прогресса |
| `/analytics` | AnalyticsPage.vue | Статистика и графики |
| `/settings` | SettingsPage.vue | Настройки, темы, здоровье системы |
| `/week` | WeekPlanPage.vue | Планирование недели |
| `/report` | ReportPage.vue | Отчёт о тренировке |

---

## 🔧 Backend

### API Endpoints

Все endpoints под `/api/`:

| Endpoint | Описание |
|----------|----------|
| `/api/health` | Health check всех сервисов |
| `/api/auth` | Авторизация Telegram |
| `/api/profile` | Профиль пользователя |
| `/api/sessions` | Тренировочные сессии |
| `/api/exercises` | Каталог упражнений |
| `/api/programs` | Тренировочные программы |
| `/api/daily-advice` | AI-советы дня |
| `/api/analytics` | Аналитика |

### Prisma Schema

20+ моделей данных:
- `Profile` — пользователи
- `TrainingSession` — тренировочные сессии
- `Exercise`, `ExerciseLevel` — упражнения и уровни
- `TrainingProgram` — программы тренировок
- `ProgressPhoto` — фото прогресса
- `DailyAdvice` — советы дня
- И многое другое...

---

## 🐍 Микросервисы

### AI Advisor (порт 3003)
Генерация персонализированных советов через LLM (OpenAI/Anthropic/Gemini).

### Analytics (порт 3004)
Сложная аналитика: тренды, агрегации, рекорды.

### Image Processor (порт 3002)
Оптимизация изображений: ресайз, качество, форматы.

---

## 🌐 Запуск через ngrok

### Как работает start-with-ngrok.sh

Скрипт выполняет:

1. **Cleanup** — убивает старые процессы и освобождает порты
2. **Infrastructure Checks** — проверяет Node, Python, Docker, ngrok
3. **Ngrok Tunnel** — создаёт HTTPS туннель для порта 3000
4. **Environment Injection** — подставляет ngrok URL в конфиги
5. **Docker Services** — поднимает PostgreSQL и Redis
6. **Application Launch** — запускает все 6 сервисов через concurrently
7. **Health Check** — проверяет готовность всех сервисов

### Известные ограничения

⚠️ **venv для Python сервисов нужно создавать вручную** (до первого запуска)

Если скрипт предупреждает об отсутствии venv:
```bash
cd services/ai-advisor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
```

---

## ⚙️ Конфигурация

Основные переменные окружения (`.env`):

| Переменная | Описание | Пример |
|------------|----------|--------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `DIRECT_URL` | Direct DB URL (без pooler) | `postgresql://...` |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота | `123456:ABC...` |
| `JWT_SECRET` | Секрет для JWT | (сгенерируй случайный) |
| `CACHE_REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `OPENAI_API_KEY` | Ключ OpenAI API | `sk-...` |
| `NGROK_TOKEN` | Токен ngrok | (из dashboard.ngrok.com) |

Полный список см. в `.env.example`.

---

## 🧪 Тестирование

```bash
# Backend
cd backend
npm run test:unit           # Unit тесты
npm run test:integration    # Integration тесты
npm run test:e2e            # E2E тесты

# Frontend
cd frontend
npm run test:snapshot       # Snapshot тесты
npx playwright test         # E2E browser тесты
```

---

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) | Обзор системы |
| [`docs/onboarding.md`](docs/onboarding.md) | Руководство для новых разработчиков |
| [`docs/architecture/`](docs/architecture/) | 12 архитектурных документов |
| [`docs/api/`](docs/api/) | API документация |
| [`docs/guides/`](docs/guides/) | Руководства |

---

## 📋 План развития

> **📄 [ARCHITECTURE_IMPROVEMENT_PLAN.md](ARCHITECTURE_IMPROVEMENT_PLAN.md)** — полный roadmap улучшений с **150+ задачами**, включая детальные планы для каждого раздела приложения.
>
> 🔄 *Последний глубокий аудит: 2025-12-08 (версия 6.0 — свежий полный аудит всех компонентов)*

### Критические задачи (P0)

| Проблема | Решение | Статус |
|----------|---------|--------|
| 📦 `bot/runtime.ts` — 192KB монолит | Декомпозиция на commands/, handlers/, services/ | ⏳ Planned |
| 📦 `SettingsPage.vue` — 1504 строки | Разбить на виджеты (Profile, Notifications, Theme) | ⏳ Planned |
| 📦 `App.vue` — 1416 строк | Вынести Header, Footer, HeroPanel | ⏳ Planned |
| 📦 `ExercisesPage.vue` — 899 строк | Декомпозиция на ProgramsCarousel, ExerciseList | ⏳ Planned |
| 🔧 venv не создаётся автоматически | Авто-создание в `start-with-ngrok.sh` | ⏳ Planned |

### Дорожная карта

| Фаза | Название | Фокус | Срок |
|------|----------|-------|------|
| **1** | **Стабилизация** | One-click launch, Health Checks, авто-venv | Неделя 1-2 |
| **2** | **Рефакторинг** | Декомпозиция SettingsPage, ExercisesPage, App.vue | Неделя 3-4 |
| **3** | **Функционал** | Telegram уведомления, фильтры, offline mode | Неделя 5-6 |
| **4** | **UX & Polish** | View Transitions, тесты, документация | Неделя 7-8 |

### Метрики успеха

| Метрика | Текущее | Целевое |
|---------|---------|---------|-
| 🚀 Запуск с первого раза | ~70% | 100% |
| 📱 Lighthouse Performance | ~80 | > 90 |
| 📦 Макс. размер Vue компонента | 1504 строки | < 300 строк |
| 📦 Макс. размер TS файла (bot) | 192KB | < 50KB |
| 🧪 Тестовое покрытие | ~20% | > 80% |

---

## ❓ Troubleshooting

### 🛑 "Port 3000/3001/5432 is already in use"
Скрипт `start-with-ngrok.sh` пытается автоматически освободить порты. Если это не сработало:
```bash
# Найти процесс, занимающий порт
lsof -i :3000
# Убить процесс по PID
kill -9 <PID>
```

### ❌ "Missing environment variables"
Скрипт проверяет наличие критических переменных. Убедись, что:
1. Файл `.env` существует (создан из `.env.example`).
2. Заполнены `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
3. Если включен AI (`AI_ADVISOR_ENABLED=true`), задан `OPENAI_API_KEY`.

### 🐍 "Python module not found / venv issues"
Если микросервисы падают с ошибкой импорта:
```bash
# Пересоздать venv для конкретного сервиса (например, ai-advisor)
cd services/ai-advisor
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 📉 "Service Health Check Failed" (502 Bad Gateway)
Если скрипт зависает на "Waiting for services...":
1. Проверь логи (они пишутся в stdout терминала или в файлы логов, если настроено).
2. Попробуй запустить сервис вручную, чтобы увидеть ошибку:
   ```bash
   cd services/image-processor
   source .venv/bin/activate
   python3 main.py
   ```

---

## 📄 Лицензия

MIT

---

> **Вопросы?** Создай issue или свяжись с командой.
> 
> *Документ обновлён: 2025-12-08*
