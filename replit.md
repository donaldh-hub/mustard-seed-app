# Mustard Seed

## Overview

Mustard Seed is a personal accountability and growth tracking web application. It features an AI-like coach named "Jae" that users chat with to stay on track with their goals. The app uses a tree/garden metaphor — users plant a "mustard seed" and watch it grow as they maintain consistency. Key features include an onboarding assessment, a chat interface with Jae (powered by a local keyword-matching "Heartbeat Relay" system, not an external AI), a progress/garden visualization, a calendar-based memory bank of journal entries, and a user profile.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side router) with routes for Welcome, Assessment, Home (chat), Progress, Calendar, and Profile
- **State Management**: Zustand for global client state (userId stored in localStorage), TanStack React Query for server state/caching
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives with Tailwind CSS v4
- **Animations**: Framer Motion for page transitions and UI animations
- **Styling**: Custom "Seedling" theme with organic green/beige colors. Fonts are DM Sans (body) and Lora (headings) loaded from Google Fonts
- **Layout**: Mobile-first design constrained to max-w-md, simulating a phone app with a bottom tab navigation bar

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (tsx for dev, esbuild for production builds)
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Key Endpoints**:
  - `POST/GET/PATCH /api/users/:id` — User CRUD
  - `GET/POST /api/users/:userId/messages` — Chat messages (sending a message triggers a Jae response)
  - `GET /api/users/:userId/entries` — Journal entries
- **Jae AI Coach**: The "Heartbeat Relay" system in `server/heartbeat.ts` is a local keyword-matching engine, NOT an external AI API. It matches user input against predefined modules (clarity, consistency, etc.) and returns contextual coaching responses with tools and prompts
- **Dev Mode**: Vite dev server is integrated as middleware with HMR support
- **Production**: Client is pre-built to `dist/public`, served as static files with SPA fallback

### Database
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (in `shared/schema.ts`):
  - `users` — id (UUID), name, goals (text array), struggles (text array), commitmentLevel, isOnboarded, waterLevel, treeStage, streak, createdAt
  - `messages` — id (UUID), userId, text, sender ('user' | 'jae'), createdAt
  - `entries` — id (UUID), userId, date (YYYY-MM-DD string), summary, mood ('happy' | 'neutral' | 'sad'), createdAt
  - `assessments` — id (UUID), userId, answers (jsonb), totalScore, stage, motivationalMessage, heartbeatScores (jsonb), weakestHeartbeat, createdAt
- **Migrations**: Use `npm run db:push` (drizzle-kit push) to sync schema to database

### Shared Code
- `shared/schema.ts` contains Drizzle table definitions, Zod insert schemas, and TypeScript types used by both client and server
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`, `@assets` → `attached_assets/`

### Build System
- **Development**: `npm run dev` runs the Express server with Vite middleware for HMR
- **Production Build**: `npm run build` runs a custom script (`script/build.ts`) that builds the client with Vite and bundles the server with esbuild. Server dependencies on an allowlist are bundled to reduce cold start times.
- **Production Start**: `npm start` runs the compiled `dist/index.cjs`

## External Dependencies

### Required Services
- **PostgreSQL Database**: Must be provisioned and connected via `DATABASE_URL` environment variable. Used for all persistent data (users, messages, entries).

### Onboarding Flow
- **First-run**: Welcome → Assessment (required) → Chat HQ. New users cannot access Chat, Progress, Calendar, or Profile until Assessment is submitted.
- **Returning users**: Automatically skip to Chat HQ if assessment exists. Can retake from Profile page.
- **Assessment scoring**: 10 questions (0-5 scale), totalScore mapped to stages: Seed (0-15), Sprout (16-30), Growth (31-45), Bloom (46-50)
- **Heartbeat mapping**: Q1→Clarity, Q2-3,9→Consistency, Q4,7→Mindset, Q5,8→Adaptation, Q6,10→Courage
- **Data persistence**: Assessment stored in both localStorage (key: assessmentResult) and backend database

### Five Heartbeats Framework
1. Clarity of Vision & Why
2. Small Steps + Consistency
3. Mindset over Method
4. Feedback & Adaptation
5. Courageous Action

### Jae AI Coach — DEPTH Coaching System
- **Primary engine**: `server/jaeCoach.ts` — AI-powered DEPTH coaching using OpenAI (gpt-4o) via Replit AI Integrations. Uses a structured system prompt with intent classification (PROACTIVE_ACTION, PROGRESS_UPDATE, STRUGGLE_OR_SETBACK, QUESTION_SEEKING, REFLECTION_OR_IDENTITY, ADMIN_OR_NAVIGATION) and 4-part DEPTH response format (Mirror, Meaning, Heartbeat Link, Next Move).
- **Fallback engine**: `server/heartbeat.ts` — Local keyword-matching "Heartbeat Relay" system used as fallback when AI is unavailable. Also used directly for admin/navigation queries (stage check, focus check, heartbeat check, small step, save commands, log entries, goal queries).
- **Context injection**: System prompt dynamically receives user's active targeted/untargeted goal titles, obstacle, streak, growth stage, weakest heartbeat, and recent message history (last 6 messages).
- **API keys**: Managed via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`). No user API key required — charges go to Replit credits.

