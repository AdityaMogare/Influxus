from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    # Cached balance for fast reads. Strict double entry requires sum(entries) == balance.
    balance = Column(Numeric(14, 4), default=0.0000, nullable=False)

class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    # For Phase 3: the background job will transition this from PENDING to COMPLETED
    status = Column(String, default="PENDING") 
    created_at = Column(DateTime, server_default=func.now())
    
    entries = relationship("JournalEntry", back_populates="transaction", cascade="all, delete-orphan")

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    
    # Positive amount increases balance (credit to account), negative decreases balance (debit from account)
    amount = Column(Numeric(14, 4), nullable=False) 
    currency = Column(String(3), nullable=False)
    
    transaction = relationship("LedgerTransaction", back_populates="entries")
    account = relationship("Account")

class Quote(Base):
    __tablename__ = "quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    source_currency = Column(String(3), nullable=False)
    target_currency = Column(String(3), nullable=False)
    amount = Column(Numeric(14, 4), nullable=False)
    rate = Column(Numeric(14, 6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
