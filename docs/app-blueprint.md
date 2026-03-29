# Mainline App Blueprint
## Personal Productivity System

**Last updated:** 2026-03-28
**Status:** Production-ready. Deployed on Vercel. 19+ pages, ~30 API routes. Offline-first PWA with conflict detection, incremental sync (5 min + tab focus), rate limiting, fetch timeouts, dashboard caching, service worker v10. AI uses Claude Opus 4.6. Week pattern rotation system. Disciplines & values tracking. User-configurable context lists with inline context manager. First-run setup wizard. Dark mode. Keyboard shortcuts. Search. Drag-to-reorder. Undo. Data import/export. PWA notifications. Mini timeline. In-app update notifications. Configurable timezone via env var or Settings. Session invalidation on password change. Settings GET hides sensitive keys. Migration system at v015. Journal with AI insights. Horizons named-item blocks. Daily inbox type checkboxes. 70+ tests. HTTP security headers. Error boundary + 404 page. Backup restore SQL injection hardened. Sync data-loss fix.

---

## What This Is

A self-deployed personal productivity app. Each customer gets their own instance on Vercel + Neon. Single-user, offline-first, AI-powered.

**Tech:** Next.js 16, TypeScript, Tailwind v4, Neon Postgres (`@neondatabase/serverless`), Claude API (Opus), PWA
**Location:** `/Users/johnfoval/Desktop/Mainline/app/`
**GitHub:** `https://github.com/jfoval/mainline-app` (public)
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
- Simple password auth (single user per instance)
- `src/proxy.ts` — checks JWT cookie on every request, redirects to `/login` if missing
- Login: `POST /api/auth/login` — validates bcrypt password hash, sets HTTP-only JWT cookie (7-day expiry), rate limiting with exponential backoff after 3 failed attempts
- Logout: `POST /api/auth/logout` — clears cookie
- Login page: `/login` — email + password form
- Uses `jose` library for JWT, `bcryptjs` for password hashing

