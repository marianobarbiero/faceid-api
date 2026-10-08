import secrets

from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader

from app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    if api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return api_key


admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def verify_admin_key(admin_key: str = Security(admin_key_header)) -> str:
    if not settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API disabled: set ADMIN_API_KEY",
        )
    if not secrets.compare_digest(admin_key or "", settings.admin_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin key",
        )
    return admin_key
