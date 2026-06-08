"""ServiceRecord, ServicePart, PartReplacementInterval."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class ServiceRecord(Base, TimestampMixin):
    __tablename__ = "ServiceRecord"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        nullable=False,
    )
    expense_id: Mapped[str | None] = mapped_column("expenseId", String, nullable=True)
    service_type: Mapped[str] = mapped_column("serviceType", String, nullable=False)
    garage_name: Mapped[str | None] = mapped_column("garageName", String, nullable=True)
    odometer_at_service: Mapped[int | None] = mapped_column(
        "odometerAtService", Integer, nullable=True
    )
    service_date: Mapped[datetime] = mapped_column("serviceDate", DateTime(timezone=True), nullable=False)
    next_service_date: Mapped[datetime | None] = mapped_column(
        "nextServiceDate", DateTime(timezone=True), nullable=True
    )
    next_service_km: Mapped[int | None] = mapped_column("nextServiceKm", Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    vehicle: Mapped["CustomerVehicle"] = relationship("CustomerVehicle", back_populates="service_records")  # type: ignore[name-defined]
    parts: Mapped[list["ServicePart"]] = relationship(
        "ServicePart", back_populates="service_record", cascade="all, delete-orphan"
    )


class ServicePart(Base, TimestampMixin):
    __tablename__ = "ServicePart"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    service_record_id: Mapped[str] = mapped_column(
        "serviceRecordId",
        String,
        ForeignKey("customer.ServiceRecord.id", ondelete="CASCADE"),
        nullable=False,
    )
    part_type: Mapped[str] = mapped_column("partType", String, nullable=False)
    part_name: Mapped[str | None] = mapped_column("partName", String, nullable=True)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    warranty_months: Mapped[int | None] = mapped_column("warrantyMonths", Integer, nullable=True)
    warranty_km: Mapped[int | None] = mapped_column("warrantyKm", Integer, nullable=True)
    warranty_expires_at: Mapped[datetime | None] = mapped_column(
        "warrantyExpiresAt", DateTime(timezone=True), nullable=True
    )
    last_replaced_at: Mapped[datetime | None] = mapped_column(
        "lastReplacedAt", DateTime(timezone=True), nullable=True
    )
    next_replacement_due: Mapped[datetime | None] = mapped_column(
        "nextReplacementDue", DateTime(timezone=True), nullable=True
    )

    service_record: Mapped[ServiceRecord] = relationship("ServiceRecord", back_populates="parts")


class PartReplacementInterval(Base):
    __tablename__ = "PartReplacementInterval"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    make: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    year_min: Mapped[int | None] = mapped_column("yearMin", Integer, nullable=True)
    year_max: Mapped[int | None] = mapped_column("yearMax", Integer, nullable=True)
    part_type: Mapped[str] = mapped_column("partType", String, nullable=False)
    interval_months: Mapped[int | None] = mapped_column("intervalMonths", Integer, nullable=True)
    interval_km: Mapped[int | None] = mapped_column("intervalKm", Integer, nullable=True)
    default_warranty_months: Mapped[int | None] = mapped_column(
        "defaultWarrantyMonths", Integer, nullable=True
    )
    source: Mapped[str | None] = mapped_column(String, nullable=True)
