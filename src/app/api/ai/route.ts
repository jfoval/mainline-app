import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { nowCentral, daysAgoStr } from '@/lib/api-helpers';

// Cache the API key lookup with a 60-second TTL
let cachedApiKey: string | null | undefined = undefined;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function getApiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedApiKey;
  }

  // Check settings table first
  try {
    const row = await sql`SELECT value FROM settings WHERE key = 'anthropic_api_key'`;
    if (row.length > 0 && row[0].value) {
      cachedApiKey = row[0].value as string;
      cacheTimestamp = Date.now();
      return cachedApiKey;
    }
  } catch {
    // Settings table may not exist or key not set
  }

  // Fall back to env var
  cachedApiKey = process.env.ANTHROPIC_API_KEY || null;
  cacheTimestamp = Date.now();
  return cachedApiKey;
}

// Hybrid rate limiter: in-memory + database-backed (survives serverless cold starts)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
let requestTimestamps: number[] = [];
let lastDbSync = 0;

async function checkRateLimit(): Promise<boolean> {
  const now = Date.now();

  // Hydrate from DB if memory is empty (cold start)
  if (requestTimestamps.length === 0 && now - lastDbSync > RATE_LIMIT_WINDOW_MS) {
    try {
      const rows = await sql`SELECT value FROM settings WHERE key = 'ai_rate_limit'`;
      if (rows.length > 0) {
        const stored = JSON.parse(rows[0].value as string) as number[];
        requestTimestamps = stored.filter(t => t > now - RATE_LIMIT_WINDOW_MS);
      }
    } catch { /* settings table may not exist */ }
    lastDbSync = now;
  }

  // Prune expired timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_MAX) return false;
  requestTimestamps.push(now);

  // Persist to DB (fire-and-forget, non-blocking)
  const value = JSON.stringify(requestTimestamps);
  sql`INSERT INTO settings (key, value) VALUES ('ai_rate_limit', ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});

  return true;
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    if (!await checkRateLimit()) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
    }

    const body = await req.json();
    const { action, data } = body;

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'No Claude API key configured. Add one in Settings or set ANTHROPIC_API_KEY environment variable.' }, { status: 400 });
    }

    switch (action) {
      case 'process_inbox': return NextResponse.json(await processInboxItem(apiKey, data));
      case 'morning_briefing': return NextResponse.json(await morningBriefing(apiKey));
      case 'prioritize': return NextResponse.json(await prioritizeDay(apiKey));
      case 'ask': return NextResponse.json(await askAssistant(apiKey, data));
      case 'recovery': return NextResponse.json(await recoveryWorkflow(apiKey));
      case 'journal_insights': return NextResponse.json(await journalInsights(apiKey, data));
      default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Shared System Snapshot ──────────────────────
interface SystemSnapshot {
  today: string;
  dayName: string;
  inboxCount: number;
  projects: Array<{ title: string; category: string; purpose: string | null; actionCount: number }>;
  stalledProjects: Array<{ title: string; category: string }>;
  actions: Array<{ content: string; context: string; projectTitle: string | null; waiting_on_person: string | null; waiting_since: string | null; agenda_person: string | null }>;
  actionCounts: Record<string, number>;
  waitingFor: Array<{ content: string; waiting_on_person: string; waiting_since: string }>;
  horizons: Array<{ horizon_type: string; name: string; description: string | null }>;
  dailyNote: Record<string, string | null> | null;
  recentJournal: Array<{ entry_date: string; content: string; tag: string | null }>;
  disciplines: Array<{ name: string; completed: boolean }>;
  daysSinceReview: number;
}

async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const ct = nowCentral();
  const today = ct.dateStr;
  const dayName = ct.weekday;
  const sevenDaysAgo = daysAgoStr(7);

  const [
    inboxResult,
    projects,
    allActions,
    horizons,
    dailyNoteRows,
    journalEntries,
    disciplineRows,
    disciplineLogRows,
    lastReviewRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`,
    sql`SELECT p.title, p.category, p.purpose,
         (SELECT COUNT(*) FROM next_actions WHERE project_id = p.id AND status = 'active') as action_count
         FROM projects p WHERE p.status = 'active' ORDER BY p.title`,
    sql`SELECT na.content, na.context, p.title as project_title, na.waiting_on_person, na.waiting_since, na.agenda_person
         FROM next_actions na LEFT JOIN projects p ON na.project_id = p.id
         WHERE na.status = 'active' ORDER BY na.context, na.sort_order`,
    sql`SELECT horizon_type, name, description FROM horizon_items ORDER BY horizon_type, sort_order`,
    sql`SELECT * FROM daily_notes WHERE date = ${today}`,
    sql`SELECT entry_date, content, tag FROM journal_entries WHERE entry_date >= ${sevenDaysAgo} ORDER BY entry_date DESC, created_at DESC LIMIT 20`,
    sql`SELECT id, name FROM disciplines WHERE is_active = 1 ORDER BY sort_order`,
    sql`SELECT discipline_id FROM discipline_logs WHERE date = ${today}`,
    sql`SELECT value FROM settings WHERE key = 'last_weekly_review'`,
  ]);

  const inboxCount = Number(inboxResult[0].count);

  const projectList = (projects as Array<{ title: string; category: string; purpose: string | null; action_count: number }>)
    .map(p => ({ title: p.title, category: p.category, purpose: p.purpose, actionCount: Number(p.action_count) }));
  const stalledProjects = projectList.filter(p => p.actionCount === 0);

  const actionList = allActions as SystemSnapshot['actions'];

  const actionCounts: Record<string, number> = {};
  for (const a of actionList) {
    actionCounts[a.context] = (actionCounts[a.context] || 0) + 1;
  }

  const waitingFor = actionList
    .filter(a => a.context === 'waiting_for' && a.waiting_on_person)
    .map(a => ({ content: a.content, waiting_on_person: a.waiting_on_person!, waiting_since: a.waiting_since || '' }));

  const dailyNote = (dailyNoteRows[0] as Record<string, string | null>) || null;
  const recentJournal = journalEntries as SystemSnapshot['recentJournal'];

  const completedIds = new Set((disciplineLogRows as Array<{ discipline_id: string }>).map(r => r.discipline_id));
  const disciplines = (disciplineRows as Array<{ id: string; name: string }>)
    .map(d => ({ name: d.name, completed: completedIds.has(d.id) }));

  const lastReview = lastReviewRows[0] as { value: string } | undefined;
  const daysSinceReview = lastReview ? Math.floor((Date.now() - new Date(lastReview.value).getTime()) / (24 * 60 * 60 * 1000)) : 999;

  const horizonList = horizons as SystemSnapshot['horizons'];

  return {
    today, dayName, inboxCount, projects: projectList, stalledProjects,
    actions: actionList, actionCounts, waitingFor, horizons: horizonList as SystemSnapshot['horizons'],
    dailyNote, recentJournal, disciplines, daysSinceReview,
  };
}