### Environment Variables (5, set in Vercel + `.env.local`)
- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_PASSWORD_HASH` — bcrypt hash of login password (or set via first-run setup wizard)
- `JWT_SECRET` — 64-char hex string for signing JWTs
- `ANTHROPIC_API_KEY` — (optional) Claude API key, can also be set in app Settings
- `TIMEZONE` — (optional) IANA timezone, defaults to `America/Chicago`, can also be set in app Settings

### How to Deploy Changes
1. Edit code locally
2. `git add . && git commit -m "description" && git push origin main`
3. Vercel auto-deploys in ~60 seconds
4. **Important:** Commits must have author email `johnfoval@gmail.com` (matching GitHub account) or Vercel Hobby tier blocks the deploy. Git config is set in the repo (`git config user.email`), but if commits come from a new machine or tool, verify the email matches.

### How to Run Locally
- `npm run dev` (requires `.env.local` with DATABASE_URL, JWT_SECRET, AUTH_PASSWORD_HASH, optional ANTHROPIC_API_KEY)
- Connects to the same Neon database as production

### Useful Scripts
- `node scripts/hash-password.mjs "new-password"` — generate bcrypt hash for AUTH_PASSWORD_HASH
- Schema creation and migrations run automatically on app startup via `ensureDb()` → `runMigrations()`

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

## What's Built (18+ pages, ~30 API routes)

### Daily Workflows
- **Morning Process** (`/process`) — 3-step guided flow: daily note & reflection (what matters most, who to be) + **Top 3 priorities inline** (#1 = "one action to move forward most", #2, #3; stalled projects flagged) → inbox with **inbox type checkboxes** (Physical/Work Email/Personal Email, user-configurable via gear icon; check state saves to `daily_notes.inbox_checks`) → animated completion celebration (auto-redirects to dashboard)
- **Shutdown** (`/shutdown`) — 3-step: capture sweep → evening reflection (did well, fell short, do differently) → animated completion celebration (auto-redirects to dashboard)
- **Dashboard** (`/`) — **Quick Stats above Now/Up Next** (new order: stats → Now/Up Next → Top 3 → Disciplines → Next Actions → Daily Calendar). Mini timeline, voice capture, refresh button with spinner.

### Core Productivity
- **Inbox** (`/inbox`) — text + voice capture (Web Speech API). Search filter for 5+ items.
- **Inbox Processing** (`/inbox/process`) — decision tree, one item at a time, AI-assisted routing. Keyboard shortcuts (Y/N/D, 1-8 for contexts, T/S/R, Esc). Undo last routing decision. Quick-route: trash, someday/maybe, reference, wish list, reading, movie, show, album, travel.
- **Next Actions** (`/actions`) — user-configurable context lists. **Gear icon opens inline context manager**: add/edit/delete contexts with color picker (key auto-gen from name). Active/Completed toggle. Search filter. Drag-to-reorder via @dnd-kit.
- **Projects** (`/projects`, `/projects/[id]`) — CRUD with categories, Active/Someday-Maybe toggle, stalled project detection

### Schedule System
- **Ideal Calendar** (`/ideal-calendar`) — week pattern editor with bi-weekly rotation (e.g., Girls Week / Non-Girls Week). Create named patterns with blocks per day.
- **Daily Calendar** (on dashboard) — auto-hydrated from ideal calendar. Per-day edits. Drag-to-reorder blocks (swaps time slots).
- **Disciplines** (`/disciplines`) — daily habit/value tracking with streaks and completion percentages

### Life System
- **Journal** (`/journal`) — combined daily view: morning reflections (read-only), free-form journal entries (create/edit/delete with tags), evening reflections (read-only). Date navigation. AI Insights analyzes last 14 days for patterns and themes.
- **Horizons** (`/horizons`) — purpose, vision, goals, areas of focus, growth intentions. **Named item blocks**: each section shows a list of user-created named items (with optional description) that can be added, edited, and deleted. Data stored in `horizon_items` table and synced via `/api/horizon-items`.
- **Reference/Lists** (`/reference`) — wish list (3 tiers), reading (3 statuses), movies, shows, albums, travel

### Reviews & AI
- **Weekly Review** (`/review`) — **6 guided steps** (recurring tasks step removed; notes sections removed). Live system data. Tracks last completion date, shows overdue warning if >8 days.
- **Monthly Review** (`/review`) — **10 steps** (weekly 6 + goals check, horizons review, systems check, personal pulse). Overdue warning if >35 days.
- **AI Assistant** (`/ai`) — 3 tabs: morning briefing, prioritize day, ask Claude (all Opus)
- **Recovery** (`/recovery`) — AI-powered "get back on track" guided re-engagement

### Settings & System
- **Settings** (`/settings`) — AI connection test, appearance (dark/light mode), timezone picker, notifications toggle, JSON data export + import, version check, logout
- **Sync Conflicts** (`/conflicts`) — side-by-side conflict resolution for offline sync
- **Setup** (`/setup`) — first-run wizard for password + database initialization
- **Login** (`/login`) — password auth with rate limiting (no sidebar shown)

---

## What's NOT Built Yet (P2)

- **Gmail integration** — email scanning/triage within the app
- **Google Calendar integration** — event display, prep prompts
- **One-on-one rotation tracking** — which kid gets 1:1 time
- **Brain dump mode** — guided initial system population
- **Custom domain** — optional, Vercel supports it

---

## Timezone Handling

All server-side date/time logic uses a configurable timezone via the `nowCentral()` helper in `src/lib/api-helpers.ts`. This is critical because Vercel servers run in UTC — without this, routine blocks, daily notes, and schedule detection would be hours off.

- **Timezone config:** Reads from `TIMEZONE` env var → `timezone` setting in DB → defaults to `America/Chicago`. Set in Settings page or `.env.local`.
- **Helper:** `nowCentral()` uses `Intl.DateTimeFormat` with the configured timezone — no external libraries needed
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
- **Dexie.js v4** for IndexedDB (`src/lib/offline/db.ts`) — schema version 9 (horizon_items added)
- **Custom sync queue** — FIFO mutation queue, replayed on reconnect (`src/lib/offline/sync-queue.ts`)
- **Per-table store configs** — queryLocal, fetchUrl, create/update/remove (`src/lib/offline/stores.ts`)
- **React hook `useOfflineStore()`** — replaces useState+useEffect+fetch
- **SyncStatus pill** — red "Offline" / orange "Syncing X..." in bottom-right corner
- **Service worker v10** — caches app shell + key pages, versioned cache for deploy cache busting, notification click handler
- **Initial sync** — first visit hydrates all priority tables from server (30s timeout per fetch)
- **Incremental sync** — refreshes all data every 5 minutes while online; `syncInProgress` flag prevents concurrent runs from the timer, online event, and visibilitychange firing simultaneously
- **Reconnect sync** — listens for `online` event and syncs immediately on reconnect
- **Tab focus sync** — refreshes data when user returns to the tab (`visibilitychange`)
- **Sync queue hardening** — exponential backoff (2s-30s), 5 retries, smart 404 handling
- **Safe table refresh** — incremental sync uses set-difference delete (not `clear()`) so locally-created records that haven't synced yet are never wiped; pending mutations are also skipped during upsert to avoid overwriting local edits with stale server state
- **Dark mode** — CSS variable overrides on `html.dark`, persisted to localStorage + settings API, flash-prevention inline script
- **Local notifications** — Notification API for inbox overflow and stalled projects (quiet hours 9pm-7am, 30-min interval)
- **Update notifications** — checks upstream GitHub repo for newer versions (24h client cache, 1h server cache), shows indigo banner with "How to Update" modal guiding users through GitHub fork sync. Settings → About shows current version + manual check button. Version injected at build time via `NEXT_PUBLIC_APP_VERSION` from package.json.

### Tables mirrored in IndexedDB (13)
`next_actions`, `inbox_items`, `list_items`, `projects`, `daily_notes`, `routine_blocks`, `reference_docs`, `disciplines`, `discipline_logs`, `context_lists`, `daily_blocks`, `journal_entries`, `horizon_items`

### What works offline on mobile
- View and check off next actions (all context lists)
- Capture to inbox (text + voice via Web Speech API)
- View reference lists
- Create new actions, inbox items, list items, projects

### What only works online (by design)
- Processing inbox, reviews, AI features, dashboard, horizons

---

## Durability Architecture

**The system protects your data at every layer.**

### Migration System
- `src/lib/migrations/runner.ts` — embedded SQL migrations (Postgres dialect), `schema_version` table tracks applied versions
- 15 migrations applied: baseline through daily_blocks, disciplines, context_lists, updated_at backfill, legacy table cleanup, reflection questions, journal_entries, inbox_checks (014), horizon_items (015)
- Note: Neon HTTP driver is stateless — each `sql.query()` is an independent request. DDL auto-commits in Postgres. No cross-query transactions.

### Database Durability
- Neon Postgres handles backups, point-in-time recovery, and high availability
- JSON export available: POST `/api/backup` returns full database dump
- JSON import available: POST `/api/backup/restore` — truncates + re-inserts in FK-safe order

### API Hardening
- `buildUpdate()` whitelists fields per table, generates Postgres `$1, $2, ...` parameterized queries
- try/catch on all handlers, input validation on all POST routes
- All PATCH routes return the updated record (not just `{success: true}`)
- Rate limiting on AI endpoint (20 req/min)
- 12-second fetch timeouts
- HTTP security headers on all responses: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`
- Backup restore (`POST /api/backup/restore`) validates all table names against a known whitelist — unknown names in uploaded JSON are silently ignored, not interpolated into SQL

