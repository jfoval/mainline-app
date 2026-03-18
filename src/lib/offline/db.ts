import Dexie, { type Table } from 'dexie';

// ---- Types matching SQLite schema ----

export interface InboxItem {
  id: string;
  content: string;
  source: string;
  url: string | null;
  captured_at: string;
  processed_at: string | null;
  status: string;
  updated_at?: string;
}

export interface NextAction {
  id: string;
  content: string;
  context: string;
  project_id: string | null;
  project_title: string | null;
  waiting_on_person: string | null;
  waiting_since: string | null;
  agenda_person: string | null;
  added_at: string;
  completed_at: string | null;
  status: string;
  sort_order: number;
  updated_at?: string;
}

export interface ListItem {
  id: string;
  list_type: string;
  title: string;
  tier: string | null;
  status: string | null;
  url: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface PipelineDeal {
  id: string;
  company: string;
  contact_name: string | null;
  what_they_need: string | null;
  stage: string;
  next_action: string | null;
  last_contact: string | null;
  value: string | null;
  loss_reason: string | null;
  win_notes: string | null;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineContact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  how_you_know: string | null;
  contact_type: string;
  engagement_type: string | null;
  start_date: string | null;
  date_range: string | null;
  last_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PipelineWarmLead {
  id: string;
  name: string;
  company: string | null;
  interest: string | null;
  source: string | null;
  added_at: string;
  notes: string | null;
  updated_at?: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  purpose: string | null;
  key_milestones: string | null;
  planning_steps: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  active_action_count?: number;
}

export interface DailyNote {
  id: string;
  date: string;
  reflection_showed_up: string | null;
  reflection_fell_short: string | null;
  reflection_noticed: string | null;
  reflection_grateful: string | null;
  top3_revenue: string | null;
  top3_second: string | null;
  top3_third: string | null;
  notes: string | null;
  tomorrow: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RoutineBlock {
  id: string;
  routine_type: string;
  start_time: string;
  end_time: string;
  label: string;
  description: string | null;
  is_non_negotiable: number;
  sort_order: number;
}

export interface ReferenceDoc {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---- Sync Queue ----

export interface SyncQueueEntry {
  queueId?: number;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body: string | null;
  timestamp: number;
  retries: number;
}

// ---- Sync Metadata ----

export interface SyncMeta {
  table: string;
  lastSyncedAt: number;
}

// ---- Conflict Entry ----

export interface ConflictEntry {
  conflictId?: number;
  table: string;
  recordId: string;
  clientVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  detectedAt: number;
}

// ---- Database ----

class GTDOfflineDB extends Dexie {
  inbox_items!: Table<InboxItem, string>;
  next_actions!: Table<NextAction, string>;
  list_items!: Table<ListItem, string>;
  pipeline_deals!: Table<PipelineDeal, string>;
  pipeline_contacts!: Table<PipelineContact, string>;
  pipeline_warm_leads!: Table<PipelineWarmLead, string>;
  projects!: Table<Project, string>;
  daily_notes!: Table<DailyNote, string>;
  routine_blocks!: Table<RoutineBlock, string>;
  reference_docs!: Table<ReferenceDoc, string>;
  sync_queue!: Table<SyncQueueEntry, number>;
  sync_meta!: Table<SyncMeta, string>;
  conflicts!: Table<ConflictEntry, number>;

  constructor() {
    super('foval-gtd');
    this.version(1).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      pipeline_deals: 'id, stage',
      pipeline_contacts: 'id, contact_type',
      pipeline_warm_leads: 'id',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
    });

    this.version(2).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      pipeline_deals: 'id, stage',
      pipeline_contacts: 'id, contact_type',
      pipeline_warm_leads: 'id',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });

    this.version(3).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      pipeline_deals: 'id, stage',
      pipeline_contacts: 'id, contact_type',
      pipeline_warm_leads: 'id',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      reference_docs: 'id, category, slug',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });
  }
}

export const offlineDb = new GTDOfflineDB();
