from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, JSON, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(64))
    model_name: Mapped[str] = mapped_column(String(64))
    detector_backend: Mapped[str] = mapped_column(String(64))
    anti_spoofing: Mapped[bool] = mapped_column(default=False)
    result: Mapped[dict] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FaceRegistration(Base):
    __tablename__ = "face_registrations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(256))
    email: Mapped[str | None] = mapped_column(String(256), nullable=True, unique=True)
    image: Mapped[bytes] = mapped_column(LargeBinary)
    image_path: Mapped[str] = mapped_column(String(512))
    embedding: Mapped[list] = mapped_column(JSON)
    model_name: Mapped[str] = mapped_column(String(64))
    detector_backend: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
