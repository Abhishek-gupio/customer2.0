"""Expense schemas."""
from datetime import datetime
from typing import Any, Literal

from app.schemas.common import CamelModel


class CreateExpenseRequest(CamelModel):
    vehicle_id: str | None = None
    amount: float
    currency: str = "INR"
    category: Literal[
        "FUEL", "MAINTENANCE", "INSURANCE", "REGISTRATION", "PARKING",
        "TOLL", "REPAIR", "PARTS", "SERVICE", "ACCIDENT", "OTHER"
    ] = "OTHER"
    date: datetime | None = None
    merchant_name: str | None = None
    location: str | None = None
    notes: str | None = None


class ParseTextRequest(CamelModel):
    text: str
    vehicle_id: str | None = None


class ParseVoiceTextRequest(CamelModel):
    transcript: str
    vehicle_id: str | None = None


class SetBudgetRequest(CamelModel):
    category: str
    amount: float
    period: Literal["MONTHLY", "YEARLY"] = "MONTHLY"
    notify_threshold: float | None = None


class ExpenseResponse(CamelModel):
    id: str
    vehicle_id: str | None
    amount: float
    currency: str
    category: str
    date: datetime
    merchant_name: str | None
    source: str
    receipt_url: str | None
    notes: str | None
    created_at: datetime


class ExpenseSummaryResponse(CamelModel):
    total: float
    by_category: dict[str, float]
    period: str
