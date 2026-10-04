from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_key: str = "changeme"
    # Separate key for the backoffice; empty disables the /admin endpoints
    admin_api_key: str = ""
    face_db_path: str = "./face_db"
    model_name: str = "VGG-Face"
    detector_backend: str = "opencv"
    distance_metric: str = "cosine"
    # Max distance (in distance_metric units) to accept a match; None uses DeepFace's default
    match_threshold: float | None = None
    # Max distance between a new enrollment photo and the person's existing photos.
    # Looser than match_threshold, but stops adding someone else's face to a person.
    enroll_max_distance: float = 0.50
    max_photos_per_person: int = 10
    cache_ttl: int = 300
    cache_maxsize: int = 256
    anti_spoofing: bool = False

    model_config = {"env_file": ".env"}

    @field_validator("match_threshold", mode="before")
    @classmethod
    def _empty_threshold_is_none(cls, value: object) -> object:
        # Allow "MATCH_THRESHOLD=" (empty) in .env to mean "use the default"
        return None if value == "" else value


settings = Settings()
