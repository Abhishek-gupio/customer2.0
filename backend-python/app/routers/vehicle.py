"""Vehicle router — /api/v1/vehicles/*"""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.vehicle import Challan, CustomerVehicle, OdometerLog, VehicleCatalog, VehicleAsset
from app.schemas.common import success
from app.schemas.vehicle import AddVehicleRequest, OdometerLogRequest, UpdateVehicleRequest

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


def _serialize(v: CustomerVehicle) -> dict:
    return {
        "id": v.id,
        "registrationNumber": v.registration_number,
        "make": v.make,
        "model": v.model,
        "fuelType": v.fuel_type,
        "vehicleType": v.vehicle_type,
        "currentOdometer": v.current_odometer,
        "rcVerified": v.rc_verified,
        "isPrimary": v.is_primary,
        "isActive": v.is_active,
        "ownerName": v.owner_name,
        "imageUrl": v.image_url,
        "insuranceUpto": v.insurance_upto,
        "pollutionUpto": v.pollution_upto,
        "color": v.color,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
    }


@router.post("/", status_code=201)
async def add_vehicle(
    body: AddVehicleRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    vehicle = CustomerVehicle(
        id=new_id(),
        customer_id=customer.id,
        registration_number=body.registration_number.upper().replace(" ", ""),
        make=body.make,
        model=body.model,
        fuel_type=body.fuel_type,
        vehicle_type=body.vehicle_type,
        current_odometer=int(body.current_odometer or 0),
    )
    db.add(vehicle)
    await db.flush()
    return success(_serialize(vehicle), status_code=201)


@router.post("/verify")
async def verify_vehicle(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"verified": False, "message": "RC verification service not configured"})


@router.get("/")
async def list_vehicles(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerVehicle).where(
            CustomerVehicle.customer_id == customer.id,
            CustomerVehicle.is_active == True,
        )
    )
    vehicles = result.scalars().all()
    return success([_serialize(v) for v in vehicles])


@router.get("/{vehicle_id}")
async def get_vehicle(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomerVehicle).where(CustomerVehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise NotFoundError("Vehicle not found")
    if vehicle.customer_id != customer.id:
        raise ForbiddenError("Not your vehicle")
    return success(_serialize(vehicle))


@router.get("/{vehicle_id}/assets")
async def get_vehicle_assets(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    # Look up catalog by registration -> make+model match
    result = await db.execute(select(CustomerVehicle).where(CustomerVehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise NotFoundError("Vehicle not found")
    return success({"assets": []})


@router.put("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    body: UpdateVehicleRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomerVehicle).where(CustomerVehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle or vehicle.customer_id != customer.id:
        raise NotFoundError("Vehicle not found")
    if body.make is not None:
        vehicle.make = body.make
    if body.model is not None:
        vehicle.model = body.model
    if body.fuel_type is not None:
        vehicle.fuel_type = body.fuel_type
    if body.current_odometer is not None:
        vehicle.current_odometer = int(body.current_odometer)
    await db.flush()
    return success(_serialize(vehicle))


@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomerVehicle).where(CustomerVehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle or vehicle.customer_id != customer.id:
        raise NotFoundError("Vehicle not found")
    vehicle.is_active = False
    await db.flush()
    return success({"deleted": True})


@router.put("/{vehicle_id}/primary")
async def set_primary(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    # Unset all primary flags first
    all_vehicles = (
        await db.execute(
            select(CustomerVehicle).where(CustomerVehicle.customer_id == customer.id)
        )
    ).scalars().all()
    for v in all_vehicles:
        v.is_primary = v.id == vehicle_id
    await db.flush()
    return success({"primaryVehicleId": vehicle_id})


@router.post("/{vehicle_id}/health/recalculate")
async def recalculate_health(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
):
    return success({"message": "Health score recalculation queued"})


@router.post("/{vehicle_id}/odometer")
async def log_odometer(
    vehicle_id: str,
    body: OdometerLogRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    result = await db.execute(select(CustomerVehicle).where(CustomerVehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle or vehicle.customer_id != customer.id:
        raise NotFoundError("Vehicle not found")
    log = OdometerLog(
        id=new_id(),
        vehicle_id=vehicle_id,
        reading=int(body.reading),
        date=body.date or datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    vehicle.current_odometer = int(body.reading)
    await db.flush()
    return success({"reading": log.reading})


@router.post("/{vehicle_id}/odometer-ai/extract")
async def extract_odometer_ai(
    vehicle_id: str,
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
):
    return success({"reading": None, "message": "AI extraction not configured"})


@router.post("/{vehicle_id}/odometer-ai")
async def add_odometer_ai(
    vehicle_id: str,
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
):
    return success({"reading": None, "message": "AI extraction not configured"})


# ---- Challans ----

@router.get("/{vehicle_id}/challans")
async def list_challans(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(Challan).where(Challan.vehicle_id == vehicle_id))).scalars().all()
    return success([{
        "id": c.id,
        "challanNumber": c.challan_number,
        "amount": c.amount,
        "status": c.status,
        "date": c.date.isoformat() if c.date else None,
        "violationType": c.violation_type,
        "location": c.location,
    } for c in rows])


@router.get("/plate/{reg_no}/challans")
async def list_challans_by_plate(
    reg_no: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerVehicle).where(CustomerVehicle.registration_number == reg_no.upper())
    )
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return success([])
    rows = (await db.execute(select(Challan).where(Challan.vehicle_id == vehicle.id))).scalars().all()
    return success([{
        "id": c.id,
        "challanNumber": c.challan_number,
        "amount": c.amount,
        "status": c.status,
        "date": c.date.isoformat() if c.date else None,
        "violationType": c.violation_type,
    } for c in rows])


@router.post("/{vehicle_id}/challans/sync")
async def sync_challans(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
):
    return success({"synced": 0, "message": "Challan sync not configured"})


@router.patch("/challans/{challan_id}/pay")
async def mark_challan_paid(
    challan_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Challan).where(Challan.id == challan_id))
    challan = result.scalar_one_or_none()
    if not challan:
        raise NotFoundError("Challan not found")
    challan.status = "PAID"
    await db.flush()
    return success({"id": challan.id, "status": challan.status})
