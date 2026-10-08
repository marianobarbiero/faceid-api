import os

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import FacePhoto, FaceRegistration
from app.embeddings import embedding_store
from app.schemas.admin import PhotoInfo, UserDetail, UserListResponse, UserSummary


def list_users(db: Session, q: str | None, limit: int, offset: int) -> UserListResponse:
    query = select(FaceRegistration)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                FaceRegistration.full_name.ilike(pattern),
                FaceRegistration.email.ilike(pattern),
                FaceRegistration.external_id.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(FaceRegistration.created_at.desc(), FaceRegistration.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    ids = [row.id for row in rows]
    extra = dict(
        db.execute(
            select(FacePhoto.registration_id, func.count())
            .where(FacePhoto.registration_id.in_(ids))
            .group_by(FacePhoto.registration_id)
        ).all()
    ) if ids else {}

    return UserListResponse(
        items=[
            UserSummary.model_validate(row, from_attributes=True).model_copy(
                update={"photos_count": 1 + extra.get(row.id, 0)}
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_user_image(db: Session, user_id: int) -> bytes | None:
    return db.scalar(select(FaceRegistration.image).where(FaceRegistration.id == user_id))


def get_user_detail(db: Session, user_id: int) -> UserDetail | None:
    user = db.get(FaceRegistration, user_id)
    if user is None:
        return None
    extra = db.scalars(
        select(FacePhoto).where(FacePhoto.registration_id == user_id).order_by(FacePhoto.created_at, FacePhoto.id)
    ).all()
    photos = [PhotoInfo(photo_id=None, created_at=user.created_at)]
    photos += [PhotoInfo(photo_id=p.id, created_at=p.created_at) for p in extra]
    summary = UserSummary.model_validate(user, from_attributes=True)
    return UserDetail(**summary.model_dump(exclude={"photos_count"}), photos_count=len(photos), photos=photos)


def get_photo_image(db: Session, user_id: int, photo_id: int) -> bytes | None:
    return db.scalar(
        select(FacePhoto.image).where(FacePhoto.id == photo_id, FacePhoto.registration_id == user_id)
    )


def delete_user(db: Session, user_id: int) -> bool:
    """Hard-delete a person, their photos (rows and files) and their in-memory embeddings.

    Afterwards they are no longer identified and their email can be registered again.
    """
    user = db.get(FaceRegistration, user_id)
    if user is None:
        return False
    paths = [user.image_path] + list(
        db.scalars(select(FacePhoto.image_path).where(FacePhoto.registration_id == user_id))
    )
    db.execute(delete(FacePhoto).where(FacePhoto.registration_id == user_id))
    db.delete(user)
    db.commit()
    embedding_store.remove(user_id)

    for path in paths:
        try:
            os.remove(path)
            # Drop the person's folder in face_db once it is empty
            os.rmdir(os.path.dirname(path))
        except OSError:
            pass
    return True
