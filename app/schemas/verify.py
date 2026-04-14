from pydantic import BaseModel


class VerifyRequest(BaseModel):
    img1: str
    img2: str


class FacialArea(BaseModel):
    x: int
    y: int
    w: int
    h: int


class VerifyResponse(BaseModel):
    verified: bool
    distance: float
    threshold: float
    model: str
    distance_metric: str
    facial_areas: dict
