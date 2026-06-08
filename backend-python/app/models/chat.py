"""ChatSession, ChatMessage, ChatAnalytics."""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class ChatSession(Base, TimestampMixin):
    __tablename__ = "ChatSession"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(
        "customerId", String, ForeignKey("customer.Customer.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(String, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="chat_sessions")  # type: ignore[name-defined]
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "ChatMessage"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        "sessionId",
        String,
        ForeignKey("customer.ChatSession.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    metadata_: Mapped[Any | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False
    )

    session: Mapped[ChatSession] = relationship("ChatSession", back_populates="messages")


class ChatAnalytics(Base):
    __tablename__ = "ChatAnalytics"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column("customerId", String, nullable=False)
    session_id: Mapped[str | None] = mapped_column("sessionId", String, nullable=True)
    tool_name: Mapped[str | None] = mapped_column("toolName", String, nullable=True)
    intent: Mapped[str | None] = mapped_column(String, nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column("responseTimeMs", Integer, nullable=True)
    message_count: Mapped[int] = mapped_column("messageCount", Integer, default=0, nullable=False)
    had_tool_call: Mapped[bool] = mapped_column("hadToolCall", Boolean, default=False, nullable=False)
    had_image: Mapped[bool] = mapped_column("hadImage", Boolean, default=False, nullable=False)
    was_streaming: Mapped[bool] = mapped_column("wasStreaming", Boolean, default=False, nullable=False)
    feedback: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False
    )
