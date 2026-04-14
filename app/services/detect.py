import base64
import io

import numpy as np
from deepface import DeepFace
from PIL import Image

from app.config import settings
from app.schemas.detect import DetectResponse, DetectedFace, FacialArea


def _b64_to_numpy(img: str) -> np.ndarray:
    if "," in img:
        img = img.split(",", 1)[1]
    image_bytes = base64.b64decode(img)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(pil_image)


def detect_faces(img: str) -> DetectResponse:
    results = DeepFace.extract_faces(
        img_path=_b64_to_numpy(img),
        detector_backend=settings.detector_backend,
        align=True,
        enforce_detection=False,
        anti_spoofing=settings.anti_spoofing,
    )

    faces: list[DetectedFace] = []
    for face in results:
        area = face.get("facial_area", {})
        faces.append(
            DetectedFace(
                facial_area=FacialArea(
                    x=area.get("x", 0),
                    y=area.get("y", 0),
                    w=area.get("w", 0),
                    h=area.get("h", 0),
                    left_eye=area.get("left_eye"),
                    right_eye=area.get("right_eye"),
                ),
                confidence=float(face.get("confidence", 0.0)),
            )
        )

    return DetectResponse(faces=faces)
