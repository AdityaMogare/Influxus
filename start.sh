#!/bin/bash
echo "====================================="
echo " Starting Influxus Fintech Platform"
echo "====================================="

# Ensure docker is up for Postgres/Redis
docker compose up -d
sleep 2

source venv/bin/activate

echo "--> Starting FastAPI Backend on http://127.0.0.1:8000"
uvicorn main:app --port 8000 &
UVICORN_PID=$!
sleep 2

echo "--> Starting BullMQ Payments Worker"
python worker.py &
WORKER_PID=$!

echo "--> Starting Asset Price Updater"
python price_updater.py &
PRICE_PID=$!
sleep 1

echo "--> Starting React Vite Frontend on http://127.0.0.1:5173"
cd frontend
npm run dev &
VITE_PID=$!

echo "All services running! Press Ctrl+C to stop."
trap "kill $UVICORN_PID $WORKER_PID $PRICE_PID $VITE_PID; exit" INT TERM
wait
