# Mainline Quick Start Guide

*Your personal productivity system. Deploy it, own it, run your day.*

Version 0.8.0 | March 2026

---

## PART 1: Get Started Fast

*Everything you need to deploy Mainline and start using it today.*

Mainline is a personal productivity app that **you deploy and own**. It runs on Vercel (free) and stores your data in a Neon Postgres database (also free). Nobody else sees your data --- ever.

It's built on a simple loop that actually works:

**Capture > Organize > Act > Review**

Everything in your life --- tasks, ideas, reminders, random thoughts --- goes into one inbox. Every morning, you process that inbox: decide what's actionable, route it to the right place, and move on. During the day, you work from context-based action lists (@Work, @Errands, @Home, etc.). At night, you do a quick shutdown to clear your head. Once a week, you review everything to make sure nothing slipped through.

**That's the whole system.** Mainline just makes it fast, frictionless, and hard to forget.

### Key Concepts

**Inbox** --- The catch-all. Anything on your mind goes here --- voice or text. Don't organize it yet, just capture it. Process it every morning.

**Next Actions** --- Concrete, physical actions organized by context (where you are or what tool you need). Not "handle taxes" but "Call accountant to confirm Q1 estimate deadline." Each action lives in a context list like @Work, @Calls, @Errands, etc.

**Projects** --- Anything that takes more than one action step. "Plan vacation" is a project. "Book flights" is a next action inside that project. Every active project should have at least one next action --- if it doesn't, the app flags it.

### The Daily Rhythm

- **Morning Process** (~15 min): Set your Top 3 priorities, do a quick morning reflection, process your inbox
- **During the Day**: Work from your context lists. Capture stray thoughts with the mic button.
- **Shutdown** (~10 min): Sweep your head for anything uncaptured, review your disciplines, reflect on the day

### Other Features

**Weekly Review** (~60 min): The one habit that makes everything else work. Walk through your inboxes, projects, action lists, and calendar. The app guides you step by step.

**Reference** --- Non-actionable stuff worth keeping. Someday/Maybe ideas (personal and work), plus folders for reference notes.

**Horizons** --- Your big-picture alignment: purpose, vision, goals, areas of focus, and growth intentions. Reviewed monthly so your daily work connects to what actually matters.

---

### Step 1: Create your database (free)

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project (any name, pick a region near you)
3. Copy the **connection string** --- it looks like:
   `postgresql://neondb_owner:abc123@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`

### Step 2: Fork the repo and deploy to Vercel (free)

1. Go to [github.com/jfoval/mainline-app](https://github.com/jfoval/mainline-app) and click "Fork" (top right). This creates your own copy.
2. Go to vercel.com > "Add New" > "Project" > Import your fork
3. Add an environment variable: `DATABASE_URL` = your Neon connection string
4. Click Deploy and wait ~60 seconds

### Step 3: Set up your app

1. Visit your new Vercel URL (shown after deploy)
2. The setup wizard walks you through:
   - Set a password
   - Enter your name (optional)
   - Add a Claude API key for AI features (optional --- can add later)
3. **That's it.** Your database tables are created automatically.

> **Install on your iPhone:** Open Safari > go to your Vercel URL > tap Share > "Add to Home Screen." Works like a native app with full offline support.

> **Enable AI features (optional):** Get an API key at console.anthropic.com. Costs about $2--5/month. Add it in Settings > Claude API Key. Unlocks Morning Briefing, Prioritize Day, and AI Assistant.

---

### Your first 30 minutes

1. **Add 5--10 things to your inbox.** Brain dump. Meetings, tasks, ideas, "call mom" --- whatever's on your mind. Use the mic button or type.
2. **Process your inbox.** Tap "Process Inbox" and work through each item. The decision tree guides you: Is it actionable? Route it. Not actionable? Trash it, file it, or save it for someday.
3. **Check your Next Actions page.** Your routed actions are now organized by context.
4. **Try the Morning Process tomorrow.** Open it from the sidebar. It takes 15 minutes and sets up your whole day.

---

## PART 2: Going Deeper

*Whenever you're ready to get more out of the system.*

### Weekly Review

The weekly review is the single most important habit in this system. Everything else can slip for a day or two without consequences. But if you stop reviewing weekly, your system slowly becomes untrustworthy --- and then you stop using it.

The app guides you through 6 steps:

1. Clear ALL inboxes (app, email, physical desk, phone)
2. Review every active project --- still active? has a next action?
3. Review all context lists --- still relevant? right wording?
4. Review @Waiting For --- need to follow up on anything?
5. Review calendar --- look back 1 week, forward 2 weeks
6. Review areas of focus --- are all your life areas represented?

Block 60--90 minutes once a week. Saturday morning works great. The app tracks when you last completed a review and nudges you when you're overdue.

### Monthly Deep Review

Once a month, extend your weekly review with 4 extra steps:

1. Someday/Maybe --- activate anything whose time has come, delete anything dead
2. Goals check --- are your goals still aligned with your active projects?
3. Systems check --- pick 1--2 areas of your workflow to evaluate
4. Personal pulse --- are you spending time on what matters?

This is where you zoom out from "what am I doing this week" to "where is my life going."

### Ideal Calendar

Instead of building your schedule from scratch every day, create templates. Set up Week A and Week B patterns (e.g., Week A = normal work week, Week B = heavier meeting schedule), and the app rotates between them automatically. Each morning, today's template blocks appear on your dashboard --- editable for that day without changing the template.

### Disciplines

Track habits you want to build. The app shows completion status on your dashboard --- just tap to check off. During your nightly shutdown, you review what you did and didn't complete. No streaks that make you feel terrible when you miss a day. No gamification. Just a quiet tracker that's there when you want it.

### Journal

Write daily entries with optional tags (gratitude, idea, lesson, goal, win, struggle). Your morning and evening reflections show up here too. The AI can analyze your last 14 days of entries and surface patterns you might miss.

### Offline Support

Works offline for the most common tasks: viewing and completing actions, capturing to inbox (voice and text), viewing reference lists. Changes sync automatically when you reconnect. A status indicator in the corner tells you if you're offline or syncing.

### AI Features

Three tools, all powered by Claude:

- **Morning Briefing** --- a daily overview based on your real data (inbox, projects, actions, journal, disciplines)
- **Prioritize Day** --- suggests your Top 3 priorities based on what's active
- **AI Assistant** --- free-form chat with full context about your system. Ask things like "which projects are stalled?" or "what should I focus on this week?"

### Keyboard Shortcuts

Press **g** then a letter to navigate anywhere (**g d** = dashboard, **g i** = inbox, **g a** = actions, etc.). Hints show next to each sidebar item.

Inbox processing has full hotkeys: **Y/N** for actionable, **1--8** for context routing, **T** for trash, **S** for someday.

### Updates

The app checks for updates and shows a banner when a new version is available. To update:

1. Go to your fork on GitHub
2. Click "Sync fork" > "Update branch"
3. Vercel auto-deploys in about a minute

### Links

- GitHub: [github.com/jfoval/mainline-app](https://github.com/jfoval/mainline-app)
- Report bugs or request features via GitHub Issues

*Built with care. Enjoy.*
