from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from models import Account, LedgerTransaction, JournalEntry

async def record_transfer(
    db: AsyncSession, 
    from_account_id: int, 
    to_account_id: int, 
    amount: Decimal,
    currency: str,
    description: str
) -> LedgerTransaction:
    amount = Decimal(amount)
    if from_account_id == to_account_id:
        raise ValueError("Cannot transfer to the same account.")
    if amount <= 0:
        raise ValueError("Transfer amount must be strictly positive.")
    
    # Lock the accounts to prevent race conditions during balance update
    from_acc = await db.get(Account, from_account_id, with_for_update=True)
    to_acc = await db.get(Account, to_account_id, with_for_update=True)
    
    if not from_acc or not to_acc:
        raise ValueError("One or both accounts not found.")
        
    if from_acc.currency != currency or to_acc.currency != currency:
        raise ValueError(
            "Currency mismatch. Core ledger requires matching currencies "
            "for simple transfer. FX requires multi-currency journal entries."
        )
        
    if from_acc.balance < amount:
        raise ValueError("Insufficient original funds.")
        
    # Double-entry Bookkeeping Transaction
    transaction = LedgerTransaction(
        description=description,
        status="PENDING" # Will be processed by BullMQ worker later
    )
    db.add(transaction)
    await db.flush()
    
    # The fundamental principle: sum of amounts = 0
    debit_entry = JournalEntry(
        transaction_id=transaction.id,
        account_id=from_account_id,
        amount=-amount,
        currency=currency
    )
    credit_entry = JournalEntry(
        transaction_id=transaction.id,
        account_id=to_account_id,
        amount=amount,
        currency=currency
    )
    
    db.add_all([debit_entry, credit_entry])
    
    from_acc.balance -= amount
    to_acc.balance += amount
    
    return transaction
