import numpy as np
import pandas as pd
from implicit.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix
import pickle
from typing import Optional


class CollaborativeFilteringModel:

    def __init__(
        self,
        factors: int = 50,
        iterations: int = 20,
        regularization: float = 0.1,
    ):
        self.model = AlternatingLeastSquares(
            factors=factors,
            iterations=iterations,
            regularization=regularization,
            use_gpu=False,
        )
        self.user_id_map: dict[str, int] = {}
        self.track_id_map: dict[str, int] = {}
        self.reverse_track_map: dict[int, str] = {}
        self.user_item_matrix: Optional[csr_matrix] = None
        self.is_trained: bool = False

    def build_interaction_matrix(self, interactions: pd.DataFrame) -> csr_matrix:
        """
        interactions DataFrame columns: userId, videoId, score
        score = min(secondsPlayed / trackDuration, 1.0) * 5
        """
        users = interactions["userId"].unique()
        tracks = interactions["videoId"].unique()

        self.user_id_map = {uid: i for i, uid in enumerate(users)}
        self.track_id_map = {vid: i for i, vid in enumerate(tracks)}
        self.reverse_track_map = {i: vid for vid, i in self.track_id_map.items()}

        rows = interactions["userId"].map(self.user_id_map)
        cols = interactions["videoId"].map(self.track_id_map)
        data = interactions["score"].values.astype(np.float32)

        return csr_matrix(
            (data, (rows, cols)),
            shape=(len(users), len(tracks)),
        )

    def train(self, interactions: pd.DataFrame) -> None:
        self.user_item_matrix = self.build_interaction_matrix(interactions)
        self.model.fit(self.user_item_matrix)
        self.is_trained = True

    def recommend(
        self,
        user_id: str,
        n: int = 20,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[tuple[str, float]]:
        """Returns list of (videoId, score) tuples."""
        if not self.is_trained or self.user_item_matrix is None:
            return []

        if user_id not in self.user_id_map:
            return []

        user_idx = self.user_id_map[user_id]
        exclude_set = set(exclude_ids or [])

        item_ids, scores = self.model.recommend(
            user_idx,
            self.user_item_matrix[user_idx],
            N=n + len(exclude_set) + 10,
            filter_already_liked_items=True,
        )

        results: list[tuple[str, float]] = []
        for item_idx, score in zip(item_ids, scores):
            video_id = self.reverse_track_map.get(int(item_idx))
            if video_id and video_id not in exclude_set:
                results.append((video_id, float(score)))
            if len(results) >= n:
                break

        return results

    def save(self, path: str) -> None:
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: str) -> "CollaborativeFilteringModel":
        with open(path, "rb") as f:
            return pickle.load(f)
