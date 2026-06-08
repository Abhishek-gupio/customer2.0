"""SupportTicket, TicketMessage, FAQ."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "SupportTicket"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="OPEN", nullable=False)
    priority: Mapped[str] = mapped_column(String, default="MEDIUM", nullable=False)
    category: Mapped[str] = mapped_column(String, default="OTHER", nullable=False)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="support_tickets")  # type: ignore[name-defined]
    messages: Mapped[list["TicketMessage"]] = relationship(
        "TicketMessage", back_populates="ticket", cascade="all, delete-orphan"
    )


class TicketMessage(Base):
    __tablename__ = "TicketMessage"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(
        "ticketId",
        String,
        ForeignKey("customer.SupportTicket.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[str] = mapped_column("senderId", String, nullable=False)
    sender_role: Mapped[str] = mapped_column("senderRole", String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False
    )

    ticket: Mapped[SupportTicket] = relationship("SupportTicket", back_populates="messages")


class FAQ(Base):
    __tablename__ = "FAQ"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    order: Mapped[int] = mapped_column(String, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column("isActive", String, default=True, nullable=False)
