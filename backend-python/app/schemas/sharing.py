"""Vehicle sharing schemas."""
from datetime import datetime

from app.schemas.common import CamelModel


class ShareVehicleRequest(CamelModel):
    vehicle_id: str
    target_phone_number: str
    role: str = "VIEWER"


class SharedVehicleResponse(CamelModel):
    vehicle_id: str
    registration_number: str
    role: str
    shared_by: str
    shared_at: datetime


class VehicleAccessResponse(CamelModel):
    customer_id: str
    phone_number: str
    full_name: str | None
    role: str
    granted_at: datetime
