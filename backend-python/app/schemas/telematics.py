"""Telematics / driving trip schemas."""
from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class LinkDeviceRequest(CamelModel):
    vehicle_id: str
    device_token: str
    platform: str = "android"


class TripResponse(CamelModel):
    id: str
    trip_id: str
    vehicle_id: str
    start_time: datetime
    end_time: datetime | None
    distance_km: float | None
    duration_min: float | None
    max_speed: float | None
    avg_speed: float | None
    safety_score: float | None
    start_location: Any | None
    end_location: Any | None
    status: str


class InhouseTripRequest(CamelModel):
    vehicle_id: str
    trip_data: dict


class StartLiveSessionRequest(CamelModel):
    vehicle_id: str


class PushGpsPointRequest(CamelModel):
    latitude: float
    longitude: float
    speed: float | None = None
    timestamp: datetime | None = None
