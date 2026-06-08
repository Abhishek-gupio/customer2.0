"""
Common Pydantic response schemas that match the Admin panel contract exactly.

Admin panel (Admin/src/api/client.ts) expects:
  Success:    { success: true,  data: T }
  Error:      { success: false, error: { message: string, code?: string } }
  Paginated:  { success: true,  data: { data: T[], pagination: { page, limit, total, totalPages } } }

All domain response models inherit CamelModel so that snake_case Python fields
are serialised as camelCase JSON automatically (phone_number → phoneNumber).
"""
from typing import Any, Generic, TypeVar

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Base model — camelCase JSON output for ALL domain schemas
# ---------------------------------------------------------------------------

class CamelModel(BaseModel):
    """
    Base for every request/response Pydantic model.
    • Python fields stay snake_case for readability.
    • JSON output uses camelCase (phone_number → phoneNumber).
    • populate_by_name=True allows using either form when parsing input.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,   # lets us do Model.model_validate(orm_obj)
    )


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class Pagination(BaseModel):
    page: int
    limit: int
    total: int
    totalPages: int


class PaginatedData(BaseModel, Generic[T]):
    data: list[T]
    pagination: Pagination


# ---------------------------------------------------------------------------
# Response helpers (used in every route handler)
# ---------------------------------------------------------------------------

def success(data: Any, status_code: int = 200) -> JSONResponse:
    """
    Wrap data in { success: true, data: ... } envelope.
    Handles Pydantic models, ORM objects, dicts, and lists.
    """
    return JSONResponse(
        {"success": True, "data": jsonable_encoder(data)},
        status_code=status_code,
    )


def paginated(
    items: list[Any],
    page: int,
    limit: int,
    total: int,
) -> JSONResponse:
    """
    Wrap a list in the paginated envelope the Admin panel expects:
      { success: true, data: { data: [...], pagination: { page, limit, total, totalPages } } }
    """
    total_pages = max(1, (total + limit - 1) // limit)
    return JSONResponse(
        {
            "success": True,
            "data": {
                "data": jsonable_encoder(items),
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "totalPages": total_pages,
                },
            },
        }
    )


def error_response(message: str, code: str = "ERROR", status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": code}},
        status_code=status_code,
    )
