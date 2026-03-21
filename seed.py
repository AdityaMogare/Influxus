import asyncio
from database import AsyncSessionLocal, engine
from models import Account, Category, AssetPrice, Base

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

async def seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        # ── Checking Accounts ──
        alice_usd = Account(name="Alice USD", currency="USD", balance=5000.0, account_type="CHECKING")
        bob_usd = Account(name="Bob USD", currency="USD", balance=2000.0, account_type="CHECKING")
        alice_eur = Account(name="Alice EUR", currency="EUR", balance=3000.0, account_type="CHECKING")
        session.add_all([alice_usd, bob_usd, alice_eur])
        await session.flush()
        
        # ── Jars for Alice ──
        holiday = Account(name="Jar: Holiday Fund", currency="USD", balance=0, account_type="JAR", parent_account_id=alice_usd.id, jar_name="Holiday Fund")
        emergency = Account(name="Jar: Emergency", currency="USD", balance=0, account_type="JAR", parent_account_id=alice_usd.id, jar_name="Emergency")
        session.add_all([holiday, emergency])
        
        # ── Default Categories ──
        categories = [
            Category(name="Food", icon="🍔"),
            Category(name="Transport", icon="🚗"),
            Category(name="Entertainment", icon="🎬"),
            Category(name="Shopping", icon="🛍️"),
            Category(name="Utilities", icon="⚡"),
            Category(name="Transfer", icon="↔️"),
        ]
        session.add_all(categories)
        
        # ── Mock Asset Prices ──
        assets = [
            AssetPrice(symbol="AAPL", name="Apple Inc.", current_price=195.50),
            AssetPrice(symbol="GOOGL", name="Alphabet Inc.", current_price=175.25),
            AssetPrice(symbol="SPY", name="S&P 500 ETF", current_price=580.00),
            AssetPrice(symbol="BTC", name="Bitcoin", current_price=67500.00),
            AssetPrice(symbol="ETH", name="Ethereum", current_price=3450.00),
        ]
        session.add_all(assets)
        
        await session.commit()
    print("✅ Database seeded with accounts, jars, categories, and asset prices.")

if __name__ == "__main__":
    asyncio.run(seed())
