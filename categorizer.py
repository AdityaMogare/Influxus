import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Category, LedgerTransaction

# Simple mapping-based auto-tagger
CATEGORY_PATTERNS = {
    "Food": [r"(?i)whole\s*foods", r"(?i)groceries", r"(?i)mcdonald", r"(?i)starbucks", r"(?i)restaurant", r"(?i)pizza", r"(?i)cafe", r"(?i)food"],
    "Transport": [r"(?i)uber", r"(?i)lyft", r"(?i)taxi", r"(?i)metro", r"(?i)gas\s*station", r"(?i)fuel", r"(?i)transport"],
    "Entertainment": [r"(?i)netflix", r"(?i)spotify", r"(?i)cinema", r"(?i)hulu", r"(?i)gaming", r"(?i)entertainment"],
    "Shopping": [r"(?i)amazon", r"(?i)walmart", r"(?i)target", r"(?i)ebay", r"(?i)shop"],
    "Utilities": [r"(?i)electric", r"(?i)water\s*bill", r"(?i)internet", r"(?i)phone\s*bill", r"(?i)utility"],
    "Transfer": [r"(?i)transfer", r"(?i)move\s*to\s*jar", r"(?i)move\s*from\s*jar"],
}


def classify_description(description: str) -> str | None:
    """Match a transaction description against known patterns."""
    if not description:
        return None
    for category_name, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, description):
                return category_name
    return None


async def categorize_transaction(db: AsyncSession, tx: LedgerTransaction):
    """
    Auto-categorize a LedgerTransaction based on its description.
    Creates the Category row if it doesn't exist, then links it.
    """
    cat_name = classify_description(tx.description)
    if not cat_name:
        return
    
    cat = (await db.execute(select(Category).where(Category.name == cat_name))).scalars().first()
    if not cat:
        cat = Category(name=cat_name)
        db.add(cat)
        await db.flush()
    
    tx.category_id = cat.id
