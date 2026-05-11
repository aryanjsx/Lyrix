import json
import logging
from typing import Optional

import redis as redis_lib
from app.config import settings

logger = logging.getLogger(__name__)

_redis: Optional[redis_lib.Redis] = None


def get_redis() -> Optional[redis_lib.Redis]:
    global _redis
    if _redis is not None:
        return _redis
    if not settings.REDIS_URL:
        return None
    try:
        _redis = redis_lib.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        _redis.ping()
        return _redis
    except Exception as e:
        logger.warning(f"[Redis] Connection failed: {e}")
        _redis = None
        return None


def cache_get(key: str) -> Optional[dict]:
    r = get_redis()
    if r is None:
        return None
    try:
        val = r.get(key)
        if val:
            return json.loads(val)
    except Exception as e:
        logger.warning(f"[Redis] GET error: {e}")
    return None


def cache_set(key: str, value: dict, ttl_seconds: int = 3600) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl_seconds, json.dumps(value))
    except Exception as e:
        logger.warning(f"[Redis] SET error: {e}")
