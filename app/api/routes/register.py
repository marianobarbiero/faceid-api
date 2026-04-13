from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import verify_api_key
from app.schemas.register import RegisterRequest, RegisterResponse
from app.services.register import DuplicateEmailError, register_face

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_api_key),
) -> RegisterResponse:
    try:
        return register_face(body.img, body.full_name, body.email, body.external_id, db)
    except DuplicateEmailError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Email already registered: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
