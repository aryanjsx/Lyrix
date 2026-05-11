import numpy as np
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer, MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity
from typing import Optional


class ContentBasedModel:

    def __init__(self):
        self.track_features: Optional[pd.DataFrame] = None
        self.feature_matrix: Optional[np.ndarray] = None
        self.track_id_to_idx: dict[str, int] = {}
        self.idx_to_track_id: dict[int, str] = {}
        self.genre_binarizer = MultiLabelBinarizer()
        self.scaler = MinMaxScaler()
        self.is_trained: bool = False

    def build_features(self, tracks: pd.DataFrame) -> np.ndarray:
        """
        tracks DataFrame columns:
          id, genres (list of strings), channelId, duration, category, filterScore
        """
        genre_matrix = self.genre_binarizer.fit_transform(tracks["genres"])

        duration_normalized = self.scaler.fit_transform(tracks[["duration"]])

        category = (tracks["category"] == "music").astype(float).values.reshape(-1, 1)

        score_normalized = tracks["filterScore"].values.reshape(-1, 1) / 100.0

        return np.hstack([
            genre_matrix,
            duration_normalized,
            category,
            score_normalized,
        ])

    def train(self, tracks: pd.DataFrame) -> None:
        self.track_features = tracks.reset_index(drop=True)
        self.feature_matrix = self.build_features(self.track_features)

        self.track_id_to_idx = {
            tid: i for i, tid in enumerate(self.track_features["id"])
        }
        self.idx_to_track_id = {i: tid for tid, i in self.track_id_to_idx.items()}
        self.is_trained = True

    def similar_to_track(
        self,
        video_id: str,
        n: int = 20,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[tuple[str, float]]:
        if (
            not self.is_trained
            or self.feature_matrix is None
            or video_id not in self.track_id_to_idx
        ):
            return []

        idx = self.track_id_to_idx[video_id]
        track_vector = self.feature_matrix[idx].reshape(1, -1)
        similarities = cosine_similarity(track_vector, self.feature_matrix)[0]

        exclude_set = set(exclude_ids or []) | {video_id}
        results: list[tuple[str, float]] = []

        for i in np.argsort(similarities)[::-1]:
            tid = self.idx_to_track_id[i]
            if tid not in exclude_set:
                results.append((tid, float(similarities[i])))
            if len(results) >= n:
                break

        return results

    def similar_to_profile(
        self,
        played_track_ids: list[str],
        n: int = 20,
        exclude_ids: Optional[list[str]] = None,
    ) -> list[tuple[str, float]]:
        """Build a user profile vector from their played tracks, find similar."""
        if not self.is_trained or self.feature_matrix is None:
            return []

        valid_idxs = [
            self.track_id_to_idx[tid]
            for tid in played_track_ids
            if tid in self.track_id_to_idx
        ]
        if not valid_idxs:
            return []

        profile_vector = self.feature_matrix[valid_idxs].mean(axis=0).reshape(1, -1)
        similarities = cosine_similarity(profile_vector, self.feature_matrix)[0]

        exclude_set = set(exclude_ids or []) | set(played_track_ids)
        results: list[tuple[str, float]] = []

        for i in np.argsort(similarities)[::-1]:
            tid = self.idx_to_track_id[i]
            if tid not in exclude_set:
                results.append((tid, float(similarities[i])))
            if len(results) >= n:
                break

        return results
