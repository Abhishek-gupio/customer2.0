"""Chat / AI assistant router — /api/v1/chat/*"""
import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.customer import Customer
from app.schemas.common import success
from app.schemas.chat import ChatFeedbackRequest

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


@router.get("/sessions")
async def list_sessions(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(ChatSession)
            .where(ChatSession.customer_id == customer.id)
            .order_by(ChatSession.updated_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return success([{
        "id": s.id,
        "title": s.title,
        "isActive": s.is_active,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
        "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
    } for s in rows])


@router.post("/sessions", status_code=201)
async def create_session(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(
        id=new_id(),
        customer_id=customer.id,
        title=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.flush()
    return success({"id": session.id, "title": session.title, "isActive": session.is_active}, status_code=201)


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    session = (
        await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        raise NotFoundError("Chat session not found")
    msgs = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
    ).scalars().all()
    return success([{
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
    } for m in msgs])


@router.post("/sessions/{session_id}/message")
async def send_message(
    session_id: str,
    body: dict,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    user_msg = ChatMessage(
        id=new_id(),
        session_id=session_id,
        role="user",
        content=body.get("content", ""),
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)

    reply_content = "I'm your GuPio AI assistant. How can I help with your vehicle today?"
    assistant_msg = ChatMessage(
        id=new_id(),
        session_id=session_id,
        role="assistant",
        content=reply_content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)
    await db.flush()

    return success({
        "userMessage": {"id": user_msg.id, "role": "user", "content": user_msg.content},
        "assistantMessage": {"id": assistant_msg.id, "role": "assistant", "content": reply_content},
    })


@router.post("/sessions/{session_id}/stream")
async def stream_message(
    session_id: str,
    body: dict,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    async def event_generator():
        words = "I'm your GuPio AI assistant. How can I help with your vehicle today?".split()
        for word in words:
            chunk = json.dumps({"delta": word + " "})
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.flush()
    return success({"deleted": True})


@router.post("/feedback")
async def submit_feedback(
    body: ChatFeedbackRequest,
    customer: Customer = Depends(get_current_customer),
):
    return success({"received": True})


@router.get("/analytics")
async def get_analytics(customer: Customer = Depends(get_current_customer)):
    return success({"totalSessions": 0, "totalMessages": 0})