### Conflict Detection
- Server PATCH routes check `_base_updated_at` → 409 on conflict
- `/conflicts` page for side-by-side resolution

### Session Security
- Password change (via setup) stores `jwt_issued_after` timestamp in settings
- Proxy middleware checks every JWT's `iat` against this — stale sessions are rejected
- Settings GET endpoint hides `auth_password_hash`, `jwt_issued_after`, `jwt_secret`; API key is masked
- Service worker cache cleared on logout (prevents back-button access to authenticated pages)

---

## Daily Workflow

### Morning (7:30-8:00) — Morning Process page
1. Daily Note & Reflection — "What matters most today?", "Who do I want to be today?", then Top 3 priorities inline: #1 = "What one action would move my life forward most?", #2 and #3 for next most important outcomes. Stalled projects flagged.
2. Process inbox — every item through decision tree. Also check physical desk inbox.
3. Completion animation — animated checkmark celebration, auto-redirects to dashboard.

### During the day
- Check @work list during work blocks
- Check @errands when leaving house
- Capture stray thoughts to inbox (voice or text)
- Check @agendas before meetings
- Check @haley during Haley time

### Shutdown (4:45-5:00) — Shutdown page
1. Capture sweep — anything uncaptured from today?
2. Evening reflection — "What did I do well?", "Where did I fall short, and why?", "What will I do differently tomorrow?"
3. Completion animation — animated checkmark celebration, auto-redirects to dashboard.

### Evening
- @prayers during God time
- @haley items during Haley time

---

## Weekly Review (Saturday 7:30-8:30)

6 steps (recurring tasks step and per-step notes removed in v0.6.0):

1. Clear ALL inboxes (app inbox, email, physical, phone notifications)
2. Review every active project + scan Someday/Maybe
3. Review all context lists
4. Review @waiting-for and @agendas (stale items highlighted)
5. Review calendar (look back 1 week, forward 2 weeks)
6. Review areas of focus (faith, marriage, kids, health, Nurik, LSU, music, finances, home, growth)

---

## Monthly Deep Review (one Saturday/month, ~2-3 hours)

Weekly review steps 1-6 first, then:

7. Goals check (goals vs active projects — aligned?)
8. Horizons review (scan for connections and gaps)
9. Systems check (pick 1-2 areas to evaluate)
10. Personal pulse (spending time on what matters?)

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

## Context Lists

@work, @errands, @home, @waiting_for (person + what + date), @agendas (person-specific), @haley, @prayers

## Routine Types

non_girls_week, girls_week, saturday, sunday

## Themed Afternoons

Monday: Business Development | Tuesday: Nurik IP | Wednesday: Business Development | Thursday: Research & Learning | Friday: Operations & Admin
