"""Auth schemas for customer-facing auth endpoints."""
from pydantic import EmailStr

from app.schemas.common import CamelModel


class SendOtpRequest(CamelModel):
    phone_number: str


class VerifyOtpRequest(CamelModel):
    phone_number: str
    otp: str


class LoginRequest(CamelModel):
    phone_number: str
    password: str | None = None


class GoogleAuthRequest(CamelModel):
    id_token: str


class RefreshRequest(CamelModel):
    refresh_token: str


class CheckUserRequest(CamelModel):
    phone_number: str


class AuthTokens(CamelModel):
    access_token: str
    refresh_token: str
    expires_in: int


class CustomerProfile(CamelModel):
    id: str
    phone_number: str
    email: str | None
    full_name: str | None
    profile_pic: str | None
