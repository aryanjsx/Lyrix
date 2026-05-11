#!/bin/bash
set -e

cd "$(dirname "$0")/.."
echo "[evaluate] Running model evaluation..."
python -c "
from app.data.loader import get_engine, load_interactions
from app.training.evaluate import evaluate_model
from app.models.hybrid import HybridModel
import pickle, os

model_path = os.environ.get('MODEL_PATH', './models/hybrid_model.pkl')
if not os.path.exists(model_path):
    print('No model found. Run train_model.sh first.')
    exit(1)

with open(model_path, 'rb') as f:
    model = pickle.load(f)

engine = get_engine()
interactions = load_interactions(engine)
metrics = evaluate_model(model, interactions)
print(f'Precision@10: {metrics[\"precision_at_10\"]:.4f}')
print(f'Recall@10:    {metrics[\"recall_at_10\"]:.4f}')
print(f'NDCG@10:      {metrics[\"ndcg_at_10\"]:.4f}')
print(f'Users eval:   {metrics[\"total_users_evaluated\"]}')
"
echo "[evaluate] Done."