function formatSnapshotForPrompt(s: SystemSnapshot): string {
  const sections: string[] = [];

  sections.push(`Today: ${s.dayName}, ${s.today}`);
  sections.push(`Inbox: ${s.inboxCount} items pending`);

  // Projects
  sections.push(`\nACTIVE PROJECTS (${s.projects.length}):`);
  if (s.projects.length > 0) {
    for (const p of s.projects) {
      sections.push(`- ${p.title} [${p.category}] — ${p.actionCount} action(s)${p.purpose ? ` — purpose: ${p.purpose}` : ''}`);
    }
  }
  if (s.stalledProjects.length > 0) {
    sections.push(`\nSTALLED PROJECTS (no next action): ${s.stalledProjects.map(p => p.title).join(', ')}`);
  }

  // Actions by context
  sections.push(`\nNEXT ACTIONS BY CONTEXT (${Object.values(s.actionCounts).reduce((a, b) => a + b, 0)} total):`);
  const contexts = [...new Set(s.actions.map(a => a.context))];
  for (const ctx of contexts) {
    const ctxActions = s.actions.filter(a => a.context === ctx);
    sections.push(`@${ctx} (${ctxActions.length}):`);
    for (const a of ctxActions.slice(0, 15)) {
      let line = `  - ${a.content}`;
      if (a.projectTitle) line += ` (project: ${a.projectTitle})`;
      if (a.waiting_on_person) line += ` [waiting on: ${a.waiting_on_person}${a.waiting_since ? ` since ${a.waiting_since}` : ''}]`;
      if (a.agenda_person) line += ` [agenda: ${a.agenda_person}]`;
      sections.push(line);
    }
    if (ctxActions.length > 15) sections.push(`  ... and ${ctxActions.length - 15} more`);
  }

  // Waiting-for summary
  if (s.waitingFor.length > 0) {
    const stale = s.waitingFor.filter(w => {
      const days = Math.floor((Date.now() - new Date(w.waiting_since).getTime()) / (24 * 60 * 60 * 1000));
      return days >= 7;
    });
    if (stale.length > 0) {
      sections.push(`\nSTALE WAITING-FOR (7+ days): ${stale.map(w => `${w.content} (${w.waiting_on_person}, ${w.waiting_since})`).join('; ')}`);
    }
  }

  // Daily note
  if (s.dailyNote) {
    const parts: string[] = [];
    if (s.dailyNote.top3_first) parts.push(`Top 3: ${[s.dailyNote.top3_first, s.dailyNote.top3_second, s.dailyNote.top3_third].filter(Boolean).join(', ')}`);
    if (s.dailyNote.reflection_matters_most) parts.push(`Matters most: ${s.dailyNote.reflection_matters_most}`);
    if (s.dailyNote.evening_did_well) parts.push(`Did well: ${s.dailyNote.evening_did_well}`);
    if (s.dailyNote.evening_fell_short) parts.push(`Fell short: ${s.dailyNote.evening_fell_short}`);
    if (parts.length > 0) {
      sections.push(`\nTODAY'S NOTE:\n${parts.join('\n')}`);
    }
  }

  // Horizons
  if (s.horizons.length > 0) {
    sections.push(`\nHORIZONS:`);
    const grouped = new Map<string, string[]>();
    for (const h of s.horizons) {
      if (!grouped.has(h.horizon_type)) grouped.set(h.horizon_type, []);
      grouped.get(h.horizon_type)!.push(h.description ? `${h.name}: ${h.description.slice(0, 100)}` : h.name);
    }
    for (const [type, items] of grouped) {
      sections.push(`${type}: ${items.join(', ')}`);
    }
  }

  // Disciplines
  if (s.disciplines.length > 0) {
    const done = s.disciplines.filter(d => d.completed).length;
    sections.push(`\nDISCIPLINES: ${done}/${s.disciplines.length} done today (${s.disciplines.map(d => `${d.name}: ${d.completed ? 'done' : 'pending'}`).join(', ')})`);
  }

  // Journal
  if (s.recentJournal.length > 0) {
    sections.push(`\nRECENT JOURNAL (last 7 days):`);
    for (const e of s.recentJournal.slice(0, 10)) {
      sections.push(`[${e.entry_date}]${e.tag ? ` #${e.tag}` : ''}: ${e.content.slice(0, 150)}`);
    }
  }

  // Review
  sections.push(`\nDays since last weekly review: ${s.daysSinceReview === 999 ? 'Never' : s.daysSinceReview}`);

  return sections.join('\n');
}

const DEFAULT_MODEL = 'claude-opus-4-6';
const DEFAULT_MAX_TOKENS = 1024;
const MODELS: Record<string, string> = {
  process_inbox: DEFAULT_MODEL,
  morning_briefing: DEFAULT_MODEL,
  prioritize: DEFAULT_MODEL,
  ask: DEFAULT_MODEL,
  recovery: DEFAULT_MODEL,
  journal_insights: DEFAULT_MODEL,
};
const MAX_TOKENS: Record<string, number> = {
  ask: 2048,
  morning_briefing: 1500,
  journal_insights: 2048,
};

async function callClaude(apiKey: string, system: string, userMessage: string, action?: string): Promise<string> {
  const model = (action && MODELS[action]) || DEFAULT_MODEL;
  const maxTokens = (action && MAX_TOKENS[action]) || DEFAULT_MAX_TOKENS;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const apiMsg = (err as Record<string, Record<string, string>>).error?.message || '';
    // Return user-friendly messages for common errors; don't leak raw Anthropic internals
    if (res.status === 401) throw new Error('Invalid API key. Check your Anthropic API key in Settings.');
    if (res.status === 429) throw new Error('Anthropic rate limit reached. Please wait a moment and try again.');
    if (res.status === 529) throw new Error('Anthropic API is temporarily overloaded. Please try again later.');
    if (apiMsg.toLowerCase().includes('credit') || apiMsg.toLowerCase().includes('billing')) {
      throw new Error('Anthropic billing issue. Check your API account at console.anthropic.com.');
    }
    throw new Error(`AI request failed (status ${res.status}). Check your API key and account.`);
  }

  const result = await res.json();
  return (result as { content: Array<{ text: string }> }).content[0].text;
}

