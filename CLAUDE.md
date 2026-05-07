# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Train Me Now is an AI-first self-learning platform. Users input a topic + duration, Gemini Flash designs a personalized curriculum, content is sourced from YouTube/Wikipedia/Dev.to/web scraping, and the LLM organizes it into modules with quizzes and client-side PDF certificate generation.

## Deployment Status — ALL LIVE (frontend auto-deploys; backend needs manual Render trigger)

| Layer | Service | Status |
|---|---|---|
| Frontend | Netlify — `trainmenow-app-616.netlify.app` | **LIVE** — auto-deploys via GitHub Actions |
| Backend API | Render — `trainmenow-api.onrender.com` | **LIVE** but needs manual redeploy |
| PostgreSQL | Neon (free serverless) | **LIVE** — tables via `prisma db push` |
| Redis + BullMQ | Upstash (free tier) | **LIVE** |

### Service Registry

| Service | Details |
|---|---|
| Frontend URL | `https://trainmenow-app-616.netlify.app` |
| Backend URL | `https://trainmenow-api.onrender.com` |
| Netlify site ID | `d8608965-4beb-48c7-bde9-3396f0376b2e` |
| Render service ID | `srv-d7t0j90sfn5c73ftb4p0` |
| GitHub | `https://github.com/nitinjog/trainmenow` (account: nitinjog, branch: master) |
| Neon DB | `ep-royal-lake-ap8nnvre.c-7.us-east-1.aws.neon.tech`, DB: `neondb` |
| Upstash Redis | `neat-mallard-115620.upstash.io:6379` (use `rediss://` TLS prefix) |

### ⚠️ FIRST ACTION NEXT SESSION

**Trigger a Render manual redeploy** — many backend commits are stacked since last deploy.

Go to `https://dashboard.render.com/web/srv-d7t0j90sfn5c73ftb4p0` → Manual Deploy → Deploy latest commit.

Before deploying, verify these env vars are set on the Render dashboard:

| Key | Value |
|---|---|
| `GEMINI_MODEL` | `gemini-flash-latest` |
| `GEMINI_API_KEY` | Current (non-revoked) key |
| `OPENROUTER_API_KEY` | The OpenRouter key provided 2026-05-07 |
| `OPENROUTER_MODEL` | `google/gemini-2.0-flash-001` (optional, this is the code default) |
| `YOUTUBE_API_KEY` | Google Cloud YouTube Data API v3 key (optional — skipped if not set) |

The Render redeploy will automatically run `prisma db push` which adds the new `failure_reason` column to `learning_journeys`.

### Pending Polish Items

- Revert `errorHandler.ts` to hide raw error messages in production: `res.status(500).json({ error: 'Internal server error' })` instead of `err.message`

### Features Shipped (2026-05-07 session)

- **OpenRouter fallback**: `geminiService.ts` falls back to OpenRouter API when Gemini returns 429. Controlled by `OPENROUTER_API_KEY` env var. Default OpenRouter model: `google/gemini-2.0-flash-001`.
- **Content pipeline rewrite**: `scraperEngine.ts` now queries YouTube Data API v3, Wikipedia API, and Dev.to API for real verified resource URLs. `organizeContent` Gemini prompt passes the real resource list and forbids hallucinating URLs — fixing broken links.
- **YouTube duration filtering**: `videos?part=contentDetails` batch call fetches ISO 8601 durations; filters by course length caps (20/30/45/60 min). `videoDuration` flows through to module resource JSON and is displayed as overlay on thumbnails.
- **LearnPage resources**: YouTube thumbnails with duration overlay, type badges (video/article/reference), card-style layout.
- **Curriculum failure reason**: `LearningJourney.failureReason` field stores the actual error message on failure. `GET /curriculum/:id/modules` returns it. LearnPage shows rate-limit vs generic message based on it.
- **organizeContent token limit**: Raised from 4000 → 8192 `maxOutputTokens` (4000 was too low for 4–8 modules with detailed content, causing JSON truncation).
- **Dashboard — delete learning paths**: `DELETE /api/v1/curriculum/:id` cascades all related records. Dashboard shows trash icon + two-step confirm on failed/stuck cards (`failed`, `scraping_queued`, `awaiting_followup`). Failed cards have dashed border + destructive badge.
- **Dashboard — deduplicate certificates**: Frontend deduplicates by module title (keep most recent), removing visual duplicates from multiple retry attempts.
- **GitHub Actions fixes**: `frontend/package-lock.json` committed (fixes cache-dependency-path error). `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` added to silence Node 20 deprecation.
- **render.yaml**: `GEMINI_MODEL` corrected to `gemini-flash-latest`, added `OPENROUTER_API_KEY`, `YOUTUBE_API_KEY` declarations, fixed `buildCommand` to include `PLAYWRIGHT_BROWSERS_PATH=0` and `prisma db push`.

