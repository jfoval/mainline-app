# Mainline App Blueprint
## Personal Productivity System Powered by GTD

**Last updated:** 2026-03-27
**Status:** Production-ready. Deployed on Vercel. 14+ pages, ~33 API routes. Offline-first PWA with conflict detection, rate limiting, fetch timeouts, dashboard caching, service worker cache versioning. AI uses Claude Opus 4.6. Week pattern rotation system. Disciplines & values tracking. User-configurable context lists. First-run setup wizard. All server-side time logic uses Central Time via `nowCentral()` helper.

---

## What This Is

A self-deployed personal GTD productivity app. Each customer gets their own instance on Vercel + Neon. Single-user, offline-first, AI-powered.

**Tech:** Next.js 16, TypeScript, Tailwind v4, Neon Postgres (`@neondatabase/serverless`), Claude API (Opus), PWA
**Location:** `/Users/johnfoval/Desktop/Mainline/app/`
**GitHub:** `https://github.com/jfoval/mainline-app` (private, repo rename pending)
**Live:** Deployed on Vercel (auto-deploys on push to `main`)
**Database:** Neon Postgres (free tier, US East 1)

---

## Deployment & Infrastructure

### Hosting
- **Vercel** (free tier) — auto-deploys from GitHub on every push to `main`
- **HTTPS** provided automatically by Vercel (voice capture works on iPhone without proxy)

### Database
- **Neon Postgres** (serverless, free tier, 0.5 GB storage)
- Driver: `@neondatabase/serverless` — all queries are async, uses tagged templates (`sql\`...\``) or `sql.query()`
- Connection via `DATABASE_URL` environment variable
- Neon handles backups (point-in-time recovery on free tier)
- JSON export still available via POST `/api/backup`

### Authentication
- Simple password auth (single user — John only)
- `src/middleware.ts` — checks JWT cookie on every request, redirects to `/login` if missing
- Login: `POST /api/auth/login` — validates email + bcrypt password hash, sets HTTP-only JWT cookie (7-day expiry)
- Logout: `POST /api/auth/logout` — clears cookie
- Login page: `/login` — email + password form
- Uses `jose` library for JWT, `bcryptjs` for password hashing

