"""
python-socketio ASGI socket manager.
Mirrors Backend/src/socket/socketManager.ts event names exactly so the
mobile app's socket client works unchanged during the dual-run phase.
"""
import asyncio
import logging
from typing import Any

import socketio
from app.core.config import settings
from app.core.security import decode_customer_token

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.CORS_ORIGIN.split(","),
    logger=False,
    engineio_logger=False,
)

socket_app = socketio.ASGIApp(sio)

_customer_socket_map: dict[str, str] = {}


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        qs = environ.get("QUERY_STRING", "")
        for part in qs.split("&"):
            if part.startswith("token="):
                token = part[6:]
                break

    if token:
        try:
            payload = decode_customer_token(token)
            customer_id = payload.get("sub") or payload.get("id")
            if customer_id:
                _customer_socket_map[customer_id] = sid
                await sio.enter_room(sid, f"customer:{customer_id}")
                logger.info("Socket connected: customer=%s sid=%s", customer_id, sid)
        except Exception:
            pass


@sio.event
async def disconnect(sid: str):
    to_remove = [cid for cid, s in _customer_socket_map.items() if s == sid]
    for cid in to_remove:
        del _customer_socket_map[cid]
    logger.info("Socket disconnected: sid=%s", sid)


@sio.event
async def join(sid: str, data: Any):
    """Client joins a named room (mirrors Node.js `join` event)."""
    room = data if isinstance(data, str) else (data or {}).get("room")
    if room:
        await sio.enter_room(sid, room)


@sio.event
async def leave(sid: str, data: Any):
    room = data if isinstance(data, str) else (data or {}).get("room")
    if room:
        await sio.leave_room(sid, room)


async def emit_to_customer(customer_id: str, event: str, data: Any) -> None:
    """Emit an event to a specific customer's socket room."""
    room = f"customer:{customer_id}"
    await sio.emit(event, data, room=room)


async def emit_new_notification(customer_id: str, notification: dict) -> None:
    """Matches Node.js `socket.to(room).emit('new_notification', notif)` call."""
    await emit_to_customer(customer_id, "new_notification", notification)
