from deepface.modules.exceptions import SpoofDetected
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import verify_api_key
from app.schemas.verify import VerifyRequest, VerifyResponse
from app.services.verify import verify_faces

router = APIRouter()


@router.post("/verify", response_model=VerifyResponse)
def verify(
    body: VerifyRequest,
    _: str = Depends(verify_api_key),
) -> VerifyResponse:
    try:
        return verify_faces(body.img1, body.img2)
    except SpoofDetected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness check failed: image does not appear to be real",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
