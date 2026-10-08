from pydantic import BaseModel


class InfoResponse(BaseModel):
    model_name: str
    detector_backend: str
    distance_metric: str
    match_threshold: float  # effective value: MATCH_THRESHOLD or DeepFace's default
    anti_spoofing: bool
