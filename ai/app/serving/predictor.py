import logging
from typing import Optional

from app.models.hybrid import HybridModel
from app.serving.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

RECO_TTL = 7200  # 2 hours
SIMILAR_TTL = 3600  # 1 hour


def predict_for_you(
    model: HybridModel,
    user_id: str,
    interaction_count: int,
    recently_played_ids: list[str],
    top_track_ids: list[str],
    n: int = 30,
) -> list[dict]:
    """Get personalized recommendations, with Redis caching."""
    cache_key = f"ai:foryou:{user_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached.get("recommendations", [])

    results = model.recommend_for_user(
        user_id=user_id,
        user_interaction_count=interaction_count,
        recently_played_ids=recently_played_ids,
        top_track_ids=top_track_ids,
        n=n,
    )

    if results:
        cache_set(cache_key, {"recommendations": results}, RECO_TTL)

    return results


def predict_similar(
    model: HybridModel,
    video_id: str,
    n: int = 20,
    exclude_ids: Optional[list[str]] = None,
) -> list[dict]:
    """Get similar track recommendations, with Redis caching."""
    cache_key = f"ai:similar:{video_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached.get("recommendations", [])

    results = model.recommend_similar(
        video_id=video_id,
        n=n,
        exclude_ids=exclude_ids,
    )

    if results:
        cache_set(cache_key, {"recommendations": results}, SIMILAR_TTL)

    return results
