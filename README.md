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
- **AI Assistant** — powered by Claude (bring your own Anthropic API key)
- **Offline-first** — works without internet, syncs when back online
- **PWA** — install on your phone's home screen

## Deploy Your Own Instance

### Prerequisites

You'll need free accounts on three services:
1. **GitHub** — to get the code
2. **Vercel** — to host the app
3. **Neon** — for the database

### Step 1: Get the Code

Fork this repository to your own GitHub account (click the **Fork** button at the top right).

### Step 2: Create a Neon Database

1. Go to [neon.tech](https://neon.tech) and sign up (free tier works fine)
2. Create a new project (any name, pick a region near you)
3. Copy the **connection string** — it looks like `postgresql://neondb_owner:abc123@ep-cool-name-123.us-east-2.aws.neon.tech/neondb?sslmode=require`

### Step 3: Initialize the Database

Run this one-time command to set up your database tables:

```bash
DATABASE_URL="your-connection-string-here" node scripts/setup-schema.mjs
```

You can run this from your local machine (requires Node.js) or from any environment with Node installed.

### Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (free tier works)
2. Click **Add New Project** and import your forked repo
3. In the **Environment Variables** section, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string from Step 2 |
| `JWT_SECRET` | A random string (64+ characters). Generate one at [generate-secret.vercel.app](https://generate-secret.vercel.app/64) |

4. Click **Deploy**

### Step 5: Complete Setup

1. Visit your new Vercel URL (e.g., `your-app.vercel.app`)
2. You'll be guided through a setup wizard:
   - Set your password
   - Enter your name (optional)
   - Add an Anthropic API key for AI features (optional, can add later in Settings)
3. Done! You're logged in and ready to use Mainline.

## AI Features (Optional)

The AI assistant uses Claude by Anthropic. To enable it:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Either:
   - Add it during setup, OR
   - Add it later in Settings, OR
   - Set `ANTHROPIC_API_KEY` as an environment variable in Vercel

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
- **Claude API** (AI features)
- **PWA** (installable, works offline)
