"""Configuration settings for TrackerThings AI Microservice."""
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "production"

    # Service-to-Service Shared Secret Key
    SERVICE_API_KEY: str = os.getenv(
        "SERVICE_API_KEY",
        "trackerthings_koyeb_service_secret_change_in_production"
    )

    # File Constraints
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

