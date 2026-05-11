from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.serving.predictor import predict_for_you, predict_similar

router = APIRouter()


def _get_model():
    """Access the globally loaded model from main module."""
    import main

    if main.loaded_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return main.loaded_model


class ForYouRequest(BaseModel):
    userId: str
    interactionCount: int = 0
    recentlyPlayedIds: list[str] = []
    topTrackIds: list[str] = []
    n: int = 30


class MoreLikeRequest(BaseModel):
    videoId: str
    userId: Optional[str] = None
    excludeIds: list[str] = []
    n: int = 20


@router.post("/for-you")
async def for_you(req: ForYouRequest):
    model = _get_model()
    results = predict_for_you(
        model=model,
        user_id=req.userId,
        interaction_count=req.interactionCount,
        recently_played_ids=req.recentlyPlayedIds,
        top_track_ids=req.topTrackIds,
        n=req.n,
    )
    return {"recommendations": results, "model": "ai_hybrid"}


@router.post("/more-like")
async def more_like(req: MoreLikeRequest):
    model = _get_model()
    results = predict_similar(
        model=model,
        video_id=req.videoId,
        n=req.n,
        exclude_ids=req.excludeIds if req.excludeIds else None,
    )
    return {"recommendations": results, "model": "ai_content"}
