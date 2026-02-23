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