"""
Admin-facing Pydantic schemas.
These must match Admin/src/api/client.ts TypeScript interfaces exactly.
"""
from datetime import datetime
from typing import Literal

from pydantic import EmailStr

from app.schemas.common import CamelModel


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class AdminLoginRequest(CamelModel):
    email: EmailStr
    password: str


class AdminSignupRequest(CamelModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["SUPER_ADMIN", "ADMIN", "SUPPORT"] = "SUPPORT"


class AdminForgotPasswordRequest(CamelModel):
    email: EmailStr


class AdminVerifyResetOtpRequest(CamelModel):
    email: EmailStr
    otp: str


class AdminResetPasswordRequest(CamelModel):
    email: EmailStr
    otp: str
    new_password: str


class AdminTokenResponse(CamelModel):
    access_token: str
    expires_in: int
    admin: "AdminProfileResponse"


# ---------------------------------------------------------------------------
# Admin profile
# ---------------------------------------------------------------------------

class AdminProfileResponse(CamelModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    can_access_customers: bool = False
    created_at: datetime


# ---------------------------------------------------------------------------
# Admin list (manage admins page)
# ---------------------------------------------------------------------------

class AdminListItem(CamelModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    can_access_customers: bool = False
    created_at: datetime


class ToggleAdminStatusRequest(CamelModel):
    pass  # no body; action derived from current state


class ToggleSupportCustomersRequest(CamelModel):
    pass


class DeleteAdminsRequest(CamelModel):
    admin_ids: list[str]


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

class DashboardStats(CamelModel):
    total_customers: int
    new_customers: int
    total_vehicles: int
    active_vehicles: int
    total_expenses: float
    open_tickets: int
    days: int


# ---------------------------------------------------------------------------
# Customer list / detail (admin view)
# ---------------------------------------------------------------------------

class AdminCustomerCount(CamelModel):
    vehicles: int
    expenses: int
    documents: int
    support_tickets: int


class AdminCustomerListItem(CamelModel):
    id: str
    phone_number: str
    email: str | None
    full_name: str | None
    profile_pic: str | None
    created_at: datetime
    count: AdminCustomerCount


class AdminCustomerUpdateRequest(CamelModel):
    full_name: str | None = None
    email: str | None = None
    phone_number: str | None = None


class DeleteCustomersRequest(CamelModel):
    customer_ids: list[str]


# ---------------------------------------------------------------------------
# Vehicle list (admin view)
# ---------------------------------------------------------------------------

class AdminVehicleOwner(CamelModel):
    id: str
    full_name: str | None
    phone_number: str


class AdminVehicleListItem(CamelModel):
    id: str
    registration_number: str
    make: str | None
    model: str | None
    vehicle_type: str | None
    rc_verified: bool
    is_active: bool
    owner: AdminVehicleOwner
    health_score: float | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Expense list / detail (admin view)
# ---------------------------------------------------------------------------

class AdminExpenseCustomer(CamelModel):
    id: str
    full_name: str | None
    phone_number: str


class AdminExpenseListItem(CamelModel):
    id: str
    amount: float
    currency: str
    category: str
    date: datetime
    merchant_name: str | None
    source: str
    receipt_url: str | None
    customer: AdminExpenseCustomer
    created_at: datetime


# ---------------------------------------------------------------------------
# Ticket list / messages (admin view)
# ---------------------------------------------------------------------------

class AdminTicketCustomer(CamelModel):
    id: str
    full_name: str | None
    phone_number: str


class AdminTicketListItem(CamelModel):
    id: str
    subject: str
    status: str
    priority: str
    category: str
    customer: AdminTicketCustomer
    created_at: datetime
    updated_at: datetime


class AdminTicketMessage(CamelModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_role: str
    content: str
    created_at: datetime


class AddTicketMessageRequest(CamelModel):
    content: str


class UpdateTicketStatusRequest(CamelModel):
    status: Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]


# ---------------------------------------------------------------------------
# Vehicle catalog
# ---------------------------------------------------------------------------

class VehicleCatalogItem(CamelModel):
    id: str
    vehicle_type: str
    make: str
    model: str
    variant: str | None
    normalized_key: str
    assets: list["VehicleAssetItem"] = []


class VehicleAssetItem(CamelModel):
    id: str
    catalog_id: str
    type: str
    asset_index: int
    asset_url: str
    asset_hash: str | None


class CreateCatalogVehicleRequest(CamelModel):
    vehicle_type: str
    make: str
    model: str
    variant: str | None = None
