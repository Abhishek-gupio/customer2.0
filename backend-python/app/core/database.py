"""
Async SQLAlchemy engine + session factory.
Connects to the same PostgreSQL instance as the Node.js backend.
Both the 'customer' and 'public' schemas are accessible — models set
__table_args__ = {"schema": "customer"} or {"schema": "public"} as needed.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _normalize_url(raw: str) -> str:
    """Ensure the URL always uses the asyncpg driver regardless of what the env var says."""
    if raw.startswith("postgresql://") and "+asyncpg" not in raw:
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw.startswith("postgres://") and "+asyncpg" not in raw:
        return raw.replace("postgres://", "postgresql+asyncpg://", 1)
    return raw


def _make_engine():
    url = _normalize_url(settings.DATABASE_URL)
    kwargs: dict = {
        "echo": settings.is_development,
        "pool_pre_ping": True,
    }
    # NullPool avoids issues in test environments; use regular pool in prod/dev
    if settings.ENVIRONMENT == "test":
        kwargs["poolclass"] = NullPool
    else:
        kwargs.update(
            {
                "pool_size": settings.db_pool_max,
                "max_overflow": 5,
                "pool_timeout": settings.DATABASE_POOL_CONN_TIMEOUT_MS / 1000,
                "pool_recycle": settings.DATABASE_POOL_IDLE_MS / 1000,
            }
        )
    return create_async_engine(url, **kwargs)


engine = _make_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Alias used by Celery workers which import directly from this module
async_session_factory = AsyncSessionLocal


async def check_db_health() -> dict:
    """Used by the /health/detailed endpoint."""
    from sqlalchemy import text

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
