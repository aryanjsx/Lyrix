import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:4000")
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    MODEL_PATH: str = os.getenv("MODEL_PATH", "./models/hybrid_model.pkl")
    MIN_INTERACTIONS_FOR_CF: int = int(os.getenv("MIN_INTERACTIONS_FOR_CF", "5"))
    AB_TEST_PERCENTAGE: int = int(os.getenv("AB_TEST_PERCENTAGE", "20"))
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")


settings = Settings()
