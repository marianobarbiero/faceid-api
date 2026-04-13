import os

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.api.routes import analyze, detect, identify, register, verify
from app.config import settings
from app.db.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    # Create DB tables
    Base.metadata.create_all(bind=engine)

    # Create face DB directory if missing
    os.makedirs(settings.face_db_path, exist_ok=True)

    # Warm up DeepFace models
    from deepface import DeepFace
    import numpy as np

    dummy = np.zeros((100, 100, 3), dtype=np.uint8)
    try:
        DeepFace.extract_faces(
            img_path=dummy,
            detector_backend=settings.detector_backend,
            enforce_detection=False,
        )
    except Exception:
        pass

    yield


app = FastAPI(
    title="deepface-api",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(register.router)
app.include_router(verify.router)
app.include_router(identify.router)
app.include_router(analyze.router)
app.include_router(detect.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
