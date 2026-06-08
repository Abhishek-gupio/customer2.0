"""
Shared SQLAlchemy declarative base and common column helpers.
All models inherit from Base and annotate their schema with
__table_args__ = {"schema": "customer"} or {"schema": "public"}.
"""
import enum
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.database import Base


def utcnow():
    """Server-side UTC timestamp default."""
    return func.now()


class TimestampMixin:
    """Adds created_at / updated_at to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
