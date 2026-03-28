'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2, Circle, AlertTriangle, Inbox,
  FolderKanban, ListTodo, Clock, Calendar, RotateCcw,
  Target, ArrowRight, Check, Sparkles, Plus, Trash2
} from 'lucide-react';
import Link from 'next/link';

interface ReviewData {
  type: string;
  inbox_count: number;
  active_projects: Array<{ id: string; title: string; category: string; active_action_count: number; updated_at: string }>;
  stalled_projects: Array<{ id: string; title: string; category: string }>;
  someday_projects: Array<{ id: string; title: string; category: string }>;
  all_actions: Array<{ id: string; content: string; context: string; waiting_on_person: string; waiting_since: string; agenda_person: string }>;
  action_counts: Record<string, number>;
  total_actions: number;
  waiting_for: Array<{ id: string; content: string; waiting_on_person: string; waiting_since: string }>;
  stale_waiting: Array<{ id: string; content: string; waiting_on_person: string; waiting_since: string }>;
  agendas: Array<{ id: string; content: string; agenda_person: string }>;
  recurring_tasks: Array<{ id: string; content: string; area: string; cadence: string; last_triggered: string }>;
  horizons?: Array<{ id: string; type: string; content: string }>;
}

const WEEKLY_STEPS = [
  { id: 'inboxes', label: 'Clear All Inboxes', icon: Inbox, description: 'Get every inbox to zero. App inbox, email, physical inbox, phone notifications.' },
  { id: 'projects', label: 'Review Active Projects', icon: FolderKanban, description: 'Still active? Current status? Does every project have a next action?' },
  { id: 'actions', label: 'Review Next Action Lists', icon: ListTodo, description: 'Every @context list. Still relevant? Right next action? Anything completed but not checked?' },
  { id: 'waiting', label: 'Review @waiting-for & @agendas', icon: Clock, description: 'Follow up needed? Upcoming meetings to prep? Stale items to remove?' },
  { id: 'calendar', label: 'Review Calendar', icon: Calendar, description: 'Look back 1 week (anything fall through?). Look ahead 2 weeks (need to prepare?).' },
  { id: 'recurring', label: 'Check Recurring Tasks', icon: RotateCcw, description: 'Any monthly, quarterly, or annual tasks due soon? Add as next actions.' },
  { id: 'areas', label: 'Review Areas of Focus', icon: Target, description: 'Review each area of focus. Are you giving it adequate attention? Need a project or next action?' },
];

const MONTHLY_EXTRA_STEPS = [
  { id: 'thinking', label: 'Thinking Doc Connections', icon: Sparkles, description: 'Scan for clusters, orphans, redundancy. Any docs to consolidate?' },
  { id: 'goals', label: 'Goals Check', icon: Target, description: 'Are active projects aligned with your 1-2 year goals? Any misalignment?' },
  { id: 'systems', label: 'Systems Check', icon: RotateCcw, description: 'Pick 1-2 areas. What is working? What is friction? What could improve?' },
  { id: 'pulse', label: 'Personal Pulse Check', icon: CheckCircle2, description: 'How are you doing in your key life roles? Is work crowding out what matters most?' },
];

const STORAGE_KEY = 'mainline_review_progress';

function loadProgress(): { reviewType: 'weekly' | 'monthly'; currentStep: number; completedSteps: number[]; notes: Record<number, string> } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveProgress(reviewType: 'weekly' | 'monthly', currentStep: number, completedSteps: Set<number>, notes: Record<number, string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      reviewType,
      currentStep,
      completedSteps: Array.from(completedSteps),
      notes,
    }));
  } catch { /* storage unavailable */ }
}

function clearProgress() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

