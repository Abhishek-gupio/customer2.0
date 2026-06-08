"""
JWT sign / verify — mirrors Backend/src/modules/auth/jwt.ts and admin.jwt.ts.
Uses the same JWT_SECRET so tokens issued by Node.js are accepted here
during the dual-run switchover period.

Customer token payload: { id, phoneNumber, iat, exp }
Admin token payload:    { id, email, role, iat, exp }
"""
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def _create_token(payload: dict[str, Any], expiry_sec: int) -> str:
    now = datetime.now(UTC)
    data = {
        **payload,
        "iat": now,
        "exp": now + timedelta(seconds=expiry_sec),
    }
    return jwt.encode(data, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_customer_access_token(customer_id: str, phone_number: str) -> str:
    return _create_token(
        {"id": customer_id, "phoneNumber": phone_number},
        settings.access_token_expiry_sec,
    )


def create_customer_refresh_token(customer_id: str, phone_number: str) -> str:
    return _create_token(
        {"id": customer_id, "phoneNumber": phone_number},
        settings.refresh_token_expiry_sec,
    )


def create_admin_token(admin_id: str, email: str, role: str) -> str:
    return _create_token(
        {"id": admin_id, "email": email, "role": role},
        settings.admin_token_expiry_sec,
    )


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------

def decode_token(token: str) -> dict[str, Any]:
    """
    Decodes and validates a JWT.
    Raises jose.JWTError on invalid/expired token.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


def decode_customer_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if "phoneNumber" not in payload:
        raise JWTError("Not a customer token")
    return payload


def decode_admin_token(token: str) -> dict[str, Any]:
    payload = decode_token(token)
    if "role" not in payload:
        raise JWTError("Not an admin token")
    return payload
