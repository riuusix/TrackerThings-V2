"""Configuration settings for Vercel Python AI Serverless Handlers."""
import os
from typing import List


class ServerlessConfig:
    ENVIRONMENT: str = os.getenv("VERCEL_ENV", os.getenv("NODE_ENV", "production"))
    SERVICE_API_KEY: str = os.getenv(
        "SELF_HOSTED_ML_KEY",
        os.getenv(
            "SERVICE_API_KEY",
            "trackerthings_dev_secret_key_8f7b2c9a1d4e6f3b0a2c5e8d"
        )
    )
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
    ]


config = ServerlessConfig()
