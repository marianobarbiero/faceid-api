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
    image_path: str
    model_name: str
    detector_backend: str
    is_active: bool
    created_at: datetime
