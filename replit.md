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
- **Central Reward Engine**: `rewardEngine.ts` is the single source of truth for all AP/water/credit transactions. Contains `REWARD_CONFIG` (canonical mapping table for all action types with AP values, water eligibility, and celebration trigger rules), `processRewardTransaction()` (atomic DB write for goal AP/water/entry), and 90-second in-memory deduplication to prevent double-rewards on network retry. Celebration text in `routes.ts` is gated on `rewardResult.success === true`; if the DB write fails or the submission is duplicate, celebration is blocked and the reason is logged via `[REWARD]` prefix.
- **Growth Aggregation Engine**: `computeGrowthStateFromEntries(entryCount)` in `waterEngine.ts` is the shared display aggregation function. Each happy entry (VA/AR action) = 1 water unit. 10 water units = 1 cup. Cups drive seed stage via `STAGE_CUP_REQUIREMENTS`. Garden-summary uses this function instead of reading `goals.waterEvents` directly (which required 10 AP ≈ 4 VAs per unit — too slow for visible progress). `percentComplete` for goals without explicit metrics = `Math.min(100, waterEvents/50*100)` — monotonically increasing toward max growth.
- **Photo Attachment + Vision Analysis**: `visionAnalysis.ts` integrates OpenAI gpt-4o vision API to analyze uploaded photos, verifying goal-aligned actions and awarding water based on confidence. Photos are stored and linked to calendar entries.
- **Subscription System**: Manages user tiers (Lite, Premium) and their respective feature access, handling trials and various subscription states.
- **Stability Lock (Market Readiness)**: Surgical fixes applied — see "Stability Lock" section below.

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
### Timezone-Aware Entry System
- **Root cause fixed**: Previously, entries used `new Date().toISOString().split("T")[0]` (UTC) — users east of UTC got entries stamped on the wrong next day near midnight.
- **Client-side**: `client/src/lib/dateUtils.ts` provides `getLocalDateStr()` (local YYYY-MM-DD using `getFullYear/getMonth/getDate`) and `getUserTimezone()` (IANA string from `Intl.DateTimeFormat`).
- **API propagation**: `api.sendMessage` accepts `localDate` and `userTimezone` params; Chat.tsx calls both utilities before sending.
- **Server acceptance**: Chat handler extracts `clientLocalDate` and `clientTimezone` from `req.body`; all `todayStr()` entry creates in the handler are replaced with `clientLocalDate || todayStr()`.
- **Reward engine**: `RewardInput` now includes optional `userTimezone`; stored on the `entries` row.
- **Schema**: `entries` table has nullable `user_timezone text` column (backward-compatible with existing rows).
- **Fallback**: All non-chat routes (goal log, weekly review) also accept `localDate`/`userTimezone` from request body, falling back to `new Date().toLocaleDateString("en-CA")` (also local-time).

### Calendar Display Improvements
- **Chronological sort**: Entries within a day are sorted by `createdAt` ascending, so morning entries appear before evening entries.
- **Count badge**: Calendar day cells show a small badge with the number of entries when a day has more than 1 entry.
- **Entry count header**: The day detail panel already shows "X memories" count in the top-right.

### Stability Lock — Market Readiness Pass
Applied to `routes.ts`, `rewardEngine.ts`, `api.ts`, `Chat.tsx`, `GoalCompletionCeremony.tsx`:
- **localDate propagation**: `sendMessage` API now accepts and forwards `localDate` from the browser. Memory entries are stamped with the device's local date, not UTC server time. Photo endpoint already used this pattern.
- **Ceremony single-fire protection**: Dual dedup guard — `ceremonyGoalIdRef` (per-mount) + `sessionStorage.getItem("ceremony_shown_<goalId>")` (survives navigation and remount). Key is set before `setCeremonyPayload` to prevent any race.
- **completionGrowth null safety**: All boolean fields in the ceremony payload constructor now use explicit `=== true` / `?? 0` guards. Missing payload renders zero reward lines gracefully.
- **[CEREMONY_FLOW_ERROR]** tag: try/catch wraps the ceremony trigger block — errors logged with goalId and message.
- **[GOAL_FLOW_ERROR]** tag: Completion pipeline catch block replaced `[COMPLETION] Pipeline error` with structured `[GOAL_FLOW_ERROR] completion_pipeline`.
- **[REWARD_FLOW_ERROR]** tag: DB write failure in `rewardEngine.ts` replaced `[REWARD] DB_FAILURE`.
- **[MEMORY_WRITE_ERROR]** tag: Entry creation failure in `rewardEngine.ts` replaced `[REWARD] ENTRY_FAILURE`.
- **Ceremony console log sequence (exact)**: Logs moved from render body to `useEffect` to prevent render-phase side effects. Sequence now: `[CEREMONY] payload_received → mode_selected → animation_start → animation_complete (at 1600ms) → dismissed`.

