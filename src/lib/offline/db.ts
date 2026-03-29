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
  reflection_matters_most: string | null;
  reflection_who_to_be: string | null;
  reflection_one_action: string | null;
  evening_did_well: string | null;
  evening_fell_short: string | null;
  evening_do_differently: string | null;
  top3_first: string | null;
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

export interface Discipline {
  id: string;
  name: string;
  type: 'discipline' | 'value';
  description: string | null;
  frequency: string; // 'daily' | 'weekly' | JSON days array e.g. '["mon","wed","fri"]'
  time_of_day: 'morning' | 'shutdown';
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DisciplineLog {
  id: string;
  discipline_id: string;
  date: string;
  completed: number;
  notes: string | null;
  created_at: string;
}

export interface ContextList {
  id: string;
  name: string;
  key: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DailyBlock {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  description: string | null;
  is_non_negotiable: number;
  source_block_id: string | null;
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
  lastRetryAt?: number;
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

class MainlineOfflineDB extends Dexie {
  inbox_items!: Table<InboxItem, string>;
  next_actions!: Table<NextAction, string>;
  list_items!: Table<ListItem, string>;
  projects!: Table<Project, string>;
  daily_notes!: Table<DailyNote, string>;
  routine_blocks!: Table<RoutineBlock, string>;
  reference_docs!: Table<ReferenceDoc, string>;
  disciplines!: Table<Discipline, string>;
  discipline_logs!: Table<DisciplineLog, string>;
  context_lists!: Table<ContextList, string>;
  daily_blocks!: Table<DailyBlock, string>;
  sync_queue!: Table<SyncQueueEntry, number>;
  sync_meta!: Table<SyncMeta, string>;
  conflicts!: Table<ConflictEntry, number>;

  constructor() {
    super('mainline');
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

    // Version 4: Drop pipeline tables
    this.version(4).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      pipeline_deals: null,
      pipeline_contacts: null,
      pipeline_warm_leads: null,
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      reference_docs: 'id, category, slug',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });

    // Version 5: Add disciplines + discipline_logs
    this.version(5).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      reference_docs: 'id, category, slug',
      disciplines: 'id, type, is_active, sort_order',
      discipline_logs: 'id, discipline_id, date, [discipline_id+date]',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });

    // Version 6: Add context_lists
    this.version(6).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      reference_docs: 'id, category, slug',
      disciplines: 'id, type, is_active, sort_order',
      discipline_logs: 'id, discipline_id, date, [discipline_id+date]',
      context_lists: 'id, key, is_active, sort_order',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });

    // Version 7: Add daily_blocks
    this.version(7).stores({
      inbox_items: 'id, status, captured_at',
      next_actions: 'id, context, status, project_id, sort_order',
      list_items: 'id, list_type, sort_order',
      projects: 'id, status, category',
      daily_notes: 'id, date',
      routine_blocks: 'id, routine_type, sort_order',
      reference_docs: 'id, category, slug',
      disciplines: 'id, type, is_active, sort_order',
      discipline_logs: 'id, discipline_id, date, [discipline_id+date]',
      context_lists: 'id, key, is_active, sort_order',
      daily_blocks: 'id, date',
      sync_queue: '++queueId, timestamp',
      sync_meta: 'table',
      conflicts: '++conflictId, table, recordId, detectedAt',
    });
  }
}

export const offlineDb = new MainlineOfflineDB();
