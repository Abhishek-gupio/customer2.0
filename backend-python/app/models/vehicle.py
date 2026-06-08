"""
Vehicle-related models:
CustomerVehicle, VehicleCatalog, VehicleAsset, OdometerLog,
VehicleHealthScore, VehicleAccess, Challan.
"""
import enum
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class AccessRole(str, enum.Enum):
    VIEWER = "VIEWER"
    EDITOR = "EDITOR"
    OWNER = "OWNER"


class VehicleAssetType(str, enum.Enum):
    HERO = "HERO"
    ANGLE = "ANGLE"


class CustomerVehicle(Base, TimestampMixin):
    __tablename__ = "CustomerVehicle"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    registration_number: Mapped[str] = mapped_column(
        "registrationNumber", String, unique=True, nullable=False
    )
    make: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    fuel_type: Mapped[str | None] = mapped_column("fuelType", String, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column("vehicleType", String, nullable=True)
    current_odometer: Mapped[int | None] = mapped_column("currentOdometer", Integer, default=0)
    registration_date: Mapped[datetime | None] = mapped_column(
        "registrationDate", DateTime(timezone=True), nullable=True
    )
    rc_verified: Mapped[bool] = mapped_column("rcVerified", Boolean, default=False)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    is_primary: Mapped[bool] = mapped_column("isPrimary", Boolean, default=False)
    chassis_number: Mapped[str | None] = mapped_column("chassisNumber", String, nullable=True)
    engine_number: Mapped[str | None] = mapped_column("engineNumber", String, nullable=True)
    image_url: Mapped[str | None] = mapped_column("imageUrl", String, nullable=True)
    owner_name: Mapped[str | None] = mapped_column("ownerName", String, nullable=True)
    rto: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_class: Mapped[str | None] = mapped_column("vehicleClass", String, nullable=True)
    fuel_norms: Mapped[str | None] = mapped_column("fuelNorms", String, nullable=True)
    rc_status: Mapped[str | None] = mapped_column("rcStatus", String, nullable=True)
    unloaded_weight: Mapped[str | None] = mapped_column("unloadedWeight", String, nullable=True)
    fitness_upto: Mapped[str | None] = mapped_column("fitnessUpto", String, nullable=True)
    insurance_upto: Mapped[str | None] = mapped_column("insuranceUpto", String, nullable=True)
    pollution_upto: Mapped[str | None] = mapped_column("pollutionUpto", String, nullable=True)
    mileage: Mapped[str | None] = mapped_column(String, nullable=True)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    manufacturing_month_year: Mapped[str | None] = mapped_column(
        "manufacturingMonthYear", String, nullable=True
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="vehicles")  # type: ignore[name-defined]
    challans: Mapped[list["Challan"]] = relationship(
        "Challan", back_populates="vehicle", cascade="all, delete-orphan"
    )
    odometer_logs: Mapped[list["OdometerLog"]] = relationship(
        "OdometerLog", back_populates="vehicle", cascade="all, delete-orphan"
    )
    health_score: Mapped["VehicleHealthScore | None"] = relationship(
        "VehicleHealthScore", back_populates="vehicle", cascade="all, delete-orphan", uselist=False
    )
    access_list: Mapped[list["VehicleAccess"]] = relationship(
        "VehicleAccess", back_populates="vehicle", cascade="all, delete-orphan"
    )
    expenses: Mapped[list["Expense"]] = relationship(  # type: ignore[name-defined]
        "Expense",
        primaryjoin="CustomerVehicle.id == foreign(Expense.vehicle_id)",
        back_populates="vehicle",
    )
    service_records: Mapped[list["ServiceRecord"]] = relationship(  # type: ignore[name-defined]
        "ServiceRecord", back_populates="vehicle", cascade="all, delete-orphan"
    )
    driving_trips: Mapped[list["DrivingTrip"]] = relationship(  # type: ignore[name-defined]
        "DrivingTrip", back_populates="vehicle", cascade="all, delete-orphan"
    )
    telematics_device: Mapped["TelematicsDevice | None"] = relationship(  # type: ignore[name-defined]
        "TelematicsDevice", back_populates="vehicle", uselist=False, cascade="all, delete-orphan"
    )
    documents: Mapped[list["VehicleDocument"]] = relationship(  # type: ignore[name-defined]
        "VehicleDocument", back_populates="vehicle"
    )


class VehicleCatalog(Base, TimestampMixin):
    __tablename__ = "VehicleCatalog"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_type: Mapped[str] = mapped_column("vehicleType", String, nullable=False)
    make: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    variant: Mapped[str | None] = mapped_column(String, nullable=True)
    normalized_key: Mapped[str] = mapped_column("normalizedKey", String, unique=True, nullable=False)

    assets: Mapped[list["VehicleAsset"]] = relationship(
        "VehicleAsset", back_populates="catalog", cascade="all, delete-orphan"
    )


class VehicleAsset(Base, TimestampMixin):
    __tablename__ = "VehicleAsset"
    __table_args__ = (
        UniqueConstraint("catalogId", "type", "assetIndex", name="uq_vehicle_asset"),
        {"schema": "customer"},
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    catalog_id: Mapped[str] = mapped_column(
        "catalogId",
        String,
        ForeignKey("customer.VehicleCatalog.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[VehicleAssetType] = mapped_column(
        String, nullable=False
    )
    asset_index: Mapped[int] = mapped_column("assetIndex", Integer, default=0, nullable=False)
    asset_url: Mapped[str] = mapped_column("assetUrl", String, nullable=False)
    asset_hash: Mapped[str | None] = mapped_column("assetHash", String, nullable=True)
    mime_type: Mapped[str | None] = mapped_column("mimeType", String, nullable=True)
    s3_key: Mapped[str | None] = mapped_column("s3Key", String, nullable=True)

    catalog: Mapped[VehicleCatalog] = relationship("VehicleCatalog", back_populates="assets")


class OdometerLog(Base):
    __tablename__ = "OdometerLog"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        nullable=False,
    )
    reading: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False
    )

    vehicle: Mapped[CustomerVehicle] = relationship("CustomerVehicle", back_populates="odometer_logs")


class Challan(Base, TimestampMixin):
    __tablename__ = "Challan"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        nullable=False,
    )
    challan_number: Mapped[str] = mapped_column("challanNumber", String, unique=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    violation_type: Mapped[str] = mapped_column("violationType", String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    metadata_: Mapped[Any | None] = mapped_column("metadata", JSONB, nullable=True)

    vehicle: Mapped[CustomerVehicle] = relationship("CustomerVehicle", back_populates="challans")


class VehicleHealthScore(Base):
    __tablename__ = "VehicleHealthScore"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    overall_score: Mapped[int] = mapped_column("overallScore", Integer, default=100, nullable=False)
    age_score: Mapped[int | None] = mapped_column("ageScore", Integer, nullable=True)
    mileage_score: Mapped[int | None] = mapped_column("mileageScore", Integer, nullable=True)
    maintenance_score: Mapped[int | None] = mapped_column("maintenanceScore", Integer, nullable=True)
    driving_score: Mapped[int | None] = mapped_column("drivingScore", Integer, nullable=True)
    explanations: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    recommendations: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    last_calculated: Mapped[datetime] = mapped_column(
        "lastCalculated", DateTime(timezone=True), nullable=False
    )
    next_due_date: Mapped[datetime | None] = mapped_column(
        "nextDueDate", DateTime(timezone=True), nullable=True
    )

    vehicle: Mapped[CustomerVehicle] = relationship(
        "CustomerVehicle", back_populates="health_score"
    )


class VehicleAccess(Base, TimestampMixin):
    __tablename__ = "VehicleAccess"
    __table_args__ = (
        UniqueConstraint("vehicleId", "customerId", name="uq_vehicle_access"),
        {"schema": "customer"},
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(
        "vehicleId",
        String,
        ForeignKey("customer.CustomerVehicle.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[str] = mapped_column(
        "customerId",
        String,
        ForeignKey("customer.Customer.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[AccessRole] = mapped_column(String, default=AccessRole.VIEWER, nullable=False)
    granted_by_id: Mapped[str | None] = mapped_column(
        "grantedById", String, ForeignKey("customer.Customer.id"), nullable=True
    )
    granted_at: Mapped[datetime | None] = mapped_column("grantedAt", DateTime(timezone=True), nullable=True)

    vehicle: Mapped[CustomerVehicle] = relationship("CustomerVehicle", back_populates="access_list")
    customer: Mapped["Customer"] = relationship("Customer", foreign_keys=[customer_id], back_populates="shared_vehicles")  # type: ignore[name-defined]
