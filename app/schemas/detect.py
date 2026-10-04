from pydantic import BaseModel


class DetectRequest(BaseModel):
    img: str


class FacialArea(BaseModel):
    x: int
    y: int
    w: int
    h: int
    left_eye: tuple[int, int] | None = None
    right_eye: tuple[int, int] | None = None


class DetectedFace(BaseModel):
    facial_area: FacialArea
    confidence: float
    is_real: bool | None = None
    antispoof_score: float | None = None


class DetectResponse(BaseModel):
    faces: list[DetectedFace]
