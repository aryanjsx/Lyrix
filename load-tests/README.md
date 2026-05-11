# Load Tests

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

## Run order before any production deploy

1. `npm run load:smoke` — must pass, zero failures
2. `npm run load:baseline` — performance KPIs must be green
3. `npm run load:quota` (staging) — quota protection must not 500

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Smoke | `npm run load:smoke` | Pre-deploy fast check (<60s) |
| Baseline | `npm run load:baseline` | Normal load, KPI thresholds |
| Quota Stress | `npm run load:quota` | Verifies graceful quota handling |
| Staging | `npm run load:staging` | Baseline against staging URL |

## KPI targets (will cause test failure if missed)

- Home API p95 < 1s
- Search API p95 < 2s
- Error rate < 1%
- Health check always < 200ms