### Weekly Follow-Up Engine
- **Engine**: `server/weeklyReview.ts` — AI-powered weekly audit using OpenAI (gpt-4o) for heartbeat direction evaluation and collective analysis
- **Trigger**: Every 7 days from `users.weeklyCycleStart` (set at onboarding/user creation and reset on review completion)
- **Three sections**: Targeted Goal Progress (measurable data only), Heartbeat Direction (5 arrows: ↑/→/↓), Collective Analysis (max 4 sentences, objective tone)
- **Endpoints**: `GET /api/users/:userId/weekly-review/status`, `POST .../generate`, `POST .../:reviewId/complete`, `GET .../history`
- **UI**: `/weekly-review` route shows structured written report (not chat). Home screen shows amber banner when pending, compact snapshot after completion
- **Calendar**: Generates an entry in the entries table on review generation with heartbeat summary
- **Schema**: `weekly_reviews` table stores cycle dates, goal snapshots, heartbeat directions, and analysis text

### Water & Growth Engine
- **Engine**: `server/waterEngine.ts` — AI-powered water evaluation using OpenAI (gpt-4o) to determine if user message represents real execution vs. talk/intention
- **Schema**: `goals` table has `waterEvents` (0-49), `cupsFilled` (cumulative), `seedStage` (0-6)
- **Water rules**: Only awarded for measurable action aligned with active goal. 1 water per base action, 2 for photo+context proof. NOT awarded for conversation, venting, planning, or emotions.
- **Cup mechanics**: 50 water events = 1 full cup. Identity statements reveal at 25% ("I STARTED"), 50% ("I CAN'T QUIT NOW"), 75% ("I'M FINISHING THIS"), 100% ("I FOLLOW THROUGH"). Cup pours onto seed at 100%, water resets.
- **Seed stages**: 0=Dormant, 1=Germination (cup 1), 2=Primary Root (cup 2), 3=Root Expansion (cup 3), 4=Soil Pressure (cup 4), 5=Sprout Emergence (cup 5), 6=Early Plant (cup 8). Underground emphasis model.
- **Per-goal**: Each goal has independent water container, cups, and seed. Water does NOT transfer between goals.
- **Goal selection**: When both goals active, AI evaluates message against each goal and awards water to the best match.
- **UI**: WaterCup component (fill animation, markers, identity statements) + SeedGrowth component (underground root visualization) on Growth Dashboard

