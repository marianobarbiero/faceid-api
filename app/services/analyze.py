from deepface import DeepFace

from app.config import settings
from app.schemas.analyze import AnalyzeResponse, FaceAnalysis, FaceRegion


def analyze_faces(img: str, actions: list[str]) -> AnalyzeResponse:
    results = DeepFace.analyze(
        img_path=img,
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
        is_real: bool | None = None
        antispoof_score: float | None = None

        if settings.anti_spoofing:
            is_real = face.get("is_real")
            antispoof_score = face.get("antispoof_score")

        faces.append(
            FaceAnalysis(
                age=face.get("age"),
                dominant_gender=face.get("dominant_gender"),
                gender=face.get("gender"),
                dominant_emotion=face.get("dominant_emotion"),
                emotion=face.get("emotion"),
                dominant_race=face.get("dominant_race"),
                race=face.get("race"),
                region=FaceRegion(
                    x=region.get("x", 0),
                    y=region.get("y", 0),
                    w=region.get("w", 0),
                    h=region.get("h", 0),
                ),
                is_real=is_real,
                antispoof_score=antispoof_score,
            )
        )

    return AnalyzeResponse(faces=faces)
