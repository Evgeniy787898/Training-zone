# Analytics Service - Standardized Structure

This directory contains the refactored Analytics microservice following the TZONA V2 Python microservices standards.

## Structure

```
app/
├── __init__.py           # Package initialization
├── main.py               # FastAPI app initialization
├── config.py             # Environment configuration
├── models.py             # Pydantic models (requests/responses)
├── routes/               # API endpoints
│   ├── __init__.py
│   ├── health.py         # Health and metrics endpoints
│   ├── analytics.py      # Analytics queries
│   └── visualizations.py # Chart generation
├── services/             # Business logic
│   ├── __init__.py
│   └── analytics_service.py  # Database queries and aggregations
└── utils/                # Helper functions
    └── __init__.py
```

## Running

```bash
# Development (from services/analytics)
python -m app.main

# Docker
docker-compose up analytics
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/metrics` - Service metrics
- `GET /api/analytics/profile/{profileId}` - Profile statistics
- `POST /api/analytics/grouped` - Grouped metrics
- `POST /api/analytics/visualize` - Generate charts
