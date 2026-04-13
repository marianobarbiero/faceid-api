import base64
import os
import re
import uuid

from deepface import DeepFace
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import FaceRegistration
from app.embeddings import embedding_store
from app.schemas.register import RegisterResponse


class DuplicateEmailError(Exception):
    pass


def _decode_image(img_b64: str) -> bytes:
    # Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    return base64.b64decode(img_b64)


def _save_image(image_bytes: bytes, full_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]", "_", full_name.lower())
    filename = f"{slug}_{uuid.uuid4().hex[:8]}.jpg"
    person_dir = os.path.join(settings.face_db_path, slug)
    os.makedirs(person_dir, exist_ok=True)
    path = os.path.join(person_dir, filename)
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path


def register_face(body_img: str, full_name: str, email: str | None, external_id: str | None, db: Session) -> RegisterResponse:
    image_bytes = _decode_image(body_img)
    image_path = _save_image(image_bytes, full_name)

    try:
        representations = DeepFace.represent(
            img_path=image_path,
            model_name=settings.model_name,
            detector_backend=settings.detector_backend,
            align=True,
            enforce_detection=False,
        )
    except Exception:
        os.remove(image_path)
        raise
    embedding = representations[0]["embedding"] if representations else []

    record = FaceRegistration(
        full_name=full_name,
        email=email,
        external_id=external_id,
        image=image_bytes,
        image_path=image_path,
        embedding=embedding,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        os.remove(image_path)
        raise DuplicateEmailError(email)
    db.refresh(record)
    embedding_store.add(record.id, record.email, embedding)

    return RegisterResponse(
        id=record.id,
        full_name=record.full_name,
        email=record.email,
        external_id=record.external_id,
        model_name=record.model_name,
        detector_backend=record.detector_backend,
        is_active=record.is_active,
        created_at=record.created_at,
    )
