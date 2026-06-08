"""Chat / AI assistant schemas."""
from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class ChatMessageResponse(CamelModel):
    id: str
    session_id: str
    role: str
    content: str
    metadata: Any | None
    created_at: datetime


class ChatSessionResponse(CamelModel):
    id: str
    title: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ChatFeedbackRequest(CamelModel):
    session_id: str
    rating: int | None = None
    comment: str | None = None


class AICoachRequest(CamelModel):
    message: str
    vehicle_id: str | None = None
