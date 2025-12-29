#!/bin/bash

# TZONA Local Development Script
# Runs everything on localhost without ngrok

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting TZONA (Local Mode)...${NC}\n"

# ==========================================
# 0. Cleanup Existing Processes
# ==========================================
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"

pkill -9 node 2>/dev/null || true
pkill -9 tsx 2>/dev/null || true
pkill -9 python3 2>/dev/null || true

sleep 2

for port in 3000 3001 3002 3003 3004; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}⚠️  Port $port still in use by PID $PID, killing...${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ Cleanup completed${NC}\n"

# ==========================================
# 1. Load Environment
# ==========================================
if [ ! -f .env ]; then
    echo -e "${RED}❌ Root .env file not found${NC}"
    exit 1
fi

set -a
source .env
set +a

# ==========================================
# 2. Set Local URLs (no ngrok)
# ==========================================
export TELEGRAM_WEBAPP_URL="http://localhost:3000"
export VITE_API_BASE_URL="http://localhost:3001/api"
export WEBAPP_URL="http://localhost:3000"
export FRONTEND_URL="http://localhost:3000"

export AI_ADVISOR_BASE_URL="http://localhost:3003"
export ANALYTICS_BASE_URL="http://localhost:3004"
export IMAGE_PROCESSOR_URL="http://localhost:3002"
export AI_ADVISOR_ENABLED="true"
export ANALYTICS_ENABLED="true"
export IMAGE_PROCESSOR_ENABLED="true"

# CSRF for localhost (not HTTPS)
export CSRF_COOKIE_SAMESITE="lax"
export CSRF_COOKIE_SECURE="false"

export AI_ADVISOR_API_TOKEN="${AI_ADVISOR_API_TOKEN:-dev-ai-advisor-token}"
export ANALYTICS_API_TOKEN="${ANALYTICS_API_TOKEN:-dev-analytics-token}"
export IMAGE_PROCESSOR_API_TOKEN="${IMAGE_PROCESSOR_API_TOKEN:-dev-image-processor-token}"

export PYTHONPATH="$PYTHONPATH:$(pwd)/services"

echo -e "${GREEN}✅ Environment configured for localhost${NC}\n"

# ==========================================
# 3. Start Database
# ==========================================
echo -e "${YELLOW}🐘 Starting database services...${NC}"
docker-compose -p tzona up -d postgres redis
sleep 3

# Migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
cd backend
npx prisma migrate deploy 2>&1 | head -10 || echo -e "${YELLOW}⚠️ Migration check completed${NC}"
cd ..
echo -e "${GREEN}✅ Database ready${NC}\n"

# ==========================================
# 4. Ensure Python venvs
# ==========================================
ensure_venv() {
    local service_path="$1"
    local service_name=$(basename "$service_path")
    
    if [ ! -d "$service_path/.venv" ]; then
        echo -e "${YELLOW}📦 Creating venv for $service_name...${NC}"
        python3 -m venv "$service_path/.venv"
    fi
    
    local marker="$service_path/.venv/.deps_installed"
    local requirements="$service_path/requirements.txt"
    
    if [ -f "$requirements" ]; then
        if [ ! -f "$marker" ] || [ "$requirements" -nt "$marker" ]; then
            echo -e "${YELLOW}📦 Installing deps for $service_name...${NC}"
            "$service_path/.venv/bin/pip" install -q -r "$requirements"
            touch "$marker"
        fi
    fi
}

ensure_venv "services/image-processor"
ensure_venv "services/ai-advisor"
ensure_venv "services/analytics"

mkdir -p logs

# ==========================================
# 5. Launch Services
# ==========================================
echo -e "${GREEN}🔥 Launching all services...${NC}\n"

cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    pkill -f "concurrently" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Commands
CMD_BACKEND="npm run dev"
CMD_FRONTEND="npm run dev --prefix ../frontend"
CMD_IMG="cd ../services/image-processor && PORT=3002 .venv/bin/python3 main.py"
CMD_AI="cd ../services/ai-advisor && PORT=3003 .venv/bin/python3 main.py"
CMD_ANALYTICS="cd ../services/analytics && PORT=3004 .venv/bin/python3 main.py"
CMD_BOT="npm run dev:bot"

# Healthcheck in background
(
    sleep 15
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ TZONA LOCAL MODE${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}🌐 Frontend:        ${NC}http://localhost:3000"
    echo -e "${BLUE}🔧 Backend API:     ${NC}http://localhost:3001/api"
    echo -e "${BLUE}🖼️  Image Processor: ${NC}http://localhost:3002"
    echo -e "${BLUE}🤖 AI Advisor:      ${NC}http://localhost:3003"
    echo -e "${BLUE}📊 Analytics:       ${NC}http://localhost:3004"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"
) &

cd backend
npx concurrently \
    -n "BACKEND,FRONTEND,IMG-PROC,AI-ADV,ANALYTICS,BOT" \
    -c "blue,green,magenta,cyan,yellow,white" \
    --kill-others \
    --restart-tries 3 \
    "$CMD_BACKEND" \
    "$CMD_FRONTEND" \
    "$CMD_IMG" \
    "$CMD_AI" \
    "$CMD_ANALYTICS" \
    "$CMD_BOT"
