"""
Application error classes.
All errors serialize to the Admin-panel-compatible envelope:
  { "success": false, "error": { "message": "...", "code": "..." } }
"""
from fastapi import HTTPException


class AppError(HTTPException):
    """
    Base application error.
    Mirrors AppError from Backend/src/utils/AppError.ts.
    """

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        code: str | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.message = message
        self.code = code or f"ERR_{status_code}"


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=404, code="NOT_FOUND")


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=401, code="UNAUTHORIZED")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, status_code=403, code="FORBIDDEN")


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message, status_code=409, code="CONFLICT")


class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message, status_code=422, code="VALIDATION_ERROR")


class BadRequestError(AppError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message, status_code=400, code="BAD_REQUEST")


class InternalError(AppError):
    def __init__(self, message: str = "Internal server error") -> None:
        super().__init__(message, status_code=500, code="INTERNAL_ERROR")