export default function ReviewPage() {
  const [reviewType, setReviewType] = useState<'weekly' | 'monthly' | null>(null);
  const [data, setData] = useState<ReviewData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [restored, setRestored] = useState(false);

  // Restore progress from sessionStorage on mount
  useEffect(() => {
    const saved = loadProgress();
    if (saved) {
      setReviewType(saved.reviewType);
      setCurrentStep(saved.currentStep);
      setCompletedSteps(new Set(saved.completedSteps));
      setNotes(saved.notes);
      fetch(`/api/review?type=${saved.reviewType}`)
        .then(r => r.json())
        .then(d => setData(d));
    }
    setRestored(true);
  }, []);

  // Persist progress to sessionStorage whenever it changes
  useEffect(() => {
    if (!restored) return;
    if (reviewType) {
      saveProgress(reviewType, currentStep, completedSteps, notes);
    }
  }, [reviewType, currentStep, completedSteps, notes, restored]);

  async function startReview(type: 'weekly' | 'monthly') {
    setReviewType(type);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setNotes({});
    const res = await fetch(`/api/review?type=${type}`);
    setData(await res.json());
  }

  async function completeReview() {
    await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: reviewType, notes }),
    });
    clearProgress();
    setReviewType(null);
    setData(null);
  }

  function markStepDone(stepIndex: number) {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  }

  function nextStep() {
    markStepDone(currentStep);
    const steps = reviewType === 'monthly' ? [...WEEKLY_STEPS, ...MONTHLY_EXTRA_STEPS] : WEEKLY_STEPS;
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  // ─── Landing: Choose Review Type ──────────────────────
  if (!reviewType) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Review</h1>
        <p className="text-sm text-muted mb-8">The enforcement mechanism for your entire system. Pick your review type.</p>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => startReview('weekly')}
            className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left"
          >
            <Calendar size={32} className="text-primary mb-3" />
            <h2 className="text-lg font-semibold">Weekly Review</h2>
            <p className="text-sm text-muted mt-2">7-step guided walkthrough. Clear inboxes, review projects, actions, and areas of focus.</p>
            <p className="text-xs text-muted mt-3">Saturday 7:30-8:30 AM · 60-90 min</p>
          </button>

          <button
            onClick={() => startReview('monthly')}
            className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-left"
          >
            <Sparkles size={32} className="text-amber-500 mb-3" />
            <h2 className="text-lg font-semibold">Monthly Deep Review</h2>
            <p className="text-sm text-muted mt-2">Weekly review + deeper pass: goals check, thinking docs, systems review, personal pulse.</p>
            <p className="text-xs text-muted mt-3">One Saturday/month · 2-3 hours total</p>
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-4xl mx-auto text-center py-12 text-muted">Loading review data...</div>;
  }

  const steps = reviewType === 'monthly' ? [...WEEKLY_STEPS, ...MONTHLY_EXTRA_STEPS] : WEEKLY_STEPS;
  const progress = completedSteps.size / steps.length;
  const allDone = completedSteps.size === steps.length;
  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header + Progress */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => { clearProgress(); setReviewType(null); setData(null); }} className="text-sm text-muted hover:text-foreground transition-colors mb-1 block">
            ← Back to Review Menu
          </button>
          <h1 className="text-2xl font-bold">{reviewType === 'monthly' ? 'Monthly Deep Review' : 'Weekly Review'}</h1>
        </div>
        {allDone && (
          <button onClick={completeReview} className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium">
            Complete Review
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{completedSteps.size}/{steps.length} complete</span>
        </div>
        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        {/* Step Sidebar */}
        <div className="space-y-1">
          {steps.map((s, i) => {
            const isDone = completedSteps.has(i);
            const isCurrent = i === currentStep;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  isCurrent ? 'bg-primary/10 text-primary font-medium' : isDone ? 'text-green-600' : 'text-muted hover:text-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${completedSteps.has(currentStep) ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
              <StepIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{step.label}</h2>
              <p className="text-sm text-muted">{step.description}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 mb-4">
            <StepContent stepId={step.id} data={data} />
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-4 mb-4">
            <textarea
              value={notes[currentStep] || ''}
              onChange={e => setNotes(prev => ({ ...prev, [currentStep]: e.target.value }))}
              placeholder="Notes for this step..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px] resize-y"
              rows={2}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => markStepDone(currentStep)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                completedSteps.has(currentStep)
                  ? 'bg-green-100 text-green-700'
                  : 'border border-border hover:bg-primary/5'
              }`}
            >
              {completedSteps.has(currentStep) ? <><CheckCircle2 size={16} /> Done</> : <><Circle size={16} /> Mark Done</>}
            </button>

            {currentStep < steps.length - 1 ? (
              <button onClick={nextStep} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-sm">
                Next Step <ArrowRight size={16} />
              </button>
            ) : !allDone ? (
              <button onClick={() => markStepDone(currentStep)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-sm">
                Finish <Check size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step-Specific Content ──────────────────────
function StepContent({ stepId, data }: { stepId: string; data: ReviewData }) {
  switch (stepId) {
    case 'inboxes':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-background">
            <span className="text-sm">App Inbox</span>
            <span className={`text-sm font-medium ${data.inbox_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.inbox_count > 0 ? `${data.inbox_count} items` : 'Clear'}
            </span>
          </div>
          {data.inbox_count > 0 && (
            <Link href="/inbox/process" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowRight size={14} /> Go process inbox
            </Link>
          )}
          <div className="text-xs text-muted space-y-1">
            <p>Also check:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Both email inboxes</li>
              <li>Physical inbox / desk</li>
              <li>Voicemail / texts with action items</li>
              <li>Phone notifications with action items</li>
            </ul>
          </div>
        </div>
      );

    case 'projects':
      return (
        <div className="space-y-3">
          <p className="text-sm">{data.active_projects.length} active projects</p>
          {data.stalled_projects.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                <AlertTriangle size={14} /> {data.stalled_projects.length} stalled (no next action)
              </p>
              <ul className="mt-2 space-y-1">
                {data.stalled_projects.map(p => (
                  <li key={p.id} className="text-xs">
                    <Link href={`/projects/${p.id}`} className="text-red-700 hover:underline">{p.title}</Link>
                    <span className="text-red-500 ml-1">({p.category})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {data.active_projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-background text-sm">
                <span>{p.title} <span className="text-muted text-xs">({p.category})</span></span>
                <span className={`text-xs ${p.active_action_count === 0 ? 'text-red-600 font-medium' : 'text-muted'}`}>
                  {p.active_action_count} action{p.active_action_count !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
          {data.someday_projects.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted font-medium mb-1">Someday/Maybe ({(data.someday_projects as Array<{id: string; title: string}>).length}) — anything ready to activate?</p>
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {(data.someday_projects as Array<{id: string; title: string; category: string}>).map(p => (
                  <p key={p.id} className="text-xs text-muted">{p.title} ({p.category})</p>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'actions':
      return (
        <div className="space-y-2">
          <p className="text-sm">{data.total_actions} active actions across {Object.keys(data.action_counts).filter(k => data.action_counts[k] > 0).length} contexts</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.action_counts).map(([ctx, count]) => (
              <Link key={ctx} href={`/actions?context=${ctx}`} className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-primary/5 text-sm">
                <span>@{ctx.replace(/_/g, ' ')}</span>
                <span className={`font-medium ${count === 0 ? 'text-muted' : ''}`}>{count}</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">Check each list: Still relevant? Right next action? Completed but not checked off?</p>
        </div>
      );

    case 'waiting':
      return (
        <div className="space-y-3">
          <p className="text-sm">{data.waiting_for.length} waiting-for · {data.agendas.length} agenda items</p>
          {data.stale_waiting.length > 0 && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-sm font-medium text-yellow-700">{data.stale_waiting.length} stale (7+ days)</p>
              <ul className="mt-1 space-y-1">
                {data.stale_waiting.map(w => (
                  <li key={w.id} className="text-xs text-yellow-700">
                    {w.content} {w.waiting_on_person && `(${w.waiting_on_person})`} — since {w.waiting_since}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.waiting_for.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-1">@waiting-for</p>
              {data.waiting_for.map(w => (
                <p key={w.id} className="text-xs py-1">{w.content} {w.waiting_on_person && <span className="text-muted">({w.waiting_on_person})</span>}</p>
              ))}
            </div>
          )}
          {data.agendas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-1">@agendas</p>
              {data.agendas.map(a => (
                <p key={a.id} className="text-xs py-1">{a.content} {a.agenda_person && <span className="text-muted">({a.agenda_person})</span>}</p>
              ))}
            </div>
          )}
        </div>
      );

    case 'calendar':
      return (
        <div className="space-y-3 text-sm">
          <p>Open your calendar and check:</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-background">
              <p className="font-medium text-xs uppercase text-muted mb-1">Look Back (1 week)</p>
              <ul className="text-xs space-y-1 text-muted">
                <li>Anything fall through the cracks?</li>
                <li>Commitments made that need capturing?</li>
                <li>Follow-ups from meetings?</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-background">
              <p className="font-medium text-xs uppercase text-muted mb-1">Look Ahead (2 weeks)</p>
              <ul className="text-xs space-y-1 text-muted">
                <li>Any prep needed?</li>
                <li>Materials to prepare?</li>
                <li>Travel or logistics?</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted">Open your calendar app to review alongside this step.</p>
        </div>
      );

    case 'recurring':
      return <RecurringTasksStep tasks={data.recurring_tasks} />;

    case 'areas':
      return (
        <div className="space-y-2">
          <p className="text-sm mb-2">Scan each area. Keeping up? Need a project or next action?</p>
          {[
            { area: 'Health & Wellness', prompt: 'Workouts on track? Sleep? Nutrition?' },
            { area: 'Relationships', prompt: 'Key people getting enough attention? Any follow-ups needed?' },
            { area: 'Career / Business', prompt: 'Delivery solid? Building toward goals?' },
            { area: 'Finances', prompt: 'Books current? Invoicing up to date? Budget on track?' },
            { area: 'Home', prompt: 'Maintenance? Projects? Anything stalled?' },
            { area: 'Personal Growth', prompt: 'Growth intentions still right? Any to graduate or add?' },
            { area: 'Fun & Recreation', prompt: 'Making time for things you enjoy?' },
          ].map(item => (
            <div key={item.area} className="flex items-start gap-2 p-2 rounded-lg bg-background">
              <Circle size={14} className="text-muted mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{item.area}</p>
                <p className="text-xs text-muted">{item.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      );

    // Monthly extra steps
    case 'thinking':
      return (
        <div className="space-y-3 text-sm">
          <p>Review your thinking docs for connections, redundancy, and consolidation opportunities.</p>
          <div className="text-xs text-muted">
            <p className="font-medium mb-1">Look for:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Ideas that connect across docs</li>
              <li>Redundant content to consolidate</li>
              <li>Orphan docs that need attention or deletion</li>
            </ul>
          </div>
        </div>
      );

    case 'goals':
      return (
        <div className="space-y-3 text-sm">
          <p>Are your active projects moving toward your 1-2 year goals?</p>
          <Link href="/horizons" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ArrowRight size={12} /> Open Horizons
          </Link>
          {data.horizons && (
            <div className="space-y-2">
              {data.horizons.filter(h => h.type === 'goals').map(h => (
                <div key={h.id} className="p-3 rounded-lg bg-background">
                  <p className="text-xs font-medium text-muted uppercase mb-1">Current Goals</p>
                  <p className="text-xs whitespace-pre-wrap">{h.content || 'No goals written yet. Go fill these in!'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'systems':
      return (
        <div className="space-y-3 text-sm">
          <p>Pick 1-2 areas to review this month. What is working, what is friction, what could improve?</p>
          <div className="grid grid-cols-2 gap-2">
            {['Work delivery process', 'GTD system', 'Home organization', 'Financial systems',
              'Family routines', 'Daily routines', 'Tools & workflow', 'Communication systems',
            ].map(area => (
              <div key={area} className="flex items-center gap-2 p-2 rounded-lg bg-background">
                <Circle size={12} className="text-muted" />
                <span className="text-xs">{area}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'pulse':
      return (
        <div className="space-y-3 text-sm">
          <p className="font-medium">How are you doing as a whole person?</p>
          <p className="text-muted text-xs">Not a formal review. Just a moment to ask whether work is crowding out the other things that matter. If it is, that is a signal to revisit priorities, not to add more tasks.</p>
          <div className="space-y-2">
            {['Am I spending time on what I say matters?', 'Is anything obviously out of balance?', 'What needs more of me right now?'].map(q => (
              <div key={q} className="p-2 rounded-lg bg-background">
                <p className="text-xs text-muted">{q}</p>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return <p className="text-sm text-muted">Review content for this step.</p>;
  }
}

// ─── Recurring Tasks Step (with inline CRUD) ──────────────────────
function RecurringTasksStep({ tasks: initialTasks }: { tasks: ReviewData['recurring_tasks'] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newArea, setNewArea] = useState('business');
  const [newCadence, setNewCadence] = useState('monthly');

  async function fetchTasks() {
    const res = await fetch('/api/recurring-tasks');
    setTasks(await res.json());
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    await fetch('/api/recurring-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), area: newArea, cadence: newCadence }),
    });
    setNewContent('');
    setShowAdd(false);
    fetchTasks();
  }

  async function markTriggered(id: string) {
    await fetch('/api/recurring-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, last_triggered: 'now' }),
    });
    fetchTasks();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/recurring-tasks?id=${id}`, { method: 'DELETE' });
    fetchTasks();
  }

  const grouped: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!grouped[t.cadence]) grouped[t.cadence] = [];
    grouped[t.cadence].push(t);
  }

  function isDue(task: typeof tasks[0]): boolean {
    if (!task.last_triggered) return true;
    const last = new Date(task.last_triggered);
    const now = new Date();
    const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (task.cadence === 'weekly') return daysSince >= 6;
    if (task.cadence === 'monthly') return daysSince >= 25;
    if (task.cadence === 'quarterly') return daysSince >= 80;
    if (task.cadence === 'annual') return daysSince >= 350;
    return false;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm">{tasks.length} recurring task{tasks.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus size={12} /> Add Task
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addTask} className="p-3 rounded-lg bg-background space-y-2">
          <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Task description" autoFocus
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <div className="flex gap-2">
            <select value={newArea} onChange={e => setNewArea(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border bg-card text-xs">
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
            <select value={newCadence} onChange={e => setNewCadence(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border bg-card text-xs">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs">Add</button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-muted">No recurring tasks set up yet. Add things like invoicing, bookkeeping, transfers.</p>
      ) : (
        ['weekly', 'monthly', 'quarterly', 'annual'].map(cadence => {
          const cadenceTasks = grouped[cadence];
          if (!cadenceTasks) return null;
          return (
            <div key={cadence}>
              <p className="text-xs font-medium text-muted uppercase mb-1">{cadence} ({cadenceTasks.length})</p>
              <div className="space-y-1">
                {cadenceTasks.map(t => {
                  const due = isDue(t);
                  return (
                    <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${due ? 'bg-yellow-50 border border-yellow-200' : 'bg-background'}`}>
                      <div>
                        <span className={due ? 'font-medium text-yellow-700' : ''}>{t.content}</span>
                        <span className="text-muted ml-1">({t.area})</span>
                        {t.last_triggered && <span className="text-muted ml-1">· last: {t.last_triggered}</span>}
                        {due && <span className="text-yellow-600 ml-1 font-medium">DUE</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => markTriggered(t.id)} className="p-1 rounded hover:bg-green-100 text-green-600" title="Mark done">
                          <Check size={12} />
                        </button>
                        <button onClick={() => deleteTask(t.id)} className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
