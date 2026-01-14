#!/bin/bash

echo "Starting Python FastAPI backend on port 8000..."
python api/main.py &
PYTHON_PID=$!

sleep 2

echo "Starting Node.js frontend on port 5000..."
npm run dev &
NODE_PID=$!

cleanup() {
    echo "Shutting down..."
    kill $PYTHON_PID 2>/dev/null
    kill $NODE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
