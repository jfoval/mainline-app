# Scripts

Utility scripts for the Mainline app.

---

## `hash-password.mjs`

Generates a bcrypt hash for your app password. Run this once during setup or whenever you change your password.

```bash
node scripts/hash-password.mjs
```

Paste the output hash into the Neon SQL editor:
```sql
INSERT INTO settings (key, value) VALUES ('auth_password_hash', '<paste hash here>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## `screenshot-swap.mjs`

Swaps between your real data and generic demo data for taking documentation screenshots. Keeps your personal data safe — nothing shows up in screenshots that you wouldn't want public.

### Usage

```bash
# 1. Back up your real data
node scripts/screenshot-swap.mjs backup

# 2. Load demo data (clears your real data from the DB temporarily)
node scripts/screenshot-swap.mjs seed

# 3. Take screenshots (see docs/screenshots/)

# 4. Restore your real data
node scripts/screenshot-swap.mjs restore
```

The backup is saved to `/tmp/mainline-backup.json`. This file is local only — never committed.

### What gets swapped

| Table | Demo content |
|-------|-------------|
| `projects` | 5 generic projects (Website Redesign, Kitchen Renovation, etc.) |
| `next_actions` | 15 active + 3 completed actions across all contexts |
| `inbox_items` | 5 pending items |
| `disciplines` | Exercise, Meditate, Read — 14 days of logs |
| `journal_entries` | 5 entries with varied tags (win, lesson, idea, etc.) |
| `daily_notes` | 1 note with Top 3 filled |
| `horizon_items` | 14 items across all 5 horizon levels |

Tables **not** touched by seed/restore: `settings`, `context_lists`, `week_patterns`, `week_pattern_blocks`, `daily_blocks`, `reference_docs`.

---

## `seed-demo-data.sql`

The same demo data as above, but as a raw SQL file you can run directly in the [Neon SQL editor](https://neon.tech) or via `psql`.

```bash
psql $DATABASE_URL -f scripts/seed-demo-data.sql
```

Useful if you want to set up a separate demo database, or if you prefer working in the Neon console directly.

The file includes a cleanup block at the bottom — uncomment and run it to remove all `demo-` prefixed rows.
