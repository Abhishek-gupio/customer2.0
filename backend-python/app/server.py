"""
Uvicorn server entry point — mirrors Backend/src/server.ts.
Initialises Redis on startup, gracefully shuts down on SIGTERM/SIGINT.
"""
from contextlib import asynccontextmanager

import uvicorn

from app.core.config import settings
from app.core.logging import logger
from app.core.redis import close_redis, init_redis
from app.main import create_app
from app.websocket.socket_manager import socket_app


@asynccontextmanager
async def lifespan(app):
    # Startup
    logger.info("Starting Gupio Customer API (Python FastAPI)", port=settings.PORT)
    await init_redis()
    yield
    # Shutdown
    logger.info("Shutting down...")
    await close_redis()


_fastapi_app = create_app()
_fastapi_app.router.lifespan_context = lifespan

# Mount Socket.io under /socket.io/ — python-socketio's ASGIApp dispatches
# socket paths internally and falls back to the FastAPI app for everything else.
from socketio import ASGIApp as _SioASGI  # noqa: E402

app = _SioASGI(
    socketio_server=__import__("app.websocket.socket_manager", fromlist=["sio"]).sio,
    other_asgi_app=_fastapi_app,
)


if __name__ == "__main__":
    uvicorn.run(
        "app.server:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower(),
    )
