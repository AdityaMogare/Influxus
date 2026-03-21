from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    balance = Column(Numeric(14, 4), default=0.0000, nullable=False)
    
    # Phase 6: Jars Architecture
    account_type = Column(String, default="CHECKING", nullable=False)  # CHECKING, SAVINGS, JAR, INVESTMENT
    parent_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    jar_name = Column(String, nullable=True)  # User-facing label for Jars (e.g., "Holiday Fund")
    
    parent = relationship("Account", remote_side=[id], backref="jars")

class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    status = Column(String, default="PENDING")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Phase 7
    created_at = Column(DateTime, server_default=func.now())
    
    entries = relationship("JournalEntry", back_populates="transaction", cascade="all, delete-orphan")
    category = relationship("Category", back_populates="transactions")

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("ledger_transactions.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    amount = Column(Numeric(14, 4), nullable=False)
    currency = Column(String(3), nullable=False)
    quantity = Column(Numeric(14, 6), nullable=True)  # Phase 8: Unit-based for assets
    
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

# Phase 7: Categorization Engine
class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, nullable=True)
    
    transactions = relationship("LedgerTransaction", back_populates="category")

class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    monthly_limit = Column(Numeric(14, 4), nullable=False)
    
    account = relationship("Account")
    category = relationship("Category")

# Phase 8: Assets Engine
class AssetPrice(Base):
    __tablename__ = "asset_prices"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(10), nullable=False, unique=True)
    name = Column(String, nullable=False)
    current_price = Column(Numeric(14, 4), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
