"""Notification worker — FCM push + in-app notification creation."""
import asyncio

from app.workers.celery_app import celery_app


@celery_app.task(
    name="app.workers.notification_worker.send_push_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_push_notification(
    self,
    *,
    customer_id: str,
    title: str,
    body: str,
    type: str = "GENERAL",
    link: str | None = None,
    data: dict | None = None,
):
    """Send FCM push notification and create an InAppNotification record."""
    try:
        asyncio.run(
            _send(customer_id=customer_id, title=title, body=body, type=type, link=link, data=data)
        )
    except Exception as exc:
        raise self.retry(exc=exc)


async def _send(*, customer_id: str, title: str, body: str, type: str, link: str | None, data: dict | None):
    from app.core.database import async_session_factory
    from app.core.config import settings
    from app.models.customer import Customer, CustomerDevice
    from app.models.notification import InAppNotification
    from sqlalchemy import select
    from datetime import datetime, timezone

    try:
        from cuid2 import CUID
        notif_id = CUID().generate()
    except ImportError:
        import uuid
        notif_id = uuid.uuid4().hex

    async with async_session_factory() as db:
        notif = InAppNotification(
            id=notif_id,
            customer_id=customer_id,
            title=title,
            body=body,
            type=type,
            link=link,
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif)

        devices = (
            await db.execute(
                select(CustomerDevice).where(CustomerDevice.customer_id == customer_id)
            )
        ).scalars().all()

        fcm_tokens = [d.fcm_token for d in devices if d.fcm_token]
        await db.commit()

    if not fcm_tokens or not settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        return

    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
        import json

        if not firebase_admin._apps:
            sa = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(sa)
            firebase_admin.initialize_app(cred)

        for token in fcm_tokens:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                token=token,
            )
            messaging.send(msg)
    except Exception:
        pass
