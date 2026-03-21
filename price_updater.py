import asyncio
import random
from decimal import Decimal
from database import AsyncSessionLocal
from models import AssetPrice
from sqlalchemy import select


async def update_prices():
    """Simulate market fluctuations by randomly adjusting asset prices every 10 seconds."""
    while True:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(AssetPrice))
            assets = result.scalars().all()
            for asset in assets:
                # Random walk: -2% to +2%
                change = Decimal(str(random.uniform(-0.02, 0.02)))
                new_price = asset.current_price * (1 + change)
                asset.current_price = max(Decimal("0.01"), round(new_price, 4))
            await session.commit()
            if assets:
                print(f"[PriceUpdater] Updated {len(assets)} asset prices.")
        await asyncio.sleep(10)


async def main():
    print("Asset Price Updater running (updates every 10s)...")
    await update_prices()


if __name__ == "__main__":
    asyncio.run(main())