### Bug Fixes Already in master — Do NOT Re-Apply

1. **`backend/package.json`** — `@types/express` downgraded to `^4.17.21`
2. **`backend/tsconfig.json`** — added `"types": ["node"]`, `"lib": ["ES2020", "DOM"]`
3. **`backend/src/routes/quiz.ts`** — Zod `type` field uses `z.enum([...])`
4. **`backend/src/middleware/errorHandler.ts`** — `ZodError` → 400; exposes `err.message` (revert for prod)
5. **`backend/src/app.ts`** — rate limit raised to `max: 200`
6. **`backend/src/services/geminiService.ts`** — retry logic; `maxOutputTokens` floor 2048; default model `gemini-flash-latest`; OpenRouter fallback on 429; `organizeContent` maxOutputTokens 8192
7. **`frontend/netlify.toml`** — `VITE_API_URL` set to correct Render URL
8. **`frontend/.env.production`** — created with correct `VITE_API_URL`
9. **`frontend/src/pages/QuizPage.tsx`** — `useState(() => loadQuiz())` → `useEffect(() => { loadQuiz(); }, [])`

### Prisma Note

**Use `prisma db push` not `prisma migrate deploy`** — no migration files were ever committed. Render build command:
```
npm install --include=dev && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium && npm run build && npx prisma generate && npx prisma db push
```

### Deployment Notes

- **Frontend deploys**: GitHub Actions handles it automatically on push. No manual `netlify deploy` needed.
- **Backend deploys**: Render does NOT auto-deploy from GitHub (webhook not connected). Must manually trigger via Render dashboard after each push.
- **Render API PUT env-vars**: Always GET existing vars first and PUT all of them. PUT is a full replacement — a partial PUT wipes unlisted vars.
- **render.yaml env vars**: `value` fields in render.yaml apply on Blueprint sync. Dashboard overrides take precedence for already-running services. Always set critical vars on the dashboard directly.

## Commands

```bash
# Local infrastructure
docker-compose up -d          # Start local postgres + redis

# Backend (cd backend first)
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev                   # ts-node + nodemon, port 3000

# Frontend (cd frontend first)
npm install
npm run dev                   # Vite dev server, port 5173 (proxies /api to :3000)
npm run build
```

## Project Structure

```
trainmenow/
├── .github/workflows/
│   └── deploy-frontend.yml  # Auto-deploy frontend to Netlify on push (Node 24)
├── netlify.toml             # Netlify build config (base=frontend, publish=dist)
├── docker-compose.yml       # Local postgres + redis
├── frontend/                # React 18 + TypeScript + Vite → Netlify
│   ├── package-lock.json    # committed — required for GitHub Actions npm cache
│   └── src/
│       ├── pages/           # LoginPage, RegisterPage, DashboardPage,
│       │                    # OnboardingPage, LearnPage, QuizPage, CertificatePage
│       ├── components/ui/   # button, card, input, progress, badge
│       ├── stores/          # userStore (JWT auth), learningStore (progress/notes)
│       ├── services/api.ts  # Axios client + typed API calls (incl. curriculumApi.delete)
│       └── types/index.ts   # Shared TypeScript interfaces
└── backend/                 # Node.js + Express + TypeScript → Render
    ├── render.yaml          # Service config — buildCommand, env var declarations
    ├── prisma/schema.prisma # 7 tables + failureReason on LearningJourney
    └── src/
        ├── app.ts / server.ts
        ├── middleware/       # auth (JWT), errorHandler
        ├── routes/           # auth, curriculum (incl. DELETE), scrape, quiz, certificate
        └── services/
            ├── geminiService.ts      # 4 LLM prompts; OpenRouter 429 fallback; ContentResource export
            ├── scraperEngine.ts      # YouTube API + Wikipedia + Dev.to + Playwright; duration filtering
            ├── contentProcessor.ts   # sanitize + chunk (legacy, no longer used in main pipeline)
            ├── curriculumBuilder.ts  # LLM → discover → LLM; stores failureReason on error
            ├── quizGenerator.ts      # generate + grade (70% pass threshold)
            ├── certificateService.ts # creates DB record, TMN-XXXX-timestamp format
            └── queueService.ts       # BullMQ worker on Upstash Redis
```

