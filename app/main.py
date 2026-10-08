import logging
import os
import time

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

from app.api.routes import admin, analyze, detect, identify, info, register, verify
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
    t0 = time.perf_counter()
    try:
        DeepFace.represent(
            img_path=dummy,
            model_name=settings.model_name,
            detector_backend=settings.detector_backend,
            enforce_detection=False,
        )
    except Exception:
        pass
    t1 = time.perf_counter()

    # The age/gender/emotion/race models are otherwise loaded by the first /analyze,
    # which then takes 15-20 s; run one analysis now so the demo is fluid from the start
    if settings.warmup_analyze:
        try:
            DeepFace.analyze(
                img_path=dummy,
                actions=["age", "gender", "emotion", "race"],
                detector_backend=settings.detector_backend,
                enforce_detection=False,
                silent=True,
            )
        except Exception:
            pass
    logging.getLogger(__name__).info(
        "warm-up done — recognition: %.1fs | analysis: %.1fs",
        t1 - t0,
        time.perf_counter() - t1,
    )

    # Load embeddings into memory
    from app.db.database import SessionLocal
    from app.embeddings import embedding_store

    db = SessionLocal()
    try:
        embedding_store.load(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="deepface-api",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register.router)
app.include_router(verify.router)
app.include_router(identify.router)
app.include_router(analyze.router)
app.include_router(detect.router)
app.include_router(admin.router)
app.include_router(info.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
