import asyncio
from database import AsyncSessionLocal, engine
from models import Account, Base

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        acc1 = Account(name="Alice USD", currency="USD", balance=1000.0)
        acc2 = Account(name="Bob USD", currency="USD", balance=500.0)
        acc3 = Account(name="Alice EUR", currency="EUR", balance=800.0)
        session.add_all([acc1, acc2, acc3])
        await session.commit()
    print("Database seeded with test accounts.")

if __name__ == "__main__":
    asyncio.run(seed())
