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
    photos_count: int = 1


class UserListResponse(BaseModel):
    items: list[UserSummary]
    total: int
    limit: int
    offset: int


class PhotoInfo(BaseModel):
    photo_id: int | None  # None for the photo taken at /register
    created_at: datetime


class UserDetail(UserSummary):
    photos: list[PhotoInfo]
