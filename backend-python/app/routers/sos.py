"""SOS router — /api/v1/sos/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.sos import EmergencyContact, SOSRequest
from app.schemas.common import success
from app.schemas.sos import AddEmergencyContactRequest, CreateSOSRequest

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


@router.post("/", status_code=201)
async def create_sos(
    body: CreateSOSRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    sos = SOSRequest(
        id=new_id(),
        customer_id=customer.id,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        type=body.type,
        status="ACTIVE",
        metadata_=body.metadata,
    )
    db.add(sos)
    await db.flush()
    return success({"id": sos.id, "status": sos.status}, status_code=201)


@router.get("/active")
async def get_active_sos(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SOSRequest).where(
            SOSRequest.customer_id == customer.id,
            SOSRequest.status == "ACTIVE",
        ).order_by(SOSRequest.created_at.desc()).limit(1)
    )
    sos = result.scalar_one_or_none()
    if not sos:
        return success(None)
    return success({"id": sos.id, "status": sos.status, "latitude": sos.latitude, "longitude": sos.longitude})


@router.post("/{sos_id}/resolve")
async def resolve_sos(
    sos_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SOSRequest).where(SOSRequest.id == sos_id))
    sos = result.scalar_one_or_none()
    if not sos:
        raise NotFoundError("SOS not found")
    sos.status = "RESOLVED"
    sos.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return success({"id": sos.id, "status": sos.status})


@router.get("/nearby-help")
async def nearby_help(
    lat: float = 0,
    lng: float = 0,
    customer: Customer = Depends(get_current_customer),
):
    return success({"services": []})


@router.post("/contacts", status_code=201)
async def add_contact(
    body: AddEmergencyContactRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    contact = EmergencyContact(
        id=new_id(),
        customer_id=customer.id,
        name=body.name,
        phone_number=body.phone_number,
        email=body.email,
        relation=body.relation,
        priority=body.priority,
    )
    db.add(contact)
    await db.flush()
    return success({"id": contact.id}, status_code=201)


@router.get("/contacts")
async def list_contacts(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(EmergencyContact).where(EmergencyContact.customer_id == customer.id)
        )
    ).scalars().all()
    return success([{
        "id": c.id,
        "name": c.name,
        "phoneNumber": c.phone_number,
        "email": c.email,
        "relation": c.relation,
        "priority": c.priority,
    } for c in rows])


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmergencyContact).where(
            EmergencyContact.id == contact_id,
            EmergencyContact.customer_id == customer.id,
        )
    )
    contact = result.scalar_one_or_none()
    if contact:
        await db.delete(contact)
        await db.flush()
    return success({"deleted": True})
