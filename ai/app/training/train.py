import os
import pickle
from datetime import datetime

from app.config import settings
from app.data.loader import get_engine, load_interactions, load_tracks
from app.models.hybrid import HybridModel
from app.training.evaluate import evaluate_model


def train(output_path: str | None = None) -> tuple:
    engine = get_engine()
    output_path = output_path or settings.MODEL_PATH

    print(f"[{datetime.now()}] Loading interaction data...")
    interactions = load_interactions(engine)
    print(
        f"  -> {len(interactions):,} interactions from "
        f"{interactions['userId'].nunique():,} users"
    )
    print(f"  -> {interactions['videoId'].nunique():,} unique tracks")

    if len(interactions) < 10:
        print("  WARNING: Very few interactions. Model quality will be poor.")
        print("  -> Training on available data anyway.")

    print(f"[{datetime.now()}] Loading track features...")
    tracks = load_tracks(engine)
    print(f"  -> {len(tracks):,} tracks with features")

    print(f"[{datetime.now()}] Training collaborative filtering model...")
    model = HybridModel()

    if len(interactions) >= 3:
        model.cf.train(interactions)
    else:
        print("  -> Skipping CF (too few interactions)")

    print(f"[{datetime.now()}] Training content-based model...")
    if len(tracks) >= 2:
        model.cb.train(tracks)
    else:
        print("  -> Skipping content model (too few tracks)")

    print(f"[{datetime.now()}] Evaluating model quality...")
    metrics = evaluate_model(model, interactions)
    print(f"  -> Precision@10: {metrics['precision_at_10']:.4f}")
    print(f"  -> Recall@10:    {metrics['recall_at_10']:.4f}")
    print(f"  -> NDCG@10:      {metrics['ndcg_at_10']:.4f}")
    print(f"  -> Users evaluated: {metrics['total_users_evaluated']}")

    print(f"[{datetime.now()}] Saving model to {output_path}...")
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        pickle.dump(model, f)

    print(f"[{datetime.now()}] Training complete.")
    return model, metrics


if __name__ == "__main__":
    train()
