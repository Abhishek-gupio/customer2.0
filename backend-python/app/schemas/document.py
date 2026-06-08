"""Document schemas."""
from datetime import datetime

from app.schemas.common import CamelModel


class UploadDocumentRequest(CamelModel):
    vehicle_id: str | None = None
    type: str = "OTHER"
    document_number: str | None = None
    expiry_date: datetime | None = None


class DocumentResponse(CamelModel):
    id: str
    vehicle_id: str | None
    type: str
    document_number: str | None
    expiry_date: datetime | None
    file_url: str | None
    mime_type: str | None
    created_at: datetime


class VerifyDLRequest(CamelModel):
    dl_number: str
    dob: str


class VerifyFastagRequest(CamelModel):
    vehicle_number: str


class DigiLockerConnectResponse(CamelModel):
    auth_url: str
