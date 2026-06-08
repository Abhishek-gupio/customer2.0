"""
Customer auth service — mirrors Backend/src/modules/auth/auth.service.ts.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_customer_access_token,
    create_customer_refresh_token,
)
from app.models.customer import Customer
from app.services.otp_store import create_otp, verify_otp
from app.services.sms_service import send_otp_sms

try:
    from cuid2 import CUID
    _cuid = CUID()
    def new_id() -> str:
        return _cuid.generate()
except ImportError:
    import uuid
    def new_id() -> str:
        return uuid.uuid4().hex


def _normalize_phone(phone: str) -> str:
    """Strip country code prefix for Indian numbers."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+91"):
        phone = phone[3:]
    if phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]
    return phone


async def send_otp(phone: str) -> None:
    phone = _normalize_phone(phone)
    otp = await create_otp(phone)
    await send_otp_sms(phone, otp)


async def verify_otp_and_login(
    phone: str, otp: str, db: AsyncSession
) -> tuple[Customer, str, str]:
    """
    Verifies OTP, creates or fetches customer, returns (customer, access_token, refresh_token).
    """
    phone = _normalize_phone(phone)
    if not await verify_otp(phone, otp):
        raise UnauthorizedError("Invalid or expired OTP")

    result = await db.execute(select(Customer).where(Customer.phone_number == phone))
    customer = result.scalar_one_or_none()

    if not customer:
        customer = Customer(id=new_id(), phone_number=phone)
        db.add(customer)
        await db.flush()

    access_token = create_customer_access_token(customer.id, customer.phone_number)
    refresh_token = create_customer_refresh_token(customer.id, customer.phone_number)
    return customer, access_token, refresh_token


async def google_login(id_token: str, db: AsyncSession) -> tuple[Customer, str, str]:
    """Verify Google ID token and create/login customer."""
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    from app.core.config import settings

    try:
        idinfo = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise UnauthorizedError("Invalid Google token")

    google_id = idinfo["sub"]
    email = idinfo.get("email")
    full_name = idinfo.get("name")
    profile_pic = idinfo.get("picture")

    result = await db.execute(select(Customer).where(Customer.google_id == google_id))
    customer = result.scalar_one_or_none()

    if not customer and email:
        result = await db.execute(select(Customer).where(Customer.email == email))
        customer = result.scalar_one_or_none()

    if not customer:
        # Create new customer — phone is unknown for Google users, use googleId as placeholder
        customer = Customer(
            id=new_id(),
            phone_number=f"g_{google_id}",
            google_id=google_id,
            email=email,
            full_name=full_name,
            profile_pic=profile_pic,
        )
        db.add(customer)
        await db.flush()
    else:
        customer.google_id = google_id
        if email and not customer.email:
            customer.email = email

    access_token = create_customer_access_token(customer.id, customer.phone_number)
    refresh_token = create_customer_refresh_token(customer.id, customer.phone_number)
    return customer, access_token, refresh_token


async def refresh_tokens(
    refresh_token_str: str, db: AsyncSession
) -> tuple[str, str]:
    """Issue new token pair from a valid refresh token."""
    from jose import JWTError
    from app.core.security import decode_customer_token

    try:
        payload = decode_customer_token(refresh_token_str)
    except JWTError:
        raise UnauthorizedError("Invalid or expired refresh token")

    customer_id = payload.get("id")
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise UnauthorizedError("Customer not found")

    access_token = create_customer_access_token(customer.id, customer.phone_number)
    new_refresh = create_customer_refresh_token(customer.id, customer.phone_number)
    return access_token, new_refresh
