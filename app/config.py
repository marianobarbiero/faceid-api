from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_key: str = "changeme"
    face_db_path: str = "./face_db"
    model_name: str = "VGG-Face"
    detector_backend: str = "opencv"
    distance_metric: str = "cosine"
    cache_ttl: int = 300
    cache_maxsize: int = 256
    anti_spoofing: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
