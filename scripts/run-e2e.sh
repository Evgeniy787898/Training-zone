#!/bin/bash
set -e

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🧪 Starting E2E Tests...${NC}"

# 1. Ensure DB is up
echo "Checking database..."
docker-compose up -d postgres redis

# 2. Start Backend
echo "Starting backend..."
cd backend
# Use a separate port or env if needed, but default is 3001
# We use 'nohup' or just '&' but we need to kill it later
PORT=3001 npm run dev > ../logs/backend-test.log 2>&1 &
BACKEND_PID=$!

cleanup() {
    echo -e "\n${GREEN}🧹 Cleaning up...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

# 3. Wait for Backend
echo "Waiting for backend to be ready..."
# Simple wait loop
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# 4. Run Tests
echo "Running Vitest E2E..."
npm run test:e2e

echo -e "${GREEN}✅ Tests passed!${NC}"
