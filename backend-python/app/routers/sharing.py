"""Vehicle sharing router — /api/v1/sharing/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.vehicle import VehicleAccess
from app.schemas.common import success
from app.schemas.sharing import ShareVehicleRequest

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


@router.post("/share", status_code=201)
async def share_vehicle(
    body: ShareVehicleRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    target = (
        await db.execute(select(Customer).where(Customer.phone_number == body.target_phone_number))
    ).scalar_one_or_none()
    if not target:
        raise NotFoundError("User not found with that phone number")

    existing = (
        await db.execute(
            select(VehicleAccess).where(
                and_(
                    VehicleAccess.vehicle_id == body.vehicle_id,
                    VehicleAccess.customer_id == target.id,
                )
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Vehicle already shared with this user")

    access = VehicleAccess(
        id=new_id(),
        vehicle_id=body.vehicle_id,
        customer_id=target.id,
        granted_by_id=customer.id,
        role=body.role,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(access)
    await db.flush()
    return success({"id": access.id, "role": access.role, "vehicleId": access.vehicle_id}, status_code=201)


@router.get("/shared-with-me")
async def shared_with_me(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(VehicleAccess).where(VehicleAccess.customer_id == customer.id)
        )
    ).scalars().all()
    return success([{
        "id": r.id,
        "vehicleId": r.vehicle_id,
        "role": r.role,
        "grantedBy": r.granted_by_id,
        "grantedAt": r.granted_at.isoformat() if r.granted_at else None,
    } for r in rows])


@router.get("/shared-by-me")
async def shared_by_me(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(VehicleAccess).where(VehicleAccess.granted_by_id == customer.id)
        )
    ).scalars().all()
    return success([{
        "id": r.id,
        "vehicleId": r.vehicle_id,
        "sharedWith": r.customer_id,
        "role": r.role,
        "grantedAt": r.granted_at.isoformat() if r.granted_at else None,
    } for r in rows])


@router.get("/vehicle/{vehicle_id}/access-list")
async def get_access_list(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(VehicleAccess).where(VehicleAccess.vehicle_id == vehicle_id)
        )
    ).scalars().all()
    return success([{
        "id": r.id,
        "customerId": r.customer_id,
        "role": r.role,
        "grantedAt": r.granted_at.isoformat() if r.granted_at else None,
    } for r in rows])


@router.patch("/access/{access_id}/role")
async def update_access_role(
    access_id: str,
    body: dict,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VehicleAccess).where(
            and_(VehicleAccess.id == access_id, VehicleAccess.granted_by_id == customer.id)
        )
    )
    access = result.scalar_one_or_none()
    if not access:
        raise NotFoundError("Access record not found")
    access.role = body.get("role", access.role)
    await db.flush()
    return success({"id": access.id, "role": access.role})


@router.delete("/access/{access_id}")
async def revoke_access(
    access_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VehicleAccess).where(VehicleAccess.id == access_id)
    )
    access = result.scalar_one_or_none()
    if access:
        await db.delete(access)
        await db.flush()
    return success({"deleted": True})
