# Changelog

All notable changes to Mainline will be documented here.

## [0.7.1] - 2026-03-30

### Fixed — Critical
- **UTC date bug** — client-side `todayStr()` used `toISOString()` (UTC), causing wrong-day data after 6 PM in US timezones. Created shared `src/lib/date-utils.ts` using local timezone. Fixed in process, shutdown, disciplines, journal, dashboard, actions, inbox processing, and ideal calendar pages.
- **Server timezone date math** — `nowCentral().date` now uses `Date.UTC()` and `getMonday()` uses UTC methods, fixing date calculations on Vercel (which runs in UTC).

### Fixed — UI/UX
- **Dark mode color gaps** — fixed ~10 locations with hardcoded light-mode colors: actions context COLOR_MAP, disciplines checklist, reference rename/delete, settings sign-out, recovery warning, AI error banner, inbox AI suggestions, review page, login error.
- **Hover-only buttons invisible to keyboard users** — added `focus:opacity-100` / `focus-within:opacity-100` to delete/archive/edit buttons in inbox, projects, project detail, actions, and horizons pages.
- **Duplicate daily-blocks fetch** — DailyCalendar now accepts optional `initialBlocks` prop; dashboard passes pre-fetched blocks, eliminating a redundant API call.

### Fixed — Error Handling
- **Undo delete silent failure** — `undoableFetchDelete` now checks response status and logs errors instead of silently dropping failed DELETEs.
- **Fire-and-forget fetch in project detail** — `completeAction` now awaits the API call with error handling.
- **Missing error handling** — added `res.ok` checks to horizons (add/save/delete), disciplines (save), and ideal calendar (create pattern).
- **Missing try/catch** — wrapped AI route and maintenance route handlers in try/catch returning structured 500 errors.

### Fixed — Other
- **Unused imports removed** — `Lightbulb` from inbox/process, `ChevronDown`/`ChevronRight` from ideal calendar.
- **Service worker logout** — cache deletion now uses `event.waitUntil()` to prevent premature SW termination.
- **Proxy improvements** — added `robots.txt` to public paths; top-level import for session validity (removes dynamic import overhead).

## [0.7.0] - 2026-03-30

### Security
- **SQL injection fix in backup restore** — column names from backup JSON are now validated against a strict regex before SQL interpolation
- **Backup export no longer leaks secrets** — `auth_password_hash`, `jwt_secret`, `anthropic_api_key`, and `jwt_issued_after` are stripped from settings table exports
- **Server-side login rate limiting** — replaced client-side cookie-based rate limiting (easily bypassed) with server-side IP-based rate limiting with exponential backoff
- **Content-Security-Policy header** — added CSP to mitigate XSS attacks

### Fixed — Critical
- **Offline sync data loss** — incremental sync (`fetchAllData`) now checks the sync queue for pending mutations and skips overwriting records with local edits, preventing silent data loss during offline-to-online transitions
- **Silent data loss on sync retry exhaustion** — sync queue now dispatches a `mainline-sync-failure` custom event when mutations are dropped after 5 retries, so the UI can notify the user
- **Daily blocks double hydration** — added a lock to prevent concurrent dashboard + daily-blocks requests from creating duplicate blocks
- **Conflict resolution for 7 missing tables** — `urlForTable()` now maps all 13 data tables (was only 6), enabling conflict resolution for disciplines, context lists, daily blocks, journal entries, horizon items, and reference docs

### Fixed — Performance
- **Dashboard N+1 queries eliminated** — stalled projects detection now uses a single LEFT JOIN query instead of one query per project; projects GET uses a single query with subquery for action counts
- **Database indexes added** — migration 017 adds indexes on `next_actions(context, project_id, status)`, `inbox_items(status)`, `projects(status)`, `reference_docs(category)`
- **Sync queue mutex** — concurrent `processQueue` calls no longer process the same entries simultaneously

### Fixed — UI/UX
- **Dark mode colors** — fixed hardcoded light-mode-only colors throughout: dashboard alerts, "Do Differently" banner, morning process warnings, review page warnings, inbox AI suggestions, recovery page severity colors
- **Missing loading/error states** — added spinners and error UI to: project detail, review page, ideal calendar, morning process, shutdown routine
- **AI chat auto-scroll** — chat container now scrolls to the latest message automatically
- **Dashboard discipline toggle** — added error handling with rollback on API failure
- **Project archive** — now awaits API response before navigating away

### Added
- **Global error boundary** (`global-error.tsx`) — catches root layout errors with a retry button
- **OpenGraph & Twitter Card meta tags** — shared links now show title and description
- **Service worker cache bumped to v11** — with synchronized version constant in ServiceWorker.tsx

### Changed
- Removed orphaned "Thinking Doc Connections" step from monthly review (table was dropped in migration 011)
- PWA manifest `scope` field added for explicitness

## [0.6.0] - 2026-03-29