// ─── Process Inbox Item ──────────────────────
async function processInboxItem(apiKey: string, data: { content: string }) {
  const projects = await sql`SELECT id, title, category FROM projects WHERE status = 'active' ORDER BY title` as Array<{ id: string; title: string; category: string }>;
  const projectList = projects.map(p => `- ${p.title} (${p.category})`).join('\n');

  // Get user's context lists dynamically
  const contextRows = await sql`SELECT DISTINCT context FROM next_actions WHERE status = 'active' ORDER BY context` as Array<{ context: string }>;
  const contextList = contextRows.map(c => `@${c.context}`).join(', ');

  const system = `You are an inbox processing assistant for a personal productivity system.

Your job is to help route inbox items through the decision tree:
1. Is it actionable? If no: trash, someday/maybe (personal or work), or reference.
2. If actionable: Is it a 2-minute task? If yes, do it now.
3. If longer: What context list? (${contextList || '@work, @errands, @home, @waiting_for, @agendas'})
4. Does it belong to an existing project? Or need a new one?

Active projects:
${projectList}

IMPORTANT: If the item is actionable, check if the suggested action is concrete and specific. A concrete action starts with a verb and specifies exactly what to do, who to contact, or what to produce.
Vague: "Handle taxes", "Deal with email", "Work on proposal"
Concrete: "Call accountant about quarterly estimate deadline", "Reply to Sarah's email about project timeline", "Draft introduction section of proposal"
If the action seems vague, set "concrete": false and provide a "reworded" field with a more specific version.

Respond with a JSON object (no markdown): {"actionable": boolean, "suggestion": "brief routing suggestion", "context": "${contextList ? contextList.split(', ')[0] : '@work'}|...|null", "project_match": "project title or null", "two_minute": boolean, "category": "action|trash|someday_personal|someday_work|reference|thinking", "concrete": true, "reworded": null}`;

  const response = await callClaude(apiKey, system, `Route this inbox item: "${data.content}"`);

  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return { result: JSON.parse(cleaned) };
  } catch {
    return { result: { suggestion: response } };
  }
}

