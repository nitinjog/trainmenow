# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Train Me Now is an AI-first self-learning platform. Users input a topic + duration, Gemini Flash 2.5 designs a personalized curriculum, Playwright scrapes web content, and LLM organizes it into modules with quizzes and client-side PDF certificate generation.

## Deployment

- **Frontend** → Netlify (static Vite build, `netlify.toml` at repo root)
- **Backend** → Render (Node.js web service, `backend/render.yaml`)
- **Database** → Neon (serverless PostgreSQL)
- **Redis** → Upstash (BullMQ jobs + caching)

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

# Single test
npm run test -- path/to/test.spec.ts
```

## Project Structure

```
train-me-now/
├── netlify.toml             # Netlify build config (builds frontend/)
├── docker-compose.yml       # Local postgres + redis
├── .env.example
├── frontend/                # React 18 + TypeScript + Vite → Netlify
│   ├── src/
│   │   ├── pages/           # LoginPage, RegisterPage, DashboardPage,
│   │   │                    # OnboardingPage, LearnPage, QuizPage, CertificatePage
│   │   ├── components/ui/   # button, card, input, progress, badge
│   │   ├── stores/          # userStore (auth), learningStore (progress/notes)
│   │   ├── services/api.ts  # Axios client + all API calls
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
            ├── geminiService.ts      # 4 LLM prompt types, JSON output
            ├── scraperEngine.ts      # Playwright + Cheerio, batch=3
            ├── contentProcessor.ts   # sanitize + chunk scraped content
            ├── curriculumBuilder.ts  # orchestrates scrape → LLM pipeline
            ├── quizGenerator.ts      # generate + grade quizzes
            ├── certificateService.ts # creates DB certificate record
            └── queueService.ts       # BullMQ worker (Upstash Redis)
```

## Architecture Notes

**LLM-First**: All intelligence via `geminiService.ts` — all calls use `responseMimeType: "application/json"`.

**Async scraping**: BullMQ job queued on `/curriculum/follow-up`; frontend polls `GET /api/v1/scrape/:jobId/status`. `LearnPage` auto-refetches every 5s until modules appear.

**PDF certificates**: Generated entirely client-side in `CertificatePage.tsx` using `@react-pdf/renderer` — no Puppeteer on backend.

**Auth**: JWT stored in localStorage, attached via Axios interceptor. Token cleared on 401.

**State**: Zustand with `persist` middleware — progress and notes survive page refreshes.

## API Routes

```
POST /api/v1/auth/register|login   GET  /api/v1/auth/me
POST /api/v1/curriculum/initiate   POST /api/v1/curriculum/follow-up
GET  /api/v1/curriculum/:id/modules|progress
POST /api/v1/curriculum/:id/progress
GET  /api/v1/scrape/:jobId/status
POST /api/v1/quiz/generate|submit   GET /api/v1/quiz/:id/results
POST /api/v1/certificate/generate   GET /api/v1/certificate/:id
GET  /api/v1/verify/:certificateNumber   (public, no auth)
```

## Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trainmenow
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=                    # user provides
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
SERPAPI_KEY=                       # optional; scraping degrades gracefully without it
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173

# frontend/.env
VITE_API_URL=http://localhost:3000/api/v1   # only needed when NOT using Vite proxy
```

## Key Constraints

- Quiz pass threshold: 70%
- Scraping concurrency: max 3 parallel, 1s delay between batches, max 15 URLs
- Content body capped at 10,000 chars per page
- Scraping user agent: `TrainMeNow-Bot/1.0 (Educational Content Aggregation)`
- Certificate format: `TMN-${8-char UUID}-${timestamp}`
- Render free tier: 512MB RAM, spins down after 15min idle (cold start ~30–60s)
- Playwright launch flags required on Render: `--no-sandbox --disable-dev-shm-usage --disable-gpu`
