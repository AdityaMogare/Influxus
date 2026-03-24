import json
import random
from datetime import datetime, timedelta
from database import AsyncSessionLocal
from models import LedgerTransaction, JournalEntry, Account
from sqlalchemy import select

async def generate_simulated_bank_statement() -> list[dict]:
    """
    Generates a simulated JSON bank statement for the last 24 hours.
    Injects anomalies for the Reconciliation Engine to catch.
    """
    async with AsyncSessionLocal() as session:
        # Fetch actual transactions from the last 24h
        yesterday = datetime.now() - timedelta(days=1)
        result = await session.execute(
            select(LedgerTransaction)
            .where(LedgerTransaction.created_at >= yesterday, LedgerTransaction.status == "COMPLETED")
        )
        txs = result.scalars().all()

        statement = []
        
        for tx in txs:
            # We need to know the 'external' cash movement for this TX.
            # We assume external bank only sees movements involving the main CHECKING account.
            # Jars and Investments are internal to Influxus. We'll find JournalEntries for CHECKING accounts.
            entries = (await session.execute(
                select(JournalEntry).join(Account).where(
                    JournalEntry.transaction_id == tx.id,
                    Account.account_type == "CHECKING"
                )
            )).scalars().all()
            
            # Sum the net impact on our checking accounts for this transaction
            net_amount = sum(e.amount for e in entries)
            if net_amount == 0:
                continue # Internal transfer only (like checking to checking) where net is 0, bank might not see it or sees 2 lines. 
                         # However, for simplicity let's just log the absolute external amount moved.
            
            # Let's say we inject a MISTAKE randomly (10% chance)
            amount = float(abs(net_amount))
            is_anomaly = random.random() < 0.2
            
            if is_anomaly:
                defect_type = random.choice(["AMOUNT_MISMATCH", "MISSING_FROM_BANK"])
                if defect_type == "AMOUNT_MISMATCH":
                    amount += 5.00 # The bank charged $5 more (wire fee?)
                elif defect_type == "MISSING_FROM_BANK":
                    continue # Drop it! (Missing external transaction)
                    
            statement.append({
                "bank_reference": f"BANK-{tx.id}",
                "internal_tx_id": tx.id,
                "amount": amount,
                "direction": "CREDIT" if net_amount > 0 else "DEBIT",
                "timestamp": tx.created_at.isoformat() if tx.created_at else datetime.now().isoformat()
            })
            
        # Inject PHANTOM anomaly (transaction at the bank that Influxus doesn't know about)
        if random.random() < 0.5:
            statement.append({
                "bank_reference": f"BANK-99999{random.randint(10,99)}",
                "internal_tx_id": None,
                "amount": 150.00,
                "direction": "DEBIT",
                "timestamp": datetime.now().isoformat()
            })

        return statement

if __name__ == "__main__":
    import asyncio
    stmt = asyncio.run(generate_simulated_bank_statement())
    print(json.dumps(stmt, indent=2))
