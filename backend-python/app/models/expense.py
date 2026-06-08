"""Expense, ExpenseBudget, FuelPriceCache, ServiceRecord, ServicePart."""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Expense(Base, TimestampMixin):
    __tablename__ = "Expense"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        "vehicleId", String, ForeignKey("customer.CustomerVehicle.id"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="INR", nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    merchant_name: Mapped[str | None] = mapped_column("merchantName", String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, default="MANUAL", nullable=False)
    receipt_url: Mapped[str | None] = mapped_column("receiptUrl", String, nullable=True)
    mime_type: Mapped[str | None] = mapped_column("mimeType", String, nullable=True)
    raw_text: Mapped[str | None] = mapped_column("rawText", String, nullable=True)
    is_automated: Mapped[bool] = mapped_column("isAutomated", Boolean, default=False, nullable=False)
    driver_id: Mapped[str | None] = mapped_column("driverId", String, nullable=True)
    place_address: Mapped[str | None] = mapped_column("placeAddress", String, nullable=True)
    place_id: Mapped[str | None] = mapped_column("placeId", String, nullable=True)
    place_lat: Mapped[float | None] = mapped_column("placeLat", Float, nullable=True)
    place_lng: Mapped[float | None] = mapped_column("placeLng", Float, nullable=True)
    place_name: Mapped[str | None] = mapped_column("placeName", String, nullable=True)

    customer: Mapped["Customer"] = relationship(  # type: ignore[name-defined]
        "Customer",
        primaryjoin="Expense.customer_id == Customer.id",
        back_populates="expenses",
    )
    vehicle: Mapped["CustomerVehicle | None"] = relationship(  # type: ignore[name-defined]
        "CustomerVehicle",
        primaryjoin="Expense.vehicle_id == CustomerVehicle.id",
        back_populates="expenses",
    )


class ExpenseBudget(Base, TimestampMixin):
    __tablename__ = "ExpenseBudget"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    period: Mapped[str] = mapped_column(String, default="MONTHLY", nullable=False)
    notify_threshold: Mapped[float | None] = mapped_column("notifyThreshold", Float, nullable=True)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="budgets")  # type: ignore[name-defined]


class FuelPriceCache(Base):
    __tablename__ = "FuelPriceCache"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    city: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False)
    fuel_type: Mapped[str] = mapped_column("fuelType", String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
