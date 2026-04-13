from pydantic import BaseModel


class IdentifyRequest(BaseModel):
    img: str


class IdentifyMatch(BaseModel):
    identity: str
    distance: float
    threshold: float


class IdentifyResponse(BaseModel):
    matches: list[IdentifyMatch]
    is_real: bool | None = None
    antispoof_score: float | None = None
