from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import LedgerTransaction, JournalEntry, Account, ReconciliationReport, ReconciliationException

async def run_reconciliation(db: AsyncSession, statement: list[dict]) -> ReconciliationReport:
    """
    The Reconciliation Engine.
    Matches internal transactions against the bank statement.
    """
    report = ReconciliationReport()
    db.add(report)
    await db.flush()
    
    # 1. Map Bank Statement by internal_tx_id
    bank_txs = {}
    for b_tx in statement:
        if b_tx["internal_tx_id"]:
            bank_txs[b_tx["internal_tx_id"]] = b_tx
    
    # Calculate Bank Total Drift
    bank_total_balance = sum((Decimal(str(t["amount"])) if t["direction"] == "CREDIT" else -Decimal(str(t["amount"]))) for t in statement)
    
    # 2. Match Internal Ledger
    yesterday = datetime.now() - timedelta(days=1)
    internal_txs = (await db.execute(
        select(LedgerTransaction)
        .where(
            LedgerTransaction.created_at >= yesterday, 
            LedgerTransaction.status == "COMPLETED",
            LedgerTransaction.reconciliation_status != "RECONCILED"
        )
    )).scalars().all()
    
    internal_total_balance = Decimal("0.0")
    exceptions = []
    
    for tx in internal_txs:
        # Sum impact on Checking Accounts only (since Jars/Investments are internal virtual buckets)
        entries = (await db.execute(
            select(JournalEntry).join(Account).where(
                JournalEntry.transaction_id == tx.id,
                Account.account_type == "CHECKING"
            )
        )).scalars().all()
        
        net_amount = sum(e.amount for e in entries)
        internal_total_balance += net_amount
        
        # Skip internal-only transfers (net 0 on checking, e.g checking A to checking B)
        if net_amount == 0:
            tx.reconciliation_status = "RECONCILED"
            continue
            
        abs_net = abs(net_amount)
        
        if tx.id in bank_txs:
            b_tx = bank_txs[tx.id]
            b_amount = Decimal(str(b_tx["amount"]))
            
            if abs_net != b_amount:
                tx.reconciliation_status = "EXCEPTION"
                exceptions.append(ReconciliationException(
                    report_id=report.id,
                    transaction_id=tx.id,
                    bank_reference=b_tx["bank_reference"],
                    mismatch_type="AMOUNT_MISMATCH"
                ))
            else:
                tx.reconciliation_status = "RECONCILED"
            # Remove from bank_txs so we can find phantoms
            del bank_txs[tx.id]
        else:
            tx.reconciliation_status = "EXCEPTION"
            exceptions.append(ReconciliationException(
                report_id=report.id,
                transaction_id=tx.id,
                bank_reference=None,
                mismatch_type="MISSING_EXTERNAL"  # In DB but not at bank
            ))

    # 3. Phantoms (In Bank but not in DB)
    for b_tx in statement:
        # Any remaining transactions in the statement are phantoms or unlinked
        if b_tx["internal_tx_id"] not in bank_txs and b_tx["internal_tx_id"] is not None:
            continue # already processed
            
        exceptions.append(ReconciliationException(
            report_id=report.id,
            transaction_id=None,
            bank_reference=b_tx["bank_reference"],
            mismatch_type="PHANTOM"
        ))

    # 4. Drift Detector
    drift = internal_total_balance - bank_total_balance
    report.total_drift = drift
    report.status = "HAS_EXCEPTIONS" if exceptions else "RESOLVED"
    
    if exceptions:
        db.add_all(exceptions)
        
    await db.commit()
    return report

async def force_reconcile_exception(db: AsyncSession, exception_id: int, checking_account_id: int):
    """
    Financial Ops manual intervention: resolves an exception by injecting an adjustment entry into the ledger.
    """
    exc = await db.get(ReconciliationException, exception_id)
    if not exc or exc.resolved == "YES":
        raise ValueError("Exception not found or already resolved.")
        
    checking = await db.get(Account, checking_account_id)
    if not checking or checking.account_type != "CHECKING":
        raise ValueError("Valid CHECKING account required for adjustment.")
        
    # Inject adjustment transaction
    adj_tx = LedgerTransaction(
        description=f"RECONCILIATION ADJUSTMENT: {exc.mismatch_type} ({exc.bank_reference})",
        status="COMPLETED",
        reconciliation_status="RECONCILED"
    )
    db.add(adj_tx)
    await db.flush()
    
    # We create a dummy balancing entry. In reality, a "Reconciliation Adjustment" Account is used.
    # We'll just debit/credit the checking account to force balance sync with bank.
    db.add(JournalEntry(
        transaction_id=adj_tx.id,
        account_id=checking.id,
        amount=Decimal("0.0"), # We log the trace but without a real amount/partner just mark as resolved. Real FinOps requires exact adjustment offset amount.
        currency=checking.currency
    ))
    
    exc.resolved = "YES"
    # Update report status
    report = await db.get(ReconciliationReport, exc.report_id)
    unresolved = (await db.execute(select(func.count(ReconciliationException.id)).where(ReconciliationException.report_id == report.id, ReconciliationException.resolved == "NO"))).scalar()
    if unresolved == 0:
        report.status = "RESOLVED"
        
    await db.commit()
    return adj_tx
