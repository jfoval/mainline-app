import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { isGirlsWeek as checkGirlsWeek } from '@/lib/girls-week';
import { nowCentral } from '@/lib/api-helpers';

function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

// Simple in-memory rate limiter
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const requestTimestamps: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) return false;
  requestTimestamps.push(now);
  return true;
}

export async function POST(req: NextRequest) {
  await ensureDb();

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
  }

  const body = await req.json();
  const { action, data } = body;

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'No Claude API key configured. Set ANTHROPIC_API_KEY environment variable.' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'process_inbox': return NextResponse.json(await processInboxItem(apiKey, data));
      case 'morning_briefing': return NextResponse.json(await morningBriefing(apiKey));
      case 'prioritize': return NextResponse.json(await prioritizeDay(apiKey));
      case 'worksheet': return NextResponse.json(await generateWorksheet(apiKey, data));
      case 'ask': return NextResponse.json(await askAssistant(apiKey, data));
      case 'client_notes': return NextResponse.json(await analyzeClientNotes(apiKey, data));
      case 'recovery': return NextResponse.json(await recoveryWorkflow(apiKey));
      default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const DEFAULT_MODEL = 'claude-opus-4-6';
const MODELS: Record<string, string> = {
  process_inbox: DEFAULT_MODEL,
  morning_briefing: DEFAULT_MODEL,
  prioritize: DEFAULT_MODEL,
  worksheet: DEFAULT_MODEL,
  ask: DEFAULT_MODEL,
  client_notes: DEFAULT_MODEL,
  recovery: DEFAULT_MODEL,
};

async function callClaude(apiKey: string, system: string, userMessage: string, action?: string): Promise<string> {
  const model = (action && MODELS[action]) || DEFAULT_MODEL;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, Record<string, string>>).error?.message || `API error: ${res.status}`);
  }

  const result = await res.json();
  return (result as { content: Array<{ text: string }> }).content[0].text;
}

// ─── Process Inbox Item ──────────────────────
async function processInboxItem(apiKey: string, data: { content: string }) {
  const projects = await sql`SELECT id, title, category FROM projects WHERE status = 'active' ORDER BY title` as Array<{ id: string; title: string; category: string }>;
  const projectList = projects.map(p => `- ${p.title} (${p.category})`).join('\n');

  const system = `You are a GTD (Getting Things Done) processing assistant for John, a business owner who runs Nurik (consulting/training), teaches at LSU, and records music. He has a wife Haley and 4 kids.

Your job is to help route inbox items through the GTD decision tree:
1. Is it actionable? If no: trash, someday/maybe, or reference.
2. If actionable: Is it a 2-minute task? If yes, do it now.
3. If longer: What context list? (@work, @errands, @home, @waiting_for, @agendas, @haley, @prayers)
4. Does it belong to an existing project? Or need a new one?

Active projects:
${projectList}

IMPORTANT: If the item is actionable, check if the suggested action is concrete and specific. A concrete action starts with a verb and specifies exactly what to do, who to contact, or what to produce.
Vague: "Handle taxes", "Deal with email", "Work on proposal"
Concrete: "Call Nathan at BCE CPA about quarterly estimate deadline", "Reply to Sarah's email about project timeline", "Draft introduction section of Acme Corp proposal"
If the action seems vague, set "concrete": false and provide a "reworded" field with a more specific version.

Respond with a JSON object (no markdown): {"actionable": boolean, "suggestion": "brief routing suggestion", "context": "@work|@errands|@home|@waiting_for|@agendas|@haley|@prayers|null", "project_match": "project title or null", "two_minute": boolean, "category": "action|trash|someday|reference|thinking|list", "concrete": true, "reworded": null}`;

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
  const ct = nowCentral();
  const today = ct.dateStr;
  const dayName = ct.weekday;

  const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
  const inboxCount = Number(inboxCountResult[0].count);

  const stalledProjects = await sql`
    SELECT p.title FROM projects p WHERE p.status = 'active' AND (SELECT COUNT(*) FROM next_actions WHERE project_id = p.id AND status = 'active') = 0
  ` as Array<{ title: string }>;

  const workActions = await sql`
    SELECT content FROM next_actions WHERE context = 'work' AND status = 'active' ORDER BY sort_order LIMIT 10
  ` as Array<{ content: string }>;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const waitingStale = await sql`
    SELECT content, waiting_on_person FROM next_actions WHERE context = 'waiting_for' AND status = 'active' AND waiting_since IS NOT NULL AND waiting_since <= ${sevenDaysAgo}
  ` as Array<{ content: string; waiting_on_person: string }>;

  const dailyNoteRows = await sql`SELECT * FROM daily_notes WHERE date = ${today}`;
  const dailyNote = dailyNoteRows[0] as Record<string, string> | undefined;

  const activeDeals = await sql`
    SELECT company, stage, next_action FROM pipeline_deals WHERE stage NOT IN ('closed_won', 'closed_lost')
  ` as Array<{ company: string; stage: string; next_action: string }>;

  const isGirlsWeek = checkGirlsWeek();

  const themes: Record<string, string> = {
    Monday: 'Business Development', Tuesday: 'Nurik IP', Wednesday: 'Business Development',
    Thursday: 'Research & Learning', Friday: 'Operations & Admin',
  };

  const context = `Today: ${dayName}, ${today}
Girls week: ${isGirlsWeek ? 'Yes' : 'No'}
Afternoon theme: ${themes[dayName] || 'Weekend'}
Inbox items: ${inboxCount}
Stalled projects: ${stalledProjects.map(p => p.title).join(', ') || 'None'}
@work actions: ${workActions.map(a => a.content).join('; ') || 'None'}
Stale waiting-for: ${waitingStale.map(w => `${w.content} (${w.waiting_on_person})`).join('; ') || 'None'}
Active deals: ${activeDeals.map(d => `${d.company} [${d.stage}]${d.next_action ? ': ' + d.next_action : ''}`).join('; ') || 'None'}
Top 3 from daily note: ${dailyNote ? [dailyNote.top3_revenue, dailyNote.top3_second, dailyNote.top3_third].filter(Boolean).join(', ') : 'Not set yet'}`;

  const system = `You are John's GTD assistant. Generate a concise morning briefing. Be direct, warm but professional. Focus on:
1. What needs attention today (revenue first)
2. Any alerts (stalled projects, stale waiting-for, full inbox)
3. Today's theme and recommended focus
Keep it to 150 words max. No markdown headers.`;

  const response = await callClaude(apiKey, system, context);
  return { briefing: response };
}

