from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SUPPORTED_METRICS = ("cosine", "euclidean", "euclidean_l2")


@dataclass
class EmbeddingEntry:
    registration_id: int
    email: str | None
    vector: np.ndarray  # raw embedding (needed for plain euclidean)
    unit: np.ndarray  # L2-normalized embedding (cosine / euclidean_l2)


@dataclass
class SearchResult:
    email: str | None
    score: float
    threshold: float


def _normalize(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v)
    return v / norm if norm > 0 else v


def get_threshold(model_name: str, distance_metric: str, override: float | None = None) -> float:
    """Max distance for a match: MATCH_THRESHOLD if set, otherwise DeepFace's default."""
    if override is not None:
        return override
    try:
        from deepface.modules import verification
        return verification.find_threshold(model_name, distance_metric)
    except Exception:
        pass
    try:
        from deepface.commons import distance as dst
        return dst.findThreshold(model_name, distance_metric)
    except Exception:
        pass
    return 0.40


class EmbeddingStore:
    def __init__(self) -> None:
        self._entries: list[EmbeddingEntry] = []

    def load(self, db: Session) -> None:
        from app.db.models import FaceRegistration

        records = db.query(FaceRegistration).filter(FaceRegistration.is_active == True).all()
        self._entries = [
            _entry(r.id, r.email, r.embedding)
            for r in records
            if r.embedding
        ]

    def add(self, registration_id: int, email: str | None, embedding: list) -> None:
        self._entries.append(_entry(registration_id, email, embedding))

    def search(
        self,
        query_embedding: list,
        model_name: str,
        distance_metric: str,
        threshold_override: float | None = None,
    ) -> list[SearchResult]:
        if not self._entries:
            return []
        if distance_metric not in SUPPORTED_METRICS:
            raise ValueError(f"Unsupported distance metric: {distance_metric}")

        threshold = get_threshold(model_name, distance_metric, threshold_override)
        distances = _distances(self._entries, np.array(query_embedding, dtype=np.float32), distance_metric)

        best = int(np.argmin(distances))
        # Logged for every search so the threshold can be calibrated from real attempts
        logger.info(
            "identify best match: id=%s distance=%.4f threshold=%.4f metric=%s matched=%s",
            self._entries[best].registration_id,
            float(distances[best]),
            threshold,
            distance_metric,
            bool(distances[best] <= threshold),
        )

        # Score is reported as 1 - distance (higher is better; match iff score >= threshold)
        score_threshold = round(1.0 - threshold, 6)
        results = [
            SearchResult(
                email=self._entries[i].email,
                score=round(1.0 - float(dist), 6),
                threshold=score_threshold,
            )
            for i, dist in enumerate(distances)
            if float(dist) <= threshold
        ]
        results.sort(key=lambda r: r.score, reverse=True)
        return results


def _entry(registration_id: int, email: str | None, embedding: list) -> EmbeddingEntry:
    vector = np.array(embedding, dtype=np.float32)
    return EmbeddingEntry(registration_id=registration_id, email=email, vector=vector, unit=_normalize(vector))


def _distances(entries: list[EmbeddingEntry], query: np.ndarray, distance_metric: str) -> np.ndarray:
    """Vectorized distance from the query to every entry, matching DeepFace's definitions."""
    if distance_metric == "euclidean":
        return np.linalg.norm(np.stack([e.vector for e in entries]) - query, axis=1)
    units = np.stack([e.unit for e in entries])  # (N, D)
    query_unit = _normalize(query)
    if distance_metric == "euclidean_l2":
        return np.linalg.norm(units - query_unit, axis=1)
    return 1.0 - units @ query_unit  # cosine


embedding_store = EmbeddingStore()
