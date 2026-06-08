"""
FastAPI auth dependencies — mirrors Backend/src/middlewares/auth.middleware.ts
and admin.middleware.ts.
"""
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_admin_token, decode_customer_token
from app.dependencies.database import get_db
from app.models.admin import AdminUser
from app.models.customer import Customer

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Missing or invalid Authorization header")
    return credentials.credentials


# ---------------------------------------------------------------------------
# Customer auth
# ---------------------------------------------------------------------------

async def get_current_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    token = _extract_token(credentials)
    try:
        payload = decode_customer_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")

    customer_id = payload.get("id")
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise UnauthorizedError("Customer not found")
    return customer


# ---------------------------------------------------------------------------
# Admin auth
# ---------------------------------------------------------------------------

async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    token = _extract_token(credentials)
    try:
        payload = decode_admin_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired admin token")

    admin_id = payload.get("id")
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise UnauthorizedError("Admin not found")
    if not admin.is_active:
        raise ForbiddenError("Admin account is inactive")
    return admin


def require_admin_role(*roles: str):
    """
    Dependency factory that restricts an endpoint to specific admin roles.
    Mirrors requireAdminRole() in Backend/src/middlewares/admin.middleware.ts.
    """
    async def _check(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if admin.role.value not in roles:
            raise ForbiddenError(
                f"Access denied. Required roles: {', '.join(roles)}"
            )
        return admin
    return _check
