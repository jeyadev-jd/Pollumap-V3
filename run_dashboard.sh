#!/bin/bash
# Start script for Fullstack Pollumap V3 Dashboard

# 1. Start the FastAPI Backend in the background
echo "Starting FastAPI Backend on port 8000..."
source .venv/bin/activate
cd backend
python -m uvicorn app.main:app --port 8000 &
BACKEND_PID=$!
cd ..

# 2. Start the Vite React Frontend
echo "Starting React Frontend on port 5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo "Both servers are running!"
echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both servers."

# Trap SIGINT to kill background processes
trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT
wait