// ─── Prioritize Day ──────────────────────
async function prioritizeDay(apiKey: string) {
  const workActions = await sql`
    SELECT na.content, p.title as project_title FROM next_actions na LEFT JOIN projects p ON na.project_id = p.id WHERE na.context = 'work' AND na.status = 'active' ORDER BY na.sort_order
  ` as Array<{ content: string; project_title: string }>;

  const activeDeals = await sql`
    SELECT company, stage, next_action, value FROM pipeline_deals WHERE stage NOT IN ('closed_won', 'closed_lost')
  ` as Array<{ company: string; stage: string; next_action: string; value: string }>;

  const buildingNow = await sql`SELECT name, build_status FROM offerings WHERE readiness = 'building_now'` as Array<{ name: string; build_status: string }>;

  const context = `@work actions:\n${workActions.map(a => `- ${a.content}${a.project_title ? ` (${a.project_title})` : ''}`).join('\n') || 'None'}

Active deals:\n${activeDeals.map(d => `- ${d.company} [${d.stage}] ${d.value ? '$' + d.value : ''} ${d.next_action || ''}`).join('\n') || 'None'}

Building now:\n${buildingNow.map(o => `- ${o.name} ${o.build_status || ''}`).join('\n') || 'None'}`;

  const system = `You are John's GTD assistant. Apply the Revenue Priority Stack to recommend his Top 3 for today:
1. Client delivery (active deals with next actions)
2. Warm prospect pursuit
3. Build the next sellable thing
4. Create new prospects
5. Content / thought leadership

Return JSON (no markdown): {"top3": [{"task": "...", "why": "..."}], "revenue_focus": "one sentence"}`;

  const response = await callClaude(apiKey, system, context);
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { suggestion: response };
  }
}

