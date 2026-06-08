"""
File storage — mirrors Backend/src/services/storage.service.ts.
Supports 'local' and 's3' drivers controlled by STORAGE_DRIVER env var.
"""
import os
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


def _s3_client():
    import boto3
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


async def upload_file(
    file_bytes: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    folder: str = "uploads",
) -> str:
    """
    Upload file bytes and return the public URL.
    Mirrors storageService.upload() from Node.js backend.
    """
    ext = Path(filename).suffix
    key = f"{folder}/{uuid.uuid4().hex}{ext}"

    if settings.STORAGE_DRIVER == "s3":
        return await _upload_s3(file_bytes, key, content_type)
    return await _upload_local(file_bytes, key)


async def _upload_s3(file_bytes: bytes, key: str, content_type: str) -> str:
    import asyncio
    s3 = _s3_client()
    await asyncio.to_thread(
        s3.put_object,
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


async def _upload_local(file_bytes: bytes, key: str) -> str:
    path = Path(settings.UPLOAD_DIR) / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(file_bytes)
    base = settings.PUBLIC_BASE_URL or ""
    return f"{base}/{key}"


async def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned S3 URL (or local URL for local driver)."""
    if settings.STORAGE_DRIVER == "s3":
        import asyncio
        s3 = _s3_client()
        return await asyncio.to_thread(
            s3.generate_presigned_url,
            "get_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
            ExpiresIn=expires_in,
        )
    base = settings.PUBLIC_BASE_URL or ""
    return f"{base}/{key}"


async def delete_file(key: str) -> None:
    if settings.STORAGE_DRIVER == "s3":
        import asyncio
        s3 = _s3_client()
        await asyncio.to_thread(
            s3.delete_object, Bucket=settings.AWS_S3_BUCKET, Key=key
        )
    else:
        path = Path(settings.UPLOAD_DIR) / key
        try:
            path.unlink()
        except FileNotFoundError:
            pass
