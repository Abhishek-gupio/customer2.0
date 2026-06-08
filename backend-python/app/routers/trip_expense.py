"""Trip expense / planned trip router — /api/v1/trip-expense/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.sharing import PlannedTrip
from app.schemas.common import success

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


def _serialize(t: PlannedTrip) -> dict:
    return {
        "id": t.id,
        "origin": t.origin,
        "destination": t.destination,
        "distanceKm": t.distance_km,
        "estimatedCost": t.estimated_cost,
        "fuelCost": t.fuel_cost,
        "tollCost": t.toll_cost,
        "status": t.status,
        "plannedAt": t.planned_at.isoformat() if t.planned_at else None,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
    }


@router.post("/plan", status_code=201)
async def plan_trip(
    body: dict,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    origin = body.get("origin", "")
    destination = body.get("destination", "")
    vehicle_id = body.get("vehicleId")
    fuel_efficiency = body.get("fuelEfficiency", 15)
    fuel_price = body.get("fuelPrice", 100)
    distance_km = body.get("distanceKm")
    toll_cost = None

    if settings.TOLLGURU_API_KEY and distance_km:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://apis.tollguru.com/toll/v2/complete-trip-vehicle-type",
                    headers={"x-api-key": settings.TOLLGURU_API_KEY, "Content-Type": "application/json"},
                    json={
                        "from": {"address": origin},
                        "to": {"address": destination},
                        "vehicle": {"type": "2AxlesAuto"},
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    toll_cost = data.get("route", {}).get("costs", {}).get("tag", 0)
        except Exception:
            pass

    if distance_km:
        fuel_cost = round((distance_km / fuel_efficiency) * fuel_price, 2)
    else:
        fuel_cost = None

    estimated_cost = None
    if fuel_cost is not None and toll_cost is not None:
        estimated_cost = fuel_cost + toll_cost
    elif fuel_cost is not None:
        estimated_cost = fuel_cost

    trip = PlannedTrip(
        id=new_id(),
        customer_id=customer.id,
        vehicle_id=vehicle_id,
        origin=origin,
        destination=destination,
        distance_km=distance_km,
        fuel_cost=fuel_cost,
        toll_cost=toll_cost,
        estimated_cost=estimated_cost,
        status="PLANNED",
        planned_at=datetime.now(timezone.utc),
    )
    db.add(trip)
    await db.flush()
    return success(_serialize(trip), status_code=201)


@router.get("/plans")
async def list_plans(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PlannedTrip)
            .where(PlannedTrip.customer_id == customer.id)
            .order_by(PlannedTrip.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return success([_serialize(t) for t in rows])


@router.get("/plans/{plan_id}")
async def get_plan(
    plan_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlannedTrip).where(PlannedTrip.id == plan_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise NotFoundError("Plan not found")
    return success(_serialize(trip))


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlannedTrip).where(PlannedTrip.id == plan_id))
    trip = result.scalar_one_or_none()
    if trip:
        await db.delete(trip)
        await db.flush()
    return success({"deleted": True})


@router.get("/toll-estimate")
async def toll_estimate(
    origin: str,
    destination: str,
    customer: Customer = Depends(get_current_customer),
):
    if not settings.TOLLGURU_API_KEY:
        return success({"tollCost": None, "message": "TollGuru not configured"})
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://apis.tollguru.com/toll/v2/complete-trip-vehicle-type",
                headers={"x-api-key": settings.TOLLGURU_API_KEY, "Content-Type": "application/json"},
                json={
                    "from": {"address": origin},
                    "to": {"address": destination},
                    "vehicle": {"type": "2AxlesAuto"},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                toll = data.get("route", {}).get("costs", {}).get("tag", 0)
                return success({"tollCost": toll})
    except Exception:
        pass
    return success({"tollCost": None})
