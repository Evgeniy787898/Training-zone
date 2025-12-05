# Microservice Health Endpoints

## FastAPI Services
Каждый микросервис реализует `/api/health` с объектом `HealthReporter`:
- `services/image-processor/main.py:800`
- `services/ai-advisor/main.py:504`
- `services/analytics/main.py:1778`

Эндпоинт возвращает агрегат проверок (`status`, `checks[]`, `version`). Примеры проверок регистрируются через HealthReporter (`runtime`, `promptTemplate`, `databaseConnection` и т.д.).

## API Gateway
- `backend/src/routes/microservicesProxy.ts` проксирует `/api/internal/<service>/api/health` в соответствующие микросервисы.
- `backend/src/services/health.ts` собирает статусы через `callMicroservice(...,/api/health)` и добавляет их в `/api/health` API.

## Использование
1. Liveness (микросервис напрямую):
   ```bash
   curl http://localhost:3003/api/health
   ```
2. Via gateway:
   ```bash
   curl http://localhost:4000/api/internal/ai-advisor/api/health
   ```
3. Общий снимок:
   ```bash
   curl http://localhost:4000/api/health | jq '.dependencies.microservices'
   ```

## Статусы
- `ok` — проверки прошли.
- `degraded` — частичная деградация (health reporter).
- `unavailable`/`timeout` — API не отвечает (см. `microserviceGateway`).
