<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Express-4-000000?logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

# Lyrix

A full-stack music streaming application built on top of the YouTube ecosystem. Lyrix wraps YouTube's vast music catalog in a clean, purpose-built player interface with playlists, play history, AI-powered recommendations, and zero ads.

> **Live:** [elyrix.vercel.app](https://elyrix.vercel.app)

---

## Features

- **Spotify-Inspired UI** — Full-width homepage with filter chips (All, Music, Podcasts), horizontal scrollable sections, album-art grids, and smooth Framer Motion animations.
- **Search & Play** — Search songs, artists, and podcasts. Multi-tier search (Innertube → Invidious → Piped → local DB) with zero YouTube API quota cost.
- **Queue Management** — Add to queue, reorder, auto-advance, auto-fill from "Similar Tracks" when the queue runs low.
- **Playlists** — Create, rename, reorder (drag-and-drop), and manage playlists with Spotify-style hero headers and cover art. YouTube sync (import/export) with quota-aware rate limiting.
- **Listening History** — Every play is tracked. View stats, top tracks, genre breakdown, and listening streaks.
- **AI Recommendations** — Hybrid recommendation engine combining collaborative filtering (ALS) and content-based similarity. Falls back to rule-based recommendations automatically.
- **Personalized Home** — Made For You, Trending Now, curated playlists, smart mixes, Popular Artists (with real artist thumbnails), and genre/podcast discovery. Content personalized by language preferences.
- **Multi-Language Support** — 37 languages supported (21 Indian regional + 16 international). Trending, recommendations, and mixes are all language-aware with round-robin interleaving.
- **Podcast Section** — Dedicated podcast discovery with curated categories, filtered by duration and content type.
- **Now Playing** — Full-screen view with dynamic background, marquee animation for track details, and 20+ "Similar Tracks" suggestions (language & genre matched, with fuzzy deduplication).
- **Smart Remix Filtering** — Automatically excludes remix/mashup content from homepage, trending, and recommendations (multi-layer filtering on client + server).
- **Music Download** — Download any track as audio for offline listening. Available from the mini player and now playing screen. Requires login — guests are prompted to sign in.
- **Mini Player** — Persistent mini player across all pages with progress bar, controls, and YouTube attribution.
- **Google Sign-In** — One-click login with Google OAuth 2.0. Guest mode fully supported — auth never blocks playback.
- **Mobile-First** — Bottom navigation bar, responsive layouts, and touch-friendly controls.
- **Session Persistence** — Resume playback where you left off across page reloads.
- **Network Awareness** — Detects offline/slow connections and shows appropriate banners.
- **Production Hardened** — Security headers (Helmet + CSP), rate limiting, quota management with hourly budgets and alerting, Redis reconnection resilience, cache warming, and request deduplication.

---

## Supported Languages

Users select preferred languages on first launch. All recommendations, trending, and mixes adapt accordingly.

**Indian Regional (21):** Hindi, Punjabi, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati, Odia, Assamese, Urdu, Bhojpuri, Haryanvi, Rajasthani, Maithili, Konkani, Dogri, Sindhi, Kashmiri, Chhattisgarhi

**International (16):** English, Korean, Spanish, French, German, Portuguese, Italian, Arabic, Japanese, Chinese, Turkish, Russian, Thai, Indonesian, Vietnamese, Filipino, Swahili

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, Zustand, Framer Motion, dnd-kit |
| **Backend** | Node.js, Express 4, TypeScript 5 |
| **AI Service** | Python 3.11, FastAPI, scikit-learn, implicit (ALS) |
| **Database** | MySQL 8+ (TiDB Cloud), Prisma ORM |
| **Cache** | Redis (Upstash) |
| **Playback** | YouTube IFrame Player API |
| **Discovery** | Innertube, Invidious, Piped (quota-free), YouTube Data API v3 (fallback), Artist Thumbnails API |
| **Auth** | Google OAuth 2.0, JWT (HttpOnly cookies) |
| **Observability** | Sentry (errors), PostHog (analytics), Web Vitals reporting |
| **Security** | Helmet, CSP, rate limiting, input validation |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Node.js API    │────▶│  Python AI      │
│   Next.js    │     │   Express        │     │  FastAPI         │
│   Vercel     │     │   Render         │     │  Render          │
└─────────────┘     └──────┬───────────┘     └────────┬────────┘
                           │                          │
                    ┌──────▼──────────────────────────▼──────┐
                    │          Shared Infrastructure          │
                    │   MySQL (TiDB Cloud) + Redis (Upstash)  │
                    └─────────────────────────────────────────┘
```

The AI service is **optional**. If it's down or disabled, the backend falls back to rule-based recommendations automatically. Users never see a difference.

---

## Project Structure

```
lyrix/
├── backend/               Express API server
│   ├── prisma/            Schema & migrations
│   ├── src/
│   │   ├── config/        Environment configuration
│   │   ├── controllers/   Route handlers (search, playlists, auth)
│   │   ├── middleware/     Auth, rate limiting, error handling
│   │   ├── routes/        API route definitions (artist, playlists, etc.)
│   │   ├── services/      Business logic
│   │   │   ├── innertubeService.ts    Multi-tier YouTube search
│   │   │   ├── recommendationService.ts  Language-aware recommendations
│   │   │   ├── trendingService.ts     Round-robin multi-language trending
│   │   │   ├── mixService.ts          Smart mix generation (20+ tracks)
│   │   │   ├── downloadService.ts     Audio stream extraction (Invidious)
│   │   │   └── cacheService.ts        Redis caching with pattern delete
│   │   ├── scripts/       Batch jobs (cleanup, mixes, profiles)
│   │   └── utils/         Shared validators and helpers
│   └── package.json
├── frontend/              Next.js application
│   ├── public/            Static assets (logo, favicon)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/           SiteHeader (Spotify-style navbar)
│   │   │   ├── player/           MiniPlayer, NowPlayingMoreLike
│   │   │   ├── playlist/         PlaylistGrid, PlaylistCard, PlaylistDetail
│   │   │   ├── recommendations/  ForYou, Trending, Curated, Podcasts, Artists
│   │   │   ├── search/           SearchPage, TrackCard
│   │   │   └── auth/             AuthProvider, UserAvatar
│   │   ├── config/        Language configuration (37 languages)
│   │   ├── hooks/         Custom React hooks (usePlayer, useDownload, etc.)
│   │   ├── pages/         Next.js pages (home, now-playing, playlists, preferences)
│   │   ├── services/      API clients and telemetry
│   │   ├── store/         Zustand global state
│   │   ├── styles/        Global CSS & Tailwind v4
│   │   └── utils/         Shared utilities
│   └── package.json
├── ai/                    Python AI recommendation service
│   ├── app/
│   │   ├── models/        ML models (collaborative, content, hybrid)
│   │   ├── data/          Database loaders
│   │   ├── training/      Training pipeline & evaluation
│   │   ├── serving/       Prediction & caching
│   │   └── routes/        FastAPI endpoints
│   ├── main.py            FastAPI entry point
│   ├── Dockerfile
│   └── requirements.txt
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js 20 LTS**
- **Python 3.11** (for AI service, optional)
- [YouTube Data API key](https://console.cloud.google.com/)
- [Google OAuth 2.0 client](https://console.cloud.google.com/apis/credentials)
- MySQL database ([TiDB Cloud](https://tidbcloud.com/) free tier works)
- Redis instance ([Upstash](https://upstash.com/) free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/aryanjsx/Lyrix.git
cd Lyrix

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

**Backend** — create `backend/.env`:

```env
PORT=4000
YOUTUBE_API_KEY=your_youtube_api_key
DATABASE_URL="mysql://user:password@host:port/lyrix?sslaccept=strict"
REDIS_URL=rediss://default:token@host:6379
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/callback
JWT_SECRET=<generate-64-byte-hex>
JWT_EXPIRES_IN=7d
COOKIE_SECRET=<generate-64-byte-hex>

SENTRY_DSN=your_sentry_dsn
POSTHOG_API_KEY=your_posthog_key
POSTHOG_HOST=https://us.i.posthog.com

# AI service (optional)
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT_MS=800
AI_SERVICE_ENABLED=false
SHADOW_MODE=false
AB_TEST_PERCENTAGE=0
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Frontend** — create `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**AI Service** (optional) — create `ai/.env`:

```env
DATABASE_URL=mysql+pymysql://user:pass@host:port/lyrix?ssl_verify_cert=true
REDIS_URL=rediss://default:token@host:6379
SENTRY_DSN=your_sentry_dsn
MODEL_PATH=./models/hybrid_model.pkl
PORT=8000
```

### 3. Set Up Database

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — AI service (optional)
cd ai && pip install -r requirements.txt
python -m app.training.train    # train model
uvicorn main:app --reload       # start service
```

Open [http://localhost:3000](http://localhost:3000) to start using Lyrix.

---

## API Reference

### Public

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check (status indicators only) |
| `GET` | `/api/search?q={query}` | Search tracks (cached, multi-tier) |
| `GET` | `/api/track/:videoId` | Get track metadata |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/google` | Initiate Google OAuth flow |
| `GET` | `/api/auth/callback` | OAuth callback handler |
| `GET` | `/api/auth/me` | Get current user profile |
| `GET` | `/api/auth/logout` | Clear session |

### History & Stats (auth required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/history/log` | Record a play event |
| `PATCH` | `/api/history/update` | Update seconds played |
| `GET` | `/api/stats` | Listening stats, genres, top tracks |
| `POST` | `/api/stats/rebuild` | Rebuild user profile (1/hour) |

### Playlists (auth required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/playlists` | List all playlists |
| `POST` | `/api/playlists` | Create a playlist |
| `GET` | `/api/playlists/:id` | Get playlist with tracks |
| `PATCH` | `/api/playlists/:id` | Update playlist |
| `DELETE` | `/api/playlists/:id` | Delete a playlist |
| `POST` | `/api/playlists/:id/tracks` | Add track to playlist |
| `DELETE` | `/api/playlists/:id/tracks/:trackId` | Remove track |
| `PATCH` | `/api/playlists/:id/tracks/reorder` | Reorder tracks |

### Download (auth required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/download/:videoId` | Download track audio (rate limited: 15/hr) |

### Saved Tracks (auth required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/saved` | List saved tracks |
| `POST` | `/api/saved` | Save a track |
| `DELETE` | `/api/saved/:videoId` | Unsave a track |

### Recommendations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/recommendations/trending` | Trending tracks (multi-language interleaved) |
| `GET` | `/api/recommendations/for-you` | Personalized feed (auth) |
| `GET` | `/api/recommendations/mixes` | Smart mixes (auth, 20+ tracks each) |
| `GET` | `/api/recommendations/recently-played` | Recent history (auth) |
| `GET` | `/api/recommendations/discover` | Discover by genre |
| `GET` | `/api/recommendations/more-like/:videoId` | Similar tracks (language/genre matched) |
| `POST` | `/api/recommendations/feedback` | Log recommendation feedback (auth) |
| `GET` | `/api/artist/thumbnail?name={name}` | Artist profile thumbnail |

### Admin (requires `x-admin-key` header)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/quota` | YouTube API quota, sync ops, cache stats |
| `POST` | `/admin/quota/reset` | Reset quota counter |

### AI Service (internal)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health + model status |
| `POST` | `/recommend/for-you` | AI personalized recommendations |
| `POST` | `/recommend/more-like` | AI similar tracks |
| `GET` | `/model/status` | Model details (users, tracks, version) |
| `GET` | `/model/metrics` | A/B test quality metrics |
| `POST` | `/model/train?secret=...` | Trigger model retraining |

---

## AI Recommendation Engine

Lyrix uses a hybrid ML recommendation system that combines two approaches:

- **Collaborative Filtering** (ALS via `implicit`) — "Users similar to you also listened to..." Builds a user-item interaction matrix from play history and finds latent factors.
- **Content-Based Filtering** (cosine similarity via `scikit-learn`) — "Tracks similar to what you play..." Uses genre tags, duration, category, and quality scores as features.

The hybrid model weights collaborative filtering at 65% and content-based at 35%. For new users with fewer than 5 interactions, it falls back to content-based only (cold start handling).

**Rollout strategy:**
1. Shadow mode — AI runs in parallel, results logged but not shown
2. A/B test at 20% — compare engagement metrics (play rate, completion rate, save rate)
3. Gradual increase to 100% only after quality is confirmed

---

## Security

- YouTube API key is **server-side only** — never exposed to the browser
- JWT authentication with **HttpOnly cookies** (`Secure` + `SameSite` in production)
- JWT secret validated at startup — app refuses to start in production without `JWT_SECRET`
- JWT verification pinned to `HS256` algorithm
- CSRF protection on OAuth via `state` parameter + `crypto.timingSafeEqual`
- OAuth tokens delivered exclusively via HttpOnly cookies (never in redirect URLs)
- Admin endpoints require authenticated session + server-side API key
- CORS restricted to configured origins
- Rate limiting: search (30/min), auth (10/min), download (15/hr), sync (5/hr), feedback (20/hr), global (100/min)
- Security headers via Helmet: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- Health endpoint exposes only status indicators (no internal details)
- Sentry session replay masks all text and blocks media by default
- Request body size capped at 256KB
- Input validation on all endpoints
- Hourly quota budgets prevent API exhaustion before peak hours
- Quota alerts at 70%, 85%, and 95% thresholds
- All `.env` files are gitignored
- AI model files (`.pkl`) are gitignored

---

## Deployment

### Backend (Render)

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |
| `GOOGLE_REDIRECT_URI` | `https://your-backend.onrender.com/api/auth/callback` |
| `AI_SERVICE_URL` | `https://your-ai-service.onrender.com` |

### Frontend (Vercel)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |

### AI Service (Render — Docker)

| Setting | Value |
|---|---|
| Root Directory | `ai` |
| Language | Docker |
| Health Check | `/health` |

After deploy, train the model:
```javascript
fetch("https://your-ai.onrender.com/model/train?secret=lyrix-train-2026", { method: "POST" })
```

---

## Scripts

```bash
# Backend batch jobs (run via cron or manually)
cd backend
npx ts-node src/scripts/cleanup.ts          # Remove expired cache & old data
npx ts-node src/scripts/generateMixes.ts    # Generate smart mixes for active users
npx ts-node src/scripts/rebuildProfiles.ts  # Rebuild genre/artist profiles
npx ts-node src/scripts/processFeedback.ts  # Process user feedback logs

# AI model training
cd ai
python -m app.training.train                # Train and save model
```

---

## License

This project is open source under the [MIT License](LICENSE).