// ─── Generate Worksheet ──────────────────────
async function generateWorksheet(apiKey: string, data: { child_name: string; subject?: string }) {
  const profileRows = await sql`SELECT * FROM learning_profiles WHERE name = ${data.child_name}`;
  const profiles = profileRows[0] as Record<string, string> | undefined;

  const profileContext = profiles
    ? `Name: ${profiles.name}\nType: ${profiles.type}\nGrade: ${profiles.grade || 'unknown'}\nAge: ${profiles.age || 'unknown'}\nFocus areas: ${profiles.focus_areas || 'general'}\nProgression: ${profiles.progression_path || 'standard'}\nProgress: ${profiles.progress_log || 'none yet'}`
    : `Name: ${data.child_name}. No learning profile found — generate a general age-appropriate worksheet.`;

  const system = `You are an educational worksheet generator. Create a timed practice worksheet for a child.
The worksheet should be:
- Printable (clean text format)
- 10-15 problems or questions
- Include clear instructions
- Include an answer key at the bottom
- Age and skill-level appropriate based on the profile
${data.subject ? `Focus on: ${data.subject}` : 'Choose the most relevant subject based on their focus areas.'}`;

  const response = await callClaude(apiKey, system, profileContext);
  return { worksheet: response, child: data.child_name };
}

// ─── General Assistant ──────────────────────
async function askAssistant(apiKey: string, data: { question: string; context?: string }) {
  const inboxCountResult = await sql`SELECT COUNT(*) as count FROM inbox_items WHERE status = 'pending'`;
  const projectCountResult = await sql`SELECT COUNT(*) as count FROM projects WHERE status = 'active'`;
  const actionCountResult = await sql`SELECT COUNT(*) as count FROM next_actions WHERE status = 'active'`;

  const inboxCount = Number(inboxCountResult[0].count);
  const projectCount = Number(projectCountResult[0].count);
  const actionCount = Number(actionCountResult[0].count);

  const system = `You are John's GTD assistant built into his personal productivity app. You have context about his system:
- ${inboxCount} inbox items pending
- ${projectCount} active projects
- ${actionCount} active next actions
${data.context || ''}

Be concise, practical, and direct. You know the GTD methodology deeply. John runs Nurik (consulting/training), teaches at LSU, records music, and has a wife Haley and 4 kids (Aiden, Liam, and two girls on alternating weeks).`;

  const response = await callClaude(apiKey, system, data.question);
  return { response };
}

// ─── Client Notes Analysis ──────────────────────
async function analyzeClientNotes(apiKey: string, data: { client_name: string; question: string }) {
  const notes = await sql`
    SELECT date, content FROM client_notes WHERE client_name = ${data.client_name} ORDER BY date DESC
  ` as Array<{ date: string; content: string }>;

  if (notes.length === 0) {
    return { response: `No notes found for ${data.client_name}.` };
  }

  const notesText = notes.map(n => `[${n.date}] ${n.content}`).join('\n\n');

  const contactRows = await sql`SELECT * FROM pipeline_contacts WHERE name = ${data.client_name}`;
  const contact = contactRows[0] as Record<string, string> | undefined;

  const deals = await sql`
    SELECT company, stage, value, next_action FROM pipeline_deals WHERE company = ${data.client_name}
  ` as Array<{ company: string; stage: string; value: string; next_action: string }>;

  const pipelineContext = contact
    ? `\nPipeline info: ${contact.contact_type}, ${contact.company || ''}, ${contact.role || ''}`
    : '';
  const dealsContext = deals.length > 0
    ? `\nDeals: ${deals.map(d => `${d.company} [${d.stage}] ${d.value ? '$' + d.value : ''}`).join('; ')}`
    : '';

  const system = `You are John's client notes analyst. You have access to all notes for the client "${data.client_name}".${pipelineContext}${dealsContext}

Your job is to answer questions about this client based on the notes. You can:
- Search for specific information mentioned in any note
- Summarize the relationship history
- Identify action items, commitments, or follow-ups mentioned
- Spot patterns or trends across the notes
- Provide a timeline of key events

Be concise and direct. Reference specific dates when citing information from notes.

Here are all the notes (newest first):
${notesText}`;

  const response = await callClaude(apiKey, system, data.question, 'client_notes');
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

  const system = `You are John's GTD recovery assistant. He's been away from his system and needs help getting back on track. Be warm but direct.

Generate a prioritized recovery plan based on the current system state. Focus on what matters most first.

Return JSON (no markdown): {"severity": "light|moderate|heavy", "steps": [{"title": "...", "description": "...", "link": "/page-url"}], "encouragement": "one sentence of encouragement"}

VALID LINKS (use ONLY these):
- /inbox/process — Process inbox items
- /projects — Review projects
- /actions — Review next action lists
- /review — Weekly or monthly review
- /pipeline — Pipeline and deals
- /process — Morning process
- /shutdown — Shutdown routine
- /horizons — Purpose, vision, goals
- /clients — Client notes
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