// ─── Morning Briefing ──────────────────────
async function morningBriefing(apiKey: string) {
  const snapshot = await getSystemSnapshot();
  const systemContext = formatSnapshotForPrompt(snapshot);

  const system = `You are a productivity assistant. Generate a concise morning briefing. Be direct, warm but professional. Focus on:
1. What needs attention today (reference specific items)
2. Any alerts (stalled projects, stale waiting-for, full inbox, overdue review, incomplete disciplines)
3. Recommended focus areas based on their actual action lists and priorities
Keep it to 200 words max. No markdown headers.`;

  const response = await callClaude(apiKey, system, systemContext);
  return { briefing: response };
}

// ─── Prioritize Day ──────────────────────
async function prioritizeDay(apiKey: string) {
  const snapshot = await getSystemSnapshot();

  // Build context with all actions, stalled projects, and daily note
  const sections: string[] = [];

  sections.push(`Today: ${snapshot.dayName}, ${snapshot.today}`);

  if (snapshot.dailyNote) {
    const top3 = [snapshot.dailyNote.top3_first, snapshot.dailyNote.top3_second, snapshot.dailyNote.top3_third].filter(Boolean);
    if (top3.length > 0) sections.push(`Today's Top 3 (already set): ${top3.join(', ')}`);
  }

  if (snapshot.stalledProjects.length > 0) {
    sections.push(`Stalled projects (need next action): ${snapshot.stalledProjects.map(p => p.title).join(', ')}`);
  }

  // All actions by context
  const contexts = [...new Set(snapshot.actions.map(a => a.context))];
  for (const ctx of contexts) {
    const ctxActions = snapshot.actions.filter(a => a.context === ctx);
    sections.push(`\n@${ctx} (${ctxActions.length}):`);
    for (const a of ctxActions) {
      let line = `- ${a.content}`;
      if (a.projectTitle) line += ` (${a.projectTitle})`;
      if (a.waiting_on_person) line += ` [waiting on: ${a.waiting_on_person}]`;
      sections.push(line);
    }
  }

  const context = sections.join('\n');

  const system = `You are a productivity assistant. Help the user prioritize their day by recommending their Top 3 tasks from ALL their action lists (not just @work).

Consider:
- Urgency and deadlines
- Impact and importance
- Dependencies (what unblocks other work)
- Energy and focus requirements
- Stalled projects that need unblocking
- Already-set priorities in their daily note (align with or suggest changes)

Return JSON (no markdown): {"top3": [{"task": "...", "why": "..."}]}`;

  const response = await callClaude(apiKey, system, context);
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { suggestion: response };
  }
}

