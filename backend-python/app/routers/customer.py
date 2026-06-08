"""Customer router — /api/v1/customer/*"""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer, CustomerDevice
from app.schemas.common import success
from app.schemas.customer import RegisterDeviceRequest, UpdateProfileRequest
from app.services.storage_service import upload_file

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


@router.get("/profile")
async def get_profile(customer: Customer = Depends(get_current_customer)):
    return success({
        "id": customer.id,
        "phoneNumber": customer.phone_number,
        "email": customer.email,
        "fullName": customer.full_name,
        "profilePic": customer.profile_pic,
        "createdAt": customer.created_at.isoformat() if customer.created_at else None,
    })


@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        customer.full_name = body.full_name
    if body.email is not None:
        customer.email = body.email
    await db.flush()
    return success({"id": customer.id, "fullName": customer.full_name, "email": customer.email})


@router.post("/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    url = await upload_file(file_bytes, file.filename or "profile.jpg", file.content_type or "image/jpeg", "profiles")
    customer.profile_pic = url
    await db.flush()
    return success({"profilePic": url})


@router.post("/device")
async def register_device(
    body: RegisterDeviceRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    # Upsert device by platform + customer
    result = await db.execute(
        select(CustomerDevice).where(
            CustomerDevice.customer_id == customer.id,
            CustomerDevice.platform == body.platform,
        )
    )
    device = result.scalar_one_or_none()
    if device:
        device.device_token = body.device_token
        device.last_active_at = datetime.now(timezone.utc)
    else:
        import json
        device = CustomerDevice(
            id=new_id(),
            customer_id=customer.id,
            platform=body.platform,
            device_token=body.device_token,
            device_info=json.dumps(body.device_info) if body.device_info else None,
            last_active_at=datetime.now(timezone.utc),
        )
        db.add(device)
    await db.flush()
    return success({"registered": True})


@router.get("/profile/stats")
async def get_profile_stats(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    from app.models.vehicle import CustomerVehicle
    from app.models.expense import Expense
    vehicle_count = (
        await db.execute(select(func.count(CustomerVehicle.id)).where(CustomerVehicle.customer_id == customer.id))
    ).scalar() or 0
    expense_count = (
        await db.execute(select(func.count(Expense.id)).where(Expense.customer_id == customer.id))
    ).scalar() or 0
    return success({"vehicles": vehicle_count, "expenses": expense_count})


# Valet-related customer endpoints (stubs — full implementation in valet service)
@router.get("/valet-location/{vehicle_number}")
async def get_valet_location(vehicle_number: str):
    return success({"location": None})


@router.post("/customer-location/{vehicle_number}")
async def post_customer_location(vehicle_number: str, body: dict):
    return success({"received": True})


@router.post("/request-drop")
async def request_drop(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"message": "Drop request submitted"})


@router.get("/request-status")
async def get_request_status(customer: Customer = Depends(get_current_customer)):
    return success({"status": None})


@router.get("/vehicle-request-data")
async def get_vehicle_request_data(customer: Customer = Depends(get_current_customer)):
    return success({"data": None})


@router.post("/cancel-drop-request")
async def cancel_drop_request(customer: Customer = Depends(get_current_customer)):
    return success({"message": "Cancelled"})


@router.post("/resend-drop-request")
async def resend_drop_request(customer: Customer = Depends(get_current_customer)):
    return success({"message": "Resent"})
