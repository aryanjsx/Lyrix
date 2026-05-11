#!/bin/bash
set -e

cd "$(dirname "$0")/.."
echo "[train] Starting model training pipeline..."
python -m app.training.train
echo "[train] Done."
