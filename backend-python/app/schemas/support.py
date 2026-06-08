"""Support ticket schemas."""
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class CreateTicketRequest(CamelModel):
    subject: str
    description: str
    category: Literal["BILLING", "TECHNICAL", "ACCOUNT", "DOCUMENT", "OTHER"] = "OTHER"
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"


class AddTicketMessageRequest(CamelModel):
    content: str


class TicketResponse(CamelModel):
    id: str
    subject: str
    description: str
    status: str
    priority: str
    category: str
    created_at: datetime
    updated_at: datetime


class TicketMessageResponse(CamelModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_role: str
    content: str
    created_at: datetime


class FAQResponse(CamelModel):
    id: str
    question: str
    answer: str
    category: str | None
    order: int
