# Mustard Seed

## Overview

Mustard Seed is a personal accountability and growth tracking web application. It uses a tree/garden metaphor where users "plant a seed" and nurture it through consistent action towards their goals. The application features an AI-like coach, "Jae," to guide users, progress visualization, a calendar-based journal, and a user profile. The core vision is to foster long-term behavioral change through a structured yet supportive environment, emphasizing measurable action over mere intention.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite, Wouter for routing, Zustand for client state, and TanStack React Query for server state.
- **UI/UX**: shadcn/ui (new-york style) with Radix UI and Tailwind CSS v4. Features a "Seedling" theme with organic colors, DM Sans and Lora fonts, and Framer Motion for animations. Designed mobile-first with a bottom tab navigation.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **API**: RESTful JSON API.
- **Jae AI Coach**: Utilizes a three-layer conversation-driven accountability model. The primary engine, `jaeCoach.ts`, uses OpenAI (gpt-4o) for DEPTH coaching (Mirror, Meaning, Heartbeat Link, Next Move) with dynamic context injection. A local keyword-matching "Heartbeat Relay" (`heartbeat.ts`) serves as a fallback and handles admin queries.
- **Weekly Follow-Up Engine**: `weeklyReview.ts` (OpenAI gpt-4o) generates structured weekly audits on goal progress, heartbeat direction, and collective analysis.
- **Water & Growth Engine (TITAN 1.2)**: `titan.ts` implements a deterministic, keyword-based classification system for user actions. It categorizes actions into Verified Action (VA), Adaptive Recovery (AR), Reflection Without Action (RW), Intention Only (IO), and Avoidance/Drift (AD), awarding Action Points (AP) that convert to "water" for seed growth. This engine includes escalation mechanics for drift and inactivity and tracks heartbeat credits.
- **Photo Attachment + Vision Analysis**: `visionAnalysis.ts` integrates OpenAI gpt-4o vision API to analyze uploaded photos, verifying goal-aligned actions and awarding water based on confidence. Photos are stored and linked to calendar entries.
- **Subscription System**: Manages user tiers (Lite, Premium) and their respective feature access, handling trials and various subscription states.

### Database
- **Type**: PostgreSQL, accessed via `DATABASE_URL`.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: Key tables include `users`, `messages`, `entries`, `assessments`, `weekly_reviews`, `goals`, `photo_memories`, and `commitments`. These store user data, chat history, journal entries, assessment results, review data, goal progress (including water events, cups filled, seed stage), photo analysis results, and tracked commitments.

### Shared Code
- `shared/schema.ts`: Contains Drizzle table definitions, Zod schemas, and TypeScript types for client and server.

## External Dependencies

- **PostgreSQL Database**: Essential for all persistent data storage.
- **OpenAI API**: Utilized for the Jae AI Coach, Weekly Follow-Up Engine, and Photo Vision Analysis. Managed via Replit AI Integrations.
- **Stripe**: Handles subscription management, including checkout, billing portal, and webhook processing for various subscription states.
- **Replit Object Storage**: Used for storing user-uploaded photos.
- **Google Fonts**: For loading DM Sans and Lora fonts.
### Progress Recognition + Anime Celebration Engine
- **Trigger**: TITAN classifies message as VA (Verified Action) or AR (Adaptive Recovery)
- **Response structure**: 1) Random anime celebration line (25-item pool), 2) Action acknowledgment (echoes user's action or references resolved commitment), 3) Emotion validation if detected (nervous, anxious, hard, etc.), 4) Water reward acknowledgment when water is awarded, 5) Random next-step reinforcement question
- **Commitment callback**: When VA/AR auto-resolves a pending commitment, celebration references it: "You said you'd [action] — and you followed through."
- **Pronoun swap**: Action echo converts first-person to second-person (I→you, my→your, I was→you were)
- **Memory storage**: VA/AR entries stored in entries table with mood="happy" and summary=rawText

### Onboarding Flow
- **Screens**: Welcome → Orientation → Assessment → Home
- **One-time only**: `onboardingCompleted` flag in localStorage (Zustand store) prevents re-display
- **Route guards**: Welcome, Orientation, and Assessment all check onboardingCompleted and redirect to /home with replace navigation
- **No back-nav**: All onboarding transitions use `{ replace: true }` to prevent browser back-button access
- **Profile goal display**: Reads from garden-summary (goals table) as primary source, falls back to users.goals array

### Water Reward System
- **Cup fill formula**: `fillPercent = min(100, waterEvents * 10 + actionPoints)` — shows AP sub-progress within the current water unit
- **Water acknowledgment**: Every VA/AR with AP > 0 and an active goal triggers "Water added to your cup." in Jae's celebration text
- **Mini water cup**: Displayed in Chat header next to Jae's avatar when user has an active goal; shows current fill level with animation on reward
- **Cup animation**: On water awarded, the mini cup animates fill. If cup just filled (threshold crossed), it shows fill→empty→new-fill sequence
- **Photo water**: Photo endpoint also returns `water` object and appends " Water added to your cup." to Jae's response when photo AP earns water
- **cBurn guard**: VA/AR messages clear cBurn; escalation no longer re-sets cBurn after a verified action in the same request
- **Goal type confirmation**: Accepts "target", "targeted", or "identity" (case-insensitive) for goal type selection
- **App reset**: Adding `?reset=1` to URL clears localStorage and restarts onboarding for a fresh user
