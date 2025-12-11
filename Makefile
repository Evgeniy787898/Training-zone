# TZONA V2 - Makefile
# Common development commands

.PHONY: dev test lint type-check frontend backend services clean help

# Default target
help:
	@echo "TZONA V2 Development Commands"
	@echo ""
	@echo "  make dev         - Start full development environment (via start-with-ngrok.sh)"
	@echo "  make frontend    - Start frontend only"
	@echo "  make backend     - Start backend only"
	@echo "  make test        - Run all tests (frontend + backend)"
	@echo "  make lint        - Run linters (frontend + backend)"
	@echo "  make type-check  - Run TypeScript type checking"
	@echo "  make clean       - Clean build artifacts"
	@echo ""

# Full development environment
dev:
	./start-with-ngrok.sh

# Frontend only
frontend:
	cd frontend && npm run dev

# Backend only
backend:
	cd backend && npm run dev

# Run all tests
test:
	cd frontend && npm run test
	cd backend && npm run test

# Run linters
lint:
	cd frontend && npm run lint
	cd backend && npm run lint

# TypeScript type checking
type-check:
	cd frontend && npm run type-check
	cd backend && npm run type-check

# Database commands
db-migrate:
	cd backend && npx prisma migrate deploy

db-seed:
	cd backend && npx prisma db seed

db-studio:
	cd backend && npx prisma studio

# Clean build artifacts
clean:
	rm -rf frontend/dist
	rm -rf backend/dist
	rm -rf logs/*.log
	@echo "Cleaned build artifacts"
