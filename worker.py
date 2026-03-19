import asyncio
from bullmq import Worker
from database import AsyncSessionLocal
from models import LedgerTransaction
from sqlalchemy import update

async def process_payment(job, job_token):
    tx_id = job.custom_data.get("transaction_id") if hasattr(job, "custom_data") and job.custom_data else job.data.get("transaction_id")
    print(f"Processing payment for transaction {tx_id}...")
    
    async with AsyncSessionLocal() as session:
        # Mark the transaction as COMPLETED
        stmt = update(LedgerTransaction).where(LedgerTransaction.id == tx_id).values(status="COMPLETED")
        await session.execute(stmt)
        await session.commit()
        
    print(f"Transaction {tx_id} marked as COMPLETED.")

async def main():
    worker = Worker("payment_queue", process_payment, {"connection": {"host": "localhost", "port": 6379}})
    print("Worker listening on payment_queue...")
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
