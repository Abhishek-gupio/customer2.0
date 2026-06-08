"""Support router — /api/v1/support/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.support import FAQ, SupportTicket, TicketMessage
from app.schemas.common import success
from app.schemas.support import AddTicketMessageRequest, CreateTicketRequest

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


@router.get("/tickets")
async def list_tickets(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(SupportTicket).where(SupportTicket.customer_id == customer.id).order_by(SupportTicket.created_at.desc())
        )
    ).scalars().all()
    return success([{
        "id": t.id,
        "subject": t.subject,
        "status": t.status,
        "priority": t.priority,
        "category": t.category,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    } for t in rows])


@router.post("/tickets", status_code=201)
async def create_ticket(
    body: CreateTicketRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    ticket = SupportTicket(
        id=new_id(),
        customer_id=customer.id,
        subject=body.subject,
        description=body.description,
        status="OPEN",
        priority=body.priority,
        category=body.category,
    )
    db.add(ticket)
    await db.flush()
    return success({"id": ticket.id, "subject": ticket.subject, "status": ticket.status}, status_code=201)


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise NotFoundError("Ticket not found")
    messages = (
        await db.execute(
            select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at)
        )
    ).scalars().all()
    return success({
        "id": ticket.id,
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "createdAt": ticket.created_at.isoformat() if ticket.created_at else None,
        "messages": [{
            "id": m.id,
            "senderId": m.sender_id,
            "senderRole": m.sender_role,
            "content": m.content,
            "createdAt": m.created_at.isoformat() if m.created_at else None,
        } for m in messages],
    })


@router.post("/tickets/{ticket_id}/messages", status_code=201)
async def add_message(
    ticket_id: str,
    body: AddTicketMessageRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    message = TicketMessage(
        id=new_id(),
        ticket_id=ticket_id,
        sender_id=customer.id,
        sender_role="customer",
        content=body.content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(message)
    await db.flush()
    return success({"id": message.id, "content": message.content}, status_code=201)


@router.get("/faqs")
async def get_faqs(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(FAQ).where(FAQ.is_active == True).order_by(FAQ.order))
    ).scalars().all()
    return success([{
        "id": f.id,
        "question": f.question,
        "answer": f.answer,
        "category": f.category,
    } for f in rows])


@router.get("/chat-flow")
async def get_chat_flow():
    return success({"flow": []})


@router.get("/info")
async def get_support_info():
    return success({"email": "support@gupio.tech", "phone": None})