### Goal Completion Ceremony (Phase 1)
- **Component**: `GoalCompletionCeremony` in `client/src/components/GoalCompletionCeremony.tsx`
- **Trigger**: Mounted in `Chat.tsx` via `AnimatePresence` + `ceremonyPayload` state; fires when `sendMutation.onSuccess` receives a `goalCompleted` payload with `category === "VA" || "AR"`
- **Dedup guard**: `ceremonyGoalIdRef` prevents duplicate overlays if the same completion callback fires twice
- **Modes**: BASIC (water only), CUP (cupJustFilled=true), STAGE (stageAdvanced=true). Mode determines headline, glow color, plant transition, and reinforcement copy.
- **Animation sequence**: overlay fade → seed visual scale-in → (stage burst if STAGE) → headline rise → reward lines stagger → reinforcement fade → Continue button fade. Total pre-dismiss time ~2.2s.
- **Dismiss**: Continue button OR tap-on-overlay after canDismiss=true. Sets `ceremonyPayload` to null; `CompletionCard` inline scroll reference remains for history.
- **Debug logs**: `[CEREMONY] payload received`, `[CEREMONY] mode selected`, `[CEREMONY] animation start`, `[CEREMONY] dismiss`

### Verified Action Streak System
- **Tracked field**: `users.streak` (current streak count), `users.previousStreak` (stored on reset)
- **Gap rules**: <24h gap → increment streak; 24-48h gap → preserve streak (at risk); >48h gap → reset to 1, save old value to `previousStreak`
- **Reflection entries excluded**: Only `VA`/`AR` primary category (after credibility validation) updates the streak; RW/IO/AD do not
- **Home streak card**: "Consistency Streak" card with three visual states — active (orange flame), at-risk (amber background + "At risk" badge + "Log today to protect your streak."), broken (muted flame + "Log a verified action to keep it alive."), new-begins (green text "New streak begins today." when `streak === 1 && previousStreak > 0`)
- **Pulse animation**: `streakPulsing` state triggers a Framer Motion scale pulse (1→1.04→1, 0.45s) whenever `currentStreak` increments between renders. `prevStreakRef` is declared before early returns to satisfy React hooks rules.

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

## Deployment Configuration

- **Target**: Autoscale
- **Build command**: `npm run build` → runs `script/build.ts` (Vite client build + esbuild server bundle)
- **Run command**: `node ./dist/index.js` (ESM bundle, top-level await supported)
- **Server bundle**: `dist/index.js` — esbuild ESM format with `createRequire` banner shim for CJS compat
- **Frontend build**: `dist/public/` — Vite output, served by `express.static` in production
- **Static path resolution**: `server/static.ts` uses `path.resolve(__dirname, "public")` with `process.cwd()+"/dist/public"` fallback
- **Port**: 5000 (mapped to external port 80)
- **Health check**: GET `/` returns 200 (index.html served by express.static)

### Reassessment Reminders & Settings Overhaul
- **User preference fields** (`shared/schema.ts`): `assessmentReminderCadenceMonths` (0=off, default 3), `notifyDailyEncouragement`, `notifyWeeklySummary`, `notifyAssessmentReminder` (all default true), `themePreference` ("light"/"dark", default "light"). Updated via existing `PATCH /api/users/:id`.
- **Reminder logic**: `Home.tsx` computes `daysSinceAssessment` from `assessment.createdAt` and compares against `cadenceMonths * 30`. When due and `notifyAssessmentReminder` is true, shows a dismissible banner ("It's been about N days since your last check-in...") with a "Retake Assessment" CTA. Dismissal is stored per-day in localStorage (`reassessment_banner_dismissed_<userId>` = today's date), so it reappears the next day if still due.
- **Settings & Profile** (`Profile.tsx`): Added "Notification Settings" section (Daily Encouragement, Weekly Summary, Assessment Reminder toggles + Reassessment Cadence dropdown: Off/3 months/6 months), an "Appearance" section (Dark Mode toggle), and a "Data Management" section (Clear Local Data — wipes localStorage/sessionStorage prefs and dismissed-banner state without touching account data).
- **Theme system**: `client/src/lib/theme.ts` provides `applyTheme()`/`getStoredTheme()`. Applied on app boot in `main.tsx` (toggles `.dark` class on `<html>`, persisted to `localStorage["pref_theme"]`) and synced to `user.themePreference` on change via `PATCH /api/users/:id`.
