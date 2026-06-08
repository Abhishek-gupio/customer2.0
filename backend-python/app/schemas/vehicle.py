"""Vehicle schemas."""
from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class AddVehicleRequest(CamelModel):
    registration_number: str
    make: str | None = None
    model: str | None = None
    fuel_type: str | None = None
    vehicle_type: str | None = None
    current_odometer: float | None = None


class UpdateVehicleRequest(CamelModel):
    make: str | None = None
    model: str | None = None
    fuel_type: str | None = None
    current_odometer: float | None = None
    is_primary: bool | None = None


class OdometerLogRequest(CamelModel):
    reading: float
    date: datetime | None = None


class VehicleResponse(CamelModel):
    id: str
    registration_number: str
    make: str | None
    model: str | None
    fuel_type: str | None
    vehicle_type: str | None
    current_odometer: float | None
    rc_verified: bool
    is_primary: bool
    is_active: bool
    owner_name: str | None
    image_url: str | None
    created_at: datetime


class VehicleHealthScoreResponse(CamelModel):
    overall_score: float | None
    age_score: float | None
    mileage_score: float | None
    maintenance_score: float | None
    driving_score: float | None
    explanations: Any | None
    recommendations: Any | None
    next_due_date: datetime | None


class ChallanResponse(CamelModel):
    id: str
    challan_number: str
    amount: float
    status: str
    date: datetime | None
    violation_type: str | None
    location: str | None
