"""
Admin router — /api/v1/admin/*
Implements all 20+ endpoints required by Admin/src/api/client.ts.
Every response uses the { success: true, data: ... } envelope.
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_admin, require_admin_role
from app.dependencies.database import get_db
from app.models.admin import AdminUser
from app.schemas.admin import (
    AdminForgotPasswordRequest,
    AdminLoginRequest,
    AdminResetPasswordRequest,
    AdminSignupRequest,
    AddTicketMessageRequest,
    CreateCatalogVehicleRequest,
    DeleteAdminsRequest,
    DeleteCustomersRequest,
    UpdateTicketStatusRequest,
    AdminVerifyResetOtpRequest,
    AdminCustomerUpdateRequest,
)
from app.schemas.common import paginated, success
from app.services import admin_service
from app.services.storage_service import upload_file

router = APIRouter()


# ===========================================================================
# Auth (public — no JWT required)
# ===========================================================================

@router.post("/auth/login")
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    data = await admin_service.admin_login(body.email, body.password, db)
    return success(data)


@router.post("/auth/signup", status_code=201)
async def admin_signup(body: AdminSignupRequest, db: AsyncSession = Depends(get_db)):
    data = await admin_service.admin_signup(body.email, body.password, body.name, body.role, db)
    return success(data, status_code=201)


@router.post("/auth/forgot-password")
async def admin_forgot_password(body: AdminForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await admin_service.admin_forgot_password(body.email, db)
    return success({"message": "If that email exists, an OTP has been sent"})


@router.post("/auth/verify-reset-otp")
async def admin_verify_reset_otp(body: AdminVerifyResetOtpRequest, db: AsyncSession = Depends(get_db)):
    valid = await admin_service.admin_verify_reset_otp(body.email, body.otp)
    return success({"valid": valid})


@router.post("/auth/reset-password")
async def admin_reset_password(body: AdminResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await admin_service.admin_reset_password(body.email, body.otp, body.new_password, db)
    return success({"message": "Password reset successfully"})


# ===========================================================================
# Admin profile
# ===========================================================================

@router.get("/me")
async def get_admin_me(admin: AdminUser = Depends(get_current_admin)):
    return success(admin_service._serialize_admin(admin))


# ===========================================================================
# Dashboard stats (SUPER_ADMIN, ADMIN only)
# ===========================================================================

@router.get("/stats")
async def get_stats(
    days: int = 7,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.get_dashboard_stats(days, db)
    return success(data)


# ===========================================================================
# Customers
# ===========================================================================

@router.get("/customers")
async def list_customers(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_customers(page, limit, search, db)
    return paginated(items, page, limit, total)


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.get_customer_detail(customer_id, db)
    return success(data)


@router.patch("/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    body: AdminCustomerUpdateRequest,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.email is not None:
        updates["email"] = body.email
    if body.phone_number is not None:
        updates["phone_number"] = body.phone_number
    data = await admin_service.update_customer(customer_id, updates, db)
    return success(data)


@router.delete("/customers")
async def delete_customers(
    body: DeleteCustomersRequest,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    count = await admin_service.delete_customers(body.customer_ids, db)
    return success({"deleted": count})


# ===========================================================================
# Vehicles
# ===========================================================================

@router.get("/vehicles")
async def list_vehicles(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    type: str | None = None,
    health_status: str | None = None,
    verification_status: str | None = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_vehicles(page, limit, search, type, db)
    return paginated(items, page, limit, total)


# ===========================================================================
# Expenses
# ===========================================================================

@router.get("/expenses")
async def list_expenses(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    customer_id: str | None = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_expenses(page, limit, search, customer_id, db)
    return paginated(items, page, limit, total)


@router.get("/expenses/{expense_id}")
async def get_expense(
    expense_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.get_expense_detail(expense_id, db)
    return success(data)


# ===========================================================================
# Support tickets
# ===========================================================================

@router.get("/tickets")
async def list_tickets(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_tickets(page, limit, search, db)
    return paginated(items, page, limit, total)


@router.get("/tickets/{ticket_id}/messages")
async def get_ticket_messages(
    ticket_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    messages = await admin_service.get_ticket_messages(ticket_id, db)
    return success(messages)


@router.post("/tickets/{ticket_id}/messages", status_code=201)
async def add_ticket_message(
    ticket_id: str,
    body: AddTicketMessageRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    message = await admin_service.add_ticket_message(
        ticket_id, admin.id, admin.role.value, body.content, db
    )
    return success(message, status_code=201)


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    body: UpdateTicketStatusRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.update_ticket_status(ticket_id, body.status, db)
    return success(data)


# ===========================================================================
# Vehicle catalog
# ===========================================================================

@router.get("/catalog/vehicles")
async def list_catalog(
    type: str | None = None,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.list_catalog(type, db)
    return success(data)


@router.post("/catalog/vehicles", status_code=201)
async def create_catalog_vehicle(
    vehicle_type: str = Form(...),
    make: str = Form(...),
    model: str = Form(...),
    variant: str | None = Form(None),
    hero_image: UploadFile | None = File(None),
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    catalog = await admin_service.create_catalog_vehicle(vehicle_type, make, model, variant, db)
    if hero_image:
        file_bytes = await hero_image.read()
        url = await upload_file(file_bytes, hero_image.filename or "hero.jpg", hero_image.content_type or "image/jpeg", "catalog")
        await admin_service.create_catalog_asset(catalog["id"], url, "HERO", 0, db)
    return success(catalog, status_code=201)


@router.post("/catalog/vehicles/{catalog_id}/assets", status_code=201)
async def create_catalog_asset(
    catalog_id: str,
    file: UploadFile = File(...),
    image_type: str = Form("ANGLE"),
    asset_index: int = Form(0),
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    url = await upload_file(file_bytes, file.filename or "asset.jpg", file.content_type or "image/jpeg", "catalog")
    asset = await admin_service.create_catalog_asset(catalog_id, url, image_type, asset_index, db)
    return success(asset, status_code=201)


@router.patch("/catalog/vehicles/{catalog_id}/assets/{asset_id}")
async def update_catalog_asset(
    catalog_id: str,
    asset_id: str,
    file: UploadFile = File(...),
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.vehicle import VehicleAsset
    result = await db.execute(select(VehicleAsset).where(VehicleAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        from app.core.errors import NotFoundError
        raise NotFoundError("Asset not found")
    file_bytes = await file.read()
    url = await upload_file(file_bytes, file.filename or "asset.jpg", file.content_type or "image/jpeg", "catalog")
    asset.asset_url = url
    await db.flush()
    return success({"id": asset.id, "assetUrl": asset.asset_url})


# ===========================================================================
# Admin management (SUPER_ADMIN only)
# ===========================================================================

@router.get("/manage/admins")
async def list_admins(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    role: str | None = None,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_admins(page, limit, search, role, db)
    return paginated(items, page, limit, total)


@router.delete("/manage/admins")
async def delete_admins(
    body: DeleteAdminsRequest,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    count = await admin_service.delete_admins(body.admin_ids, db)
    return success({"deleted": count})


@router.post("/manage/admins/{admin_id}/toggle-support-customers")
@router.patch("/manage/admins/{admin_id}/toggle-support-customers")
async def toggle_support_customers(
    admin_id: str,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.toggle_support_customers(admin_id, db)
    return success(data)


@router.patch("/manage/admins/{admin_id}/toggle-status")
async def toggle_admin_status(
    admin_id: str,
    admin: AdminUser = Depends(require_admin_role("SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.toggle_admin_status(admin_id, db)
    return success(data)


# ===========================================================================
# Documents download (admin)
# ===========================================================================

@router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.document import VehicleDocument
    from fastapi.responses import Response
    result = await db.execute(select(VehicleDocument).where(VehicleDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        from app.core.errors import NotFoundError
        raise NotFoundError("Document not found")
    if doc.file_content:
        return Response(
            content=doc.file_content,
            media_type=doc.mime_type or "application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={doc_id}"},
        )
    if doc.file_url:
        return success({"url": doc.file_url})
    from app.core.errors import NotFoundError
    raise NotFoundError("Document file not available")