### Environment Variables (4, set in Vercel + `.env.local`)
- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_PASSWORD_HASH` — bcrypt hash of login password (or set via first-run setup wizard)
- `JWT_SECRET` — 64-char hex string for signing JWTs
- `ANTHROPIC_API_KEY` — (optional) Claude API key, can also be set in app Settings

### How to Deploy Changes
1. Edit code locally
2. `git add . && git commit -m "description" && git push origin main`
3. Vercel auto-deploys in ~60 seconds
4. **Important:** Commits must have author email `johnfoval@gmail.com` (matching GitHub account) or Vercel Hobby tier blocks the deploy. Git config is set in the repo (`git config user.email`), but if commits come from a new machine or tool, verify the email matches.

### How to Run Locally
- `npm run dev` (requires `.env.local` with all 5 env vars)
- Connects to the same Neon database as production

### Useful Scripts
- `node scripts/hash-password.mjs "new-password"` — generate bcrypt hash for AUTH_PASSWORD_HASH
- `node scripts/setup-schema.mjs` — create all tables on a fresh Neon database
- `node scripts/migrate-data.mjs` — one-time SQLite → Postgres data migration (requires better-sqlite3)

---

## Core Principles (Non-Negotiable)

1. **Capture = 2 seconds.** If it takes longer, it won't happen.
2. **Inbox zero daily.** Every inbox processed every morning.
3. **Every active project has a next action.** The iron rule. Stalled = no next action.
4. **Weekly review is THE non-negotiable.** Everything else can slip.
5. **Revenue first every day.** Slot 1 of Top 3 is always revenue-generating.
6. **No streaks, no guilt, no scorecards.** Safety net, not a cage.
7. **Next actions are concrete.** Not "handle taxes" but "Call Nathan at BCE CPA about quarterly estimate deadline."
8. **System works without automation.** AI, sync, scheduled tasks are convenience layers.
9. **Priority order:** God, family, business, self.

---

## What's Built (14 pages, 32+ API routes)

### Daily Workflows
- **Morning Process** (`/process`) — 5-step guided flow: reflection → inbox (with physical desk reminder) → revenue focus (pipeline + warm leads + stalled project alerts) → top 3 → ready
- **Shutdown** (`/shutdown`) — 3-step: capture sweep → write tomorrow → complete (shows Top 3 reflection)
- **Dashboard** (`/`) — routine blocks, stats, revenue focus, schedule, Top 3. Caches offline with stale-data banner. Girls week auto-detected.

### Core GTD
- **Inbox** (`/inbox`) — text + voice capture (Web Speech API)
- **Inbox Processing** (`/inbox/process`) — GTD decision tree, one item at a time, AI-assisted routing with concrete action enforcement. Quick-route buttons: trash, someday/maybe, reference, wish list, reading, movie, show, album, travel, discuss with Haley.
- **Next Actions** (`/actions`) — 7 context lists (@work, @errands, @home, @waiting_for, @agendas, @haley, @prayers)
- **Projects** (`/projects`, `/projects/[id]`) — CRUD with categories, Active/Someday-Maybe toggle, stalled project detection

### Life System
- **Horizons** (`/horizons`) — purpose, vision, goals, areas of focus, growth intentions
- **Reference/Lists** (`/reference`) — wish list (3 tiers), reading (3 statuses), movies, shows, albums, travel

### Reviews & AI
- **Weekly Review** (`/review`) — 8 guided steps with live system data and per-step notes (persisted on completion)
- **Monthly Review** (`/review`) — 12 steps (weekly 8 + goals check, thinking docs, systems check, personal pulse)
- **AI Assistant** (`/ai`) — 3 tabs: morning briefing, prioritize day, ask Claude (all Opus)
- **Recovery** (`/recovery`) — AI-powered "get back on track" guided re-engagement with validated app links
- **Settings** (`/settings`) — AI connection test, JSON data export, logout

---

## What's NOT Built Yet (P2)

- **Gmail integration** — email scanning/triage within the app
- **Google Calendar integration** — event display, prep prompts
- **Push notifications** — block transitions, inbox alerts
- **One-on-one rotation tracking** — which kid gets 1:1 time
- **Brain dump mode** — guided initial system population
- **Reference docs** — SOPs, brand guide, consulting rates
- **Signs of drifting alerts** — 10+ inbox items, 3+ days no usage
- **Test suite** — automated tests
- **Custom domain** — optional, Vercel supports it

---

## Timezone Handling (Central Time)

All server-side date/time logic uses **America/Chicago (Central Time)** via the `nowCentral()` helper in `src/lib/api-helpers.ts`. This is critical because Vercel servers run in UTC — without this, routine blocks, daily notes, and schedule detection would be 5-6 hours off.

- **Helper:** `nowCentral()` uses `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'` — no external libraries needed
- **Returns:** `timeStr` (HH:MM), `dateStr` (YYYY-MM-DD), `dayOfWeek`, `weekday`, `timestamp`, and a `date` object for girls-week calc
- **`nowLocal()`** calls `nowCentral().timestamp` for all `updated_at` fields
- **Used by:** All API routes that depend on current time (routine, dashboard, ai, review, recurring-tasks)
- **Rule:** Never use raw `new Date()` for time-sensitive logic in API routes — always use `nowCentral()`

---

## Girls Week Auto-Detection

Girls week alternates every week and is auto-calculated — no manual toggle needed.

- **Reference point:** Week of Monday March 16, 2026 = non-girls week
- **Logic:** `src/lib/girls-week.ts` — counts weeks from reference, odd = girls week
- **DST-safe:** Uses noon timestamps to avoid daylight saving edge cases
- **Used by:** Dashboard, routine API, AI briefing, offline store fallback
- **Sidebar:** Shows "Girls Week" or "Non-Girls Week" label (read-only)
- **Timezone:** Receives `nowCentral().date` so it calculates based on Central Time day, not UTC

---

## Offline-First Architecture

**IndexedDB is the client's source of truth.** Pages read from IndexedDB instantly, then sync with the server API in background.

### Stack
- **Dexie.js v4** for IndexedDB (`src/lib/offline/db.ts`)
- **Custom sync queue** — FIFO mutation queue, replayed on reconnect (`src/lib/offline/sync-queue.ts`)
- **Per-table store configs** — queryLocal, fetchUrl, create/update/remove (`src/lib/offline/stores.ts`)
- **React hook `useOfflineStore()`** — replaces useState+useEffect+fetch
- **SyncStatus pill** — red "Offline" / orange "Syncing X..." in bottom-right corner
- **Service worker** — caches app shell + key pages, versioned cache for deploy cache busting
- **Initial sync** — first visit hydrates all priority tables from server (30s timeout per fetch)

