# Mainline

A personal productivity system powered by GTD (Getting Things Done). Deploy your own instance — your data stays on your server.

## What You Get

- **Inbox capture** — voice or text, from anywhere
- **Morning Process** — daily reflection, inbox processing, top 3 priorities, discipline check-in
- **Shutdown Routine** — capture sweep, discipline review, tomorrow planning
- **Next Actions** — organized by user-configurable context lists (@Work, @Errands, @Home, etc.)
- **Projects** — multi-step outcomes with linked actions and stalled project alerts
- **Ideal Calendar** — multi-week pattern rotation (e.g., alternating A/B week schedules)
- **Disciplines & Values** — track daily habits and aspirational values with streaks and stats
- **Weekly Review** — guided GTD review process
- **AI Assistant** — powered by Claude (bring your own Anthropic API key, optional)
- **Offline-first** — works without internet, syncs when back online
- **PWA** — install on your phone's home screen

## Deploy Your Own Instance

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjfoval%2Fmainline-app&env=DATABASE_URL&envDescription=Neon%20Postgres%20connection%20string%20(free%20at%20neon.tech)&envLink=https%3A%2F%2Fneon.tech)

This button forks the repo, asks for one value, and deploys. **Before clicking**, get your database connection string:

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project (any name, pick a region near you)
3. Copy the **connection string** — it looks like `postgresql://neondb_owner:abc123@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`

Then click the button above, paste the connection string when asked, and deploy.

### After deploying

Visit your new Vercel URL and complete the setup wizard:
- Set your password
- Enter your name (optional)
- Add an Anthropic API key for AI features (optional — can also add later in Settings)

That's it. Everything else — database tables, security keys — is handled automatically on first launch.

---

### Manual setup (alternative)

If you prefer to deploy manually:

1. Fork this repository to your GitHub account
2. Create a Neon database at [neon.tech](https://neon.tech) and copy the connection string
3. Deploy to [Vercel](https://vercel.com) and set one environment variable:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string |

4. Visit your deployed URL and complete the setup wizard

> **JWT_SECRET is optional** — if not provided, a secure secret is generated automatically on first launch and stored in your database.

---

## AI Features (Optional)

The AI assistant uses Claude by Anthropic. To enable it:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Either:
   - Add it during the setup wizard, OR
   - Add it later in **Settings → Claude API Key**

Typical cost: a few dollars per month with regular use. You control the spend — there's no subscription.

## Staying Up to Date

Mainline will notify you in-app when a new version is available. To update:

1. Open the link to the Mainline repo on GitHub
2. Navigate to your fork (GitHub shows a link at the top)
3. Click **"Sync fork"** → **"Update branch"**
4. Vercel automatically rebuilds — refresh after about a minute

You can also check manually in **Settings → About → Check for Updates**.

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Neon Postgres** (serverless)
- **Dexie.js** (IndexedDB for offline support)
- **Claude API** (AI features, optional)
- **PWA** (installable, works offline)
