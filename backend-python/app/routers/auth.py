"""Auth router — /api/v1/auth/*"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_customer_token
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.schemas.auth import (
    CheckUserRequest,
    GoogleAuthRequest,
    RefreshRequest,
    SendOtpRequest,
    VerifyOtpRequest,
)
from app.schemas.common import success
from app.services import auth_service

router = APIRouter()


@router.post("/send-otp")
async def send_otp(body: SendOtpRequest):
    await auth_service.send_otp(body.phone_number)
    return success({"message": "OTP sent"})


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    customer, access_token, refresh_token = await auth_service.verify_otp_and_login(
        body.phone_number, body.otp, db
    )
    return success({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": settings.access_token_expiry_sec,
        "customer": {
            "id": customer.id,
            "phoneNumber": customer.phone_number,
            "email": customer.email,
            "fullName": customer.full_name,
            "profilePic": customer.profile_pic,
        },
    })


@router.post("/login")
async def login(body: SendOtpRequest, db: AsyncSession = Depends(get_db)):
    """Alias for send-otp (mobile sends phone and waits for OTP)."""
    await auth_service.send_otp(body.phone_number)
    return success({"message": "OTP sent"})


@router.post("/google")
async def google_auth(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    customer, access_token, refresh_token = await auth_service.google_login(body.id_token, db)
    return success({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": settings.access_token_expiry_sec,
        "customer": {
            "id": customer.id,
            "phoneNumber": customer.phone_number,
            "email": customer.email,
            "fullName": customer.full_name,
            "profilePic": customer.profile_pic,
        },
    })


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    access_token, refresh_token = await auth_service.refresh_tokens(body.refresh_token, db)
    return success({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": settings.access_token_expiry_sec,
    })


@router.post("/logout")
async def logout(customer: Customer = Depends(get_current_customer)):
    return success({"message": "Logged out"})


@router.post("/check-user")
async def check_user(body: CheckUserRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.customer import Customer as CustomerModel
    result = await db.execute(select(CustomerModel).where(CustomerModel.phone_number == body.phone_number))
    exists = result.scalar_one_or_none() is not None
    return success({"exists": exists})


@router.get("/me")
async def get_me(customer: Customer = Depends(get_current_customer)):
    return success({
        "id": customer.id,
        "phoneNumber": customer.phone_number,
        "email": customer.email,
        "fullName": customer.full_name,
        "profilePic": customer.profile_pic,
    })
