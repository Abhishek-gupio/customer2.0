"""
Application configuration — mirrors Backend/src/config/env.ts exactly.
Uses pydantic-settings so values are loaded from .env and validated at startup.
"""
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Server
    PORT: int = 8000
    ENVIRONMENT: Literal["development", "production", "test"] = "development"
    LOG_LEVEL: Literal["fatal", "error", "warning", "info", "debug", "trace"] = "info"
    CORS_ORIGIN: str = "*"
    RATE_LIMIT_MAX: int = 300

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://abhishekkumar@localhost:5432/valet_db"
    )
    DATABASE_POOL_MAX: int = 15
    DATABASE_POOL_IDLE_MS: int = 30_000
    DATABASE_POOL_CONN_TIMEOUT_MS: int = 10_000

    # Redis
    REDIS_URL: str | None = None
    REDIS_ENABLED: bool | None = None

    # JWT — must match Backend JWT_SECRET for dual-run token compatibility
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ACCESS_EXPIRY: str = "15m"
    JWT_REFRESH_EXPIRY: str = "30d"
    ADMIN_JWT_EXPIRY: str = "24h"

    # OTP
    OTP_EXPIRY_SEC: int = 300
    OTP_RATE_LIMIT_WINDOW_SEC: int = 30

    # SMS
    SMS_SERVICE: Literal["MOCK", "GMAIL", "GUPIO", "TWILIO", "SMTP"] = "MOCK"
    FLASH49_USERNAME: str | None = None
    FLASH49_PASSWORD: str | None = None
    FLASH49_FROM: str | None = None
    FLASH49_DLT_CONTENT_ID: str | None = None
    GMAIL_USER: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_SECURE: bool = False
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    SMTP_FROM_NAME: str = "Gupio"
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_PHONE_NUMBER: str | None = None

    # AI
    GEMINI_API_KEY: str | None = None
    GEMINI_TEXT_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_VOICE_MODEL: str = "gemini-2.5-flash-lite"
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str | None = None

    # Maps
    GOOGLE_MAPS_API_KEY: str | None = None

    # Storage
    STORAGE_DRIVER: Literal["local", "s3"] = "local"
    UPLOAD_DIR: str = "uploads"
    PUBLIC_BASE_URL: str | None = None
    AWS_S3_BUCKET: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str = "us-east-1"

    # DigiLocker
    DIGILOCKER_CLIENT_ID: str | None = None
    DIGILOCKER_CLIENT_SECRET: str | None = None
    DIGILOCKER_REDIRECT_URI: str | None = None

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = None

    # Telematics
    TELEMATICS_DEFAULT_PROVIDER: Literal["damoov", "inhouse"] = "damoov"
    DAMOOV_WEBHOOK_SECRET: str | None = None
    DAMOOV_INSTANCE_ID: str | None = None
    DAMOOV_INSTANCE_KEY: str | None = None
    DAMOOV_ADMIN_EMAIL: str | None = None
    DAMOOV_ADMIN_PASSWORD: str | None = None

    # Voice TTS
    GOOGLE_CLOUD_TTS_KEY: str | None = None

    # Weather
    WEATHER_API_KEY: str | None = None

    # Vehicle Verification
    API_ID: str | None = None
    API_KEY: str | None = None
    TOKEN_ID: str | None = None

    # Trip Expense
    TOLLGURU_API_KEY: str | None = None

    # ------------------------------------------------------------------ #
    # Derived helpers                                                       #
    # ------------------------------------------------------------------ #

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def db_pool_max(self) -> int:
        return self.DATABASE_POOL_MAX if self.is_production else 5

    def expiry_to_seconds(self, expiry: str) -> int:
        """Convert '15m', '30d', '24h' strings to seconds."""
        unit = expiry[-1]
        value = int(expiry[:-1])
        return {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit] * value

    @property
    def access_token_expiry_sec(self) -> int:
        return self.expiry_to_seconds(self.JWT_ACCESS_EXPIRY)

    @property
    def refresh_token_expiry_sec(self) -> int:
        return self.expiry_to_seconds(self.JWT_REFRESH_EXPIRY)

    @property
    def admin_token_expiry_sec(self) -> int:
        return self.expiry_to_seconds(self.ADMIN_JWT_EXPIRY)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
