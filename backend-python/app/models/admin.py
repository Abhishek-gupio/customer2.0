"""AdminUser and AdminRole — mirrors Prisma AdminUser model."""
import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class AdminRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    SUPPORT = "SUPPORT"


class AdminUser(Base, TimestampMixin):
    __tablename__ = "AdminUser"
    __table_args__ = {"schema": "customer"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column("passwordHash", String, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole, name="AdminRole", schema="customer"),
        default=AdminRole.ADMIN,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)
    # Extra field managed by the app (not in Prisma schema) for support role customer access
    can_access_customers: Mapped[bool] = mapped_column(
        "canAccessCustomers", Boolean, default=False, nullable=False
    )
