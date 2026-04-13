from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    img: str
    actions: list[str] = ["age", "gender", "emotion", "race"]


class FaceRegion(BaseModel):
    x: int
    y: int
    w: int
    h: int


class FaceAnalysis(BaseModel):
    age: int | None = None
    dominant_gender: str | None = None
    gender: dict | None = None
    dominant_emotion: str | None = None
    emotion: dict | None = None
    dominant_race: str | None = None
    race: dict | None = None
    region: FaceRegion
    is_real: bool | None = None
    antispoof_score: float | None = None


class AnalyzeResponse(BaseModel):
    faces: list[FaceAnalysis]
