"""SOS and emergency contact schemas."""
from datetime import datetime

from app.schemas.common import CamelModel


class CreateSOSRequest(CamelModel):
    latitude: float
    longitude: float
    address: str | None = None
    type: str = "ACCIDENT"
    metadata: dict | None = None


class SOSResponse(CamelModel):
    id: str
    latitude: float
    longitude: float
    address: str | None
    status: str
    type: str
    created_at: datetime


class AddEmergencyContactRequest(CamelModel):
    name: str
    phone_number: str
    email: str | None = None
    relation: str | None = None
    priority: int = 1


class EmergencyContactResponse(CamelModel):
    id: str
    name: str
    phone_number: str
    email: str | None
    relation: str | None
    priority: int
