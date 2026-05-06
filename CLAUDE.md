# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Train Me Now is an AI-first self-learning platform. Users input a topic + duration, Gemini Flash designs a personalized curriculum, Playwright scrapes web content, and the LLM organizes it into modules with quizzes and client-side PDF certificate generation.

## Deployment Status — ALL LIVE (as of 2026-05-06)

| Layer | Service | Status |
|---|---|---|
| Frontend | Netlify — `trainmenow-app-616.netlify.app` | **LIVE** — auto-deploys via GitHub Actions |
| Backend API | Render — `trainmenow-api.onrender.com` | **LIVE** |
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

Update `GEMINI_MODEL` on Render to `gemini-flash-latest`:

**Via Render dashboard** (`https://dashboard.render.com/web/srv-d7t0j90sfn5c73ftb4p0` → Environment):
```
GEMINI_MODEL = gemini-flash-latest
```

**Or via Render API** (GET existing vars first, then PUT all of them with updated value — never PUT only one var or it wipes the rest):
```bash
# 1. GET current vars, 2. update GEMINI_MODEL, 3. PUT all vars back
```

**Why:** `gemini-2.5-flash` has a 20 req/day free tier limit — exhausted during testing on 2026-05-06. `gemini-flash-latest` was confirmed working (HTTP 200) while all other models returned 429.

**After updating:** trigger a Render redeploy so the new env var takes effect.

### Pending Polish Items

- Revert `errorHandler.ts` to hide raw error messages in production: `res.status(500).json({ error: 'Internal server error' })` instead of `err.message`

### Features Shipped (2026-05-06 session)

- **Quiz storage**: `StoredQuiz` table (userId + moduleId unique). Pass → reuse same quiz on retake. Fail → delete stored quiz, force fresh generation next time.
- **Certificate navigation fix**: QuizPage now navigates to `/certificate/{cert.id}` (was using moduleId by mistake).
- **Curriculum failed state**: `buildCurriculum` catches errors and sets journey status to `failed`. `GET /curriculum/:id/modules` returns `{ status, modules }`. LearnPage shows error screen + "Start a new course" button instead of infinite spinner.
- **Duration picker**: hours only — 1h, 2h, 3h, 4h, 6h, 8h, 15h, 20h, 30h (3×3 grid).
- **GitHub Actions**: `.github/workflows/deploy-frontend.yml` auto-builds and deploys frontend to Netlify on every push that touches `frontend/**`. Secrets stored in GitHub (`NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`).

### Bug Fixes Already in master — Do NOT Re-Apply

1. **`backend/package.json`** — `@types/express` downgraded to `^4.17.21`
2. **`backend/tsconfig.json`** — added `"types": ["node"]`, `"lib": ["ES2020", "DOM"]`
3. **`backend/src/routes/quiz.ts`** — Zod `type` field uses `z.enum([...])`
4. **`backend/src/middleware/errorHandler.ts`** — `ZodError` → 400; exposes `err.message` (revert for prod)
5. **`backend/src/app.ts`** — rate limit raised to `max: 200`
6. **`backend/src/services/geminiService.ts`** — retry logic; `maxOutputTokens` floor 2048; default model `gemini-flash-latest`
7. **`frontend/netlify.toml`** — `VITE_API_URL` set to correct Render URL
8. **`frontend/.env.production`** — created with correct `VITE_API_URL`
9. **`frontend/src/pages/QuizPage.tsx`** — `useState(() => loadQuiz())` → `useEffect(() => { loadQuiz(); }, [])`

### Prisma Note

**Use `prisma db push` not `prisma migrate deploy`** — no migration files were ever committed. Render build command:
```
npm install --include=dev && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium && npm run build && npx prisma generate && npx prisma db push
```

### Deployment Notes

- **Frontend deploys**: GitHub Actions handles it automatically on push. No manual `netlify deploy` needed anymore.
- **Backend deploys**: Render does NOT auto-deploy from GitHub (webhook not connected). Must manually trigger via Render dashboard or API after each push.
- **Render API PUT env-vars**: Always GET existing vars first and PUT all of them. PUT is a full replacement — a partial PUT wipes unlisted vars.

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
│   └── deploy-frontend.yml  # Auto-deploy frontend to Netlify on push
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
            ├── curriculumBuilder.ts  # LLM → scrape → LLM pipeline, sets status=failed on error
            ├── quizGenerator.ts      # generate + grade (70% pass threshold)
            ├── certificateService.ts # creates DB record, TMN-XXXX-timestamp format
            └── queueService.ts       # BullMQ worker on Upstash Redis
```

## Architecture Notes

**LLM-First**: All intelligence via `geminiService.ts` — all 4 prompt types use `responseMimeType: "application/json"`.

**Async scraping**: BullMQ job queued on `POST /curriculum/follow-up`. LearnPage polls `GET /curriculum/:id/modules` (returns `{ status, modules }`) every 5s until modules appear or status is `failed`.

**Quiz storage**: `StoredQuiz` table persists generated quiz per user+module. Reused on retake after pass; deleted on fail to force fresh generation.

**PDF certificates**: Generated client-side in `CertificatePage.tsx` using `@react-pdf/renderer`.

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
DATABASE_URL=postgresql://...   # Neon connection string
REDIS_URL=rediss://...          # Upstash Redis (TLS — rediss://)
GEMINI_API_KEY=                 # never commit; set on Render dashboard
GEMINI_MODEL=gemini-flash-latest  # use this — 2.5-flash exhausts 20 req/day limit
SERPAPI_KEY=                    # optional
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173

# frontend: VITE_API_URL in frontend/netlify.toml and frontend/.env.production
# In dev, Vite proxy handles /api → localhost:3000
```

## Key Constraints

- Quiz pass threshold: 70%
- Scraping: max 3 parallel, 1s delay between batches, max 15 URLs, 10k chars/page
- Playwright on Render: `--no-sandbox --disable-dev-shm-usage --disable-gpu`
- `PLAYWRIGHT_BROWSERS_PATH=0` required on Render
- Render free: 512MB RAM, spins down after 15min idle (cold start ~30–60s)
- Certificate number format: `TMN-${8-char UUID}-${timestamp}`
- Gemini free tier: `gemini-flash-latest` has highest quota; `gemini-2.5-flash` = 20 req/day
- `prisma db push` not `prisma migrate deploy` (no migration files committed)
- Never put API keys or secrets in CLAUDE.md, memory files, or any tracked file
