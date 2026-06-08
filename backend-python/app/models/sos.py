"""SOSRequest, EmergencyContact."""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class SOSRequest(Base, TimestampMixin):
    __tablename__ = "SOSRequest"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    type: Mapped[str] = mapped_column(String, default="ACCIDENT", nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        "resolvedAt", DateTime(timezone=True), nullable=True
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="sos_requests")  # type: ignore[name-defined]


class EmergencyContact(Base, TimestampMixin):
    __tablename__ = "EmergencyContact"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[str] = mapped_column("phoneNumber", String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    relation: Mapped[str | None] = mapped_column(String, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="emergency_contacts")  # type: ignore[name-defined]
