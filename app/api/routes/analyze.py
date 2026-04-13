from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import verify_api_key
from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.analyze import analyze_faces

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    body: AnalyzeRequest,
    _: str = Depends(verify_api_key),
) -> AnalyzeResponse:
    try:
        result = analyze_faces(body.img, body.actions)
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
