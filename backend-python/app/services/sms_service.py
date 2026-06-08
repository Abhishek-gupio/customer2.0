"""
SMS delivery — mirrors Backend/src/services/sms.service.ts.
Supports MOCK, GMAIL, GUPIO, TWILIO, SMTP drivers via SMS_SERVICE env.
"""
import smtplib
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.logging import logger


async def send_otp_sms(phone: str, otp: str) -> None:
    """Dispatch OTP SMS via the configured SMS_SERVICE driver."""
    driver = settings.SMS_SERVICE
    if driver == "MOCK":
        logger.info("[SMS MOCK] OTP", phone=phone, otp=otp)
        return

    if driver == "GMAIL":
        await _send_via_gmail(phone, otp)
    elif driver == "GUPIO":
        await _send_via_gupio(phone, otp)
    elif driver == "TWILIO":
        await _send_via_twilio(phone, otp)
    elif driver == "SMTP":
        await _send_via_smtp(phone, otp)
    else:
        logger.warning("Unknown SMS_SERVICE driver", driver=driver)


async def _send_via_gmail(phone: str, otp: str) -> None:
    if not (settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD):
        raise RuntimeError("GMAIL_USER and GMAIL_APP_PASSWORD must be set for GMAIL driver")
    # Gmail treats the recipient as email; for true SMS need a carrier gateway
    # This mirrors how the Node.js backend sends OTP via Gmail
    msg = MIMEText(f"Your Gupio OTP is: {otp}. Valid for 5 minutes.")
    msg["Subject"] = "Your Gupio OTP"
    msg["From"] = settings.GMAIL_USER
    msg["To"] = settings.GMAIL_USER  # Dev: send to self; prod: use SMS gateway email
    import asyncio
    await asyncio.to_thread(_smtp_send, "smtp.gmail.com", 587, msg, settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)


def _smtp_send(host: str, port: int, msg: MIMEText, user: str, password: str) -> None:
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)


async def _send_via_gupio(phone: str, otp: str) -> None:
    if not (settings.FLASH49_USERNAME and settings.FLASH49_PASSWORD):
        raise RuntimeError("FLASH49_* credentials required for GUPIO driver")
    params = {
        "user": settings.FLASH49_USERNAME,
        "password": settings.FLASH49_PASSWORD,
        "mobile": phone,
        "message": f"Your Gupio OTP is {otp}. Valid for 5 minutes.",
        "from": settings.FLASH49_FROM or "GUPIO",
        "contentid": settings.FLASH49_DLT_CONTENT_ID or "",
        "stype": "normal",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("https://www.flash49.com/api/sendmsg.php", params=params)
        resp.raise_for_status()


async def _send_via_twilio(phone: str, otp: str) -> None:
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER):
        raise RuntimeError("TWILIO_* credentials required for TWILIO driver")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            url,
            data={
                "From": settings.TWILIO_PHONE_NUMBER,
                "To": f"+91{phone}",
                "Body": f"Your Gupio OTP is {otp}. Valid for 5 minutes.",
            },
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        )
        resp.raise_for_status()


async def _send_via_smtp(phone: str, otp: str) -> None:
    if not (settings.SMTP_HOST and settings.SMTP_PORT and settings.SMTP_USER):
        raise RuntimeError("SMTP_* settings required for SMTP driver")
    msg = MIMEText(f"Your Gupio OTP is: {otp}. Valid for 5 minutes.")
    msg["Subject"] = "Your Gupio OTP"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = settings.SMTP_USER
    import asyncio
    await asyncio.to_thread(
        _smtp_send,
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        msg,
        settings.SMTP_USER,
        settings.SMTP_PASS or "",
    )
