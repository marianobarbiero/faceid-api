import base64
import io
import logging
import time

import numpy as np
from deepface import DeepFace
from PIL import Image
from sqlalchemy.orm import Session

from app.config import settings
from app.embeddings import embedding_store
from app.schemas.identify import IdentifyMatch, IdentifyResponse

logger = logging.getLogger(__name__)


def _b64_to_numpy(img: str) -> np.ndarray:
    if "," in img:
        img = img.split(",", 1)[1]
    image_bytes = base64.b64decode(img)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(pil_image)


def identify_face(img: str, db: Session) -> IdentifyResponse:
    t0 = time.perf_counter()

    img_array = _b64_to_numpy(img)
    t1 = time.perf_counter()

    representations = DeepFace.represent(
        img_path=img_array,
        model_name=settings.model_name,
        detector_backend=settings.detector_backend,
        align=True,
        enforce_detection=False,
    )
    t2 = time.perf_counter()

    if not representations:
        return IdentifyResponse(matches=[])

    query_embedding = representations[0]["embedding"]
    results = embedding_store.search(query_embedding, settings.model_name, settings.distance_metric)
    t3 = time.perf_counter()

    matches = [
        IdentifyMatch(email=r.email, distance=r.distance, threshold=r.threshold)
        for r in results
    ]

    logger.info(
        "identify timing — decode: %.0fms | represent: %.0fms | search: %.0fms | total: %.0fms",
        (t1 - t0) * 1000,
        (t2 - t1) * 1000,
        (t3 - t2) * 1000,
        (t3 - t0) * 1000,
    )

    return IdentifyResponse(matches=matches)
