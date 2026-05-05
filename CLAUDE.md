# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Train Me Now is an AI-first self-learning platform. Users input a topic + duration, Gemini Flash 2.5 designs a personalized curriculum, Playwright scrapes web content, and LLM organizes it into modules with quizzes and client-side PDF certificate generation.

## Deployment Targets

| Layer | Service | Status |
|---|---|---|
| Frontend | Netlify — `trainmenow-app-616.netlify.app` | Site created, **deploy pending** |
| Backend API | Render — free web service | **Not yet deployed** |
| PostgreSQL | Neon (free serverless) | **Not yet provisioned** |
| Redis + BullMQ | Upstash (free tier) | **Not yet provisioned** |

### GitHub
- Repo: `https://github.com/nitinjog/trainmenow` (account: nitinjog, branch: master)
- Two commits pushed: initial scaffold + TypeScript fix

### Netlify
- Site name: `trainmenow-app-616`, ID: `d8608965-4beb-48c7-bde9-3396f0376b2e`
- URL: `https://trainmenow-app-616.netlify.app`
- **Frontend dist is built** (`frontend/dist/` exists locally). Next step: run deploy command.
- After Render URL is known, set env var `VITE_API_URL` on Netlify and redeploy.

### To resume deployment (next session):

**Step 1 — Deploy frontend to Netlify:**
```bash
cd frontend && npm run build   # already built, but re-run to be safe
NETLIFY_AUTH_TOKEN=<token> npx netlify deploy --prod --dir=dist --site=d8608965-4beb-48c7-bde9-3396f0376b2e
```

**Step 2 — Provision Neon PostgreSQL (free):**
- Sign up at neon.tech → create project `trainmenow` → copy connection string
- Set as `DATABASE_URL` on Render

**Step 3 — Provision Upstash Redis (free):**
- Sign up at upstash.com → create Redis DB → copy `REDIS_URL`
- Set as `REDIS_URL` on Render

**Step 4 — Deploy backend to Render:**
```bash
# Using Render API (key stored in memory):
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer <render_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web_service",
    "name": "trainmenow-api",
    "repo": "https://github.com/nitinjog/trainmenow",
    "branch": "master",
    "rootDir": "backend",
    "buildCommand": "npm install && npx playwright install chromium --with-deps && npm run build && npx prisma generate",
    "startCommand": "npm start",
    "plan": "free",
    "envVars": [...]
  }'
```

**Step 5 — Set env vars on Render:**
```
DATABASE_URL=<neon connection string>
REDIS_URL=<upstash redis url>
GEMINI_API_KEY=<provided by user>
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
JWT_SECRET=<generate random>
FRONTEND_URL=https://trainmenow-app-616.netlify.app
NODE_ENV=production
```

**Step 6 — Run Prisma migrations on Render:**
After first deploy, open Render shell and run: `npx prisma migrate deploy`

**Step 7 — Update VITE_API_URL on Netlify:**
Once Render gives a URL (e.g. `trainmenow-api.onrender.com`), set:
```
VITE_API_URL=https://trainmenow-api.onrender.com/api/v1
```
Then trigger a redeploy on Netlify.

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
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
SERPAPI_KEY=                       # optional, scraping degrades without it
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173

# frontend: VITE_API_URL set on Netlify dashboard (not in repo)
# In dev, Vite proxy handles /api → localhost:3000
```

## Key Constraints

- Quiz pass threshold: 70%
- Scraping: max 3 parallel, 1s delay between batches, max 15 URLs, 10k chars/page
- Playwright on Render: `--no-sandbox --disable-dev-shm-usage --disable-gpu`
- Render free: 512MB RAM, spins down after 15min idle (cold start ~30–60s)
- Certificate number format: `TMN-${8-char UUID}-${timestamp}`
