from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import FacePhoto, FaceRegistration
from app.schemas.admin import UserListResponse, UserSummary


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
