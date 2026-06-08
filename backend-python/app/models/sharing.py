"""PlannedTrip, DiscoveryContent — misc models."""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class PlannedTrip(Base, TimestampMixin):
    __tablename__ = "PlannedTrip"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        "vehicleId", String, ForeignKey("customer.CustomerVehicle.id", ondelete="SET NULL"), nullable=True
    )
    origin: Mapped[str] = mapped_column(String, nullable=False)
    destination: Mapped[str] = mapped_column(String, nullable=False)
    distance_km: Mapped[float | None] = mapped_column("distanceKm", Float, nullable=True)
    fuel_cost: Mapped[float | None] = mapped_column("fuelCost", Float, nullable=True)
    toll_cost: Mapped[float | None] = mapped_column("tollCost", Float, nullable=True)
    estimated_cost: Mapped[float | None] = mapped_column("estimatedCost", Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PLANNED", nullable=False)
    planned_at: Mapped[datetime | None] = mapped_column("plannedAt", DateTime(timezone=True), nullable=True)
    waypoints: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="planned_trips")  # type: ignore[name-defined]


class DiscoveryContent(Base, TimestampMixin):
    __tablename__ = "DiscoveryContent"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column("thumbnailUrl", String, nullable=True)
    content_url: Mapped[str | None] = mapped_column("contentUrl", String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)
    content: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
