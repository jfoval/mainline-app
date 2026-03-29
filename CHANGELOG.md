# Changelog

All notable changes to Mainline will be documented here.

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
