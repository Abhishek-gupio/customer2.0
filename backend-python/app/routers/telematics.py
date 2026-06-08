"""Telematics router — /api/v1/telematics/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.telematics import DrivingTrip, TelematicsDevice
from app.schemas.common import success
from app.schemas.telematics import InhouseTripRequest, LinkDeviceRequest

router = APIRouter()

try:
    from cuid2 import CUID
    _cuid = CUID()
    def new_id() -> str:
        return _cuid.generate()
except ImportError:
    import uuid
    def new_id() -> str:
        return uuid.uuid4().hex


@router.post("/device/link")
async def link_device(
    body: LinkDeviceRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    existing = (
        await db.execute(
            select(TelematicsDevice).where(TelematicsDevice.vehicle_id == body.vehicle_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.device_token = body.device_token
        existing.platform = body.platform
        existing.linked_at = datetime.now(timezone.utc)
        await db.flush()
        return success({"id": existing.id, "vehicleId": existing.vehicle_id, "linked": True})

    device = TelematicsDevice(
        id=new_id(),
        vehicle_id=body.vehicle_id,
        customer_id=customer.id,
        device_token=body.device_token,
        platform=body.platform,
        linked_at=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.flush()
    return success({"id": device.id, "vehicleId": device.vehicle_id, "linked": True})


@router.post("/device/unlink")
async def unlink_device(
    body: dict,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    vehicle_id = body.get("vehicleId") or body.get("vehicle_id")
    result = await db.execute(
        select(TelematicsDevice).where(TelematicsDevice.vehicle_id == vehicle_id)
    )
    device = result.scalar_one_or_none()
    if device:
        await db.delete(device)
        await db.flush()
    return success({"unlinked": True})


@router.get("/trips")
async def list_trips(
    vehicle_id: str | None = None,
    page: int = 1,
    limit: int = 20,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    q = select(DrivingTrip).where(DrivingTrip.customer_id == customer.id)
    if vehicle_id:
        q = q.where(DrivingTrip.vehicle_id == vehicle_id)
    rows = (
        await db.execute(
            q.order_by(DrivingTrip.start_time.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).scalars().all()
    return success([_serialize_trip(t) for t in rows])


@router.get("/trips/{trip_id}")
async def get_trip(
    trip_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DrivingTrip).where(DrivingTrip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise NotFoundError("Trip not found")
    return success(_serialize_trip(trip))


@router.post("/trips/inhouse")
async def create_inhouse_trip(
    body: InhouseTripRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    trip = DrivingTrip(
        id=new_id(),
        trip_id=body.trip_id or new_id(),
        vehicle_id=body.vehicle_id,
        customer_id=customer.id,
        start_time=body.start_time,
        end_time=body.end_time,
        distance_km=body.distance_km,
        duration_min=body.duration_min,
        max_speed=body.max_speed,
        avg_speed=body.avg_speed,
        safety_score=body.safety_score,
        start_location=body.start_location,
        end_location=body.end_location,
        status="COMPLETED",
        source="INHOUSE",
    )
    db.add(trip)
    await db.flush()
    return success(_serialize_trip(trip), status_code=201)


@router.get("/live/{vehicle_id}")
async def live_tracking(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
):
    return success({"vehicleId": vehicle_id, "status": "idle", "location": None})


@router.post("/webhook/damoov")
async def damoov_webhook(request: Request):
    payload = await request.json()
    return {"received": True}


@router.get("/stats")
async def get_telematics_stats(
    vehicle_id: str | None = None,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    return success({"totalTrips": 0, "totalDistanceKm": 0, "avgSafetyScore": None})


def _serialize_trip(t: DrivingTrip) -> dict:
    return {
        "id": t.id,
        "tripId": t.trip_id,
        "vehicleId": t.vehicle_id,
        "startTime": t.start_time.isoformat() if t.start_time else None,
        "endTime": t.end_time.isoformat() if t.end_time else None,
        "distanceKm": t.distance_km,
        "durationMin": t.duration_min,
        "maxSpeed": t.max_speed,
        "avgSpeed": t.avg_speed,
        "safetyScore": t.safety_score,
        "startLocation": t.start_location,
        "endLocation": t.end_location,
        "status": t.status,
    }