### Third-Party NPM Libraries (Notable)
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — Database ORM and migrations
- `pg` — PostgreSQL client
- `connect-pg-simple` — Session storage (available but sessions not currently implemented)
- `@tanstack/react-query` — Server state management
- `zustand` — Client state management
- `framer-motion` — Animations
- `wouter` — Client-side routing
- `shadcn/ui` ecosystem (Radix UI, tailwindcss, class-variance-authority, cmdk, etc.)
- `react-day-picker` — Calendar component
- `recharts` — Chart components
- `vaul` — Drawer component
- `stripe` — Payment processing via Stripe Checkout + Billing Portal
- `stripe-replit-sync` — Stripe schema sync and webhook management

### Subscription System
- **Tiers**: Lite (free, limited) and Premium ($9.99/month or $79.99/year)
- **States**: LITE, PREMIUM_TRIAL_ACTIVE, PREMIUM_ACTIVE, PREMIUM_GRACE_PERIOD, PREMIUM_EXPIRED, PAYMENT_FAILED, CANCELED_PENDING_EXPIRATION
- **Trial**: 14 days from user creation, auto-downgrade to Lite on expiry
- **Feature Gating**: Lite = 1 goal, basic water, no heartbeat trends. Premium = 2 goals, weighted water, heartbeat trends, deep weekly reviews, monthly recalibration.
- **Stripe Integration**: `server/stripeClient.ts` (Stripe client + sync), `server/webhookHandlers.ts` (webhook processing), `server/subscriptionEngine.ts` (state machine + feature limits)
- **Routes**: `POST /api/users/:userId/checkout` (Stripe Checkout), `POST /api/users/:userId/portal` (Billing Portal), `GET /api/users/:userId/subscription` (status), `GET /api/subscription/plans` (pricing)
- **UI**: Profile page shows subscription badge, trial countdown, and upgrade CTA. UpgradePrompt component shown at gate points (dual goals, heartbeat trends).

### Photo Attachment + Vision Analysis
- **Engine**: `server/visionAnalysis.ts` — OpenAI gpt-4o vision API analyzes photos for verified goal-aligned action
- **Schema**: `messages` table extended with `messageType` (text/photo), `status` (sent/pending_analysis/analyzed), `photoUrl`, `analysisJson`. New `photo_memories` table stores per-photo analysis results with water awards and tags.
- **Upload flow**: Presigned URL via Replit Object Storage → client uploads to storage → server runs vision analysis → awards water (0-2 max) based on confidence ≥ 0.75 and goal alignment
- **Water rules**: Server-side enforcement clamps water to 0-2. Irrelevant photos or confidence < 0.75 = 0 water. Strong photo proof with context = 2 water.
- **Calendar integration**: Photo uploads create entries in calendar memory bank. Calendar page shows photo memory thumbnails with detail view (analysis stats, Jae feedback, tags).
- **Routes**: `POST /api/users/:userId/messages/photo` (upload + analyze), `GET /api/users/:userId/photo-memories` (list)
- **UI**: Chat page has + button for camera/gallery attachment, photo preview before send, photo bubbles with water badges. Calendar shows photo memories with thumbnails.

### Multi-Platform Subscription Architecture
- **Platforms**: STRIPE (web), APPLE (iOS - future), GOOGLE (Android - future)
- **Schema fields**: `subscriptionPlatform` (STRIPE/APPLE/GOOGLE), `subscriptionProductId`, `lastReceiptValidation`
- **State machine**: Platform-agnostic `computeStateTransition()` and `validateReceiptUpdate()` in `server/subscriptionEngine.ts`
- **Receipt validation**: `POST /api/users/:userId/validate-receipt` (placeholder for Apple/Google store validation)
- **Sync endpoint**: `POST /api/users/:userId/sync-subscription` (derives effective state from database)
- **Badge labels**: CANCELED_PENDING_EXPIRATION = "Premium (Ends Soon)", PAYMENT_FAILED = "Payment Issue"
- **Feature gating rule**: Premium access granted for PREMIUM_TRIAL_ACTIVE, PREMIUM_ACTIVE, PREMIUM_GRACE_PERIOD, CANCELED_PENDING_EXPIRATION (before expiration)