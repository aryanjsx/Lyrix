# BetterUptime Setup

## Monitors to Create

### 1. Backend API Health
- URL: `https://api.lyrix.app/health`
- Method: GET
- Check interval: 1 minute
- Alert if: status != 200 OR response time > 3s
- Alert contacts: [your email / Slack webhook]

### 2. Frontend (Vercel)
- URL: `https://lyrix.app`
- Method: GET
- Check interval: 1 minute

### 3. Search API
- URL: `https://api.lyrix.app/api/search?q=test`
- Method: GET
- Check interval: 5 minutes
- Verify: response contains `"results"` key

### 4. Playback Metadata
- URL: `https://api.lyrix.app/api/track/dQw4w9WgXcQ`
- Method: GET
- Check interval: 5 minutes

## Heartbeat (Cron Monitor)

In the backend, add a heartbeat ping for any scheduled jobs:

```typescript
import { pingHeartbeat } from "./utils/heartbeat";

// In cacheService.ts cleanup job or quota reset job:
await pingHeartbeat("CACHE_WARMER");
```

URL from BetterUptime > Heartbeats > New Heartbeat.

## Environment Variables to Add

```
BETTERUPTIME_HEARTBEAT_CACHE_WARMER=https://betteruptime.com/api/v1/heartbeat/xxx
```
