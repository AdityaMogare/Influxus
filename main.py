import contextlib
from fastapi import FastAPI, Depends, HTTPException
from database import engine, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from models import Base
import models
from ledger import record_transfer
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime, timedelta
from bullmq import Queue
import redis.asyncio as redis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

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
        
        return Response(
            content=response_body, 
            status_code=response.status_code, 
            headers=dict(response.headers), 
            media_type=response.media_type
        )

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup for MVP
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="GlobalNode Ledger API", lifespan=lifespan)
app.add_middleware(IdempotencyMiddleware)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Decimal
    currency: str
    description: str = "Transfer"

@app.get("/")
async def root():
    return {"message": "GlobalNode Ledger is running"}

from sqlalchemy import select

@app.get("/transactions")
async def get_transactions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.LedgerTransaction).order_by(models.LedgerTransaction.created_at.desc()))
    txs = result.scalars().all()
    return [{"id": tx.id, "description": tx.description, "status": tx.status, "created_at": tx.created_at.isoformat() if tx.created_at else None} for tx in txs]

@app.get("/transactions/{id}")
async def get_transaction(id: int, db: AsyncSession = Depends(get_db)):
    tx = await db.get(models.LedgerTransaction, id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"id": tx.id, "description": tx.description, "status": tx.status, "created_at": tx.created_at.isoformat() if tx.created_at else None}

@app.get("/quote")
async def get_quote(sourceCurrency: str, targetCurrency: str, amount: Decimal, db: AsyncSession = Depends(get_db)):
    mock_rates = {"USD": 1.0, "EUR": 0.9, "GBP": 0.75}
    
    if sourceCurrency not in mock_rates or targetCurrency not in mock_rates:
        raise HTTPException(status_code=400, detail="Unsupported currency")
        
    rate = mock_rates[targetCurrency] / mock_rates[sourceCurrency]
    expires = datetime.now() + timedelta(minutes=15)
    
    quote = models.Quote(
        source_currency=sourceCurrency,
        target_currency=targetCurrency,
        amount=amount,
        rate=Decimal(str(rate)),
        expires_at=expires
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    
    return {
        "quote_id": quote.id,
        "source_currency": quote.source_currency,
        "target_currency": quote.target_currency,
        "source_amount": quote.amount,
        "target_amount": quote.amount * quote.rate,
        "rate": quote.rate,
        "expires_at": quote.expires_at
    }

@app.post("/transfer")
async def transfer_money(req: TransferRequest, db: AsyncSession = Depends(get_db)):
    try:
        tx = await record_transfer(
            db=db,
            from_account_id=req.from_account_id,
            to_account_id=req.to_account_id,
            amount=req.amount,
            currency=req.currency,
            description=req.description
        )
        await db.commit()
        
        await payment_queue.add("process_payment", {"transaction_id": tx.id}, {"delay": 5000})
        
        return {"status": "pending_clearing", "transaction_id": tx.id}
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
