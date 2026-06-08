"""
OTP store — exact port of Backend/src/modules/auth/otpStore.ts.

Redis key schema (must match Node.js for dual-run compatibility):
  otp:{phone}        → OTP code, TTL = OTP_EXPIRY_SEC (default 300s)
  otp:rate:{phone}   → rate-limit sentinel, TTL = OTP_RATE_LIMIT_WINDOW_SEC (default 30s)
"""
import secrets
import string

from app.core.config import settings
from app.core.redis import get_redis


def _otp_key(phone: str) -> str:
    return f"otp:{phone}"


def _rate_key(phone: str) -> str:
    return f"otp:rate:{phone}"


def _generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


async def create_otp(phone: str) -> str:
    """
    Generate and store a new OTP for the given phone number.
    Raises ValueError if rate-limit window hasn't expired yet.
    Returns the generated OTP (caller passes it to SMS service).
    """
    r = get_redis()

    # Rate-limit check
    if await r.exists(_rate_key(phone)):
        ttl = await r.ttl(_rate_key(phone))
        raise ValueError(f"Please wait {ttl}s before requesting another OTP")

    otp = _generate_otp()
    await r.setex(_otp_key(phone), settings.OTP_EXPIRY_SEC, otp)
    await r.setex(_rate_key(phone), settings.OTP_RATE_LIMIT_WINDOW_SEC, "1")
    return otp


async def verify_otp(phone: str, provided_otp: str) -> bool:
    """
    Returns True if the OTP matches and is not expired.
    Deletes the OTP on successful verification (one-time use).
    """
    r = get_redis()
    stored = await r.get(_otp_key(phone))
    if not stored:
        return False
    # MOCK mode: accept "123456" as a universal OTP for development
    if settings.SMS_SERVICE == "MOCK" and provided_otp == "123456":
        await r.delete(_otp_key(phone))
        return True
    if stored != provided_otp:
        return False
    await r.delete(_otp_key(phone))
    return True


async def clear_otp(phone: str) -> None:
    r = get_redis()
    await r.delete(_otp_key(phone))
