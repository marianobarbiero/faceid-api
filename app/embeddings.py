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
    photo_id: int | None  # None for the photo taken at /register
    vector: np.ndarray  # raw embedding (needed for plain euclidean)
    unit: np.ndarray  # L2-normalized embedding (cosine / euclidean_l2)


@dataclass
class SearchResult:
    registration_id: int
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
    """In-memory index of every enrollment photo; a person may have several."""

    def __init__(self) -> None:
        self._entries: list[EmbeddingEntry] = []

    def load(self, db: Session) -> None:
        from app.db.models import FacePhoto, FaceRegistration

        records = db.query(FaceRegistration).filter(FaceRegistration.is_active == True).all()
        emails = {r.id: r.email for r in records}
        self._entries = [_entry(r.id, r.email, r.embedding) for r in records if r.embedding]
        photos = db.query(FacePhoto).filter(FacePhoto.registration_id.in_(emails)).all() if emails else []
        self._entries += [
            _entry(p.registration_id, emails[p.registration_id], p.embedding, p.id) for p in photos if p.embedding
        ]

    def add(self, registration_id: int, email: str | None, embedding: list, photo_id: int | None = None) -> None:
        self._entries.append(_entry(registration_id, email, embedding, photo_id))

    def remove(self, registration_id: int) -> int:
        """Forget every photo of a person; returns how many entries were removed."""
        before = len(self._entries)
        self._entries = [e for e in self._entries if e.registration_id != registration_id]
        return before - len(self._entries)

    def distance_to_person(self, query_embedding: list, registration_id: int, distance_metric: str) -> float | None:
        """Closest distance between the query and any photo of the given person."""
        entries = [e for e in self._entries if e.registration_id == registration_id]
        if not entries:
            return None
        return float(_distances(entries, np.array(query_embedding, dtype=np.float32), distance_metric).min())

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

        # Each person is represented by their closest photo
        closest: dict[int, tuple[float, EmbeddingEntry]] = {}
        for entry, dist in zip(self._entries, distances.tolist()):
            current = closest.get(entry.registration_id)
            if current is None or dist < current[0]:
                closest[entry.registration_id] = (dist, entry)
        ranked = sorted(closest.values(), key=lambda item: item[0])

        best_dist, best_entry = ranked[0]
        second_dist = ranked[1][0] if len(ranked) > 1 else None
        # Logged for every search so the threshold (and a future margin rule) can be calibrated
        logger.info(
            "identify best match: id=%s photo=%s distance=%.4f second=%s threshold=%.4f metric=%s matched=%s",
            best_entry.registration_id,
            best_entry.photo_id or "main",
            best_dist,
            f"{second_dist:.4f}" if second_dist is not None else "-",
            threshold,
            distance_metric,
            best_dist <= threshold,
        )

        # Score is reported as 1 - distance (higher is better; match iff score >= threshold)
        score_threshold = round(1.0 - threshold, 6)
        return [
            SearchResult(
                registration_id=entry.registration_id,
                email=entry.email,
                score=round(1.0 - dist, 6),
                threshold=score_threshold,
            )
            for dist, entry in ranked
            if dist <= threshold
        ]


def _entry(registration_id: int, email: str | None, embedding: list, photo_id: int | None = None) -> EmbeddingEntry:
    vector = np.array(embedding, dtype=np.float32)
    return EmbeddingEntry(
        registration_id=registration_id, email=email, photo_id=photo_id, vector=vector, unit=_normalize(vector)
    )


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
