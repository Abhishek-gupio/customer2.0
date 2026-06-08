"""
Document-related models:
VehicleDocument, DrivingLicense, FastagDocument, DigiLockerConnection.
"""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class VehicleDocument(Base, TimestampMixin):
    __tablename__ = "VehicleDocument"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        "vehicleId", String, ForeignKey("customer.CustomerVehicle.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    document_number: Mapped[str | None] = mapped_column("documentNumber", String, nullable=True)
    expiry_date: Mapped[datetime | None] = mapped_column(
        "expiryDate", DateTime(timezone=True), nullable=True
    )
    file_content: Mapped[bytes | None] = mapped_column("fileContent", LargeBinary, nullable=True)
    file_url: Mapped[str | None] = mapped_column("fileUrl", String, nullable=True)
    mime_type: Mapped[str | None] = mapped_column("mimeType", String, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="documents")  # type: ignore[name-defined]
    vehicle: Mapped["CustomerVehicle | None"] = relationship("CustomerVehicle", back_populates="documents")  # type: ignore[name-defined]


class DrivingLicense(Base, TimestampMixin):
    __tablename__ = "DrivingLicense"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    dl_number: Mapped[str] = mapped_column("dlNumber", String, unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column("fullName", String, nullable=True)
    dob: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_number: Mapped[str | None] = mapped_column("referenceNumber", String, nullable=True)
    date_of_issue: Mapped[str | None] = mapped_column("dateOfIssue", String, nullable=True)
    validity_transport: Mapped[str | None] = mapped_column("validityTransport", String, nullable=True)
    validity_non_transport: Mapped[str | None] = mapped_column(
        "validityNonTransport", String, nullable=True
    )
    raw_response: Mapped[Any | None] = mapped_column("rawResponse", JSONB, nullable=True)


class FastagDocument(Base, TimestampMixin):
    __tablename__ = "FastagDocument"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    creditor_account_id: Mapped[str] = mapped_column("creditorAccountId", String, nullable=False)
    ifsc_code: Mapped[str] = mapped_column("ifscCode", String, nullable=False)
    creditor_name: Mapped[str | None] = mapped_column("creditorName", String, nullable=True)
    transaction_id: Mapped[str | None] = mapped_column("transactionId", String, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_response: Mapped[Any | None] = mapped_column("rawResponse", JSONB, nullable=True)


class DigiLockerConnection(Base, TimestampMixin):
    __tablename__ = "DigiLockerConnection"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    access_token: Mapped[str] = mapped_column("accessToken", String, nullable=False)
    refresh_token: Mapped[str] = mapped_column("refreshToken", String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True), nullable=False)
    scope: Mapped[str | None] = mapped_column(String, nullable=True)
    consent_id: Mapped[str | None] = mapped_column("consentId", String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="CONNECTED", nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(
        "lastSyncAt", DateTime(timezone=True), nullable=True
    )
    connected_at: Mapped[datetime] = mapped_column("connectedAt", DateTime(timezone=True), nullable=False)
