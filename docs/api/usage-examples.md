# API Usage Examples

This document demonstrates how to call the TZONA V2 API in real-world scenarios. Examples rely on the public `/api` surface that is documented formally in `docs/openapi.yaml` and exposed via `/api/openapi.json`.

> **Note:** Replace placeholder values (`<JWT>`, `<PROFILE_ID>`, etc.) with the data returned from your own environment. All requests use JSON payloads and expect the `Content-Type: application/json` header unless stated otherwise.

## Authentication Flow

1. **Request a PIN**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"telegramInitData":"<INIT_DATA>","language":"ru"}' \
  https://api.example.com/api/auth/request-pin
```

The response contains the masked phone number that will receive the PIN.

2. **Verify the PIN**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"telegramInitData":"<INIT_DATA>","pin":"123456"}' \
  https://api.example.com/api/auth/verify-pin
```

Successful verification returns the JWT access token, CSRF token cookie, and profile metadata:

```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "profile": {
      "id": "<PROFILE_ID>",
      "telegramId": 123456789,
      "language": "ru"
    }
  },
  "meta": {
    "traceId": "f1a2b3"
  }
}
```

All subsequent requests must include both:

- `Authorization: Bearer <JWT>` header
- `x-csrf-token: <CSRF_TOKEN>` header plus the `csrf_token` cookie

## Profile Summary

Retrieve dashboard cards and streaks:

```bash
curl -X GET \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  https://api.example.com/api/profile/summary
```

Response snippet:

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "<PROFILE_ID>",
      "language": "ru",
      "timezone": "Europe/Moscow"
    },
    "streak": 5,
    "achievements": {
      "total": 12,
      "new": 1
    }
  },
  "meta": {
    "traceId": "456def",
    "cache": {
      "hit": true,
      "scope": "profile-summary:v1"
    }
  }
}
```

## Sessions CRUD

### Create a Training Session

```bash
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "plannedAt": "2024-06-01T09:00:00Z",
    "status": "planned",
    "notes": {
      "focus": "upper-body"
    },
    "exercises": [
      {
        "exerciseKey": "push_up",
        "level": 2,
        "sets": 4,
        "reps": 12
      }
    ]
  }' \
  https://api.example.com/api/sessions
```

### List Sessions with Pagination

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "page=1" \
  --data-urlencode "page_size=10" \
  https://api.example.com/api/sessions
```

Response metadata exposes pagination cursors:

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "sess_1", "status": "completed" }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 23
    }
  },
  "meta": {
    "traceId": "abc123"
  }
}
```

### Update Session Status

```bash
curl -X PATCH \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  https://api.example.com/api/sessions/sess_1
```

### Delete a Session

```bash
curl -X DELETE \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  https://api.example.com/api/sessions/sess_1
```

## Exercises Catalog

Request catalog entries with field selection and conditional caching:

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "page=1" \
  --data-urlencode "page_size=20" \
  --data-urlencode "fields=key,name,levels" \
  https://api.example.com/api/exercises
```

The API sets `Cache-Control`, `ETag`, and `Vary` headers so clients can reuse responses:

```
Cache-Control: private, max-age=60
ETag: "W/\"b1f2...\""
Vary: Authorization, x-csrf-token, Accept-Encoding
```

## Daily Advice Feed

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "type=strength" \
  https://api.example.com/api/daily-advice
```

## Batch Profile Stats

Request up to 25 profile summaries in a single call (the service trims the list to the current batch limit and reuses cached entries automatically):

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  https://analytics.example.com/api/batch/profile-stats \
  -d '{"profileIds":["7c9e6679-7425-40de-944b-e07fc1f90ae7","13e3f900-1a1e-4c8f-a275-5f06cc2b4d0d"]}'
```

Sample response:

```json
{
  "requested": 2,
  "processed": 2,
  "limit": 25,
  "results": {
    "7c9e6679-7425-40de-944b-e07fc1f90ae7": {
      "totalSessions": 48,
      "totalExercises": 320,
      "averagePerformance": 78.5,
      "weeklyStats": [ { "weekStart": "2024-11-18", "completedSessions": 6, "totalSessions": 7, "totalVolume": 2200 } ],
      "progressOverTime": [ { "date": "2024-11-23", "totalEntries": 12, "buckets": { "7": 4, "8": 8 } } ]
    },
    "13e3f900-1a1e-4c8f-a275-5f06cc2b4d0d": {
      "totalSessions": 12,
      "totalExercises": 90,
      "averagePerformance": 55.0,
      "weeklyStats": [],
      "progressOverTime": []
    }
  }
}
```

## Platform-Wide Aggregate Analytics

Fetch high-level KPIs for dashboards:

