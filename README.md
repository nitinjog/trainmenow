# Train Me Now — AI-First Self-Learning Platform

[![Frontend Status](https://img.shields.io/badge/Frontend-LIVE-brightgreen?logo=netlify)](https://trainmenow-app-616.netlify.app)
[![Backend Status](https://img.shields.io/badge/Backend-LIVE-brightgreen?logo=render)](https://trainmenow-api.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-98%25-blue)](#)

Train Me Now is an AI-powered self-learning platform that generates personalized curricula on demand. Users input a topic and desired duration, and the platform uses Google Gemini (with OpenRouter fallback) to design a custom learning path sourced from YouTube, Wikipedia, Dev.to, and web scraping.

## 🚀 Live Deployment

| Layer | Service | URL | Status |
|---|---|---|---|
| **Frontend** | Netlify | [trainmenow-app-616.netlify.app](https://trainmenow-app-616.netlify.app) | ✅ LIVE (auto-deploys via GitHub Actions) |
| **Backend API** | Render | [trainmenow-api.onrender.com](https://trainmenow-api.onrender.com) | ✅ LIVE |
| **Database** | Neon (PostgreSQL) | `ep-royal-lake-ap8nnvre.c-7.us-east-1.aws.neon.tech` | ✅ LIVE |
| **Cache & Queue** | Upstash (Redis) | `neat-mallard-115620.upstash.io:6379` | ✅ LIVE |

## 📋 Features

### Core Platform
- **AI-Powered Curriculum Generation**: Gemini Flash designs personalized learning paths based on topic + duration
- **Multi-Source Content Aggregation**: 
  - YouTube API v3 integration with duration filtering
  - Wikipedia API for comprehensive articles
  - Dev.to API for developer content
  - Web scraping for additional resources
- **Adaptive Learning Modules**: Organized content split into 20/30/45/60-minute modules
- **Interactive Quizzes**: Built-in assessments per module
- **PDF Certificates**: Client-side certificate generation upon course completion

### Advanced Features
- **OpenRouter Fallback**: Automatic failover when Gemini API hits rate limits
- **Real Resource URLs**: Verified, non-hallucinated content links with metadata
- **YouTube Duration Overlay**: Visual duration badges on video thumbnails
- **Resource Type Badges**: Distinguish between videos, articles, and reference materials
- **Curriculum Failure Tracking**: Detailed error messages for debugging failed course generations
- **Dashboard Management**: Create, delete, and track learning paths with two-step confirmation
- **Certificate Deduplication**: Frontend deduplicates certificates from retry attempts
- **Real-time Job Queue**: BullMQ-powered async task processing

## 🏗️ Architecture

### Tech Stack

```
Frontend:
  - React + TypeScript
  - Vite
  - Deployed on Netlify (auto-deploy on master push)

Backend:
  - Node.js + Express + TypeScript
  - Deployed on Render (manual redeploy required)
  - Rate limiting (200 req/min)

Database:
  - PostgreSQL (Neon serverless)
  - Prisma ORM
  
Queue & Cache:
  - Redis (Upstash)
  - BullMQ for async job processing

LLM APIs:
  - Google Gemini (primary)
  - OpenRouter (fallback)
```

### Key Services

| Service | Purpose |
|---|---|
| `geminiService.ts` | Curriculum generation & content organization with retry logic |
| `scraperEngine.ts` | Multi-source content aggregation (YouTube, Wikipedia, Dev.to) |
| `organizeContent` | Gemini prompt that structures scraped content into modules with quizzes |
| `errorHandler.ts` | Centralized Express error handling (ZodError → 400, others → 500) |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis instance
- API Keys:
  - Google Gemini API
  - Google YouTube Data API v3 (optional)
  - OpenRouter API (optional, for fallback)

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env  # Configure with your API keys
npm run dev
```

**Database:**
```bash
npx prisma db push  # Sync schema with Neon
npx prisma studio  # Browse database UI
```

### Environment Variables

**Backend `.env`:**
```env
DATABASE_URL=postgresql://...  # Neon connection
REDIS_URL=rediss://...         # Upstash Redis (TLS)
GEMINI_API_KEY=...             # Google Gemini API key
GEMINI_MODEL=gemini-flash-latest
OPENROUTER_API_KEY=...         # Optional: for fallback
OPENROUTER_MODEL=google/gemini-2.0-flash-001
YOUTUBE_API_KEY=...            # Optional: for YouTube integration
PORT=3001
NODE_ENV=development
```

## 📊 Database Schema

Key tables (managed via Prisma):
- `users` — Platform users
- `learning_journeys` — User courses with status & failure tracking
- `modules` — Course modules with quizzes
- `module_resources` — Content items (videos, articles) with metadata
- `user_responses` — Quiz responses for tracking progress
- `certificates` — Generated certificates per user/module

## 🔄 API Endpoints

### Learning Paths (Curriculum)
```
POST   /api/v1/curriculum           # Create new learning path
GET    /api/v1/curriculum/:id       # Get curriculum details
GET    /api/v1/curriculum/:id/modules  # Get modules with resources
DELETE /api/v1/curriculum/:id       # Delete (cascades all related data)
GET    /api/v1/user/curricula       # List user's curricula
```

### Modules & Quizzes
```
GET    /api/v1/modules/:id          # Get module details
POST   /api/v1/quiz/submit          # Submit quiz responses
GET    /api/v1/quiz/:moduleId       # Get quiz questions
```

### Certificates
```
POST   /api/v1/certificate/generate # Generate PDF certificate
GET    /api/v1/user/certificates    # List user's certificates
```

## 🚨 Deployment Notes

### Frontend
- **Auto-deploys** on every push to `master` branch via GitHub Actions
- Netlify site ID: `d8608965-4beb-48c7-bde9-3396f0376b2e`

### Backend
- **Manual redeploy required** on Render after commits
- Render service ID: `srv-d7t0j90sfn5c73ftb4p0`
- **Deployment steps:**
  1. Go to [Render Dashboard](https://dashboard.render.com/web/srv-d7t0j90sfn5c73ftb4p0)
  2. Click "Manual Deploy" → "Deploy latest commit"
  3. Verify env vars are set (see table below)
  4. Deployment automatically runs `prisma db push`

### Required Render Environment Variables

| Key | Value | Notes |
|---|---|---|
| `GEMINI_MODEL` | `gemini-flash-latest` | |
| `GEMINI_API_KEY` | Current API key | Must be non-revoked |
| `OPENROUTER_API_KEY` | OpenRouter key | Fallback for rate limits |
| `OPENROUTER_MODEL` | `google/gemini-2.0-flash-001` | Optional; used as default |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | Optional; skipped if not set |
| `DATABASE_URL` | Neon connection string | Auto-set by Render secret |
| `REDIS_URL` | Upstash Redis URL | Auto-set by Render secret (use `rediss://` TLS) |

## 🔧 Configuration

### Curriculum Generation
- **Module Duration**: 20, 30, 45, or 60 minutes (user-selected)
- **Max Modules**: Dynamically calculated based on total duration
- **Output Tokens**: 8192 (raised from 4000 to prevent JSON truncation)

### YouTube Filtering
- Videos filtered by ISO 8601 duration to match course length caps
- Duration overlay displayed on thumbnails in LearnPage

### Rate Limiting
- Express rate limiter: 200 requests per minute

## 📦 Project Structure

```
trainmenow/
├── frontend/              # React + Vite application
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/               # Express + TypeScript API
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic (Gemini, scrapers)
│   │   ├── middleware/    # Auth, error handling, rate limiting
│   │   └── app.ts         # Express app setup
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
├── render.yaml            # Render deployment config
└── CLAUDE.md              # Development guidance
```

## 🐛 Known Issues & Polish

### Pending
- Error messages in production should hide raw error details (`errorHandler.ts` revert)
- Implement comprehensive error logging and monitoring

### Recently Fixed (master branch)
- ✅ TypeScript compilation errors (Express types, tsconfig)
- ✅ Zod schema type validation for quiz endpoints
- ✅ Rate limiting increased to 200 req/min
- ✅ Gemini retry logic with OpenRouter fallback
- ✅ YouTube API duration filtering
- ✅ Content organization with real URLs (no hallucination)
- ✅ Dashboard delete with cascade
- ✅ Certificate deduplication
- ✅ GitHub Actions cache and Node.js version fixes

## 🤝 Contributing

1. **Create a feature branch** from `master`
2. **Commit changes** with clear messages
3. **Push to GitHub** — frontend auto-deploys, backend requires manual Render trigger
4. **Test in production** via live URLs above

### Testing Checklist
- [ ] Frontend builds without errors
- [ ] Backend starts locally (`npm run dev`)
- [ ] Prisma schema syncs (`npx prisma db push`)
- [ ] Quiz validation works (Zod schemas)
- [ ] Error responses have correct status codes
- [ ] Rate limiting doesn't block legitimate requests

## 📞 Support & Debugging

### Backend Logs
```bash
# Render logs
curl https://api.render.com/v1/services/srv-d7t0j90sfn5c73ftb4p0/logs \
  -H "Authorization: Bearer YOUR_RENDER_API_KEY"
```

### Database
```bash
# Interactive Prisma Studio
npx prisma studio

# View schema
npx prisma db pull
```

### Troubleshooting

**Curriculum generation fails with 429 (rate limit)**
- Check `OPENROUTER_API_KEY` is set and valid
- Verify `GEMINI_API_KEY` is current
- Check `failure_reason` in database for details

**YouTube videos not appearing**
- Verify `YOUTUBE_API_KEY` is set
- Check YouTube API quota on Google Cloud Console
- Ensure videos match module duration filters

**Certificate generation errors**
- Check browser console for PDF library errors
- Verify module completion status in database

## 📄 License

Proprietary — Train Me Now Platform

## 🎯 Roadmap

- [ ] User authentication & profiles
- [ ] Social learning (groups, discussions)
- [ ] Mobile app (React Native)
- [ ] AI-generated video lectures
- [ ] Spaced repetition for quiz review
- [ ] Analytics dashboard for learners
- [ ] Instructor mode for creating custom courses
