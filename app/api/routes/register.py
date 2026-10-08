from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import verify_api_key
from app.schemas.register import AddPhotoRequest, AddPhotoResponse, RegisterRequest, RegisterResponse
from app.services.photos import (
    NoFaceDetectedError,
    PersonNotFoundError,
    PhotoMismatchError,
    TooManyPhotosError,
    add_photo,
)
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


@router.post(
    "/register/{registration_id}/photos",
    response_model=AddPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_photo(
    registration_id: int,
    body: AddPhotoRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_api_key),
) -> AddPhotoResponse:
    try:
        return add_photo(registration_id, body.img, db)
    except PersonNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    except TooManyPhotosError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Photo limit reached ({e})")
    except NoFaceDetectedError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No face detected")
    except PhotoMismatchError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Photo does not match this person (distance {e.distance:.2f})",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