### Tables mirrored in IndexedDB (9)
`next_actions`, `inbox_items`, `list_items`, `pipeline_deals`, `pipeline_contacts`, `pipeline_warm_leads`, `projects`, `daily_notes`, `routine_blocks`

### What works offline on mobile
- View and check off next actions (all 7 context lists)
- Capture to inbox (text + voice via Web Speech API)
- View reference lists
- View contacts/pipeline before meetings
- Create new actions, inbox items, list items, projects

### What only works online (by design)
- Processing inbox, reviews, AI features, dashboard, horizons

---

## Durability Architecture

**The system protects your data at every layer.**

### Migration System
- `src/lib/migrations/runner.ts` — embedded SQL migrations (Postgres dialect), `schema_version` table tracks applied versions
- 4 migrations applied: baseline tables, updated_at columns, backup_log, client_notes + deal history

### Database Durability
- Neon Postgres handles backups, point-in-time recovery, and high availability
- JSON export available: POST `/api/backup` returns full database dump
- No more local file-based backups (was SQLite-specific)

### API Hardening
- `buildUpdate()` whitelists fields per table, generates Postgres `$1, $2, ...` parameterized queries
- try/catch on all handlers, input validation on all POST routes
- All PATCH routes return the updated record (not just `{success: true}`)
- Rate limiting on AI endpoint (20 req/min)
- 12-second fetch timeouts

### Conflict Detection
- Server PATCH routes check `_base_updated_at` → 409 on conflict
- `/conflicts` page for side-by-side resolution

---

## Daily Workflow

### Morning (7:30-8:00) — Morning Process page
1. Check yesterday's "Tomorrow." Answer 4 reflection questions.
2. Process inbox — every item through GTD decision tree. Also check physical desk inbox.
3. Revenue focus — app shows pipeline + warm leads. Pick highest-leverage revenue move.
4. Pick Top 3 — slot 1 = revenue focus. Slots 2-3 = other priorities.
5. Ready to work — summary of Top 3, context action counts.

### During the day
- Check @work list during work blocks
- Check @errands when leaving house
- Capture stray thoughts to inbox (voice or text)
- Check @agendas before meetings
- Check @haley during Haley time

### Shutdown (4:45-5:00) — Shutdown page
1. Capture sweep — anything uncaptured from today?
2. Write Tomorrow — check calendar, note prep needs.
3. Day complete — see Top 3 reflection. You're off.

### Evening
- @prayers during God time
- @haley items during Haley time

---

## Weekly Review (Saturday 7:30-8:30)

8 steps with per-step notes (saved on completion):

1. Clear ALL inboxes (app inbox, email, physical, phone notifications)
2. Review every active project + scan Someday/Maybe
3. Review all 7 context lists
4. Review @waiting-for and @agendas (stale items highlighted)
5. Review calendar (look back 1 week, forward 2 weeks)
6. Check recurring tasks (due items highlighted, inline CRUD)
7. Review pipeline and offerings
8. Review areas of focus (faith, marriage, kids, health, Nurik, LSU, music, finances, home, growth)

---

## Monthly Deep Review (one Saturday/month, ~2-3 hours)

Weekly review steps 1-8 first, then:

9. Goals check (goals vs active projects — aligned?)
10. Thinking docs review (connections, redundancy, consolidation)
11. Systems check (pick 1-2 areas to evaluate)
12. Personal pulse (spending time on what matters?)

---

## Revenue Priority Stack

Five levels in order:

1. **Client delivery** — active client work, deliverables due
2. **Warm prospect pursuit** — follow up with interested leads, proposals
3. **Build the next sellable thing** — offerings in progress
4. **Create a warm prospect** — outreach, networking, referral asks
5. **Content that attracts** — LinkedIn, thought leadership

Slot 1 of the daily Top 3 is always picked from the highest applicable level.

---

## Project Categories

nurik, personal, home, family, lsu, dj, music, health, finance

## Deal Stages

discovery → proposal_sent → negotiating → verbal_yes → closed_won → closed_lost

## Context Lists

@work, @errands, @home, @waiting_for (person + what + date), @agendas (person-specific), @haley, @prayers

## Routine Types

non_girls_week, girls_week, saturday, sunday

## Themed Afternoons

Monday: Business Development | Tuesday: Nurik IP | Wednesday: Business Development | Thursday: Research & Learning | Friday: Operations & Admin