```bash
curl https://analytics.example.com/api/aggregate
```

Sample response:

```json
{
  "summary": {
    "totalProfiles": 1280,
    "activeProfiles7d": 412,
    "totalSessions": 9120,
    "completedSessions": 7030,
    "totalVolume": 245000,
    "averageVolumePerSession": 85.2
  },
  "weeklyTrends": [
    {
      "weekStart": "2024-11-18",
      "totalSessions": 480,
      "completedSessions": 390,
      "uniqueProfiles": 210,
      "totalVolume": 13200
    }
  ],
  "topExercises": [
    { "exerciseKey": "push_up", "usageCount": 3200 }
  ]
}
```

## Profile Trend Forecasts

Understand whether an athlete is trending up or down before scheduling changes:

```bash
curl https://analytics.example.com/api/trends/profile/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

Sample response:

```json
{
  "profileId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "generatedAt": "2024-12-14T10:05:00.123Z",
  "windowWeeks": 6,
  "weeklySeries": [
    { "weekStart": "2024-11-04", "totalSessions": 4, "completedSessions": 3, "totalVolume": 9200 }
  ],
  "insights": [
    {
      "metric": "totalSessions",
      "direction": "up",
      "slope": 0.8,
      "currentValue": 6,
      "forecastValue": 6.8,
      "confidence": 0.77
    }
  ]
}
```

## Platform Trend Forecasts

```bash
curl https://analytics.example.com/api/trends/platform
```

Response fields mirror the profile trends but aggregate data for the entire platform so dashboards can highlight expected demand.

Response snippet:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "adv_1",
        "title": "Focus on tempo",
        "ideas": ["Slow eccentrics", "Pause at the bottom"]
      }
    ]
  },
  "meta": {
    "traceId": "dea110",
    "cache": {
      "hit": false
    }
  }
}
```

## Grouped Metrics with Filters

Analyze how workloads break down across programs, statuses, or disciplines with a single call:

```bash
curl -G \
  --data-urlencode "groupBy=discipline" \
  --data-urlencode "status=done" \
  --data-urlencode "dateFrom=2024-11-01" \
  --data-urlencode "dateTo=2024-11-30" \
  https://analytics.example.com/api/grouped-metrics
```

Sample response:

```json
{
  "groupBy": "discipline",
  "generatedAt": "2024-12-19T08:44:00.000Z",
  "appliedFilters": {
    "status": "done",
    "dateFrom": "2024-11-01",
    "dateTo": "2024-11-30"
  },
  "results": [
    {
      "key": "strength",
      "label": "Силовая",
      "totalSessions": 312,
      "completedSessions": 280,
      "uniqueProfiles": 148,
      "totalVolume": 91200
    },
    {
      "key": "mobility",
      "label": "Мобильность",
      "totalSessions": 120,
      "completedSessions": 110,
      "uniqueProfiles": 64,
      "totalVolume": 18400
    }
  ]
}
```

## Visualization-ready Charts

Request chart-ready data (labels, datasets, options) for dashboards. For example, to plot the discipline breakdown for completed sessions:

```bash
curl -X POST https://analytics.example.com/api/visualizations \
  -H "Content-Type: application/json" \
  -d '{
        "visualizationType": "discipline_breakdown",
        "filters": {
          "status": "done",
          "dateFrom": "2024-11-01",
          "dateTo": "2024-11-30"
        }
      }'
```

Sample response:

```json
{
  "visualizationType": "discipline_breakdown",
  "generatedAt": "2024-12-20T09:30:00.000Z",
  "appliedFilters": {
    "status": "done",
    "dateFrom": "2024-11-01",
    "dateTo": "2024-11-30"
  },
  "chart": {
    "type": "doughnut",
    "title": "Распределение по дисциплинам",
    "labels": ["Силовая", "Мобильность", "Кардио"],
    "datasets": [
      {
        "label": "Завершённые тренировки",
        "data": [280, 110, 64],
        "backgroundColor": ["#2563eb", "#0ea5e9", "#10b981"]
      }
    ]
  },
  "source": {
    "groupBy": "discipline",
    "rows": [
      {"label": "Силовая", "completedSessions": 280, "totalSessions": 312},
      {"label": "Мобильность", "completedSessions": 110, "totalSessions": 120},
      {"label": "Кардио", "completedSessions": 64, "totalSessions": 70}
    ]
  }
}
```

## Export Analytics Datasets (JSON/CSV)

Request a JSON export of profile statistics:

```bash
curl -G \
  --data-urlencode "resource=profile_stats" \
  --data-urlencode "profileId=7c9e6679-7425-40de-944b-e07fc1f90ae7" \
  https://analytics.example.com/api/export
```

