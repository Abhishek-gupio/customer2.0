"""Customer profile schemas."""
from datetime import datetime

from app.schemas.common import CamelModel


class CustomerProfileResponse(CamelModel):
    id: str
    phone_number: str
    email: str | None
    full_name: str | None
    profile_pic: str | None
    created_at: datetime
    updated_at: datetime


class UpdateProfileRequest(CamelModel):
    full_name: str | None = None
    email: str | None = None


class RegisterDeviceRequest(CamelModel):
    platform: str
    device_token: str
    device_info: dict | None = None


class RequestDropRequest(CamelModel):
    vehicle_number: str | None = None
    notes: str | None = None


class CustomerLocationRequest(CamelModel):
    latitude: float
    longitude: float
