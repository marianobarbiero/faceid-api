from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import verify_api_key
from app.schemas.detect import DetectRequest, DetectResponse
from app.services.detect import detect_faces

router = APIRouter()


@router.post("/detect", response_model=DetectResponse)
def detect(
    body: DetectRequest,
    _: str = Depends(verify_api_key),
) -> DetectResponse:
    try:
        result = detect_faces(body.img)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if settings.anti_spoofing:
        for face in result.faces:
            if face.is_real is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Liveness check failed: image does not appear to be real",
                )

    return result
