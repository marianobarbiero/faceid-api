import base64
import io

import numpy as np
from deepface import DeepFace
from PIL import Image

from app.config import settings
from app.schemas.analyze import AnalyzeResponse, FaceAnalysis, FaceRegion


def _b64_to_numpy(img: str) -> np.ndarray:
    if "," in img:
        img = img.split(",", 1)[1]
    image_bytes = base64.b64decode(img)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(pil_image)


def _float_dict(d: dict | None) -> dict | None:
    if d is None:
        return None
    return {k: float(v) for k, v in d.items()}


def analyze_faces(img: str, actions: list[str]) -> AnalyzeResponse:
    results = DeepFace.analyze(
        img_path=_b64_to_numpy(img),
        actions=actions,
        detector_backend=settings.detector_backend,
        align=True,
        enforce_detection=False,
        silent=True,
        anti_spoofing=settings.anti_spoofing,
    )

    faces: list[FaceAnalysis] = []
    for face in results:
        region = face.get("region", {})
        faces.append(
            FaceAnalysis(
                age=int(face["age"]) if face.get("age") is not None else None,
                dominant_gender=face.get("dominant_gender"),
                gender=_float_dict(face.get("gender")),
                dominant_emotion=face.get("dominant_emotion"),
                emotion=_float_dict(face.get("emotion")),
                dominant_race=face.get("dominant_race"),
                race=_float_dict(face.get("race")),
                region=FaceRegion(
                    x=int(region.get("x", 0)),
                    y=int(region.get("y", 0)),
                    w=int(region.get("w", 0)),
                    h=int(region.get("h", 0)),
                ),
            )
        )

    return AnalyzeResponse(faces=faces)
