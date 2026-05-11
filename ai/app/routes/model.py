import os
import pickle
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

TRAIN_SECRET = os.getenv("TRAIN_SECRET", "lyrix-train-2026")


@router.get("/status")
async def model_status():
    import main

    model_exists = os.path.exists(settings.MODEL_PATH)
    model_size_mb = None
    if model_exists:
        model_size_mb = round(
            os.path.getsize(settings.MODEL_PATH) / (1024 * 1024), 2
        )

    return {
        "model_loaded": main.loaded_model is not None,
        "model_version": getattr(main.loaded_model, "version", None),
        "model_file_exists": model_exists,
        "model_size_mb": model_size_mb,
        "model_path": settings.MODEL_PATH,
        "cf_trained": (
            main.loaded_model.cf.is_trained
            if main.loaded_model
            else False
        ),
        "cb_trained": (
            main.loaded_model.cb.is_trained
            if main.loaded_model
            else False
        ),
        "cf_users": (
            len(main.loaded_model.cf.user_id_map)
            if main.loaded_model and main.loaded_model.cf.is_trained
            else 0
        ),
        "cf_tracks": (
            len(main.loaded_model.cf.track_id_map)
            if main.loaded_model and main.loaded_model.cf.is_trained
            else 0
        ),
        "cb_tracks": (
            len(main.loaded_model.cb.track_id_to_idx)
            if main.loaded_model and main.loaded_model.cb.is_trained
            else 0
        ),
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/train")
async def train_model(secret: str = Query(...)):
    """
    Trigger model training remotely.
    Usage: POST /model/train?secret=lyrix-train-2026
    """
    import hmac

    if not hmac.compare_digest(secret, TRAIN_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    import main
    from app.training.train import train

    logger.info("Training triggered via API...")
    try:
        model, metrics = train()
        main.loaded_model = model
        return {
            "status": "success",
            "metrics": metrics,
            "model_loaded": True,
        }
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def model_metrics():
    """
    Return recommendation quality metrics from the RecommendationFeedback table.
    Reads from the shared database to compare AI vs rule-based performance.
    """
    from app.data.loader import get_engine
    from sqlalchemy import text

    engine = get_engine()

    query = text("""
        SELECT
            source,
            COUNT(*) AS total,
            SUM(CASE WHEN action = 'played' THEN 1 ELSE 0 END) AS played,
            SUM(CASE WHEN action = 'saved' THEN 1 ELSE 0 END) AS saved,
            SUM(CASE WHEN action = 'skipped' THEN 1 ELSE 0 END) AS skipped,
            AVG(playedSeconds) AS avg_play_seconds
        FROM RecommendationFeedback
        WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY source
    """)

    try:
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()

        metrics = {}
        for row in rows:
            source = row["source"]
            total = row["total"] or 1
            metrics[source] = {
                "total_impressions": total,
                "play_rate": round((row["played"] or 0) / total, 4),
                "save_rate": round((row["saved"] or 0) / total, 4),
                "skip_rate": round((row["skipped"] or 0) / total, 4),
                "avg_play_seconds": round(float(row["avg_play_seconds"] or 0), 1),
            }

        return {"period": "last_7_days", "metrics_by_source": metrics}
    except Exception:
        return {
            "period": "last_7_days",
            "metrics_by_source": {},
            "note": "RecommendationFeedback table may not exist yet",
        }
