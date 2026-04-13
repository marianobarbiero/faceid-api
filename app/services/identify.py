import os

from deepface import DeepFace

from app.config import settings
from app.schemas.identify import IdentifyMatch, IdentifyResponse


def identify_face(img: str) -> IdentifyResponse:
    if not os.path.isdir(settings.face_db_path):
        return IdentifyResponse(matches=[])

    results = DeepFace.find(
        img_path=img,
        db_path=settings.face_db_path,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        distance_metric=settings.distance_metric,
        align=True,
        enforce_detection=False,
        silent=True,
        anti_spoofing=settings.anti_spoofing,
    )

    matches: list[IdentifyMatch] = []
    for df in results:
        for _, row in df.iterrows():
            matches.append(
                IdentifyMatch(
                    identity=row["identity"],
                    distance=row[f"{settings.model_name}_{settings.distance_metric}"],
                    threshold=row.get("threshold", 0.0),
                )
            )

    is_real: bool | None = None
    antispoof_score: float | None = None

    if settings.anti_spoofing and results:
        first_df = results[0]
        if not first_df.empty and "is_real" in first_df.columns:
            is_real = bool(first_df.iloc[0]["is_real"])
            antispoof_score = float(first_df.iloc[0].get("antispoof_score", 0.0))

    return IdentifyResponse(
        matches=matches,
        is_real=is_real,
        antispoof_score=antispoof_score,
    )
