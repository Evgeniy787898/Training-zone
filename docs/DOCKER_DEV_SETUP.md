# Docker Development Environment

## Quick Start

```bash
./start-docker-dev.sh
```

This will:
1. Start PostgreSQL and Redis
2. Install dependencies (if needed)
3. Run database migrations
4. Start all services (backend, frontend, microservices)
5. Set up ngrok tunnel

## Requirements

- Docker and Docker Compose
- ngrok authtoken (get from https://dashboard.ngrok.com/get-started/your-authtoken)
- `.env` file (copy from `.env.example`)

## Configuration

Add your ngrok token to `.env`:
```bash
NGROK_AUTHTOKEN=your_token_here
```

## Services

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 3001 | http://localhost:3001 |
| Image Processor | 3002 | http://localhost:3002 |
| AI Advisor | 3003 | http://localhost:3003 |
| Analytics | 3004 | http://localhost:3004 |
| ngrok Dashboard | 4040 | http://localhost:4040 |
| PostgreSQL | 5432 | postgres://tzona:password@localhost:5432/tzona |
| Redis | 6379 | redis://localhost:6379 |

## Management Commands

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f backend

# Restart a service
docker-compose -f docker-compose.dev.yml restart backend

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild a service
docker-compose -f docker-compose.dev.yml build backend
docker-compose -f docker-compose.dev.yml up -d backend
```

## Advantages vs `start-with-ngrok.sh`

✅ **Isolated environment** - No local Node.js/Python version conflicts
✅ **Reproducible** - Same environment on all machines
✅ **Clean state** - Easy to reset with `down -v`
✅ **Service networking** - Services talk to each other by name
✅ **Automatic dependency management** - Docker handles installation

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs [service-name]

# Restart service
docker-compose -f docker-compose.dev.yml restart [service-name]
```

### Database issues
```bash
# Reset database
docker-compose -f docker-compose.dev.yml down -v
./start-docker-dev.sh
```

### ngrok tunnel not working
- Check your `NGROK_AUTHTOKEN` in `.env`
- Visit http://localhost:4040 for ngrok dashboard
- Free plan has session limits

### Port already in use
```bash
# Stop conflicting services
docker-compose -f docker-compose.dev.yml down
# Or stop specific local services using those ports
```

## Development Workflow

1. Start environment: `./start-docker-dev.sh`
2. Code changes are auto-reloaded (hot reload enabled)
3. View logs: `docker-compose -f docker-compose.dev.yml logs -f`
4. Stop when done: `docker-compose -f docker-compose.dev.yml down`

## Migration from Local Setup

The original `start-with-ngrok.sh` still works for local Node.js/Python development.

Choose based on your needs:
- **Docker** (`start-docker-dev.sh`): Isolated, reproducible, easier dependency management
- **Local** (`start-with-ngrok.sh`): Faster rebuild, direct filesystem access, familiar tools
