"""Discovery / trending content router — /api/v1/discovery/*"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.sharing import DiscoveryContent
from app.schemas.common import success

router = APIRouter()


@router.get("/trending")
async def get_trending(
    category: str | None = None,
    limit: int = 10,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    q = select(DiscoveryContent).where(DiscoveryContent.is_active == True)
    if category:
        q = q.where(DiscoveryContent.category == category)
    rows = (await db.execute(q.order_by(DiscoveryContent.created_at.desc()).limit(limit))).scalars().all()
    return success([{
        "id": r.id,
        "title": r.title,
        "type": r.type,
        "category": r.category,
        "thumbnailUrl": r.thumbnail_url,
        "contentUrl": r.content_url,
        "description": r.description,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    } for r in rows])


@router.get("/categories")
async def get_categories(customer: Customer = Depends(get_current_customer)):
    return success({"categories": ["tips", "news", "reviews", "guides", "maintenance"]})


@router.get("/{content_id}")
async def get_content(
    content_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    from app.core.errors import NotFoundError
    result = await db.execute(select(DiscoveryContent).where(DiscoveryContent.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise NotFoundError("Content not found")
    return success({
        "id": content.id,
        "title": content.title,
        "type": content.type,
        "category": content.category,
        "thumbnailUrl": content.thumbnail_url,
        "contentUrl": content.content_url,
        "description": content.description,
        "body": content.body,
        "createdAt": content.created_at.isoformat() if content.created_at else None,
    })
