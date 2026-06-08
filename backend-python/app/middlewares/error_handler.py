"""
Global error handler — converts all errors to the Admin-panel-compatible
{ success: false, error: { message, code } } envelope.
Mirrors Backend/src/middlewares/error.middleware.ts.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.errors import AppError
from app.core.logging import logger


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"message": exc.message, "code": exc.code}},
        status_code=exc.status_code,
    )


async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
    errors = exc.errors()
    message = "; ".join(
        f"{' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in errors
    )
    return JSONResponse(
        {"success": False, "error": {"message": message, "code": "VALIDATION_ERROR"}},
        status_code=422,
    )


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception", exc_info=exc, path=request.url.path)
    return JSONResponse(
        {"success": False, "error": {"message": "Internal server error", "code": "INTERNAL_ERROR"}},
        status_code=500,
    )
