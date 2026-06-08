"""Notification router — /api/v1/notifications/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.notification import InAppNotification
from app.schemas.common import success

router = APIRouter()


@router.get("/")
async def list_notifications(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(InAppNotification)
            .where(InAppNotification.customer_id == customer.id)
            .order_by(InAppNotification.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return success([{
        "id": n.id,
        "title": n.title,
        "body": n.body,
        "type": n.type,
        "link": n.link,
        "isRead": n.is_read,
        "readAt": n.read_at.isoformat() if n.read_at else None,
        "createdAt": n.created_at.isoformat() if n.created_at else None,
    } for n in rows])


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InAppNotification).where(
            InAppNotification.id == notification_id,
            InAppNotification.customer_id == customer.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise NotFoundError("Notification not found")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await db.flush()
    return success({"id": notif.id, "isRead": True})


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InAppNotification).where(
            InAppNotification.id == notification_id,
            InAppNotification.customer_id == customer.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        await db.delete(notif)
        await db.flush()
    return success({"deleted": True})
