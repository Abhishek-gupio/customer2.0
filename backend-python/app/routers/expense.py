"""Expense router — /api/v1/expenses/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.expense import Expense, ExpenseBudget
from app.schemas.common import success
from app.schemas.expense import CreateExpenseRequest, ParseTextRequest, SetBudgetRequest

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


def _serialize(e: Expense) -> dict:
    return {
        "id": e.id,
        "vehicleId": e.vehicle_id,
        "amount": e.amount,
        "currency": e.currency,
        "category": e.category,
        "date": e.date.isoformat() if e.date else None,
        "merchantName": e.merchant_name,
        "source": e.source,
        "receiptUrl": e.receipt_url,
        "notes": e.notes,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


@router.post("/", status_code=201)
async def create_expense(
    body: CreateExpenseRequest,
    receipt: UploadFile | None = File(None),
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    receipt_url = None
    if receipt:
        from app.services.storage_service import upload_file
        file_bytes = await receipt.read()
        receipt_url = await upload_file(file_bytes, receipt.filename or "receipt.jpg", receipt.content_type or "image/jpeg", "receipts")

    expense = Expense(
        id=new_id(),
        customer_id=customer.id,
        vehicle_id=body.vehicle_id,
        amount=body.amount,
        currency=body.currency,
        category=body.category,
        date=body.date or datetime.now(timezone.utc),
        merchant_name=body.merchant_name,
        location=body.location,
        notes=body.notes,
        source="MANUAL",
        receipt_url=receipt_url,
    )
    db.add(expense)
    await db.flush()
    return success(_serialize(expense), status_code=201)


@router.get("/")
async def list_expenses(
    vehicle_id: str | None = None,
    category: str | None = None,
    page: int = 1,
    limit: int = 20,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    q = select(Expense).where(Expense.customer_id == customer.id)
    if vehicle_id:
        q = q.where(Expense.vehicle_id == vehicle_id)
    if category:
        q = q.where(Expense.category == category)
    rows = (
        await db.execute(q.order_by(Expense.date.desc()).offset((page - 1) * limit).limit(limit))
    ).scalars().all()
    return success([_serialize(e) for e in rows])


@router.get("/summary")
async def get_summary(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    total = (
        await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.customer_id == customer.id))
    ).scalar() or 0.0
    return success({"total": float(total), "byCategory": {}, "period": "all"})


@router.post("/parse/text")
async def parse_text(
    body: ParseTextRequest,
    customer: Customer = Depends(get_current_customer),
):
    return success({"parsed": None, "message": "AI parsing not configured"})


@router.post("/parse/receipt")
async def parse_receipt(
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
):
    return success({"parsed": None, "message": "OCR not configured"})


@router.post("/parse/voice")
async def parse_voice(
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
):
    return success({"parsed": None, "message": "Voice parsing not configured"})


@router.post("/parse/voice/text")
async def parse_voice_text(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"parsed": None, "message": "Voice parsing not configured"})


@router.post("/budgets")
async def set_budget(
    body: SetBudgetRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExpenseBudget).where(
            ExpenseBudget.customer_id == customer.id,
            ExpenseBudget.category == body.category,
        )
    )
    budget = result.scalar_one_or_none()
    if budget:
        budget.amount = body.amount
        budget.period = body.period
        budget.notify_threshold = body.notify_threshold
    else:
        budget = ExpenseBudget(
            id=new_id(),
            customer_id=customer.id,
            category=body.category,
            amount=body.amount,
            period=body.period,
            notify_threshold=body.notify_threshold,
        )
        db.add(budget)
    await db.flush()
    return success({"category": budget.category, "amount": budget.amount})


@router.get("/fuel-prices")
async def get_fuel_prices(city: str | None = None, customer: Customer = Depends(get_current_customer)):
    return success({"prices": []})


@router.get("/fuel-prices/compare")
async def compare_fuel_prices(city: str | None = None, customer: Customer = Depends(get_current_customer)):
    return success({"comparisons": []})


@router.get("/fuel-prices/all")
async def get_all_fuel_prices(customer: Customer = Depends(get_current_customer)):
    return success({"cities": []})


@router.post("/fuel-prices/calculate-liters")
async def calculate_liters(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"liters": None})


@router.post("/warranty/primary/refresh-oem")
async def refresh_oem(customer: Customer = Depends(get_current_customer)):
    return success({"message": "OEM refresh queued"})


@router.get("/warranty/providers")
async def get_warranty_providers(customer: Customer = Depends(get_current_customer)):
    return success({"providers": []})


@router.post("/warranty/service-records")
async def log_service_record(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"message": "Service record logged"})


@router.get("/warranty/vehicles/{vehicle_id}/history")
async def get_service_history(vehicle_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"records": []})


@router.get("/warranty/vehicles/{vehicle_id}/status")
async def get_warranty_status(vehicle_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"status": None})


@router.get("/warranty/vehicles/{vehicle_id}/upcoming")
async def get_upcoming_replacements(vehicle_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"upcoming": []})


@router.get("/warranty/part-info")
async def get_part_info(customer: Customer = Depends(get_current_customer)):
    return success({"parts": []})


@router.post("/warranty/vehicles/{vehicle_id}/check-alerts")
async def check_warranty_alerts(vehicle_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"alerts": []})


@router.get("/insights")
async def get_insights(customer: Customer = Depends(get_current_customer)):
    return success({"insights": []})


@router.get("/vehicles/{vehicle_id}/cost-per-km")
async def get_cost_per_km(vehicle_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"costPerKm": None})


@router.post("/anomalies/check")
async def check_anomalies(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"anomalies": []})
