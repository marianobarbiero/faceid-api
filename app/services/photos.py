import os

from deepface import DeepFace
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import FacePhoto, FaceRegistration
from app.embeddings import embedding_store
from app.schemas.register import AddPhotoResponse
from app.services.register import _decode_image, _save_image


class PersonNotFoundError(Exception):
    pass


class TooManyPhotosError(Exception):
    pass


class NoFaceDetectedError(Exception):
    pass


class PhotoMismatchError(Exception):
    def __init__(self, distance: float) -> None:
        super().__init__(f"distance {distance:.4f} > {settings.enroll_max_distance}")
        self.distance = distance


def count_photos(db: Session, registration_id: int) -> int:
    """Photos of a person, including the one taken at /register."""
    extra = db.scalar(select(func.count()).where(FacePhoto.registration_id == registration_id)) or 0
    return 1 + extra


def add_photo(registration_id: int, img: str, db: Session) -> AddPhotoResponse:
    person = db.get(FaceRegistration, registration_id)
    if person is None or not person.is_active:
        raise PersonNotFoundError(registration_id)
    if count_photos(db, registration_id) >= settings.max_photos_per_person:
        raise TooManyPhotosError(settings.max_photos_per_person)

    image_bytes = _decode_image(img)
    image_path = _save_image(image_bytes, person.full_name)
    try:
        representations = DeepFace.represent(
            img_path=image_path,
            model_name=settings.model_name,
            detector_backend=settings.detector_backend,
            align=True,
            enforce_detection=False,
        )
        # With enforce_detection=False DeepFace falls back to the whole image (confidence 0)
        if not representations or not representations[0].get("face_confidence"):
            raise NoFaceDetectedError()
        embedding = representations[0]["embedding"]

        # The new photo must look like this person: otherwise anyone holding the public API
        # key could add their own face to someone else's identity
        distance = embedding_store.distance_to_person(embedding, registration_id, settings.distance_metric)
        if distance is None or distance > settings.enroll_max_distance:
            raise PhotoMismatchError(distance if distance is not None else float("inf"))
    except Exception:
        os.remove(image_path)
        raise

    photo = FacePhoto(
        registration_id=registration_id,
        image=image_bytes,
        image_path=image_path,
        embedding=embedding,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    embedding_store.add(registration_id, person.email, embedding, photo.id)

    return AddPhotoResponse(
        photo_id=photo.id,
        registration_id=registration_id,
        photos_count=count_photos(db, registration_id),
        distance=round(distance, 4),
    )
