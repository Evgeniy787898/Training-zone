#!/bin/bash

# TZONA with Cloudflare Tunnel (Free ngrok alternative)
# Telegram WebApp compatible via HTTPS

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting TZONA with Cloudflare Tunnel...${NC}\n"

# ==========================================
# 0. Cleanup Existing Processes
# ==========================================
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"

pkill -9 node 2>/dev/null || true
pkill -9 tsx 2>/dev/null || true
pkill -9 python3 2>/dev/null || true
pkill -9 cloudflared 2>/dev/null || true

sleep 2

for port in 3000 3001 3002 3003 3004; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}⚠️  Port $port in use, killing PID $PID...${NC}"
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
# 2. Start Cloudflare Tunnel
# ==========================================
echo -e "${YELLOW}🌐 Starting Cloudflare Tunnel...${NC}"

mkdir -p logs
cloudflared tunnel --url http://localhost:3000 > logs/cloudflared.log 2>&1 &
TUNNEL_PID=$!

cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    kill $TUNNEL_PID 2>/dev/null || true
    pkill -f "concurrently" 2>/dev/null || true
    pkill -9 cloudflared 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for tunnel URL
TUNNEL_URL=""
echo -e "${YELLOW}⏳ Waiting for tunnel URL...${NC}"
for i in {1..30}; do
    sleep 1
    TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' logs/cloudflared.log 2>/dev/null | head -1 || true)
    if [ -n "$TUNNEL_URL" ]; then
        echo -e "${GREEN}✅ Tunnel active: $TUNNEL_URL${NC}"
        break
    fi
done

if [ -z "$TUNNEL_URL" ]; then
    echo -e "${RED}❌ Failed to get tunnel URL. Check logs/cloudflared.log${NC}"
    kill $TUNNEL_PID 2>/dev/null || true
    exit 1
fi

# ==========================================
# 3. Set Environment Variables
# ==========================================
export TELEGRAM_WEBAPP_URL="$TUNNEL_URL"
export VITE_API_BASE_URL="$TUNNEL_URL/api"
export WEBAPP_URL="$TUNNEL_URL"
export FRONTEND_URL="$TUNNEL_URL"

export AI_ADVISOR_BASE_URL="http://localhost:3003"
export ANALYTICS_BASE_URL="http://localhost:3004"
export IMAGE_PROCESSOR_URL="http://localhost:3002"
export AI_ADVISOR_ENABLED="true"
export ANALYTICS_ENABLED="true"
export IMAGE_PROCESSOR_ENABLED="true"

# CSRF for HTTPS
export CSRF_COOKIE_SAMESITE="none"
export CSRF_COOKIE_SECURE="true"

export AI_ADVISOR_API_TOKEN="${AI_ADVISOR_API_TOKEN:-dev-ai-advisor-token}"
export ANALYTICS_API_TOKEN="${ANALYTICS_API_TOKEN:-dev-analytics-token}"
export IMAGE_PROCESSOR_API_TOKEN="${IMAGE_PROCESSOR_API_TOKEN:-dev-image-processor-token}"

export PYTHONPATH="$PYTHONPATH:$(pwd)/services"

echo -e "${GREEN}✅ Environment configured${NC}\n"

# ==========================================
# 4. Start Database
# ==========================================
echo -e "${YELLOW}🐘 Starting database services...${NC}"
docker-compose -p tzona up -d postgres redis

# Wait for stale Supabase connections to be released
echo -e "${YELLOW}⏳ Waiting for stale DB connections to clear (10s)...${NC}"
sleep 10

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
cd backend

# Retry migration with exponential backoff
MAX_RETRIES=3
RETRY_DELAY=5
for i in $(seq 1 $MAX_RETRIES); do
    if npx prisma migrate deploy 2>&1 | head -10; then
        echo -e "${GREEN}✅ Database ready${NC}\n"
        break
    else
        if [ $i -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}⚠️ DB connection failed, retrying in ${RETRY_DELAY}s... (attempt $i/$MAX_RETRIES)${NC}"
            sleep $RETRY_DELAY
            RETRY_DELAY=$((RETRY_DELAY * 2))
        else
            echo -e "${YELLOW}⚠️ Migration check completed with warnings${NC}"
        fi
    fi
done
cd ..

# ==========================================
# 5. Ensure Python venvs
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

# ==========================================
# 6. Launch Services
# ==========================================
echo -e "${GREEN}🔥 Launching all services...${NC}\n"

CMD_BACKEND="npm run dev"
CMD_FRONTEND="npm run dev --prefix ../frontend"
CMD_IMG="cd ../services/image-processor && PORT=3002 .venv/bin/python3 main.py"
CMD_AI="cd ../services/ai-advisor && PORT=3003 .venv/bin/python3 main.py"
CMD_ANALYTICS="cd ../services/analytics && PORT=3004 .venv/bin/python3 main.py"
CMD_BOT="npm run dev:bot"

# Show status after startup
(
    sleep 20
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ TZONA READY (Cloudflare Tunnel)${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}📱 Telegram WebApp: ${NC}$TUNNEL_URL"
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
