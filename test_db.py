import asyncio
from database import AsyncSessionLocal
from models import Account, LedgerTransaction, JournalEntry
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Account).order_by(Account.id))
        for acc in result.scalars():
            print(f"Account {acc.id} ({acc.name}): {acc.balance} {acc.currency}")
        
        txs = await session.execute(select(LedgerTransaction))
        print(f"Transactions: {len(list(txs.scalars()))}")

        jes = await session.execute(select(JournalEntry))
        for je in jes.scalars():
            print(f"Journal Entry: tx={je.transaction_id} acc={je.account_id} amt={je.amount} cur={je.currency}")

if __name__ == "__main__":
    asyncio.run(check())
