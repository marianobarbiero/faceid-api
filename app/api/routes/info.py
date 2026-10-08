from fastapi import APIRouter, Depends

from app.config import settings
from app.dependencies import verify_api_key
from app.embeddings import get_threshold
from app.schemas.info import InfoResponse

router = APIRouter()


@router.get("/info", response_model=InfoResponse)
def info(_: str = Depends(verify_api_key)) -> InfoResponse:
    """Active recognition settings, so clients can show what is really running."""
    return InfoResponse(
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        distance_metric=settings.distance_metric,
        match_threshold=get_threshold(settings.model_name, settings.distance_metric, settings.match_threshold),
        anti_spoofing=settings.anti_spoofing,
    )
