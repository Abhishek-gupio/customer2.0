"""
FastAPI application factory — mirrors Backend/src/app.ts.
Registers middleware, error handlers, routers, and health endpoints.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import check_db_health
from app.core.errors import AppError
from app.core.logging import setup_logging
from app.core.redis import check_redis_health
from app.middlewares.error_handler import (
    app_error_handler,
    generic_error_handler,
    validation_error_handler,
)
from app.middlewares.request_logging import RequestLoggingMiddleware
from app.schemas.common import success

setup_logging()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_MAX}/15minutes"],
)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gupio Customer API",
        version="2.0.0",
        docs_url="/api-docs" if not settings.is_production else None,
        redoc_url=None,
    )

    # ---- Middleware (order matters — outermost registered last) ----
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGIN.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # ---- Error handlers ----
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_exception_handler(Exception, generic_error_handler)

    # ---- Static files (local storage driver) ----
    if settings.STORAGE_DRIVER == "local":
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

    # ---- Health endpoints (mirrors Backend /health routes) ----
    @app.get("/health", tags=["health"], include_in_schema=False)
    async def health_simple():
        return success({"status": "ok", "version": "2.0.0"})

    @app.get("/health/detailed", tags=["health"], include_in_schema=False)
    async def health_detailed():
        db = await check_db_health()
        redis = await check_redis_health()
        return success({"db": db, "redis": redis})

    # ---- Routers ----
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    from app.routers import (
        admin,
        ai,
        auth,
        chat,
        customer,
        discovery,
        diy,
        document,
        expense,
        fuel,
        notification,
        places,
        sharing,
        sos,
        support,
        telematics,
        trip_expense,
        vehicle,
    )

    prefix = "/api/v1"
    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["auth"])
    app.include_router(customer.router, prefix=f"{prefix}/customer", tags=["customer"])
    app.include_router(vehicle.router, prefix=f"{prefix}/vehicles", tags=["vehicles"])
    app.include_router(document.router, prefix=f"{prefix}/documents", tags=["documents"])
    app.include_router(expense.router, prefix=f"{prefix}/expenses", tags=["expenses"])
    app.include_router(chat.router, prefix=f"{prefix}/chat", tags=["chat"])
    app.include_router(telematics.router, prefix=f"{prefix}/telematics", tags=["telematics"])
    app.include_router(notification.router, prefix=f"{prefix}/notifications", tags=["notifications"])
    app.include_router(sharing.router, prefix=f"{prefix}/sharing", tags=["sharing"])
    app.include_router(sos.router, prefix=f"{prefix}/sos", tags=["sos"])
    app.include_router(places.router, prefix=f"{prefix}/places", tags=["places"])
    app.include_router(fuel.router, prefix=f"{prefix}/fuel", tags=["fuel"])
    app.include_router(discovery.router, prefix=f"{prefix}/discovery", tags=["discovery"])
    app.include_router(support.router, prefix=f"{prefix}/support", tags=["support"])
    app.include_router(ai.router, prefix=f"{prefix}/ai", tags=["ai"])
    app.include_router(trip_expense.router, prefix=f"{prefix}/trip-expense", tags=["trip-expense"])
    app.include_router(diy.router, prefix=f"{prefix}/diy", tags=["diy"])
    app.include_router(admin.router, prefix=f"{prefix}/admin", tags=["admin"])
