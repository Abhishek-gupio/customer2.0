"""TelematicsDevice, DrivingTrip, DrivingEvent."""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TelematicsDevice(Base, TimestampMixin):
    __tablename__ = "TelematicsDevice"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    instance_id: Mapped[str] = mapped_column("instanceId", String, unique=True, nullable=False)
    device_token: Mapped[str | None] = mapped_column("deviceToken", String, nullable=True)
    platform: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(
        "lastSyncAt", DateTime(timezone=True), nullable=True
    )

    vehicle: Mapped["CustomerVehicle"] = relationship("CustomerVehicle", back_populates="telematics_device")  # type: ignore[name-defined]


class DrivingTrip(Base, TimestampMixin):
    __tablename__ = "DrivingTrip"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        nullable=False,
    )
    trip_id: Mapped[str] = mapped_column("tripId", String, unique=True, nullable=False)
    start_time: Mapped[datetime] = mapped_column("startTime", DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column("endTime", DateTime(timezone=True), nullable=True)
    distance_km: Mapped[float | None] = mapped_column("distanceKm", Float, nullable=True)
    duration_min: Mapped[float | None] = mapped_column("durationMin", Float, nullable=True)
    max_speed: Mapped[float | None] = mapped_column("maxSpeed", Float, nullable=True)
    avg_speed: Mapped[float | None] = mapped_column("avgSpeed", Float, nullable=True)
    fuel_consumed: Mapped[float | None] = mapped_column("fuelConsumed", Float, nullable=True)
    safety_score: Mapped[float | None] = mapped_column("safetyScore", Float, nullable=True)
    start_location: Mapped[Any | None] = mapped_column("startLocation", JSONB, nullable=True)
    end_location: Mapped[Any | None] = mapped_column("endLocation", JSONB, nullable=True)
    scores: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    statistics: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, default="COMPLETED", nullable=False)

    vehicle: Mapped["CustomerVehicle"] = relationship("CustomerVehicle", back_populates="driving_trips")  # type: ignore[name-defined]
    events: Mapped[list["DrivingEvent"]] = relationship(
        "DrivingEvent", back_populates="trip", cascade="all, delete-orphan"
    )


class DrivingEvent(Base):
    __tablename__ = "DrivingEvent"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    trip_id: Mapped[str] = mapped_column(
        "tripId",
        String,
        ForeignKey("customer.DrivingTrip.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column("eventType", String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[str | None] = mapped_column(String, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)

    trip: Mapped[DrivingTrip] = relationship("DrivingTrip", back_populates="events")