## Architecture Notes

**LLM-First**: All intelligence via `geminiService.ts` — all 4 prompt types use `responseMimeType: "application/json"`.

**Content pipeline**: `scraperEngine.executePlan(plan, duration)` returns `DiscoveryResult { textContent, resources }`.
- `textContent`: scraped article bodies for LLM context
- `resources`: verified real URLs from YouTube API, Wikipedia API, Dev.to API, and Playwright scraping
- Gemini's `organizeContent` receives the resource list and is instructed to only cite from it (no hallucinated URLs)
- YouTube videos filtered by duration based on course length: ≤1-2h course → 20 min cap; ≤4h → 30 min; ≤8h → 45 min; 15-30h → 60 min

**OpenRouter fallback**: `callWithJson` catches 429 from Gemini and retries via OpenRouter if `OPENROUTER_API_KEY` is set. OpenRouter uses OpenAI-compatible chat completions API with `response_format: {type: "json_object"}`.

**Async scraping**: BullMQ job queued on `POST /curriculum/follow-up`. LearnPage polls `GET /curriculum/:id/modules` (returns `{ status, modules, failureReason }`) every 5s until modules appear or status is `failed`.

**Quiz storage**: `StoredQuiz` table persists generated quiz per user+module. Reused on retake after pass; deleted on fail to force fresh generation.

**PDF certificates**: Generated client-side in `CertificatePage.tsx` using `@react-pdf/renderer`.

**Auth**: JWT stored in localStorage, attached via Axios interceptor. Token cleared on 401.

**State**: Zustand with `persist` middleware — progress and notes survive page refreshes.

## API Routes

```
POST /api/v1/auth/register|login       GET  /api/v1/auth/me
POST /api/v1/curriculum/initiate       POST /api/v1/curriculum/follow-up
GET  /api/v1/curriculum/:id/modules    GET  /api/v1/curriculum/:id/progress
POST /api/v1/curriculum/:id/progress   DELETE /api/v1/curriculum/:id
GET  /api/v1/curriculum (list)
GET  /api/v1/scrape/:jobId/status
POST /api/v1/quiz/generate             POST /api/v1/quiz/submit
GET  /api/v1/quiz/:id/results
POST /api/v1/certificate/generate      GET  /api/v1/certificate/:id
GET  /api/v1/certificate (list)
GET  /api/v1/verify/:certificateNumber  (public, no auth)
GET  /health
```

## Environment Variables

```bash
# backend/.env (git-ignored) / Render dashboard
DATABASE_URL=postgresql://...      # Neon connection string
REDIS_URL=rediss://...             # Upstash Redis (TLS — rediss://)
GEMINI_API_KEY=                    # never commit; set on Render dashboard
GEMINI_MODEL=gemini-flash-latest   # use this — 2.5-flash exhausts 20 req/day
OPENROUTER_API_KEY=                # OpenRouter fallback for Gemini 429s
OPENROUTER_MODEL=google/gemini-2.0-flash-001  # optional, this is the default
YOUTUBE_API_KEY=                   # optional — Google Cloud YouTube Data API v3; skipped if not set
SERPAPI_KEY=                       # optional — web search for article URLs
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173

# frontend: VITE_API_URL in frontend/netlify.toml and frontend/.env.production
# In dev, Vite proxy handles /api → localhost:3000
```

## Key Constraints

- Quiz pass threshold: 70%
- YouTube discovery: requires `YOUTUBE_API_KEY`; filters by duration (20/30/45/60 min cap based on course length); skips < 90s clips
- Scraping: Playwright for articles only (YouTube URLs skipped — they block bots); max 10 articles, batch=3, 1s delay, 10k chars/page
- Playwright on Render: `--no-sandbox --disable-dev-shm-usage --disable-gpu`
- `PLAYWRIGHT_BROWSERS_PATH=0` required on Render (set in both render.yaml and build cmd)
- Render free: 512MB RAM, spins down after 15min idle (cold start ~30–60s)
- Certificate number format: `TMN-${8-char UUID}-${timestamp}`
- Gemini free tier: `gemini-flash-latest` has highest quota; `gemini-2.5-flash` = 20 req/day
- `prisma db push` not `prisma migrate deploy` (no migration files committed)
- Never put API keys or secrets in CLAUDE.md, memory files, or any tracked file
- `ContentResource` interface lives in `geminiService.ts` and is imported by `scraperEngine.ts` (not circular — scraper already imports from gemini)
