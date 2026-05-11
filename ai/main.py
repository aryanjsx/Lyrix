import logging
import os
import pickle
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routes import recommend, model as model_routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.ENVIRONMENT)

loaded_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global loaded_model
    model_path = settings.MODEL_PATH

    if os.path.exists(model_path):
        logger.info(f"Loading model from {model_path}...")
        with open(model_path, "rb") as f:
            loaded_model = pickle.load(f)
        logger.info(
            f"Model loaded. CF users: {len(loaded_model.cf.user_id_map)}, "
            f"CB tracks: {len(loaded_model.cb.track_id_to_idx)}"
        )
    else:
        logger.warning(f"No model found at {model_path}. AI recommendations disabled.")
        logger.warning("Run: python -m app.training.train")

    yield

    loaded_model = None


app = FastAPI(
    title="Lyrix AI Service",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(recommend.router, prefix="/recommend")
app.include_router(model_routes.router, prefix="/model")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": loaded_model is not None,
        "model_version": getattr(loaded_model, "version", None),
    }
