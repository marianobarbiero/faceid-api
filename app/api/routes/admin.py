from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import verify_admin_key
from app.schemas.admin import UserListResponse
from app.services.admin import get_user_image, list_users

router = APIRouter(prefix="/admin", dependencies=[Depends(verify_admin_key)])


@router.get("/users", response_model=UserListResponse)
def users(
    q: str | None = Query(default=None, max_length=256),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> UserListResponse:
    return list_users(db, q, limit, offset)


@router.get("/users/{user_id}/image")
def user_image(user_id: int, db: Session = Depends(get_db)) -> Response:
    image = get_user_image(db, user_id)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return Response(content=image, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})
