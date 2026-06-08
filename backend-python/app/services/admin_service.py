"""
Admin service — mirrors Backend/src/modules/admin/admin.service.ts.
Handles admin auth, CRUD, and permissions.
"""
import math
from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, UnauthorizedError
from app.core.security import create_admin_token, hash_password, verify_password
from app.models.admin import AdminRole, AdminUser
from app.models.customer import Customer
from app.models.expense import Expense
from app.models.support import SupportTicket, TicketMessage
from app.models.vehicle import CustomerVehicle, VehicleCatalog, VehicleAsset
from app.services.otp_store import create_otp, verify_otp
from app.services.sms_service import send_otp_sms

try:
    from cuid2 import CUID
    _cuid = CUID()
    def new_id() -> str:
        return _cuid.generate()
except ImportError:
    import uuid
    def new_id() -> str:
        return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

async def admin_login(email: str, password: str, db: AsyncSession) -> dict:
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()
    if not admin or not verify_password(password, admin.password_hash):
        raise UnauthorizedError("Invalid credentials")
    if not admin.is_active:
        raise UnauthorizedError("Account is inactive")

    token = create_admin_token(admin.id, admin.email, admin.role.value)
    return {
        "accessToken": token,
        "expiresIn": 86400,
        "admin": _serialize_admin(admin),
    }


async def admin_signup(email: str, password: str, name: str, role: str, db: AsyncSession) -> dict:
    existing = await db.execute(select(AdminUser).where(AdminUser.email == email))
    if existing.scalar_one_or_none():
        raise ConflictError("An admin with this email already exists")

    admin = AdminUser(
        id=new_id(),
        email=email,
        password_hash=hash_password(password),
        name=name,
        role=AdminRole(role),
        is_active=True,
    )
    db.add(admin)
    await db.flush()

    token = create_admin_token(admin.id, admin.email, admin.role.value)
    return {
        "accessToken": token,
        "expiresIn": 86400,
        "admin": _serialize_admin(admin),
    }


async def admin_forgot_password(email: str, db: AsyncSession) -> None:
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()
    if not admin:
        return  # Don't leak whether email exists
    otp = await create_otp(f"admin:{email}")
    # In production send via email; for now uses SMS store with admin: prefix
    from app.core.logging import logger
    logger.info("[Admin Password Reset OTP]", email=email, otp=otp)


async def admin_verify_reset_otp(email: str, otp: str) -> bool:
    return await verify_otp(f"admin:{email}", otp)


async def admin_reset_password(email: str, otp: str, new_password: str, db: AsyncSession) -> None:
    if not await verify_otp(f"admin:{email}", otp):
        raise UnauthorizedError("Invalid or expired OTP")
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()
    if not admin:
        raise NotFoundError("Admin not found")
    admin.password_hash = hash_password(new_password)


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

async def get_dashboard_stats(days: int, db: AsyncSession) -> dict:
    from datetime import timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    total_customers = (await db.execute(func.count(Customer.id).select())).scalar() or 0
    new_customers = (
        await db.execute(
            select(func.count(Customer.id)).where(Customer.created_at >= cutoff)
        )
    ).scalar() or 0
    total_vehicles = (await db.execute(select(func.count(CustomerVehicle.id)))).scalar() or 0
    active_vehicles = (
        await db.execute(
            select(func.count(CustomerVehicle.id)).where(CustomerVehicle.is_active == True)
        )
    ).scalar() or 0
    total_expenses = (
        await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)))
    ).scalar() or 0.0
    open_tickets = (
        await db.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.in_(["OPEN", "IN_PROGRESS"])
            )
        )
    ).scalar() or 0

    return {
        "totalCustomers": total_customers,
        "newCustomers": new_customers,
        "totalVehicles": total_vehicles,
        "activeVehicles": active_vehicles,
        "totalExpenses": float(total_expenses),
        "openTickets": open_tickets,
        "days": days,
    }


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

