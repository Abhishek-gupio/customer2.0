"""Notification schemas."""
from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class NotificationResponse(CamelModel):
    id: str
    title: str
    body: str
    type: str | None
    link: str | None
    metadata: Any | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime
