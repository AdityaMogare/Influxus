import contextlib
from fastapi import FastAPI, Depends, HTTPException
from database import engine, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, extract
from models import Base
import models
from ledger import record_transfer, move_to_jar
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime, timedelta
from bullmq import Queue
import redis.asyncio as redis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional

payment_queue = Queue("payment_queue", {"connection": {"host": "localhost", "port": 6379}})
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method != "POST":
            return await call_next(request)
        idempotency_key = request.headers.get("x-idempotency-key")
        if not idempotency_key:
            return await call_next(request)
        cached_response = await redis_client.get(f"idemp:{idempotency_key}")
        if cached_response:
            return Response(content=cached_response, media_type="application/json")
        response = await call_next(request)
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk
        if response.status_code == 200:
            await redis_client.set(f"idemp:{idempotency_key}", response_body.decode('utf-8'), ex=86400)
        return Response(content=response_body, status_code=response.status_code, headers=dict(response.headers), media_type=response.media_type)

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Influxus Ledger API", lifespan=lifespan)
app.add_middleware(IdempotencyMiddleware)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ──────────────────────── Request Models ────────────────────────

class TransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Decimal
    currency: str
    description: str = "Transfer"

class CreateJarRequest(BaseModel):
    parent_account_id: int
    jar_name: str
    currency: str = "USD"

class OTPRequest(BaseModel):
    identifier: str

class VerifyOTPRequest(BaseModel):
    identifier: str
    otp: str

class JarMoveRequest(BaseModel):
    checking_account_id: int
    jar_account_id: int
    amount: Decimal
    direction: str = "to_jar"  # "to_jar" or "from_jar"

class SetBudgetRequest(BaseModel):
    account_id: int
    category_name: str
    monthly_limit: Decimal

class BuyAssetRequest(BaseModel):
    checking_account_id: int
    symbol: str
    amount: Decimal  # Dollar amount to spend

# ──────────────────────── Core Endpoints ────────────────────────

@app.get("/")
async def root():
    return {"message": "Influxus Ledger is running"}

import random

@app.post("/auth/request-otp")
async def request_otp(req: OTPRequest):
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    # Store in Redis with 5 min (300s) expiry
    await redis_client.set(f"otp:{req.identifier}", otp, ex=300)
    print(f"OTP for {req.identifier} is {otp}")
    # Return OTP for ease of local testing
    return {"status": "success", "message": "OTP sent", "DEBUG_OTP": otp}

@app.post("/auth/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    stored_otp = await redis_client.get(f"otp:{req.identifier}")
    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")
    if stored_otp != req.otp:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    # OTP is valid, clear it
    await redis_client.delete(f"otp:{req.identifier}")
    
    return {"status": "success", "message": "Logged in", "token": "mock-jwt-token-123"}

@app.get("/accounts")
async def get_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Account).order_by(models.Account.id))
    accs = result.scalars().all()
    return [{"id": a.id, "name": a.name, "currency": a.currency, "balance": str(a.balance), "account_type": a.account_type, "parent_account_id": a.parent_account_id, "jar_name": a.jar_name} for a in accs]

@app.get("/transactions")
async def get_transactions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.LedgerTransaction).order_by(models.LedgerTransaction.created_at.desc())
    )
    txs = result.scalars().all()
    out = []
    for tx in txs:
        cat_name = None
        if tx.category_id:
            cat = await db.get(models.Category, tx.category_id)
            cat_name = cat.name if cat else None
        out.append({"id": tx.id, "description": tx.description, "status": tx.status, "category": cat_name, "created_at": tx.created_at.isoformat() if tx.created_at else None})
    return out

@app.get("/transactions/{id}")
async def get_transaction(id: int, db: AsyncSession = Depends(get_db)):
    tx = await db.get(models.LedgerTransaction, id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"id": tx.id, "description": tx.description, "status": tx.status, "created_at": tx.created_at.isoformat() if tx.created_at else None}

# ──────────────────────── Quote ────────────────────────

@app.get("/quote")
async def get_quote(sourceCurrency: str, targetCurrency: str, amount: Decimal, db: AsyncSession = Depends(get_db)):
    mock_rates = {"USD": 1.0, "EUR": 0.9, "GBP": 0.75, "INR": 85.0, "JPY": 155.0}
    if sourceCurrency not in mock_rates or targetCurrency not in mock_rates:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    rate = mock_rates[targetCurrency] / mock_rates[sourceCurrency]
    expires = datetime.now() + timedelta(minutes=15)
    quote = models.Quote(source_currency=sourceCurrency, target_currency=targetCurrency, amount=amount, rate=Decimal(str(rate)), expires_at=expires)
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return {"quote_id": quote.id, "source_currency": quote.source_currency, "target_currency": quote.target_currency, "source_amount": str(quote.amount), "target_amount": str(quote.amount * quote.rate), "rate": str(quote.rate), "expires_at": quote.expires_at.isoformat()}

# ──────────────────────── Transfer ────────────────────────