// ─── General Assistant ──────────────────────
async function askAssistant(apiKey: string, data: { question: string; context?: string }) {
  const snapshot = await getSystemSnapshot();
  const systemContext = formatSnapshotForPrompt(snapshot);

  const system = `You are a productivity assistant built into a personal productivity app. You have full access to the user's system data below. Use it to give specific, actionable answers — reference actual project names, action items, and data.

CURRENT SYSTEM STATE:
${systemContext}
${data.context ? `\nADDITIONAL CONTEXT: ${data.context}` : ''}

Be concise, practical, and direct. You understand capture-organize-act methodology deeply. When the user asks about their system, reference specific items by name.`;

  const response = await callClaude(apiKey, system, data.question, 'ask');
  return { response };
}

// ─── Recovery Workflow ──────────────────────
async function recoveryWorkflow(apiKey: string) {
  const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
  const inboxCount = Number(inboxCountResult[0].count);

  const stalledCountResult = await sql`
    SELECT COUNT(*) as count FROM projects WHERE status = 'active' AND id NOT IN (SELECT DISTINCT project_id FROM next_actions WHERE status = 'active' AND project_id IS NOT NULL)
  `;
  const stalledCount = Number(stalledCountResult[0].count);

  const sevenDaysAgo = daysAgoStr(7);
  const staleWaitingResult = await sql`
    SELECT COUNT(*) as count FROM next_actions WHERE context = 'waiting_for' AND status = 'active' AND waiting_since IS NOT NULL AND waiting_since <= ${sevenDaysAgo}
  `;
  const staleWaiting = Number(staleWaitingResult[0].count);

  const lastNoteRows = await sql`SELECT date FROM daily_notes ORDER BY date DESC LIMIT 1`;
  const lastNote = lastNoteRows[0] as { date: string } | undefined;
  const daysSinceNote = lastNote ? Math.floor((Date.now() - new Date(lastNote.date).getTime()) / (24 * 60 * 60 * 1000)) : 999;

  const lastReviewRows = await sql`SELECT value FROM settings WHERE key = 'last_weekly_review'`;
  const lastReview = lastReviewRows[0] as { value: string } | undefined;
  const daysSinceReview = lastReview ? Math.floor((Date.now() - new Date(lastReview.value).getTime()) / (24 * 60 * 60 * 1000)) : 999;

  const context = `System state:
- Inbox items: ${inboxCount}
- Stalled projects (no next action): ${stalledCount}
- Stale @waiting_for (7+ days): ${staleWaiting}
- Days since last daily note: ${daysSinceNote}
- Days since last weekly review: ${daysSinceReview}`;

  const system = `You are a productivity recovery assistant. The user has been away from their system and needs help getting back on track. Be warm but direct.

Generate a prioritized recovery plan based on the current system state. Focus on what matters most first.

Return JSON (no markdown): {"severity": "light|moderate|heavy", "steps": [{"title": "...", "description": "...", "link": "/page-url"}], "encouragement": "one sentence of encouragement"}

VALID LINKS (use ONLY these):
- /inbox/process — Process inbox items
- /projects — Review projects
- /actions — Review next action lists
- /review — Weekly or monthly review
- /process — Morning process
- /shutdown — Shutdown routine
- /horizons — Purpose, vision, goals
- /reference — Reference lists

Guidelines:
- light: inbox < 5, recent review, recent notes
- moderate: inbox 5-20, or missed 1 review, or a few stalled projects
- heavy: inbox 20+, or missed 2+ reviews, or many stalled projects`;

  const response = await callClaude(apiKey, system, context);
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { severity: 'moderate', steps: [
      { title: 'Process your inbox', description: `You have ${inboxCount} items waiting.`, link: '/inbox/process' },
      { title: 'Check stalled projects', description: `${stalledCount} projects have no next action.`, link: '/projects' },
      { title: 'Do a weekly review', description: 'Get the full picture of your system.', link: '/review' },
    ], encouragement: 'Every return to the system makes the system stronger.' };
  }
}

