"""Expense ingestion worker — fuel price sync + anomaly detection."""
import asyncio

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.expense_ingestion_worker.sync_fuel_prices")
def sync_fuel_prices():
    asyncio.run(_sync_fuel_prices())


@celery_app.task(name="app.workers.expense_ingestion_worker.check_expense_anomaly")
def check_expense_anomaly(expense_id: str, customer_id: str):
    asyncio.run(_check_anomaly(expense_id, customer_id))


async def _sync_fuel_prices():
    """Fetch live fuel prices from an external API and upsert into FuelPriceCache."""
    from app.core.database import async_session_factory
    from app.models.expense import FuelPriceCache
    from sqlalchemy import select
    from datetime import datetime, timezone

    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://fuelpriceindia.in/api/v1/today")
            if resp.status_code != 200:
                return
            data = resp.json()
    except Exception:
        return

    async with async_session_factory() as db:
        for entry in data.get("prices", []):
            city = entry.get("city", "")
            state = entry.get("state", "")
            result = await db.execute(
                select(FuelPriceCache).where(
                    FuelPriceCache.city == city, FuelPriceCache.state == state
                )
            )
            cache = result.scalar_one_or_none()
            if cache:
                cache.petrol_price = entry.get("petrol")
                cache.diesel_price = entry.get("diesel")
                cache.cng_price = entry.get("cng")
                cache.updated_at = datetime.now(timezone.utc)
            else:
                try:
                    from cuid2 import CUID
                    cache_id = CUID().generate()
                except ImportError:
                    import uuid
                    cache_id = uuid.uuid4().hex
                cache = FuelPriceCache(
                    id=cache_id,
                    state=state,
                    city=city,
                    petrol_price=entry.get("petrol"),
                    diesel_price=entry.get("diesel"),
                    cng_price=entry.get("cng"),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(cache)
        await db.commit()


async def _check_anomaly(expense_id: str, customer_id: str):
    from app.core.database import async_session_factory
    from app.models.expense import Expense
    from sqlalchemy import select, func

    async with async_session_factory() as db:
        expense = (
            await db.execute(select(Expense).where(Expense.id == expense_id))
        ).scalar_one_or_none()
        if not expense:
            return

        avg = (
            await db.execute(
                select(func.avg(Expense.amount)).where(
                    Expense.customer_id == customer_id,
                    Expense.category == expense.category,
                )
            )
        ).scalar() or 0

        if avg > 0 and expense.amount > avg * 2.5:
            from app.workers.notification_worker import send_push_notification
            send_push_notification.delay(
                customer_id=customer_id,
                title="Unusual Expense Detected",
                body=f"This {expense.category} expense is significantly higher than your average.",
                type="ANOMALY_ALERT",
                link=f"/expenses/{expense_id}",
            )
