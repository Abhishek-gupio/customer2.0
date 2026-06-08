"""Fuel prices router — /api/v1/fuel/*"""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.expense import FuelPriceCache
from app.schemas.common import success

router = APIRouter()


@router.get("/prices")
async def get_fuel_prices(
    state: str | None = None,
    city: str | None = None,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    q = select(FuelPriceCache)
    if state:
        q = q.where(FuelPriceCache.state == state)
    if city:
        q = q.where(FuelPriceCache.city == city)
    rows = (await db.execute(q.limit(50))).scalars().all()
    return success([{
        "state": r.state,
        "city": r.city,
        "petrolPrice": r.petrol_price,
        "dieselPrice": r.diesel_price,
        "cngPrice": r.cng_price,
        "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows])


@router.get("/prices/states")
async def get_all_states(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(FuelPriceCache.state).distinct())).scalars().all()
    return success({"states": list(rows)})


@router.get("/prices/compare")
async def compare_fuel_prices(
    city1: str,
    city2: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(FuelPriceCache).where(FuelPriceCache.city.in_([city1, city2]))
        )
    ).scalars().all()
    return success({"comparisons": [{
        "city": r.city,
        "petrolPrice": r.petrol_price,
        "dieselPrice": r.diesel_price,
        "cngPrice": r.cng_price,
    } for r in rows]})


@router.post("/calculate-liters")
async def calculate_liters(
    body: dict,
    customer: Customer = Depends(get_current_customer),
):
    amount = body.get("amount", 0)
    price_per_liter = body.get("pricePerLiter", 1)
    if price_per_liter <= 0:
        return success({"liters": 0})
    liters = round(amount / price_per_liter, 2)
    return success({"liters": liters})


@router.post("/prices/refresh")
async def refresh_fuel_prices(customer: Customer = Depends(get_current_customer)):
    return success({"message": "Fuel price refresh queued"})