@app.post("/transfer")
async def transfer_money(req: TransferRequest, db: AsyncSession = Depends(get_db)):
    from categorizer import categorize_transaction
    try:
        tx = await record_transfer(db=db, from_account_id=req.from_account_id, to_account_id=req.to_account_id, amount=req.amount, currency=req.currency, description=req.description)
        await categorize_transaction(db, tx)
        await db.commit()
        await payment_queue.add("process_payment", {"transaction_id": tx.id}, {"delay": 5000})
        return {"status": "pending_clearing", "transaction_id": tx.id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────── Jars ────────────────────────

@app.post("/jars")
async def create_jar(req: CreateJarRequest, db: AsyncSession = Depends(get_db)):
    parent = await db.get(models.Account, req.parent_account_id)
    if not parent or parent.account_type != "CHECKING":
        raise HTTPException(status_code=400, detail="Parent must be a CHECKING account")
    jar = models.Account(name=f"Jar: {req.jar_name}", currency=req.currency, balance=0, account_type="JAR", parent_account_id=req.parent_account_id, jar_name=req.jar_name)
    db.add(jar)
    await db.commit()
    await db.refresh(jar)
    return {"id": jar.id, "name": jar.name, "jar_name": jar.jar_name, "currency": jar.currency, "balance": str(jar.balance)}

@app.post("/jars/move")
async def jar_move(req: JarMoveRequest, db: AsyncSession = Depends(get_db)):
    try:
        tx = await move_to_jar(db=db, checking_account_id=req.checking_account_id, jar_account_id=req.jar_account_id, amount=req.amount, direction=req.direction)
        await db.commit()
        return {"status": "completed", "transaction_id": tx.id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts/{account_id}/jars")
async def get_jars(account_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Account).where(models.Account.parent_account_id == account_id, models.Account.account_type == "JAR"))
    jars = result.scalars().all()
    return [{"id": j.id, "jar_name": j.jar_name, "currency": j.currency, "balance": str(j.balance)} for j in jars]

# ──────────────────────── Budgets ────────────────────────

@app.post("/budgets")
async def set_budget(req: SetBudgetRequest, db: AsyncSession = Depends(get_db)):
    cat = (await db.execute(select(models.Category).where(models.Category.name == req.category_name))).scalars().first()
    if not cat:
        cat = models.Category(name=req.category_name)
        db.add(cat)
        await db.flush()
    existing = (await db.execute(select(models.Budget).where(models.Budget.account_id == req.account_id, models.Budget.category_id == cat.id))).scalars().first()
    if existing:
        existing.monthly_limit = req.monthly_limit
    else:
        db.add(models.Budget(account_id=req.account_id, category_id=cat.id, monthly_limit=req.monthly_limit))
    await db.commit()
    return {"status": "ok", "category": cat.name, "monthly_limit": str(req.monthly_limit)}

@app.get("/budgets/status")
async def budget_status(account_id: int, db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    budgets = (await db.execute(select(models.Budget).where(models.Budget.account_id == account_id))).scalars().all()
    results = []
    for b in budgets:
        cat = await db.get(models.Category, b.category_id)
        spent_q = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(models.JournalEntry.amount), 0))
            .join(models.LedgerTransaction, models.JournalEntry.transaction_id == models.LedgerTransaction.id)
            .where(
                models.JournalEntry.account_id == account_id,
                models.JournalEntry.amount < 0,
                models.LedgerTransaction.category_id == b.category_id,
                extract('month', models.LedgerTransaction.created_at) == now.month,
                extract('year', models.LedgerTransaction.created_at) == now.year,
            )
        )
        spent = abs(spent_q.scalar() or 0)
        results.append({"category": cat.name, "spent": str(spent), "limit": str(b.monthly_limit), "remaining": str(b.monthly_limit - Decimal(str(spent)))})
    return results

# ──────────────────────── Assets ────────────────────────

@app.get("/assets")
async def get_assets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.AssetPrice))
    return [{"symbol": a.symbol, "name": a.name, "current_price": str(a.current_price)} for a in result.scalars().all()]

@app.post("/assets/buy")
async def buy_asset(req: BuyAssetRequest, db: AsyncSession = Depends(get_db)):
    from assets import buy_asset as do_buy
    try:
        tx, units = await do_buy(db=db, checking_account_id=req.checking_account_id, symbol=req.symbol, dollar_amount=req.amount)
        await db.commit()
        return {"status": "completed", "transaction_id": tx.id, "units_purchased": str(units)}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolio")
async def get_portfolio(account_id: int, db: AsyncSession = Depends(get_db)):
    from assets import get_portfolio_value
    try:
        holdings = await get_portfolio_value(db, account_id)
        return holdings
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ──────────────────────── Reconciliation & FinOps ────────────────────────

class ForceReconcileRequest(BaseModel):
    exception_id: int
    checking_account_id: int

@app.post("/reconcile/run")
async def run_recon_job(db: AsyncSession = Depends(get_db)):
    from statement_generator import generate_simulated_bank_statement
    from reconciliation_service import run_reconciliation
    statement = await generate_simulated_bank_statement()
    report = await run_reconciliation(db, statement)
    return {"status": "success", "report_id": report.id, "drift": str(report.total_drift), "report_status": report.status}

@app.get("/reconcile/reports")
async def get_recon_reports(db: AsyncSession = Depends(get_db)):
    from models import ReconciliationReport, ReconciliationException
    result = await db.execute(select(ReconciliationReport).order_by(ReconciliationReport.report_date.desc()))
    reports = result.scalars().all()
    out = []
    for r in reports:
        exc_q = await db.execute(select(ReconciliationException).where(ReconciliationException.report_id == r.id))
        exceptions = []
        for e in exc_q.scalars().all():
            exceptions.append({
                "id": e.id, 
                "transaction_id": e.transaction_id, 
                "bank_reference": e.bank_reference, 
                "mismatch_type": e.mismatch_type, 
                "resolved": e.resolved
            })
        out.append({
            "id": r.id, 
            "report_date": r.report_date.isoformat(), 
            "total_drift": str(r.total_drift), 
            "status": r.status,
            "exceptions": exceptions
        })
    return out

@app.post("/reconcile/force")
async def force_reconcile(req: ForceReconcileRequest, db: AsyncSession = Depends(get_db)):
    from reconciliation_service import force_reconcile_exception
    try:
        adj_tx = await force_reconcile_exception(db, req.exception_id, req.checking_account_id)
        return {"status": "resolved", "adjustment_transaction_id": adj_tx.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
