source venv/bin/activate
uvicorn main:app &
UVICORN_PID=$!
python worker.py &
WORKER_PID=$!
sleep 3

echo "Initiating Transfer..."
curl -s -X POST http://127.0.0.1:8000/transfer -H "Content-Type: application/json" -d '{"from_account_id": 1, "to_account_id": 2, "amount": 10.0, "currency": "USD", "description": "Worker Test"}' > out.json
TX_ID=$(cat out.json | grep -o '\"transaction_id\":[0-9]*' | cut -d':' -f2)
echo "Got TX_ID: $TX_ID"

echo "Waiting for worker (6s)..."
sleep 6

echo "Checking DB Status..."
python -c "
import asyncio
from database import AsyncSessionLocal
from models import LedgerTransaction
async def check():
    async with AsyncSessionLocal() as session:
        tx = await session.get(LedgerTransaction, $TX_ID)
        print(f'FINAL STATUS: Transaction {tx.id} status is: {tx.status}')
asyncio.run(check())
"

kill $UVICORN_PID
kill $WORKER_PID