// ─── Journal Insights ──────────────────────
async function journalInsights(apiKey: string, data: { days?: number }) {
  const days = data?.days || 14;
  const since = daysAgoStr(days);

  const entries = await sql`
    SELECT entry_date, content, tag FROM journal_entries
    WHERE entry_date >= ${since}
    ORDER BY entry_date ASC, created_at ASC
  ` as Array<{ entry_date: string; content: string; tag: string | null }>;

  const notes = await sql`
    SELECT date, reflection_matters_most, reflection_who_to_be, reflection_one_action,
           evening_did_well, evening_fell_short, evening_do_differently
    FROM daily_notes
    WHERE date >= ${since}
    ORDER BY date ASC
  ` as Array<Record<string, string | null>>;

  if (entries.length === 0 && notes.length === 0) {
    return { insights: `No journal entries or reflections found in the last ${days} days. Start writing to get personalized insights!` };
  }

  const entryLines = entries.map(e =>
    `[${e.entry_date}]${e.tag ? ` #${e.tag}` : ''}: ${e.content}`
  ).join('\n');

  const noteLines = notes
    .filter(n => n.reflection_matters_most || n.evening_did_well)
    .map(n => {
      const parts: string[] = [`[${n.date}]`];
      if (n.reflection_matters_most) parts.push(`Matters most: ${n.reflection_matters_most}`);
      if (n.reflection_who_to_be) parts.push(`Who to be: ${n.reflection_who_to_be}`);
      if (n.evening_did_well) parts.push(`Did well: ${n.evening_did_well}`);
      if (n.evening_fell_short) parts.push(`Fell short: ${n.evening_fell_short}`);
      return parts.join(' | ');
    }).join('\n');

  const context = `JOURNAL ENTRIES (last ${days} days):\n${entryLines || 'None'}\n\nDAILY REFLECTIONS:\n${noteLines || 'None'}`;

  const system = `You are a thoughtful journal analyst. Review the user's journal entries and daily reflections. Identify:
1. Recurring themes or patterns
2. Emotional trends (energy, mood, motivation)
3. Progress toward stated goals or intentions
4. Strengths being demonstrated
5. Recurring struggles or friction points
6. One actionable suggestion for the coming week

Be warm, insightful, and specific — reference actual entries. Keep your response under 300 words. Use plain text, no markdown headers.`;

  const response = await callClaude(apiKey, system, context, 'journal_insights');
  return { insights: response };
}
