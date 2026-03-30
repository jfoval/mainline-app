# Mainline User Guide

Your complete productivity system in one app.

**Version 0.6.0 · March 2026**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Your Daily Rhythm](#your-daily-rhythm)
3. [Page-by-Page Guide](#page-by-page-guide)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Dark Mode](#dark-mode)
6. [Search](#search)
7. [Offline & Mobile](#offline--mobile)
8. [Settings](#settings)
9. [Staying Up to Date](#staying-up-to-date)
10. [Backups & Safety](#backups--safety)

---

## Getting Started

Mainline is a self-deployed, single-user productivity app. Your instance runs on Vercel and stores data in a Neon Postgres database — both are yours, not shared with anyone.

### Accessing the App

- **Any browser:** Go to your Vercel URL (find it in your Vercel dashboard)
- **iPhone home screen:** Open Safari → go to your URL → tap Share → "Add to Home Screen." The app icon works like a native app with full offline support
- **Any device:** Log in with the password you set during setup

### Core Principles

These are baked into the app's design:

- **Capture takes 2 seconds.** Use the mic button on the dashboard or inbox page.
- **Inbox zero daily.** Process every item every morning.
- **Every active project has a next action.** If it doesn't, it's stalled.
- **Weekly review is the non-negotiable.** Everything else can slip.
- **This is a safety net, not a cage.** No streaks, no guilt, no scorecards.

---

## Your Daily Rhythm

The app is designed around three daily touchpoints.

### Morning (15–30 minutes)

Open **Morning Process** from the sidebar. It walks you through 3 steps:

1. **Daily Note & Reflection** — Two forward-looking reflection questions (What matters most today? Who do I want to be today?) followed by your Top 3 priorities: #1 asks "What one action, if completed today, would move my life forward most?", then #2 and #3 for second and third most important outcomes. Stalled projects (no next action) are flagged here too.
2. **Process Inbox** — Work through every inbox item using the decision tree. A checklist shows your configured inbox types (Physical, Work Email, Personal Email, etc.) — check each one off as you clear it. Tap the gear icon to add, edit, or delete inbox types. The check state saves daily so you can see what you've cleared.
3. **Done** — An animated checkmark celebration plays, then you're taken back to the dashboard automatically.

### During the Day

- Check your **@Work** list during focused work blocks
- Check **@Errands** when heading out
- Capture stray thoughts with the **mic button** on the dashboard
- Check **@Agendas** before meetings

### Shutdown (10–15 minutes)

Open **Shutdown** from the sidebar. 3 steps:

1. **Capture Sweep** — Add anything still in your head from today
2. **Evening Reflection** — What did I do well? Where did I fall short? What will I do differently tomorrow?
3. **Done** — An animated checkmark celebration plays, then you're taken back to the dashboard automatically.

---

## Page-by-Page Guide

### Dashboard (`/`)

Your home screen. Shows (in order):

- **Greeting** with today's date and week type (Girls Week / Non-Girls Week, auto-detected)
- **Alerts** for stalled projects and overflowing inbox
- **Quick Stats** — inbox count, action counts, active projects
- **Now / Up Next** — current and next calendar block with times
- **Top 3** — today's three priorities
- **Disciplines** — today's habit tracker
- **Next Actions** — action counts per context list
- **Daily Calendar** — today's schedule, pulled from your Ideal Calendar pattern and editable for today only

**Voice Capture:** The blue mic button (with `V` hotkey hint) captures thoughts directly to your inbox. Tap to start, tap to stop. Auto-saves with a green checkmark. Auto-stops after 15 seconds. Stat cards show inline hotkey hints (`I` for Inbox, `A` for Actions, etc.).

---

### Inbox (`/inbox`)

Where everything gets captured before you decide what to do with it.

- Type a thought and hit **Add**, or tap the mic button (with `V` hotkey hint) for voice capture
- Voice capture works in Safari and Chrome — it transcribes and saves automatically
- When you have unprocessed items, a **Process Inbox** button appears (with `P` hotkey hint)
- The capture input is not autofocused so keyboard shortcuts (`V` for voice, `P` for process) work immediately on page load
- Use the **search bar** to filter items by text

---

### Inbox Processing (`/inbox/process`)

The decision tree, one item at a time. For each item:

- **Is it actionable?** Choose Yes, No, or "Under 2 minutes — do it now"
- **If actionable:** refine the action text, pick a context list (@Work, @Home, @Errands, etc.), or create a multi-step project
- **If not actionable:** route it to Trash, Someday/Maybe (stored in Reference), Reference, Wish List, Reading List, Movie, Show, Album, or Travel Idea

The **AI assistant** can suggest routing and flag vague actions (like "handle taxes") with concrete rewrites (like "Call accountant to confirm Q1 estimate deadline").

**Keyboard shortcuts work here** — see [Keyboard Shortcuts](#keyboard-shortcuts).

**Undo:** Made a mistake? Hit the **Undo** button to go back to the previous item.

---

### Next Actions (`/actions`)

Your context lists. Tap a tab to switch between:

- **@Work** — things to do at your desk
- **@Home** — things to do around the house
- **@Errands** — things to do when you're out
- **@Waiting For** — things you're waiting on someone else for
- **@Agendas** — things to bring up with specific people
- **@Someday** — things to revisit later
- **@Prayers** — prayer items

Features:
- **Search:** Filter actions by text using the search bar
- **Complete:** Check the box to mark done. Completed actions move to the history tab
- **Drag to reorder:** Drag the handle on any action to reorder within a list
- **Active / Completed toggle:** Switch between open actions and your completion history
- **Context manager:** Tap the gear icon at the end of the tabs bar to add, edit, or delete context lists. Each context has a name and a color dot. Deleting a context removes the tab but does not delete the actions inside it.

---

### Projects (`/projects`)

Any outcome requiring more than one action step.

- Create projects with a title and category
- Each project shows its linked next actions
- **Stalled projects** (no next action) show a red alert
- Click a project to see its detail page with purpose, milestones, and all linked actions

---

### Ideal Calendar (`/ideal-calendar`)

Your template schedule editor. Set up how your weeks *should* look — separate from what actually happens each day.

- Create **week patterns** (e.g., "Week A", "Week B") with named time blocks for each day
- Set up a **bi-weekly rotation** so the app automatically knows which pattern applies this week
- Blocks copy to the **Daily Calendar** on the dashboard each morning, where you can edit them for that day only without affecting the template

---

### Disciplines (`/disciplines`)

Daily habit tracking. Each discipline shows:

- Today's completion status (tap to toggle)
- Streak count
- 30-day completion rate

Add disciplines from the settings area on the page. No judgment — it's a tool, not a scorecard.

---

### Journal (`/journal`)

Your daily journal — a combined view of reflections and free-form writing.

**What you see each day:**
- **Morning Reflection** (amber card) — read-only display of your morning reflection answers. Link to edit them in Morning Process.
- **Journal Entries** — your free-form writing for the day. Add as many entries as you like.
- **Evening Reflection** (indigo card) — read-only display of your evening reflection answers. Link to edit them in Shutdown Routine.

**Writing entries:**
- Tap **+ Add Entry** to start writing
- Optionally tag your entry: gratitude, idea, lesson, goal, win, struggle, or type a custom tag
- Tags appear as colored badges on each entry
- Edit or delete any entry with the pencil and trash icons
- Deleting shows an undo toast — tap Undo to restore

**Date navigation:**
- Use the left/right arrows to move between days
- Tap the date to open a date picker
- The **Today** pill jumps back to the current date

**AI Insights:**
- Tap **Analyze Recent Entries** at the bottom of the page
- Claude reviews your last 14 days of journal entries and daily reflections
- Returns insights about recurring themes, emotional patterns, progress toward goals, strengths, struggles, and one actionable suggestion

---

### Horizons (`/horizons`)

Big-picture alignment: purpose, vision, goals, areas of focus, and growth intentions. Review during monthly reviews to make sure daily work connects to what matters most.

Five levels — each shows a list of named items you create:
1. **Purpose** — Why you exist
2. **Vision** — What you're building toward (3–5 years)
3. **Goals** — 1–2 year specific outcomes
4. **Areas of Focus** — Ongoing roles and responsibilities
5. **Growth Intentions** — Skills, knowledge, and character traits you're developing

**Adding items:** Click **+ Add** on any section. Give it a name and optional description. Click the pencil to edit, trash to delete. Items are saved permanently and appear every time you visit.

---

### Reference / Lists (`/reference`)

Your personal reference lists:

- **Someday/Maybe** — ideas and projects you might pursue later (routed here from inbox processing, reviewed monthly)
- **Wish List** — 3 tiers (want, would be nice, someday)
- **Reading List** — 3 statuses (to read, reading, finished)
- **Movies / Shows / Albums** — to watch or listen to
- **Travel** — places you want to go
- **Reference Docs** — notes and links you want to keep

---

### Review (`/review`)

Guided weekly and monthly review workflow. The app tracks when you last completed each and shows overdue warnings.

**Weekly Review (6 steps):**
1. Clear ALL inboxes — app inbox, email, physical desk, phone notifications
2. Review every active project — still active? has next action?
3. Review all context lists — still relevant? right wording? already done?
4. Review @Waiting-For — follow up needed? stale items highlighted
5. Review calendar — look back 1 week, forward 2 weeks
6. Review areas of focus — are all areas represented in your projects?

**Monthly Deep Review (11 steps, extends to 2–3 hours):**
Do the weekly 6 steps first, then:
7. Someday/Maybe review — activate, delete, or leave for next month
8. Thinking doc connections — clusters, orphans, consolidation
9. Goals check — are your goals aligned with your active projects?
10. Systems check — pick 1–2 areas to evaluate
11. Personal pulse — are you spending time on what matters?

---

### AI Assistant (`/ai`)

Powered by Claude Opus. Three tools:

- **Morning Briefing** — generates a daily briefing based on your system (inbox, stalled projects, waiting-for items)
- **Prioritize Day** — suggests your Top 3 based on projects and priorities
- **Ask Claude** — free-form chat about your system, projects, or anything

Your API key is configured in **Settings → API Key**. Get one at [console.anthropic.com](https://console.anthropic.com). Costs roughly $2–5/month for daily use.

---

### Recovery (`/recovery`)

Fell off the wagon? The Recovery page uses AI to assess your system state and gives you a numbered recovery plan: which inbox to clear first, which stalled projects to address, whether you need a full weekly review. Color-coded severity. Each step links directly to the right page.

---

### Conflicts (`/conflicts`)

When offline edits can't be auto-merged (e.g., you edited the same action on two devices while offline), they land here. Review each conflict and choose which version to keep.

---

## Keyboard Shortcuts

All hotkeys are disabled when typing in an input, textarea, or select field.

### Global Navigation (two-key chord)

Press `g` then a letter within 1 second to navigate to any page:

| Chord | Page |
|-------|------|
| `g d` | Dashboard |
| `g m` | Morning Process |
| `g s` | Shutdown |
| `g i` | Inbox |
| `g a` | Next Actions |
| `g p` | Projects |
| `g c` | Ideal Calendar |
| `g l` | Disciplines |
| `g j` | Journal |
| `g h` | Horizons |
| `g f` | Reference |
| `g r` | Review |
| `g t` | AI Assistant |
| `g e` | Settings |

Hints are shown next to each sidebar item.

### Flow Quick-Launch

| Key | Flow |
|-----|------|
| `Shift+M` | Morning Process |
| `Shift+S` | Shutdown |
| `Shift+R` | Review |

### Dashboard

| Key | Action |
|-----|--------|
| `V` | Toggle voice capture |
| `I` | Navigate to Inbox |
| `A` | Navigate to Actions |
| `P` | Navigate to Projects |
| `W` | Navigate to Waiting For |
| `R` | Refresh dashboard |

### Inbox

| Key | Action |
|-----|--------|
| `V` | Toggle voice capture |
| `P` | Navigate to inbox processing |

### Inbox Processing

| Key | Action |
|-----|--------|
| `Y` | Yes — it's actionable |
| `N` | No — not actionable |
| `D` | Do it now (under 2 minutes) |
| `1`–`8` | Route to context 1–8 (shown on screen) |
| `T` | Route to Trash |
| `S` | Route to Someday/Maybe (stored in Reference) |
| `R` | Route to Reference |
| `Esc` | Go back / Undo last decision |

### Next Actions

| Key | Action |
|-----|--------|
| `1`–`9` | Switch to context tab 1–9 (by position) |

Number hints are shown on each context tab.

---

## Dark Mode

Toggle dark mode in **Settings → Appearance**. The preference is saved and persists across sessions. Dark mode uses deep navy and slate tones — not pure black — for easier reading in low light.

The login and setup pages always use the light theme.

---

## Search

Both the **Inbox** and **Next Actions** pages have a search bar that filters items in real time as you type. Search is client-side — it works offline and requires no network request.

---

## Offline & Mobile

The app works offline on your iPhone for the most common tasks.

### What works offline

- View and check off next actions (all context lists)
- Capture to inbox (text and voice)
- View reference lists
- Create new actions, inbox items, and projects
- View and edit today's Daily Calendar blocks

### What needs a connection

- Processing inbox (designed for desk work)
- Reviews
- AI features (Morning Briefing, Prioritize Day, Chat)
- Dashboard (requires today's data from server)

### How sync works

When you're offline, changes save locally to your device (IndexedDB). A status pill in the bottom-right corner shows **Offline** (red) or **Syncing...** (orange). Changes sync automatically when you reconnect. If two devices edit the same item, conflicts are sent to the Conflicts page for manual resolution.

Sync happens:
- On reconnect
- On tab focus (coming back to the app)
- Every 5 minutes in the background

---

## Settings

Access via **Settings** in the sidebar.

### Appearance
- **Dark mode** toggle — switches the entire app to dark theme

### Timezone
- **Timezone picker** — choose your local timezone. Defaults to America/Chicago. Affects how "today" is calculated for daily notes, dashboard data, and routine block timing.

### API Key
- **Anthropic API Key** — paste your key here to enable AI features. Saved securely to your database. Shows "configured" once saved (the raw key is never returned after saving).
- **Test Connection** button — verifies the key works before you rely on it.

### Account
- **Change Password** — goes to the setup page to set a new password. All existing login sessions are immediately invalidated.
- **Sign Out** — logs out of the current session.

### Data
- **Export Data as JSON** — downloads a full backup of all your data as `mainline-export.json`
- **Import Data from JSON** — restore from a previously exported file (replaces all current data)

### About
- **Current version** — shows your deployed version number
- **Check for Updates** — checks GitHub for a newer release and shows a banner if one is available

---

## Staying Up to Date

When a new version is available, a banner appears at the top of every page with the version number and release notes.

**To update your instance:**

1. Go to `https://github.com/jfoval/mainline-app`
2. Click **Sync fork → Update branch** (if you forked the repo)
3. Vercel auto-deploys within ~60 seconds — refresh the app to get the new version

Your data is never touched by a deploy.

---

## Backups & Safety

Your data is protected automatically:

- **Database:** Hosted on Neon Postgres with automatic backups and point-in-time recovery
- **Manual export:** Export all data as JSON from Settings anytime
- **Import:** Restore from any previous export file
- **Offline copy:** All common data is cached locally on your devices via IndexedDB
- **Session security:** Login sessions last 7 days. Changing your password immediately invalidates all existing sessions.
- **Single user:** Your app is password-protected — only you can access it

---

## Deploying Code Updates

If you're making code changes in a development session, deploy them by pushing to GitHub. Vercel auto-deploys on every push to `main`:

```bash
cd ~/Desktop/Mainline/app
git add -p        # stage changes
git commit -m "description"
git push origin main
```

Vercel rebuilds and restarts automatically. Your data is never affected by deploys.

To run locally for testing:

```bash
npm run dev       # start local dev server at localhost:3000
npm test          # run the test suite
npm run build     # verify the build compiles cleanly
```

---

*Mainline is open source. Contribute or report issues at [github.com/jfoval/mainline-app](https://github.com/jfoval/mainline-app).*
