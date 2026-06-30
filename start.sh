#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Starting Nexa..."

# Backend
if [ ! -d "backend/.venv" ]; then
  echo "Creating Python venv..."
  python3.12 -m venv backend/.venv 2>/dev/null || python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt -q
fi

# Frontend env
if [ ! -f "frontend/.env.local" ]; then
  cp frontend/.env.local.example frontend/.env.local
fi

echo "Starting backend on :8000..."
backend/.venv/bin/uvicorn app.main:app --reload --port 8000 --app-dir backend &
BACKEND_PID=$!

echo "Starting frontend on :3000..."
cd frontend && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "Nexa is running:"
echo "  Landing:   http://localhost:3000"
echo "  Dashboard: http://localhost:3000/dashboard"
echo "  API:       http://localhost:8000/docs"
echo ""
wait
