from typing import Any, Optional

from cachetools import TTLCache

from app.cache.base import CacheBackend
from app.config import settings


class MemoryCacheBackend(CacheBackend):
    def __init__(self) -> None:
        self._cache: TTLCache = TTLCache(
            maxsize=settings.cache_maxsize,
            ttl=settings.cache_ttl,
        )

    def get(self, key: str) -> Optional[Any]:
        return self._cache.get(key)

    def set(self, key: str, value: Any) -> None:
        self._cache[key] = value

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)


cache: CacheBackend = MemoryCacheBackend()
