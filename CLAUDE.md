# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Train Me Now is an AI-first self-learning platform. Users input a topic + duration, Gemini Flash designs a personalized curriculum, Playwright scrapes web content, and the LLM organizes it into modules with quizzes and client-side PDF certificate generation.

## Deployment Status (as of 2026-05-05) — ALL LIVE

| Layer | Service | Status |
|---|---|---|
| Frontend | Netlify — `trainmenow-app-616.netlify.app` | **LIVE** |
| Backend API | Render — `trainmenow-api.onrender.com` | **LIVE** |
| PostgreSQL | Neon (free serverless) | **LIVE** — tables created via `prisma db push` |
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

### Next Session Resume Checklist

**Outstanding item — must do first:**
Update Render env vars via dashboard (`https://dashboard.render.com/web/srv-d7t0j90sfn5c73ftb4p0`):
```
GEMINI_API_KEY = AIzaSyBsPQWIzTAibA8G1qYuYxr8-trHZhI2xiU   ← new key (old one was quota-exhausted)
GEMINI_MODEL   = gemini-flash-latest                         ← only model with quota on this key
```
Code already updated (commit `62e575d` on master uses `gemini-flash-latest` as default fallback).
After env vars are saved on Render, it will auto-redeploy. Then verify quiz generation works.

**Or via Render API (service ID confirmed above):**
```bash
curl -X PUT https://api.render.com/v1/services/srv-d7t0j90sfn5c73ftb4p0/env-vars \
  -H "Authorization: Bearer <render_api_key>" \
  -H "Content-Type: application/json" \
  -d '[{"key":"GEMINI_API_KEY","value":"AIzaSyBsPQWIzTAibA8G1qYuYxr8-trHZhI2xiU"},{"key":"GEMINI_MODEL","value":"gemini-flash-latest"}]'
```

**After quiz is confirmed working:**
- Revert `errorHandler.ts` to hide raw error messages: change `res.status(500).json({ error: err.message })` back to `res.status(500).json({ error: 'Internal server error' })` for production.

### Bug Fixes Applied During Deployment Session

These are already in `master` — do NOT re-apply:

1. **`backend/package.json`** — `@types/express` downgraded `^5.0.0` → `^4.17.21` (v5 broke `req.params` types)
2. **`backend/tsconfig.json`** — added `"types": ["node"]` and `"DOM"` to lib (needed after express v4 type change)
3. **`backend/src/routes/quiz.ts`** — Zod schema `type: z.string()` → `z.enum([...])` to match `QuestionData`
4. **`backend/src/middleware/errorHandler.ts`** — added `ZodError` → 400; exposed `err.message` for debugging (revert for prod)
5. **`backend/src/app.ts`** — rate limit raised `max: 10` → `max: 200` (10/min exhausted by polling every 5s)
6. **`backend/src/services/geminiService.ts`** — retry logic (3x, 3/6/9s backoff); `maxOutputTokens` floor 2048; default model `gemini-flash-latest`
7. **`frontend/netlify.toml`** — `VITE_API_URL` was `""` (overrode everything); fixed to actual Render URL
8. **`frontend/.env.production`** — created with `VITE_API_URL=https://trainmenow-api.onrender.com/api/v1`
9. **`frontend/src/pages/QuizPage.tsx`** — `useState(() => loadQuiz())` anti-pattern → `useEffect(() => { loadQuiz(); }, [])`

### Prisma Note

**Use `prisma db push` not `prisma migrate deploy`** — no migration files were ever committed. The Render build command should use `prisma db push`:
```
npm install --include=dev && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium && npm run build && npx prisma generate && npx prisma db push
```
`PLAYWRIGHT_BROWSERS_PATH=0` installs Playwright into `node_modules/` so it persists from build container to runtime container on Render.

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
├── netlify.toml             # Netlify build config (base=frontend, publish=dist)
├── docker-compose.yml       # Local postgres + redis
├── .env.example
├── frontend/                # React 18 + TypeScript + Vite → Netlify
│   ├── src/
│   │   ├── pages/           # LoginPage, RegisterPage, DashboardPage,
│   │   │                    # OnboardingPage, LearnPage, QuizPage, CertificatePage
│   │   ├── components/ui/   # button, card, input, progress, badge
│   │   ├── stores/          # userStore (JWT auth), learningStore (progress/notes)
│   │   ├── services/api.ts  # Axios client + typed API calls
│   │   └── types/index.ts   # Shared TypeScript interfaces
│   └── netlify.toml
└── backend/                 # Node.js + Express + TypeScript → Render
    ├── render.yaml
    ├── prisma/schema.prisma
    └── src/
        ├── app.ts / server.ts
        ├── middleware/       # auth (JWT), errorHandler
        ├── routes/           # auth, curriculum, scrape, quiz, certificate
        └── services/
            ├── geminiService.ts      # 4 LLM prompt types, JSON output enforced
            ├── scraperEngine.ts      # Playwright + Cheerio, batch=3, --no-sandbox
            ├── contentProcessor.ts   # sanitize + chunk scraped content
            ├── curriculumBuilder.ts  # LLM → scrape → LLM pipeline
            ├── quizGenerator.ts      # generate + grade (70% pass threshold)
            ├── certificateService.ts # creates DB record, TMN-XXXX-timestamp format
            └── queueService.ts       # BullMQ worker on Upstash Redis
```

## Architecture Notes

**LLM-First**: All intelligence via `geminiService.ts` — all 4 prompt types (follow-up questions, scraping plan, content organization, quiz) use `responseMimeType: "application/json"`.

**Async scraping**: BullMQ job queued on `POST /curriculum/follow-up`. Frontend polls `GET /api/v1/scrape/:jobId/status`. `LearnPage` auto-refetches every 5s via React Query `refetchInterval`.

**PDF certificates**: Generated client-side in `CertificatePage.tsx` using `@react-pdf/renderer` — no Puppeteer on backend.

**Auth**: JWT stored in localStorage, attached via Axios interceptor. Token cleared on 401.

**State**: Zustand with `persist` middleware — progress and notes survive page refreshes.

## API Routes

```
POST /api/v1/auth/register|login       GET  /api/v1/auth/me
POST /api/v1/curriculum/initiate       POST /api/v1/curriculum/follow-up
GET  /api/v1/curriculum/:id/modules    GET  /api/v1/curriculum/:id/progress
POST /api/v1/curriculum/:id/progress   GET  /api/v1/curriculum (list)
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
# backend/.env (git-ignored)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trainmenow
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=                    # provided by user
GEMINI_MODEL=gemini-flash-latest   # only model with quota on current key
SERPAPI_KEY=                       # optional, scraping degrades without it
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173

# frontend: VITE_API_URL set in frontend/netlify.toml and frontend/.env.production
# In dev, Vite proxy handles /api → localhost:3000
```

## Key Constraints

- Quiz pass threshold: 70%
- Scraping: max 3 parallel, 1s delay between batches, max 15 URLs, 10k chars/page
- Playwright on Render: `--no-sandbox --disable-dev-shm-usage --disable-gpu`
- `PLAYWRIGHT_BROWSERS_PATH=0` required on Render (installs into `node_modules/` which persists to runtime)
- Render free: 512MB RAM, spins down after 15min idle (cold start ~30–60s)
- Certificate number format: `TMN-${8-char UUID}-${timestamp}`
- Gemini free tier: `gemini-2.5-flash` = 20 req/day; `gemini-flash-latest` has higher quota — use this
- `prisma db push` not `prisma migrate deploy` (no migration files committed)
