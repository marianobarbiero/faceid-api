from datetime import datetime

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    img: str
    full_name: str
    email: str | None = None
    external_id: str | None = None


class RegisterResponse(BaseModel):
    id: int
    full_name: str
    email: str | None
    external_id: str | None
    model_name: str
    detector_backend: str
    is_active: bool
    created_at: datetime


class AddPhotoRequest(BaseModel):
    img: str


class AddPhotoResponse(BaseModel):
    photo_id: int
    registration_id: int
    photos_count: int  # including the photo taken at /register
    distance: float  # closest distance to the person's previous photos
