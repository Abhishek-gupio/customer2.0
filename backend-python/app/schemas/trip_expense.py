"""Trip expense planner schemas."""
from typing import Any

from app.schemas.common import CamelModel


class CalculateTripRequest(CamelModel):
    origin: str
    destination: str
    waypoints: list[str] = []
    vehicle_type: str = "car"
    fuel_type: str = "petrol"


class TripExpenseResponse(CamelModel):
    trip_id: str
    origin: str
    destination: str
    distance_km: float | None
    toll_cost: float | None
    fuel_cost: float | None
    total_cost: float | None
    result: Any | None
