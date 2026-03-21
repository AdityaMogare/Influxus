from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Account, LedgerTransaction, JournalEntry


async def record_transfer(
    db: AsyncSession, 
    from_account_id: int, 
    to_account_id: int, 
    amount: Decimal,
    currency: str,
    description: str
) -> LedgerTransaction:
    """
    External transfer. Enforces the FENCING RULE:
    Only CHECKING accounts can be the source for external payments.
    Jar balances are "fenced off" and do NOT contribute to spending power.
    """
    amount = Decimal(amount)
    if from_account_id == to_account_id:
        raise ValueError("Cannot transfer to the same account.")
    if amount <= 0:
        raise ValueError("Transfer amount must be strictly positive.")
    
    from_acc = await db.get(Account, from_account_id, with_for_update=True)
    to_acc = await db.get(Account, to_account_id, with_for_update=True)
    
    if not from_acc or not to_acc:
        raise ValueError("One or both accounts not found.")
    
    # FENCING RULE: Only CHECKING accounts can spend externally
    if from_acc.account_type != "CHECKING":
        raise ValueError(
            f"Cannot spend from a {from_acc.account_type} account. "
            "Move funds to your CHECKING account first."
        )
    
    if from_acc.currency != currency or to_acc.currency != currency:
        raise ValueError(
            "Currency mismatch. Core ledger requires matching currencies "
            "for simple transfer. FX requires multi-currency journal entries."
        )
        
    if from_acc.balance < amount:
        raise ValueError(
            f"Insufficient funds in CHECKING account. "
            f"Available: {from_acc.balance}, Required: {amount}."
        )
        
    transaction = LedgerTransaction(
        description=description,
        status="PENDING"
    )
    db.add(transaction)
    await db.flush()
    
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


async def move_to_jar(
    db: AsyncSession,
    checking_account_id: int,
    jar_account_id: int,
    amount: Decimal,
    direction: str = "to_jar"  # "to_jar" or "from_jar"
) -> LedgerTransaction:
    """
    Internal Jar transfer. Zero fees, instant execution (COMPLETED immediately).
    Crucial Wise Principle: no BullMQ delay, no fees.
    """
    amount = Decimal(amount)
    if amount <= 0:
        raise ValueError("Amount must be strictly positive.")
    
    checking = await db.get(Account, checking_account_id, with_for_update=True)
    jar = await db.get(Account, jar_account_id, with_for_update=True)
    
    if not checking or not jar:
        raise ValueError("One or both accounts not found.")
    if checking.account_type != "CHECKING":
        raise ValueError("Source must be a CHECKING account.")
    if jar.account_type != "JAR":
        raise ValueError("Target must be a JAR account.")
    if jar.parent_account_id != checking.id:
        raise ValueError("This Jar does not belong to this checking account.")
    
    if direction == "to_jar":
        source, dest = checking, jar
        desc = f"Move to Jar: {jar.jar_name or jar.name}"
    elif direction == "from_jar":
        source, dest = jar, checking
        desc = f"Move from Jar: {jar.jar_name or jar.name}"
    else:
        raise ValueError("Direction must be 'to_jar' or 'from_jar'.")
    
    if source.balance < amount:
        raise ValueError(f"Insufficient funds. Available: {source.balance}")
    
    # INSTANT execution — no BullMQ delay
    transaction = LedgerTransaction(
        description=desc,
        status="COMPLETED"
    )
    db.add(transaction)
    await db.flush()
    
    db.add_all([
        JournalEntry(transaction_id=transaction.id, account_id=source.id, amount=-amount, currency=checking.currency),
        JournalEntry(transaction_id=transaction.id, account_id=dest.id, amount=amount, currency=checking.currency),
    ])
    
    source.balance -= amount
    dest.balance += amount
    
    return transaction
