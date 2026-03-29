# Changelog

All notable changes to Mainline will be documented here.

## [0.3.0] - 2026-03-28

### Added
- Test suite with 66 tests across 5 modules (time-utils, api-helpers, version, pattern-resolver, session-validity)
- Web Speech API TypeScript type declarations (`src/types/speech-recognition.d.ts`)
- Mainline User Guide rewritten as markdown (`docs/Mainline User Guide.md`) — covers all features including dark mode, search, keyboard shortcuts, timezone, offline sync, settings, and deployment

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
