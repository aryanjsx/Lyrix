import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta
from app.config import settings


def get_engine():
    return create_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


def load_interactions(engine=None, days: int = 180) -> pd.DataFrame:
    """
    Load play history with implicit feedback scores.
    Score = min(secondsPlayed / max(duration, 1), 1.0) * 5
    Minimum 30 seconds to count as a real interaction.
    """
    if engine is None:
        engine = get_engine()

    cutoff = datetime.now() - timedelta(days=days)
    query = text("""
        SELECT
            ph.userId,
            ph.trackId AS videoId,
            LEAST(ph.secondsPlayed / GREATEST(t.duration, 1), 1.0) * 5 AS score,
            ph.playedAt
        FROM PlayHistory ph
        JOIN Track t ON t.id = ph.trackId
        WHERE ph.playedAt >= :cutoff
          AND ph.secondsPlayed >= 30
          AND t.category = 'music'
        ORDER BY ph.playedAt DESC
    """)
    return pd.read_sql(query, engine, params={"cutoff": cutoff})


def load_tracks(engine=None) -> pd.DataFrame:
    """Load all cached tracks with their genre tags."""
    if engine is None:
        engine = get_engine()

    query = text("""
        SELECT
            t.id,
            t.channelId,
            t.duration,
            t.category,
            t.filterScore,
            GROUP_CONCAT(tg.genre) AS genres_str
        FROM Track t
        LEFT JOIN TrackGenre tg ON tg.trackId = t.id
        WHERE t.filterScore >= 60
        GROUP BY t.id, t.channelId, t.duration, t.category, t.filterScore
    """)
    df = pd.read_sql(query, engine)
    df["genres"] = df["genres_str"].apply(
        lambda x: x.split(",") if pd.notna(x) and x else ["other"]
    )
    return df


def load_user_top_tracks(engine, user_id: str, limit: int = 20) -> list[str]:
    """Get a user's most-played track IDs."""
    if engine is None:
        engine = get_engine()

    query = text("""
        SELECT trackId, COUNT(*) AS cnt
        FROM PlayHistory
        WHERE userId = :user_id AND secondsPlayed >= 30
        GROUP BY trackId
        ORDER BY cnt DESC
        LIMIT :limit
    """)
    df = pd.read_sql(query, engine, params={"user_id": user_id, "limit": limit})
    return df["trackId"].tolist()


def load_user_recent_tracks(engine, user_id: str, limit: int = 50) -> list[str]:
    """Get a user's recently played track IDs."""
    if engine is None:
        engine = get_engine()

    query = text("""
        SELECT DISTINCT trackId
        FROM PlayHistory
        WHERE userId = :user_id
        ORDER BY playedAt DESC
        LIMIT :limit
    """)
    df = pd.read_sql(query, engine, params={"user_id": user_id, "limit": limit})
    return df["trackId"].tolist()
