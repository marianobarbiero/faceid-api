from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import verify_api_key
from app.schemas.identify import IdentifyRequest, IdentifyResponse
from app.services.identify import identify_face

router = APIRouter()


@router.post("/identify", response_model=IdentifyResponse)
def identify(
    body: IdentifyRequest,
    _: str = Depends(verify_api_key),
) -> IdentifyResponse:
    try:
        result = identify_face(body.img)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if settings.anti_spoofing and result.is_real is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness check failed: image does not appear to be real",
        )

    return result