### Added
- **Comprehensive keyboard shortcuts** — global hotkey system with two-key chords (`g` + letter for navigation), flow quick-launch (Shift+M/S/R), context tab switching (1-9), and page-specific hotkeys throughout
- **Completion animation** — shared `CompletionCelebration` component with circle-draw + checkmark animation for morning process and shutdown routine final steps
- **Dashboard disciplines** — moved from process flows to dashboard as interactive inline checkmarks with optimistic toggle
- **"Do Differently Today" banner** — surfaces yesterday's evening reflection on the dashboard
- **Dashboard voice button** — redesigned to match inbox mic button style
- **Dark mode default** — new users now see dark mode immediately
- **Automatic data retention** — daily cleanup of old processed inbox items (30d), completed actions/projects (90d), discipline logs (90d), daily blocks (30d), backup logs (90d). All configurable via settings.
- **Configurable alert thresholds** — inbox overflow and stale waiting-for thresholds adjustable in Settings
- **Weekly review overdue alert** — indigo banner on dashboard when review is overdue
- **"All clear" dashboard state** — green banner when no alerts are active
- **Browser notifications** — now include stale waiting-for and review overdue conditions
- **Next actions tab counts** — context tabs show action count badges; tabs wrap on desktop, scroll on mobile
- **Dynamic inbox routing** — reference folders loaded dynamically during inbox processing; Someday/Maybe split into Personal and Work
- **Reference page overhaul** — removed personal lists; added Someday/Maybe (Personal & Work) cards; inline rename/delete for reference categories
- **Inline inbox item editing** — E hotkey to edit text, Enter/Escape to confirm/cancel
- **Morning Review in Shutdown** — moved to Evening Reflection step

### Changed
- Morning process: 3 steps (Daily Note & Reflection → Process Inbox → Ready to Work)
- Shutdown routine: 3 steps (Capture Sweep → Evening Reflection → Day Complete)
- Monthly review: 10 steps (6 weekly + 4 monthly-specific)

## [0.5.1] - 2026-03-28

### Fixed
- **Monthly review crash** — the review API still queried `health_log` and `business_health_log` tables that were dropped in migration 011. Starting a monthly review returned a 500 error, crashing the page when switching between tabs. Removed the dead queries.

---

## [0.5.0] - 2026-03-28

### Added
- **Journal page** (`/journal`) — combined daily view of morning reflections, free-form journal entries, and evening reflections. Date navigation with prev/next day, date picker, and Today button.
- **Journal entries** — free-form text entries with optional tags (gratitude, idea, lesson, goal, win, struggle, or custom). Inline editing and undoable deletes via the toast system.
- **Morning/evening reflection cards** — read-only display of daily reflection data from Morning Process and Shutdown, with links to edit in their respective flows. Amber border for morning, indigo for evening.
- **AI Journal Insights** — "Analyze Recent Entries" button that sends the last 14 days of journal entries and daily reflections to Claude for pattern analysis, theme identification, and actionable suggestions.
- **Offline-first journal** — full offline support with Dexie v8 IndexedDB table, sync queue integration, and incremental sync.
- New migration v13: `journal_entries` table (id, entry_date, content, tag, created_at, updated_at)
- New API: `/api/journal` with GET/POST/PATCH/DELETE
- Sidebar: Journal nav item (NotebookPen icon) between Disciplines and Horizons

---

## [0.4.1] - 2026-03-28

### Added
- **Global undo toast system** — every destructive action (delete, complete, archive) now shows a persistent toast with an Undo button. Toasts stay until you navigate away or dismiss them; no timer pressure. Undo restores the item instantly. Covers: actions, projects, inbox, reference docs, list items, disciplines, ideal calendar blocks/patterns, daily calendar blocks, and recurring tasks.
- New files: `src/lib/toast/ToastContext.tsx`, `src/lib/toast/useUndoableAction.ts`, `src/components/Toast.tsx`

### Changed
- **Inbox**: removed "Mark processed" button — redundant with the Process Inbox flow. Only Delete (with undo) remains on individual items.
- **Disciplines**: replaced `confirm()` dialog on delete with undo toast
- **Ideal calendar**: replaced `confirm()` dialog on delete pattern with undo toast

### Fixed
- TypeScript generic type cast error in `use-offline-query.ts` that was blocking Vercel deploys
- Added `ts-node` devDependency for CI jest config parsing

---

## [0.4.0] - 2026-03-28

