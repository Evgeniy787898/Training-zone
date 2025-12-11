# OWASP Top 10 2021 — Checklist для TZONA

Аудит безопасности проекта по OWASP Top 10 2021.

## Статус аудита

| # | Уязвимость | Статус | Реализация |
|---|------------|--------|------------|
| A01 | Broken Access Control | ✅ | JWT auth + middleware `requireAuth`, Telegram initData validation |
| A02 | Cryptographic Failures | ✅ | HTTPS/TLS, bcrypt для паролей, JWT tokens |
| A03 | Injection | ✅ | Prisma ORM (parameterized queries), Zod input validation |
| A04 | Insecure Design | ✅ | DDD patterns, contracts, error handling |
| A05 | Security Misconfiguration | ✅ | Docker secrets, env variables, CORS config |
| A06 | Vulnerable Components | ✅ | `npm audit` in CI (SEC-002), dependabot |
| A07 | Identification Failures | ✅ | Session management, rate limiting (SEC-003) |
| A08 | Data Integrity Failures | ✅ | Input validation (Zod), CSRF protection |
| A09 | Logging Failures | ✅ | Structured logging (OBS-001), error tracking (OBS-003) |
| A10 | SSRF | ⚠️ | Microservices have internal URLs, но нет proxy к external URLs |

## Детали реализации

### A01: Broken Access Control
- `backend/src/middleware/requireAuth.ts` — JWT validation
- `backend/src/modules/security/` — Telegram initData validation
- Route-level authorization checks

### A02: Cryptographic Failures
- bcrypt для хеширования
- JWT с RS256/HS256
- TLS в production через ngrok/caddy

### A03: Injection
- Prisma ORM — prepared statements
- `backend/src/middleware/validateRequest.ts` — Zod schemas
- Нет raw SQL queries

### A04: Insecure Design
- Error boundaries, graceful degradation
- Rate limiting per IP
- Input type checking

### A05: Security Misconfiguration
- `docker-compose.yml` с secrets isolation
- `.env.example` для документации
- No debug mode in production

### A06: Vulnerable Components
- `npm audit` в CI pipeline
- Dependabot alerts (GitHub)
- Regular dependency updates

### A07: Identification/Auth Failures
- JWT tokens с expiration
- Rate limiting (RateLimitMiddleware)
- Telegram OAuth integration

### A08: Data Integrity
- CSRF protection: `backend/src/middleware/csrfProtection.ts`
- Content-Type validation
- Zod schema enforcement

### A09: Logging
- Structured JSON logs
- traceId for request tracking
- Error capture to DB (recordMonitoringEvent)

### A10: SSRF
- Microservices только internal URLs
- Нет user-controlled URL fetching
- Рекомендация: добавить URL whitelist если появится proxy функционал

## Рекомендации на будущее

1. **A10 SSRF**: Если добавится функционал загрузки по URL — валидировать/whitelist
2. **Security Headers**: Добавить helmet.js для CSP, HSTS
3. **API Rate Limits**: Настроить per-endpoint лимиты
4. **Penetration Testing**: Провести при выходе в production

## См. также

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [docs/adr/002-zod-validation.md](/docs/adr/002-zod-validation.md)
