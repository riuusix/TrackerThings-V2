"""Authentication dependency for Vercel Python AI Serverless Handlers."""
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status
from api.config import config


def verify_service_auth(
    authorization: Optional[str] = Header(default=None),
    x_trackerthings_service_key: Optional[str] = Header(default=None),
) -> bool:
    """
    Validates service-to-service authentication using either:
    1. Authorization: Bearer <SERVICE_API_KEY>
    2. X-TrackerThings-Service-Key: <SERVICE_API_KEY>
    """
    expected_key = config.SERVICE_API_KEY
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SERVICE_API_KEY / SELF_HOSTED_ML_KEY is not configured on the server.",
        )

    extracted_token: Optional[str] = None

    if authorization and authorization.strip():
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            extracted_token = parts[1]
        elif len(parts) == 1:
            extracted_token = parts[0]

    if not extracted_token and x_trackerthings_service_key:
        extracted_token = x_trackerthings_service_key.strip()

    if not extracted_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing service authentication credentials. Supply 'Authorization: Bearer <API_KEY>' or 'X-TrackerThings-Service-Key'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    is_valid = secrets.compare_digest(extracted_token, expected_key)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service API key. Access denied.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True
