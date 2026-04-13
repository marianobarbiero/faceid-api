from deepface import DeepFace

from app.config import settings
from app.schemas.verify import VerifyResponse


def verify_faces(img1: str, img2: str) -> VerifyResponse:
    result = DeepFace.verify(
        img1_path=img1,
        img2_path=img2,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        distance_metric=settings.distance_metric,
        align=True,
        enforce_detection=False,
        anti_spoofing=settings.anti_spoofing,
    )

    is_real: bool | None = None
    antispoof_score: float | None = None

    if settings.anti_spoofing:
        is_real = result.get("is_real")
        antispoof_score = result.get("antispoof_score")

    return VerifyResponse(
        verified=result["verified"],
        distance=result["distance"],
        threshold=result["threshold"],
        model=result["model"],
        distance_metric=result["distance_metric"],
        facial_areas=result["facial_areas"],
        is_real=is_real,
        antispoof_score=antispoof_score,
    )
