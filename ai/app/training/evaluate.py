import numpy as np
import pandas as pd
from app.models.hybrid import HybridModel


def evaluate_model(model: HybridModel, interactions: pd.DataFrame) -> dict:
    """
    Evaluate using leave-one-out cross validation.
    For each user with enough history, hold out the most recent interaction
    and check if the model recommends it in the top 10.
    """
    if interactions.empty:
        return {
            "precision_at_10": 0.0,
            "recall_at_10": 0.0,
            "ndcg_at_10": 0.0,
            "total_users_evaluated": 0,
        }

    interactions_sorted = interactions.sort_values("playedAt")

    user_counts = interactions_sorted.groupby("userId").size()
    eligible_users = user_counts[user_counts >= 3].index
    eligible = interactions_sorted[interactions_sorted["userId"].isin(eligible_users)]

    if eligible.empty:
        return {
            "precision_at_10": 0.0,
            "recall_at_10": 0.0,
            "ndcg_at_10": 0.0,
            "total_users_evaluated": 0,
        }

    test_set = eligible.groupby("userId").last().reset_index()
    train_set = (
        eligible.groupby("userId")
        .apply(lambda x: x.iloc[:-1], include_groups=False)
        .reset_index(drop=True)
    )

    if train_set.empty:
        return {
            "precision_at_10": 0.0,
            "recall_at_10": 0.0,
            "ndcg_at_10": 0.0,
            "total_users_evaluated": 0,
        }

    eval_model = HybridModel()
    try:
        eval_model.cf.train(train_set)
    except Exception:
        return {
            "precision_at_10": 0.0,
            "recall_at_10": 0.0,
            "ndcg_at_10": 0.0,
            "total_users_evaluated": 0,
        }

    hits_at_10 = 0
    ndcg_scores: list[float] = []
    total = 0

    for _, row in test_set.iterrows():
        user_id = row["userId"]
        held_out = row["videoId"]

        recs = eval_model.cf.recommend(user_id, n=10)
        rec_ids = [vid for vid, _ in recs]

        if held_out in rec_ids:
            hits_at_10 += 1
            rank = rec_ids.index(held_out) + 1
            ndcg_scores.append(1.0 / np.log2(rank + 1))
        else:
            ndcg_scores.append(0.0)

        total += 1

    if total == 0:
        return {
            "precision_at_10": 0.0,
            "recall_at_10": 0.0,
            "ndcg_at_10": 0.0,
            "total_users_evaluated": 0,
        }

    return {
        "precision_at_10": round(hits_at_10 / total, 6),
        "recall_at_10": round(hits_at_10 / total, 6),
        "ndcg_at_10": round(float(np.mean(ndcg_scores)), 6),
        "total_users_evaluated": total,
    }