async def list_customers(
    page: int, limit: int, search: str | None, db: AsyncSession
) -> tuple[list[dict], int]:
    from sqlalchemy import func as sqlfunc
    q = select(Customer)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                Customer.full_name.ilike(pattern),
                Customer.email.ilike(pattern),
                Customer.phone_number.ilike(pattern),
            )
        )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset((page - 1) * limit).limit(limit))).scalars().all()

    items = []
    for c in rows:
        vehicle_count = (
            await db.execute(
                select(func.count(CustomerVehicle.id)).where(CustomerVehicle.customer_id == c.id)
            )
        ).scalar() or 0
        expense_count = (
            await db.execute(
                select(func.count(Expense.id)).where(Expense.customer_id == c.id)
            )
        ).scalar() or 0
        ticket_count = (
            await db.execute(
                select(func.count(SupportTicket.id)).where(SupportTicket.customer_id == c.id)
            )
        ).scalar() or 0
        items.append({
            "id": c.id,
            "phoneNumber": c.phone_number,
            "email": c.email,
            "fullName": c.full_name,
            "profilePic": c.profile_pic,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
            "_count": {
                "vehicles": vehicle_count,
                "expenses": expense_count,
                "supportTickets": ticket_count,
            },
        })
    return items, total


async def get_customer_detail(customer_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer not found")

    vehicles = (
        await db.execute(select(CustomerVehicle).where(CustomerVehicle.customer_id == customer_id))
    ).scalars().all()
    expenses = (
        await db.execute(
            select(Expense).where(Expense.customer_id == customer_id).limit(20)
        )
    ).scalars().all()
    tickets = (
        await db.execute(
            select(SupportTicket).where(SupportTicket.customer_id == customer_id).limit(20)
        )
    ).scalars().all()

    return {
        "id": customer.id,
        "phoneNumber": customer.phone_number,
        "email": customer.email,
        "fullName": customer.full_name,
        "profilePic": customer.profile_pic,
        "createdAt": customer.created_at.isoformat() if customer.created_at else None,
        "vehicles": [_serialize_vehicle(v) for v in vehicles],
        "expenses": [_serialize_expense(e) for e in expenses],
        "supportTickets": [_serialize_ticket(t) for t in tickets],
    }


async def update_customer(customer_id: str, data: dict, db: AsyncSession) -> dict:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer not found")
    for field, value in data.items():
        if value is not None:
            setattr(customer, field, value)
    await db.flush()
    return {"id": customer.id, "fullName": customer.full_name, "email": customer.email}


async def delete_customers(customer_ids: list[str], db: AsyncSession) -> int:
    result = await db.execute(select(Customer).where(Customer.id.in_(customer_ids)))
    customers = result.scalars().all()
    for c in customers:
        await db.delete(c)
    await db.flush()
    return len(customers)


# ---------------------------------------------------------------------------
# Vehicles (admin list)
# ---------------------------------------------------------------------------

async def list_vehicles(
    page: int,
    limit: int,
    search: str | None,
    vehicle_type: str | None,
    db: AsyncSession,
) -> tuple[list[dict], int]:
    q = select(CustomerVehicle)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                CustomerVehicle.registration_number.ilike(pattern),
                CustomerVehicle.make.ilike(pattern),
                CustomerVehicle.model.ilike(pattern),
            )
        )
    if vehicle_type:
        q = q.where(CustomerVehicle.vehicle_type == vehicle_type)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset((page - 1) * limit).limit(limit))).scalars().all()

    items = []
    for v in rows:
        owner = (await db.execute(select(Customer).where(Customer.id == v.customer_id))).scalar_one_or_none()
        items.append(_serialize_vehicle_admin(v, owner))
    return items, total


# ---------------------------------------------------------------------------
# Expenses (admin list)
# ---------------------------------------------------------------------------

async def list_expenses(
    page: int, limit: int, search: str | None, customer_id: str | None, db: AsyncSession
) -> tuple[list[dict], int]:
    q = select(Expense)
    if customer_id:
        q = q.where(Expense.customer_id == customer_id)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                Expense.merchant_name.ilike(pattern),
                Expense.category.ilike(pattern),
            )
        )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(Expense.date.desc()).offset((page - 1) * limit).limit(limit))).scalars().all()

    items = []
    for e in rows:
        owner = (await db.execute(select(Customer).where(Customer.id == e.customer_id))).scalar_one_or_none()
        items.append(_serialize_expense_admin(e, owner))
    return items, total


