"""DIY guides router — /api/v1/diy/*"""
from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_customer
from app.models.customer import Customer
from app.schemas.common import success

router = APIRouter()

_DIY_GUIDES = [
    {"id": "diy-1", "title": "How to check tyre pressure", "category": "maintenance", "difficulty": "easy", "estimatedMinutes": 5, "thumbnailUrl": None},
    {"id": "diy-2", "title": "How to top up engine oil", "category": "maintenance", "difficulty": "easy", "estimatedMinutes": 10, "thumbnailUrl": None},
    {"id": "diy-3", "title": "How to replace wiper blades", "category": "maintenance", "difficulty": "easy", "estimatedMinutes": 15, "thumbnailUrl": None},
    {"id": "diy-4", "title": "How to jump start a car", "category": "emergency", "difficulty": "medium", "estimatedMinutes": 20, "thumbnailUrl": None},
    {"id": "diy-5", "title": "How to change a flat tyre", "category": "emergency", "difficulty": "medium", "estimatedMinutes": 30, "thumbnailUrl": None},
]

_DIY_DETAIL: dict[str, dict] = {
    g["id"]: {**g, "steps": [], "tools": [], "warnings": []}
    for g in _DIY_GUIDES
}


@router.get("/guides")
async def list_guides(
    category: str | None = None,
    vehicle_id: str | None = None,
    customer: Customer = Depends(get_current_customer),
):
    guides = _DIY_GUIDES
    if category:
        guides = [g for g in guides if g["category"] == category]
    return success({"guides": guides})


@router.get("/guides/{guide_id}")
async def get_guide(
    guide_id: str,
    customer: Customer = Depends(get_current_customer),
):
    from app.core.errors import NotFoundError
    guide = _DIY_DETAIL.get(guide_id)
    if not guide:
        raise NotFoundError("Guide not found")
    return success(guide)


@router.get("/categories")
async def get_categories(customer: Customer = Depends(get_current_customer)):
    return success({"categories": ["maintenance", "emergency", "cleaning", "upgrades"]})


@router.get("/recommended")
async def get_recommended(
    vehicle_id: str | None = None,
    customer: Customer = Depends(get_current_customer),
):
    return success({"guides": _DIY_GUIDES[:3]})
