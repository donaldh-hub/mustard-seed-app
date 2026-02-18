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