async def get_expense_detail(expense_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise NotFoundError("Expense not found")
    owner = (await db.execute(select(Customer).where(Customer.id == expense.customer_id))).scalar_one_or_none()
    return _serialize_expense_admin(expense, owner)


# ---------------------------------------------------------------------------
# Tickets (admin)
# ---------------------------------------------------------------------------

async def list_tickets(
    page: int, limit: int, search: str | None, db: AsyncSession
) -> tuple[list[dict], int]:
    q = select(SupportTicket)
    if search:
        pattern = f"%{search}%"
        q = q.where(SupportTicket.subject.ilike(pattern))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (
        await db.execute(
            q.order_by(SupportTicket.created_at.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).scalars().all()

    items = []
    for t in rows:
        owner = (await db.execute(select(Customer).where(Customer.id == t.customer_id))).scalar_one_or_none()
        items.append(_serialize_ticket_admin(t, owner))
    return items, total


async def get_ticket_messages(ticket_id: str, db: AsyncSession) -> list[dict]:
    rows = (
        await db.execute(
            select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at)
        )
    ).scalars().all()
    return [
        {
            "id": m.id,
            "ticketId": m.ticket_id,
            "senderId": m.sender_id,
            "senderRole": m.sender_role,
            "content": m.content,
            "createdAt": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]


async def add_ticket_message(
    ticket_id: str, sender_id: str, sender_role: str, content: str, db: AsyncSession
) -> dict:
    from datetime import timezone
    message = TicketMessage(
        id=new_id(),
        ticket_id=ticket_id,
        sender_id=sender_id,
        sender_role=sender_role,
        content=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(message)
    await db.flush()
    return {
        "id": message.id,
        "ticketId": message.ticket_id,
        "senderId": message.sender_id,
        "senderRole": message.sender_role,
        "content": message.content,
        "createdAt": message.created_at.isoformat(),
    }


async def update_ticket_status(ticket_id: str, status: str, db: AsyncSession) -> dict:
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise NotFoundError("Ticket not found")
    ticket.status = status
    await db.flush()
    return {"id": ticket.id, "status": ticket.status}


# ---------------------------------------------------------------------------
# Admin management
# ---------------------------------------------------------------------------

async def list_admins(
    page: int, limit: int, search: str | None, role: str | None, db: AsyncSession
) -> tuple[list[dict], int]:
    q = select(AdminUser)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(AdminUser.email.ilike(pattern), AdminUser.name.ilike(pattern))
        )
    if role:
        q = q.where(AdminUser.role == AdminRole(role))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset((page - 1) * limit).limit(limit))).scalars().all()
    return [_serialize_admin(a) for a in rows], total


async def delete_admins(admin_ids: list[str], db: AsyncSession) -> int:
    result = await db.execute(select(AdminUser).where(AdminUser.id.in_(admin_ids)))
    admins = result.scalars().all()
    for a in admins:
        await db.delete(a)
    await db.flush()
    return len(admins)


async def toggle_admin_status(admin_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise NotFoundError("Admin not found")
    admin.is_active = not admin.is_active
    await db.flush()
    return _serialize_admin(admin)


async def toggle_support_customers(admin_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise NotFoundError("Admin not found")
    admin.can_access_customers = not admin.can_access_customers
    await db.flush()
    return _serialize_admin(admin)


# ---------------------------------------------------------------------------
# Vehicle catalog
# ---------------------------------------------------------------------------

async def list_catalog(vehicle_type: str | None, db: AsyncSession) -> list[dict]:
    q = select(VehicleCatalog)
    if vehicle_type:
        q = q.where(VehicleCatalog.vehicle_type == vehicle_type)
    rows = (await db.execute(q)).scalars().all()
    result = []
    for catalog in rows:
        assets_rows = (
            await db.execute(select(VehicleAsset).where(VehicleAsset.catalog_id == catalog.id))
        ).scalars().all()
        result.append({
            "id": catalog.id,
            "vehicleType": catalog.vehicle_type,
            "make": catalog.make,
            "model": catalog.model,
            "variant": catalog.variant,
            "normalizedKey": catalog.normalized_key,
            "assets": [
                {
                    "id": a.id,
                    "catalogId": a.catalog_id,
                    "type": a.type,
                    "assetIndex": a.asset_index,
                    "assetUrl": a.asset_url,
                    "assetHash": a.asset_hash,
                }
                for a in assets_rows
            ],
        })
    return result


async def create_catalog_vehicle(
    vehicle_type: str, make: str, model: str, variant: str | None, db: AsyncSession
) -> dict:
    key = f"{vehicle_type}:{make}:{model}:{variant or ''}".lower().replace(" ", "_")
    catalog = VehicleCatalog(
        id=new_id(),
        vehicle_type=vehicle_type,
        make=make,
        model=model,
        variant=variant,
        normalized_key=key,
    )
    db.add(catalog)
    await db.flush()
    return {
        "id": catalog.id,
        "vehicleType": catalog.vehicle_type,
        "make": catalog.make,
        "model": catalog.model,
        "variant": catalog.variant,
        "normalizedKey": catalog.normalized_key,
        "assets": [],
    }


async def create_catalog_asset(
    catalog_id: str,
    asset_url: str,
    asset_type: str,
    asset_index: int,
    db: AsyncSession,
) -> dict:
    asset = VehicleAsset(
        id=new_id(),
        catalog_id=catalog_id,
        type=asset_type,
        asset_index=asset_index,
        asset_url=asset_url,
    )
    db.add(asset)
    await db.flush()
    return {
        "id": asset.id,
        "catalogId": asset.catalog_id,
        "type": asset.type,
        "assetIndex": asset.asset_index,
        "assetUrl": asset.asset_url,
    }


# ---------------------------------------------------------------------------
# Serializers (private helpers)
# ---------------------------------------------------------------------------

def _serialize_admin(a: AdminUser) -> dict:
    return {
        "id": a.id,
        "email": a.email,
        "name": a.name,
        "role": a.role.value,
        "isActive": a.is_active,
        "canAccessCustomers": getattr(a, "can_access_customers", False),
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }


def _serialize_vehicle(v: CustomerVehicle) -> dict:
    return {
        "id": v.id,
        "registrationNumber": v.registration_number,
        "make": v.make,
        "model": v.model,
        "vehicleType": v.vehicle_type,
        "rcVerified": v.rc_verified,
        "isActive": v.is_active,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
    }


def _serialize_vehicle_admin(v: CustomerVehicle, owner: Customer | None) -> dict:
    return {
        "id": v.id,
        "registrationNumber": v.registration_number,
        "make": v.make,
        "model": v.model,
        "vehicleType": v.vehicle_type,
        "rcVerified": v.rc_verified,
        "isActive": v.is_active,
        "owner": {
            "id": owner.id if owner else "",
            "fullName": owner.full_name if owner else None,
            "phoneNumber": owner.phone_number if owner else "",
        },
        "healthScore": None,
        "createdAt": v.created_at.isoformat() if v.created_at else None,
    }


def _serialize_expense(e: Expense) -> dict:
    return {
        "id": e.id,
        "amount": e.amount,
        "currency": e.currency,
        "category": e.category,
        "date": e.date.isoformat() if e.date else None,
        "merchantName": e.merchant_name,
        "source": e.source,
        "receiptUrl": e.receipt_url,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


def _serialize_expense_admin(e: Expense, owner: Customer | None) -> dict:
    base = _serialize_expense(e)
    base["customer"] = {
        "id": owner.id if owner else "",
        "fullName": owner.full_name if owner else None,
        "phoneNumber": owner.phone_number if owner else "",
    }
    return base


def _serialize_ticket(t: SupportTicket) -> dict:
    return {
        "id": t.id,
        "subject": t.subject,
        "status": t.status,
        "priority": t.priority,
        "category": t.category,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


def _serialize_ticket_admin(t: SupportTicket, owner: Customer | None) -> dict:
    base = _serialize_ticket(t)
    base["customer"] = {
        "id": owner.id if owner else "",
        "fullName": owner.full_name if owner else None,
        "phoneNumber": owner.phone_number if owner else "",
    }
    return base