### Fixed — Critical
- **SQL injection in backup restore** — table names from uploaded backup JSON are now validated against a strict whitelist before any SQL execution; unknown table names are silently skipped instead of interpolated directly into `TRUNCATE`/`INSERT` statements
- **Data loss on incremental sync** — replaced `dexieTable.clear()` with a set-difference delete that reads the sync queue first and preserves locally-created records that haven't reached the server yet; also skips overwriting records with pending local mutations
- **Concurrent sync race condition** — `syncInProgress` flag added to `performIncrementalSync()` so the 5-minute timer, `online` event, and `visibilitychange` event can no longer fire `fetchAllData()` simultaneously
- **Conflict resolution for unknown tables** — `urlForTable()` now returns `null` for unrecognised table names instead of constructing a guessed URL; `resolveKeepClient` exits cleanly with a console warning rather than firing a request to a 404 endpoint
- **`conflictId` non-null assertion in conflicts page** — conflicts without an auto-increment ID are filtered out before rendering; all `!` non-null assertions replaced with a typed local variable
- **`list_items` POST missing `updated_at`** — new list items now receive an explicit `created_at`/`updated_at` timestamp instead of the column default (`''`), which was silently breaking conflict detection on every newly created list item
- **`api-helpers.ts` crash on unexpected `Intl.DateTimeFormat` output** — replaced silent `!` non-null assertion with an explicit error message so a platform quirk doesn't produce a cryptic `Cannot read properties of undefined` crash that takes down every API write

### Fixed — Medium
- **`context-lists` PATCH race condition** — now returns `404` if the record cannot be found after update instead of returning a near-empty `{ id }` skeleton that would overwrite the client's full record
- **`ServiceWorker.tsx` cache eviction** — component was evicting caches that didn't match `mainline-v8`; the actual service worker is on `v10`, so `v9` and `v10` caches were never being cleaned up
- **`backup/restore` stale TABLE_ORDER** — 12 tables dropped in migration 011 were still listed, causing silent no-op `TRUNCATE` calls on every restore

### Fixed — Accessibility
- Removed `userScalable: false` and `maximumScale: 1` from viewport config — these settings prevent users who need zoom for accessibility from pinching to zoom (WCAG 1.4.4 violation)

---

## [0.3.0] - 2026-03-28

### Added
- Test suite with 66 tests across 6 modules: time-utils, api-helpers, version, pattern-resolver, pattern-resolver-db, session-validity, fetch-with-timeout
- Web Speech API TypeScript type declarations (`src/types/speech-recognition.d.ts`) — eliminates all `window as any` and `event: any` casts in voice capture
- `src/app/error.tsx` — React error boundary with "Try again" button and "Go to dashboard" link
- `src/app/not-found.tsx` — branded 404 page
- `aria-label` on all icon-only buttons across 8+ components (actions, inbox, disciplines, ideal-calendar, daily calendar, sidebar, install prompt, update checker, sync status)
- `robots.txt` at `/public/robots.txt` — blocks all search crawlers from this private app
- GitHub Actions CI workflow (`.github/workflows/test.yml`) — runs `tsc --noEmit` and `npm test` on every push and PR to `main`
- Mainline User Guide rewritten as markdown (`docs/Mainline User Guide.md`) — covers all features including dark mode, search, keyboard shortcuts, timezone, offline sync, settings, and deployment

### Security
- HTTP security headers in `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`
- `seedHorizons()` now uses `ON CONFLICT (id) DO NOTHING` — idempotent on retry after partial failure

### Fixed
- Replaced all 8 `alert()` calls with inline error state across 4 files — errors display contextually instead of blocking browser dialogs
- `animate-pulse` → `motion-safe:animate-pulse` throughout — respects user's reduce-motion preference
- PWA manifest: added `"id": "/"` field per spec; split `"purpose": "any maskable"` into separate icon entries

### Changed
- Removed `window as any` casts in voice capture (dashboard and inbox) — replaced with proper typed interfaces

## [0.2.0] - 2026-03-28

### Fixed
- DailyBlock type and store not exported from offline layer
- Horizons page function hoisting bug (useCallback refactor)
- Unused import in actions API route
- Dead script reference in package.json
- Export filename changed from "gtd-export" to "mainline-export"

### Security
- Settings GET endpoint now hides password hash, JWT secret, and masks API key
- Session invalidation on password change (jwt_issued_after)
- Service worker cache cleared on logout

### Added
- Configurable timezone (TIMEZONE env var or Settings page picker)
- Timezone picker in Settings with common IANA zones

### Changed
- Removed all GTD/personal branding from app UI, AI prompts, and documentation
- Dropped 12 unused legacy database tables (migration 011)
- Blueprint and README updated for all changes

## [0.1.0] - 2026-03-28

### Added
- Dark mode with theme toggle in Settings
- Search for inbox and actions pages
- Completed actions history view
- Keyboard shortcuts for inbox processing
- Undo last routing decision in inbox processing
- Data import/export (JSON backup & restore)
- Mini timeline on dashboard showing today's schedule
- Drag-to-reorder actions and daily calendar blocks
- PWA local notifications for inbox overflow and stalled projects
- Weekly/monthly review tracking with overdue warnings
- Shutdown celebration screen with summary
- Login rate limiting with exponential backoff
- Daily editable calendar system with ideal calendar patterns
- AI assistant with briefing, prioritization, and chat
- Offline-first with sync queue, conflict detection, and incremental sync
- One-click Deploy to Vercel setup
- In-app update notifications
