from deepface import DeepFace

from app.config import settings
from app.schemas.detect import DetectResponse, DetectedFace, FacialArea


def detect_faces(img: str) -> DetectResponse:
    results = DeepFace.extract_faces(
        img_path=img,
        detector_backend=settings.detector_backend,
        align=True,
        enforce_detection=False,
        anti_spoofing=settings.anti_spoofing,
    )

    faces: list[DetectedFace] = []
    for face in results:
        area = face.get("facial_area", {})
        is_real: bool | None = None
        antispoof_score: float | None = None

        if settings.anti_spoofing:
            is_real = face.get("is_real")
            antispoof_score = face.get("antispoof_score")

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
                confidence=face.get("confidence", 0.0),
                is_real=is_real,
                antispoof_score=antispoof_score,
            )
        )

    return DetectResponse(faces=faces)
