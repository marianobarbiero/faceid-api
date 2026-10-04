from datetime import datetime

from pydantic import BaseModel


class UserSummary(BaseModel):
    id: int
    full_name: str
    email: str | None
    external_id: str | None
    model_name: str
    detector_backend: str
    is_active: bool
    created_at: datetime


class UserListResponse(BaseModel):
    items: list[UserSummary]
    total: int
    limit: int
    offset: int
