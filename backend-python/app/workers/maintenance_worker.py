"""Maintenance reminder worker — mirrors Backend/src/workers/maintenanceWorker.ts."""
import asyncio
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.maintenance_worker.send_maintenance_reminders", bind=True, max_retries=3)
def send_maintenance_reminders(self):
    """Send push notifications for upcoming service due dates."""
    try:
        asyncio.run(_send_maintenance_reminders())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * 5)


async def _send_maintenance_reminders():
    from app.core.database import async_session_factory
    from sqlalchemy import select
    from app.models.service import ServiceRecord
    from app.models.customer import Customer

    async with async_session_factory() as db:
        cutoff = datetime.now(timezone.utc) + timedelta(days=7)
        rows = (
            await db.execute(
                select(ServiceRecord).where(
                    ServiceRecord.next_service_date <= cutoff,
                    ServiceRecord.next_service_date > datetime.now(timezone.utc),
                )
            )
        ).scalars().all()
        for record in rows:
            notification_worker_task.delay(
                customer_id=record.customer_id,
                title="Service Reminder",
                body=f"Your vehicle service is due soon.",
                type="SERVICE_REMINDER",
                link=f"/services/{record.id}",
            )


@celery_app.task(name="app.workers.maintenance_worker.schedule_service_alert")
def schedule_service_alert(vehicle_id: str, customer_id: str, due_date: str):
    """Schedule a one-off service alert for a specific vehicle."""
    notification_worker_task.delay(
        customer_id=customer_id,
        title="Service Due",
        body="Your vehicle service is due.",
        type="SERVICE_DUE",
        link=f"/garage/{vehicle_id}",
    )


from app.workers.notification_worker import send_push_notification as notification_worker_task  # noqa: E402
