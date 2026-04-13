import base64
import os

import numpy as np
from deepface import DeepFace
from PIL import Image
import io
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import FaceRegistration
from app.schemas.identify import IdentifyMatch, IdentifyResponse


def _b64_to_numpy(img: str) -> np.ndarray:
    if "," in img:
        img = img.split(",", 1)[1]
    image_bytes = base64.b64decode(img)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(pil_image)


def identify_face(img: str, db: Session) -> IdentifyResponse:
    if not os.path.isdir(settings.face_db_path):
        return IdentifyResponse(matches=[])

    img_array = _b64_to_numpy(img)

    results = DeepFace.find(
        img_path=img_array,
        db_path=settings.face_db_path,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        distance_metric=settings.distance_metric,
        align=True,
        enforce_detection=False,
        silent=True,
        anti_spoofing=settings.anti_spoofing,
    )

    def _get_distance(row) -> float:
        for col in [f"{settings.model_name}_{settings.distance_metric}", "distance", settings.distance_metric]:
            if col in row.index:
                return float(row[col])
        # fallback: pick the first numeric column that isn't identity/threshold
        for col in row.index:
            if col not in ("identity", "threshold") and isinstance(row[col], (int, float)):
                return float(row[col])
        return 0.0

    matches: list[IdentifyMatch] = []
    for df in results:
        for _, row in df.iterrows():
            identity_path = os.path.normpath(row["identity"])
            record = db.query(FaceRegistration).filter(
                FaceRegistration.image_path.contains(os.path.basename(identity_path))
            ).first()
            matches.append(
                IdentifyMatch(
                    email=record.email if record else None,
                    distance=_get_distance(row),
                    threshold=float(row.get("threshold", 0.0)),
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
