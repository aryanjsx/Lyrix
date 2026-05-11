from typing import Optional
from .collaborative import CollaborativeFilteringModel
from .content import ContentBasedModel


class HybridModel:

    def __init__(
        self,
        cf_weight: float = 0.65,
        cb_weight: float = 0.35,
        min_cf_interactions: int = 5,
    ):
        self.cf = CollaborativeFilteringModel()
        self.cb = ContentBasedModel()
        self.cf_weight = cf_weight
        self.cb_weight = cb_weight
        self.min_cf_interactions = min_cf_interactions
        self.version = "1.0.0"

    def recommend_for_user(
        self,
        user_id: str,
        user_interaction_count: int,
        recently_played_ids: list[str],
        top_track_ids: list[str],
        n: int = 30,
    ) -> list[dict]:

        exclude_ids = recently_played_ids[:50]
        use_cf = user_interaction_count >= self.min_cf_interactions

        if use_cf:
            cf_results = dict(
                self.cf.recommend(user_id, n=50, exclude_ids=exclude_ids)
            )
            cb_results = dict(
                self.cb.similar_to_profile(
                    top_track_ids, n=50, exclude_ids=exclude_ids
                )
            )

            all_ids = set(cf_results) | set(cb_results)
            scores: dict[str, float] = {}
            for vid in all_ids:
                cf_score = cf_results.get(vid, 0.0) * self.cf_weight
                cb_score = cb_results.get(vid, 0.0) * self.cb_weight
                scores[vid] = cf_score + cb_score
        else:
            scores = dict(
                self.cb.similar_to_profile(
                    top_track_ids, n=50, exclude_ids=exclude_ids
                )
            )

        sorted_recs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        model_label = "ai_hybrid" if use_cf else "ai_content"
        return [
            {"videoId": vid, "score": score, "model": model_label}
            for vid, score in sorted_recs[:n]
        ]

    def recommend_similar(
        self,
        video_id: str,
        n: int = 20,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        results = self.cb.similar_to_track(
            video_id, n=n, exclude_ids=exclude_ids
        )
        return [
            {"videoId": vid, "score": score, "model": "ai_content"}
            for vid, score in results
        ]
