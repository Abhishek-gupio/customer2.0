"""Customer and CustomerDevice — mirrors Prisma Customer + CustomerDevice models."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "Customer"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    phone_number: Mapped[str] = mapped_column("phoneNumber", String, unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    full_name: Mapped[str | None] = mapped_column("fullName", String, nullable=True)
    profile_pic: Mapped[str | None] = mapped_column("profilePic", String, nullable=True)
    google_id: Mapped[str | None] = mapped_column("googleId", String, unique=True, nullable=True)

    # Relationships (loaded lazily by default)
    devices: Mapped[list["CustomerDevice"]] = relationship(
        "CustomerDevice", back_populates="customer", cascade="all, delete-orphan"
    )
    vehicles: Mapped[list["CustomerVehicle"]] = relationship(  # type: ignore[name-defined]
        "CustomerVehicle", back_populates="customer", cascade="all, delete-orphan"
    )
    expenses: Mapped[list["Expense"]] = relationship(  # type: ignore[name-defined]
        "Expense",
        primaryjoin="Customer.id == foreign(Expense.customer_id)",
        back_populates="customer",
    )
    notifications: Mapped[list["InAppNotification"]] = relationship(  # type: ignore[name-defined]
        "InAppNotification", back_populates="customer", cascade="all, delete-orphan"
    )
    support_tickets: Mapped[list["SupportTicket"]] = relationship(  # type: ignore[name-defined]
        "SupportTicket", back_populates="customer", cascade="all, delete-orphan"
    )
    sos_requests: Mapped[list["SOSRequest"]] = relationship(  # type: ignore[name-defined]
        "SOSRequest", back_populates="customer", cascade="all, delete-orphan"
    )
    emergency_contacts: Mapped[list["EmergencyContact"]] = relationship(  # type: ignore[name-defined]
        "EmergencyContact", back_populates="customer", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(  # type: ignore[name-defined]
        "ChatSession", back_populates="customer", cascade="all, delete-orphan"
    )
    documents: Mapped[list["VehicleDocument"]] = relationship(  # type: ignore[name-defined]
        "VehicleDocument", back_populates="customer", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["ExpenseBudget"]] = relationship(  # type: ignore[name-defined]
        "ExpenseBudget", back_populates="customer", cascade="all, delete-orphan"
    )
    shared_vehicles: Mapped[list["VehicleAccess"]] = relationship(  # type: ignore[name-defined]
        "VehicleAccess",
        foreign_keys="[VehicleAccess.customer_id]",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    planned_trips: Mapped[list["PlannedTrip"]] = relationship(  # type: ignore[name-defined]
        "PlannedTrip", back_populates="customer", cascade="all, delete-orphan"
    )


class CustomerDevice(Base, TimestampMixin):
    __tablename__ = "CustomerDevice"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String, nullable=False)
    device_token: Mapped[str | None] = mapped_column("deviceToken", String, nullable=True)
    device_info: Mapped[str | None] = mapped_column("deviceInfo", String, nullable=True)
    last_active_at: Mapped[datetime] = mapped_column(
        "lastActiveAt", DateTime(timezone=True), nullable=False
    )

    customer: Mapped[Customer] = relationship("Customer", back_populates="devices")
