from pydantic import BaseModel


class IdentifyRequest(BaseModel):
    img: str


class IdentifyMatch(BaseModel):
    email: str | None
    score: float
    threshold: float


class IdentifyResponse(BaseModel):
    matches: list[IdentifyMatch]
    is_real: bool | None = None
    antispoof_score: float | None = None