Response snippet:

```json
{
  "resource": "profile_stats",
  "format": "json",
  "generatedAt": "2024-12-18T10:15:00.000Z",
  "metadata": {
    "resource": "profile_stats",
    "profileId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  },
  "data": {
    "totalSessions": 42,
    "weeklyStats": [{ "weekStart": "2024-12-09", "totalSessions": 4, "completedSessions": 3, "totalVolume": 9300 }]
  }
}
```

To stream a CSV export of aggregate stats:

```bash
curl -G \
  --header "Accept: text/csv" \
  --data-urlencode "resource=aggregate" \
  --data-urlencode "format=csv" \
  https://analytics.example.com/api/export -o aggregate.csv
```

The resulting `aggregate.csv` contains sections for summary metrics, weekly trends and the top exercises ready for spreadsheets.

## Subscribe to Real-Time Analytics (SSE)

Stream the latest aggregate metrics and platform trends without polling by using the analytics SSE endpoint:

```bash
curl -N https://analytics.example.com/api/realtime/metrics
```

Example events:

```
event: analytics.metrics
data: {"generatedAt":"2024-12-20T12:00:00Z","payload":{"aggregate":{"summary":{"totalProfiles":420,"totalSessions":1825}},"platformTrends":{"windowWeeks":8}}}
```

Use a browser `EventSource` or Fetch Streams API to react to the `analytics.metrics` event type and update dashboards in real time.

## Achievements Feed with Field Selection

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "page=2" \
  --data-urlencode "page_size=12" \
  --data-urlencode "fields=id,title,unlockedAt" \
  https://api.example.com/api/achievements
```

## Reports Endpoint

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "range=last_30_days" \
  https://api.example.com/api/reports/progress
```

The report combines materialized views with runtime data and streams gzip/brotli-compressed JSON if supported by the client.

## Assistant Notes

List paginated assistant notes (supports optional `query` for search):

```bash
curl -G \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  --data-urlencode "page=1" \
  --data-urlencode "page_size=25" \
  https://api.example.com/api/assistant/notes
```

Create a note:

```bash
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Post-session recovery",
    "body": "Hydrate and stretch for 10 minutes.",
    "tags": ["recovery", "post-session"]
  }' \
  https://api.example.com/api/assistant/notes
```

Deletion invalidates the cache scope automatically:

```bash
curl -X DELETE \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  https://api.example.com/api/assistant/notes/note_1
```

## Assistant Command Interpretation

Use this endpoint to run the same natural-language parser that powers the assistant before showing UI flows or shortcuts:

```bash
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Сохрани заметку: цель на июль #idei",
    "history": ["напомни через 30 минут"]
  }' \
  https://api.example.com/api/assistant/commands/interpret
```

Sample response:

```json
{
  "success": true,
  "data": {
    "intent": "note_save",
    "raw_intent": "note.save",
    "confidence": 0.85,
    "candidates": [
      { "intent": "note_save", "confidence": 0.85 },
      { "intent": "help", "confidence": 0.35 }
    ],
    "slots": {
      "note": {
        "content": "цель на июль #idei",
        "tags": ["idei"]
      }
    },
    "needs_clarification": false,
    "follow_up": null,
    "history": ["напомни через 30 минут"],
    "profile_id": "profile-command"
  },
  "meta": {
    "traceId": "assistant-integration-trace"
  }
}
```

---

### Stream live AI advice updates

Use the SSE endpoint to display progress indicators while the advisor generates a response:

```bash
curl -N -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  https://api.example.com/api/assistant/ai-advice/stream \
  -d '{
    "exerciseKey": "pushup",
    "currentLevel": "L1",
    "performance": {"reps": 10}
  }'
```

Sample stream:

```
event: progress
data: {"stage":"accepted","traceId":"stream-trace"}

event: progress
data: {"stage":"context_loaded","entries":3,"traceId":"stream-trace"}

event: advice
data: {"stage":"advice","payload":{"advice":"Продолжайте","nextSteps":["Запишите прогресс"],"tips":["Дышите"],"metadata":{"status":"ok"}},"traceId":"stream-trace"}

event: complete
data: {"stage":"completed","traceId":"stream-trace"}
```

---

### Metrics dashboard snapshot

Fetch a ready-to-plot history of latency, throughput, resource, and business metrics:

```bash
curl https://api.example.com/api/metrics/dashboard
```

The response includes the sampling config, last recorded timestamp, and a bounded history suitable for charting.

---

For the full schema reference, consult:

- `docs/openapi.yaml`
- `https://api.example.com/api/openapi.json`
- Swagger UI at `https://api.example.com/api/docs`
