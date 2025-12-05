#!/bin/bash

# TZONA V2 - Unified Launch Script
# Orchestrates Backend, Frontend, Microservices, and Ngrok
# 
# Improvements:
# - Self-contained checks (no external missing scripts)
# - No file mutation (injects env vars at runtime)
# - Robust cleanup

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting TZONA V2...${NC}\n"

# ==========================================
# 0. Cleanup Existing Processes
# ==========================================
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"

# Kill all node processes (including tsx, vite, etc.)
pkill -9 node 2>/dev/null || true
pkill -9 tsx 2>/dev/null || true

# Kill all python3 processes (microservices)
pkill -9 python3 2>/dev/null || true

# Kill ngrok
pkill -9 ngrok 2>/dev/null || true

# Wait for ports to be freed
sleep 2

# Check if critical ports are still in use and kill those processes
for port in 3000 3001 3002 3003 3004; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}⚠️  Port $port still in use by PID $PID, killing...${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ Cleanup completed${NC}\n"

# ==========================================
# 1. Infrastructure Checks
# ==========================================
echo -e "${YELLOW}🔍 Checking infrastructure...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed.${NC}"
        exit 1
    fi
}

check_command node
check_command npm
check_command python3
check_command ngrok
check_command docker-compose

# Check if Docker is actually running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_NODE_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)
if [ "$MAJOR_NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ is required. Found v$NODE_VERSION${NC}"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Environment: Node v$NODE_VERSION, Python $PYTHON_VERSION${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}❌ Root .env file not found. Please copy .env.example to .env${NC}"
    exit 1
fi

# ==========================================
# 2. Start Ngrok
# ==========================================
echo -e "\n${YELLOW}🌐 Starting ngrok...${NC}"

# Validate NGROK_TOKEN from .env
if [ -z "$NGROK_TOKEN" ]; then
    echo -e "${RED}❌ NGROK_TOKEN not found in .env file. Please add it.${NC}"
    exit 1
fi
ngrok config add-authtoken "$NGROK_TOKEN" > /dev/null 2>&1

pkill -9 -f "ngrok" 2>/dev/null || true
ngrok http 3000 --log=stdout > logs/ngrok.log 2>&1 &
NGROK_PID=$!

cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    kill $NGROK_PID 2>/dev/null || true
    pkill -f "concurrently" 2>/dev/null || true
    # Kill python processes started by this script context if possible
    # (concurrently usually handles children, but we be safe)
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for Ngrok URL
echo -e "${YELLOW}⏳ Waiting for ngrok URL...${NC}"
NGROK_URL=""
for i in {1..30}; do
    sleep 1
    # Try to fetch from local API
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; tunnels=json.load(sys.stdin).get('tunnels', []); print(tunnels[0]['public_url'] if tunnels else '')" 2>/dev/null || true)
    
    if [ -n "$NGROK_URL" ]; then
        echo -e "${GREEN}✅ Ngrok active: ${BLUE}$NGROK_URL${NC}"
        break
    fi
done

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}❌ Failed to get ngrok URL. Check logs/ngrok.log${NC}"
    kill $NGROK_PID
    exit 1
fi

# ==========================================
# 3. Environment Injection
# ==========================================
echo -e "${YELLOW}🔧 Injecting environment variables...${NC}"

# Load root .env variables to export them
set -a
source .env
set +a

# Overwrite/Set dynamic variables
export TELEGRAM_WEBAPP_URL="$NGROK_URL"
export VITE_API_BASE_URL="$NGROK_URL/api"
export AI_ADVISOR_BASE_URL="http://localhost:3003"
export ANALYTICS_BASE_URL="http://localhost:3004"
export IMAGE_PROCESSOR_URL="http://localhost:3002"
export AI_ADVISOR_ENABLED="true"
export ANALYTICS_ENABLED="true"
export IMAGE_PROCESSOR_ENABLED="true"

# Override DATABASE_URL to use Transaction Pooler (port 6543) to avoid "max clients reached"
# Using the DATABASE_URL from .env but changing port 5432 -> 6543 for pgbouncer
if [ -n "$DATABASE_URL" ]; then
    export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/:5432/:6543/' | sed 's/$/?pgbouncer=true/')
else
    echo -e "${RED}❌ DATABASE_URL not found in .env file${NC}"
    exit 1
fi

# CSRF Configuration for Ngrok (HTTPS)
export CSRF_COOKIE_SAMESITE="none"
export CSRF_COOKIE_SECURE="true"

# Set API tokens for microservices (generate simple tokens if not set)
export AI_ADVISOR_API_TOKEN="${AI_ADVISOR_API_TOKEN:-dev-ai-advisor-token-$(date +%s)}"
export ANALYTICS_API_TOKEN="${ANALYTICS_API_TOKEN:-dev-analytics-token-$(date +%s)}"
export IMAGE_PROCESSOR_API_TOKEN="${IMAGE_PROCESSOR_API_TOKEN:-dev-image-processor-token-$(date +%s)}"

export PYTHONPATH="$PYTHONPATH:$(pwd)/services"

echo -e "${GREEN}✅ Environment variables injected${NC}\n"

# ==========================================
# 4. Launch Services
# ==========================================
echo -e "${GREEN}🔥 Launching all services...${NC}"

# Ensure DB is running
echo -e "${YELLOW}🐘 Checking database services...${NC}"
docker-compose -p tzona up -d postgres redis

# Ensure logs directory exists
mkdir -p logs

# Construct commands
CMD_BACKEND="npm run dev"
CMD_FRONTEND="npm run dev --prefix ../frontend"

# Check if venvs exist, if not warn (we don't auto-create to avoid complex logic here, user should setup)
check_venv() {
    if [ ! -d "$1/.venv" ]; then
        echo -e "${YELLOW}⚠️  Virtual environment not found in $1. Service might fail.${NC}"
        echo -e "${YELLOW}👉 Run 'python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt' in $1${NC}"
    fi
}

check_venv "services/image-processor"
check_venv "services/ai-advisor"
check_venv "services/analytics"

# Python commands (assuming standard venv structure)
# Explicitly set PORT to override .env value (which is 3001 for backend)
CMD_IMG="cd ../services/image-processor && PORT=3002 .venv/bin/python3 main.py"
CMD_AI="cd ../services/ai-advisor && PORT=3003 .venv/bin/python3 main.py"
CMD_ANALYTICS="cd ../services/analytics && PORT=3004 .venv/bin/python3 main.py"

# Run concurrently from backend (where it's installed)
cd backend
npx concurrently \
    -n "BACKEND,FRONTEND,IMG-PROC,AI-ADV,ANALYTICS" \
    -c "blue,green,magenta,cyan,yellow" \
    --kill-others \
    --restart-tries 3 \
    "$CMD_BACKEND" \
    "$CMD_FRONTEND" \
    "$CMD_IMG" \
    "$CMD_AI" \
    "$CMD_ANALYTICS"
