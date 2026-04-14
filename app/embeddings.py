from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


@dataclass
class EmbeddingEntry:
    registration_id: int
    email: str | None
    vector: np.ndarray  # pre-normalized


@dataclass
class SearchResult:
    email: str | None
    score: float
    threshold: float


def _normalize(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v)
    return v / norm if norm > 0 else v


def _get_threshold(model_name: str, distance_metric: str) -> float:
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
            EmbeddingEntry(
                registration_id=r.id,
                email=r.email,
                vector=_normalize(np.array(r.embedding, dtype=np.float32)),
            )
            for r in records
            if r.embedding
        ]

    def add(self, registration_id: int, email: str | None, embedding: list) -> None:
        self._entries.append(
            EmbeddingEntry(
                registration_id=registration_id,
                email=email,
                vector=_normalize(np.array(embedding, dtype=np.float32)),
            )
        )

    def search(self, query_embedding: list, model_name: str, distance_metric: str) -> list[SearchResult]:
        if not self._entries:
            return []

        threshold = _get_threshold(model_name, distance_metric)
        query = _normalize(np.array(query_embedding, dtype=np.float32))

        matrix = np.stack([e.vector for e in self._entries])  # (N, D)
        distances = 1.0 - (matrix @ query)  # cosine distance, vectorized

        score_threshold = round(1.0 - threshold, 6)

        results = []
        for i, dist in enumerate(distances):
            if float(dist) <= threshold:
                results.append(
                    SearchResult(
                        email=self._entries[i].email,
                        score=round(1.0 - float(dist), 6),
                        threshold=score_threshold,
                    )
                )

        results.sort(key=lambda r: r.score, reverse=True)
        return results


embedding_store = EmbeddingStore()
