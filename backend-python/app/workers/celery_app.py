"""Celery application — replaces BullMQ workers from Backend/src/workers/."""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "gupio_worker",
    broker=settings.REDIS_URL or "redis://localhost:6379/0",
    backend=settings.REDIS_URL or "redis://localhost:6379/0",
    include=[
        "app.workers.maintenance_worker",
        "app.workers.notification_worker",
        "app.workers.health_score_worker",
        "app.workers.expense_ingestion_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

celery_app.conf.beat_schedule = {
    "sync-fuel-prices-daily": {
        "task": "app.workers.expense_ingestion_worker.sync_fuel_prices",
        "schedule": crontab(hour=6, minute=0),
    },
    "recalculate-health-scores-weekly": {
        "task": "app.workers.health_score_worker.recalculate_all_health_scores",
        "schedule": crontab(day_of_week=0, hour=2, minute=0),
    },
    "send-maintenance-reminders-daily": {
        "task": "app.workers.maintenance_worker.send_maintenance_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
}
