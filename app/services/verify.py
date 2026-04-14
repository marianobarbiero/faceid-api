import base64
import io

import numpy as np
from deepface import DeepFace
from PIL import Image

from app.config import settings
from app.schemas.verify import VerifyResponse


def _b64_to_numpy(img: str) -> np.ndarray:
    if "," in img:
        img = img.split(",", 1)[1]
    image_bytes = base64.b64decode(img)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(pil_image)


def verify_faces(img1: str, img2: str) -> VerifyResponse:
    result = DeepFace.verify(
        img1_path=_b64_to_numpy(img1),
        img2_path=_b64_to_numpy(img2),
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        distance_metric=settings.distance_metric,
        align=True,
        enforce_detection=False,
        anti_spoofing=settings.anti_spoofing,
    )

    return VerifyResponse(
        verified=result["verified"],
        distance=result["distance"],
        threshold=result["threshold"],
        model=result["model"],
        distance_metric=result.get("distance_metric") or result.get("similarity_metric", settings.distance_metric),
        facial_areas=result["facial_areas"],
    )
