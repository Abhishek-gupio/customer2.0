"""Vehicle health score worker — mirrors Backend/src/workers/healthScoreWorker.ts."""
import asyncio

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.health_score_worker.recalculate_all_health_scores")
def recalculate_all_health_scores():
    asyncio.run(_recalculate_all())


@celery_app.task(name="app.workers.health_score_worker.recalculate_vehicle_health")
def recalculate_vehicle_health(vehicle_id: str):
    asyncio.run(_recalculate_vehicle(vehicle_id))


async def _recalculate_all():
    from app.core.database import async_session_factory
    from app.models.vehicle import CustomerVehicle
    from sqlalchemy import select

    async with async_session_factory() as db:
        vehicles = (await db.execute(select(CustomerVehicle.id))).scalars().all()
        for vid in vehicles:
            recalculate_vehicle_health.delay(str(vid))


async def _recalculate_vehicle(vehicle_id: str):
    from app.core.database import async_session_factory
    from app.models.vehicle import CustomerVehicle, VehicleHealthScore
    from app.models.expense import Expense
    from app.models.service import ServiceRecord
    from sqlalchemy import select, func
    from datetime import datetime, timezone

    try:
        from cuid2 import CUID
        score_id = CUID().generate()
    except ImportError:
        import uuid
        score_id = uuid.uuid4().hex

    async with async_session_factory() as db:
        expense_count = (
            await db.execute(
                select(func.count()).where(Expense.vehicle_id == vehicle_id)
            )
        ).scalar() or 0

        service_count = (
            await db.execute(
                select(func.count()).where(ServiceRecord.vehicle_id == vehicle_id)
            )
        ).scalar() or 0

        score = min(100, 50 + service_count * 5 - expense_count * 0.5)
        score = max(0, score)

        existing = (
            await db.execute(
                select(VehicleHealthScore).where(VehicleHealthScore.vehicle_id == vehicle_id)
            )
        ).scalar_one_or_none()

        if existing:
            existing.score = score
            existing.calculated_at = datetime.now(timezone.utc)
        else:
            hs = VehicleHealthScore(
                id=score_id,
                vehicle_id=vehicle_id,
                score=score,
                calculated_at=datetime.now(timezone.utc),
            )
            db.add(hs)
        await db.commit()
