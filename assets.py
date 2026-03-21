from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Account, AssetPrice, LedgerTransaction, JournalEntry


async def buy_asset(
    db: AsyncSession,
    checking_account_id: int,
    symbol: str,
    dollar_amount: Decimal
) -> tuple[LedgerTransaction, Decimal]:
    """
    Buy units of an asset.
    Atomic double-entry transaction:
      - Debit $dollar_amount from CHECKING
      - Credit `units` to the user's INVESTMENT account (auto-created if needed)
    Returns (transaction, units_purchased).
    """
    dollar_amount = Decimal(dollar_amount)
    if dollar_amount <= 0:
        raise ValueError("Amount must be positive.")
    
    checking = await db.get(Account, checking_account_id, with_for_update=True)
    if not checking or checking.account_type != "CHECKING":
        raise ValueError("Source must be a CHECKING account.")
    if checking.balance < dollar_amount:
        raise ValueError(f"Insufficient funds. Available: {checking.balance}")
    
    asset = (await db.execute(select(AssetPrice).where(AssetPrice.symbol == symbol))).scalars().first()
    if not asset:
        raise ValueError(f"Unknown asset: {symbol}")
    
    units = dollar_amount / asset.current_price
    
    # Find or create the user's INVESTMENT account for this asset
    inv_acc = (await db.execute(
        select(Account).where(
            Account.parent_account_id == checking.id,
            Account.account_type == "INVESTMENT",
            Account.name == f"Investment: {symbol}"
        )
    )).scalars().first()
    
    if not inv_acc:
        inv_acc = Account(
            name=f"Investment: {symbol}",
            currency=checking.currency,
            balance=0,
            account_type="INVESTMENT",
            parent_account_id=checking.id,
            jar_name=symbol
        )
        db.add(inv_acc)
        await db.flush()
    
    # Atomic double-entry
    tx = LedgerTransaction(description=f"Buy {units:.4f} units of {symbol} @ ${asset.current_price}", status="COMPLETED")
    db.add(tx)
    await db.flush()
    
    db.add_all([
        JournalEntry(transaction_id=tx.id, account_id=checking.id, amount=-dollar_amount, currency=checking.currency),
        JournalEntry(transaction_id=tx.id, account_id=inv_acc.id, amount=dollar_amount, currency=checking.currency, quantity=units),
    ])
    
    checking.balance -= dollar_amount
    inv_acc.balance += dollar_amount
    
    return tx, units


async def get_portfolio_value(db: AsyncSession, account_id: int) -> list[dict]:
    """
    Get portfolio holdings with live market valuations.
    CurrentValue = Units × CurrentMarketPrice
    """
    inv_accs = (await db.execute(
        select(Account).where(Account.parent_account_id == account_id, Account.account_type == "INVESTMENT")
    )).scalars().all()
    
    holdings = []
    total_value = Decimal(0)
    total_cost = Decimal(0)
    
    for acc in inv_accs:
        symbol = acc.jar_name  # We stored the symbol here
        entries = (await db.execute(
            select(JournalEntry).where(JournalEntry.account_id == acc.id, JournalEntry.quantity != None)
        )).scalars().all()
        
        total_units = sum(e.quantity for e in entries)
        cost_basis = acc.balance  # Total dollars spent
        
        asset = (await db.execute(select(AssetPrice).where(AssetPrice.symbol == symbol))).scalars().first()
        if not asset:
            continue
        
        market_value = total_units * asset.current_price
        gain = market_value - cost_basis
        
        holdings.append({
            "symbol": symbol,
            "name": asset.name,
            "units": str(total_units),
            "cost_basis": str(cost_basis),
            "current_price": str(asset.current_price),
            "market_value": str(market_value),
            "gain_loss": str(gain),
            "gain_pct": str((gain / cost_basis * 100) if cost_basis else 0),
        })
        total_value += market_value
        total_cost += cost_basis
    
    return {"holdings": holdings, "total_value": str(total_value), "total_cost": str(total_cost), "total_gain": str(total_value - total_cost)}
