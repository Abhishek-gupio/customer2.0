"""Document router — /api/v1/documents/*"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Response, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.models.document import DigiLockerConnection, DrivingLicense, FastagDocument, VehicleDocument
from app.schemas.common import success
from app.schemas.document import UploadDocumentRequest, VerifyDLRequest

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


@router.post("/check-image-quality")
async def check_image_quality(file: UploadFile = File(...), customer: Customer = Depends(get_current_customer)):
    return success({"quality": "good", "score": 0.9})


@router.post("/", status_code=201)
async def upload_document(
    vehicle_id: str | None = None,
    type: str = "OTHER",
    document_number: str | None = None,
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    from app.services.storage_service import upload_file
    file_bytes = await file.read()
    file_url = await upload_file(file_bytes, file.filename or "doc.jpg", file.content_type or "image/jpeg", "documents")
    doc = VehicleDocument(
        id=new_id(),
        customer_id=customer.id,
        vehicle_id=vehicle_id,
        type=type,
        document_number=document_number,
        file_url=file_url,
        mime_type=file.content_type,
    )
    db.add(doc)
    await db.flush()
    return success({"id": doc.id, "type": doc.type, "fileUrl": doc.file_url}, status_code=201)


@router.get("/expiring")
async def get_expiring_docs(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    return success({"documents": []})


@router.get("/")
async def list_documents(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(VehicleDocument).where(VehicleDocument.customer_id == customer.id))
    ).scalars().all()
    return success([{
        "id": d.id,
        "vehicleId": d.vehicle_id,
        "type": d.type,
        "documentNumber": d.document_number,
        "expiryDate": d.expiry_date.isoformat() if d.expiry_date else None,
        "fileUrl": d.file_url,
        "mimeType": d.mime_type,
        "createdAt": d.created_at.isoformat() if d.created_at else None,
    } for d in rows])


@router.post("/verify-dl")
async def verify_dl(body: VerifyDLRequest, customer: Customer = Depends(get_current_customer)):
    return success({"verified": False, "message": "DL verification service not configured"})


@router.get("/get-dl")
async def get_dl(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DrivingLicense).where(DrivingLicense.customer_id == customer.id))
    dl = result.scalar_one_or_none()
    if not dl:
        return success(None)
    return success({"dlNumber": dl.dl_number, "fullName": dl.full_name, "dob": dl.dob})


@router.delete("/delete-dl")
async def delete_dl(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DrivingLicense).where(DrivingLicense.customer_id == customer.id))
    dl = result.scalar_one_or_none()
    if dl:
        await db.delete(dl)
        await db.flush()
    return success({"deleted": True})


@router.post("/verify-fastag")
async def verify_fastag(body: dict, customer: Customer = Depends(get_current_customer)):
    return success({"verified": False, "message": "FASTag verification not configured"})


@router.get("/get-fastag")
async def get_fastag(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FastagDocument).where(FastagDocument.customer_id == customer.id))
    ft = result.scalar_one_or_none()
    if not ft:
        return success(None)
    return success({"creditorAccountId": ft.creditor_account_id, "status": ft.status})


@router.delete("/delete-fastag")
async def delete_fastag(customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FastagDocument).where(FastagDocument.customer_id == customer.id))
    ft = result.scalar_one_or_none()
    if ft:
        await db.delete(ft)
        await db.flush()
    return success({"deleted": True})


@router.get("/{doc_id}/image")
async def get_document_image(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VehicleDocument).where(VehicleDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")
    if doc.file_content:
        return Response(content=doc.file_content, media_type=doc.mime_type or "image/jpeg")
    if doc.file_url:
        return RedirectResponse(url=doc.file_url)
    raise NotFoundError("Document image not available")


@router.get("/{doc_id}/pdf")
async def get_document_pdf(doc_id: str, db: AsyncSession = Depends(get_db)):
    raise NotFoundError("PDF export not implemented")


@router.get("/{doc_id}")
async def get_document(doc_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VehicleDocument).where(VehicleDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")
    return success({"id": doc.id, "type": doc.type, "fileUrl": doc.file_url})


@router.post("/{doc_id}/verify")
async def verify_document(doc_id: str, customer: Customer = Depends(get_current_customer)):
    return success({"verified": False})


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VehicleDocument).where(VehicleDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc:
        await db.delete(doc)
        await db.flush()
    return success({"deleted": True})


@router.get("/digilocker/connect")
async def digilocker_connect(customer: Customer = Depends(get_current_customer)):
    if not settings.DIGILOCKER_CLIENT_ID:
        return success({"authUrl": None, "message": "DigiLocker not configured"})
    state = customer.id
    auth_url = (
        f"https://api.digitallocker.gov.in/public/oauth2/1/authorize"
        f"?response_type=code&client_id={settings.DIGILOCKER_CLIENT_ID}"
        f"&redirect_uri={settings.DIGILOCKER_REDIRECT_URI}"
        f"&state={state}"
    )
    return success({"authUrl": auth_url})


@router.post("/digilocker/sync")
async def digilocker_sync(customer: Customer = Depends(get_current_customer)):
    return success({"synced": 0, "message": "DigiLocker sync not implemented"})
