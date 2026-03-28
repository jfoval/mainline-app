import { offlineDb } from './db';
import type {
  InboxItem, NextAction, ListItem,
  Project, DailyNote, RoutineBlock, ReferenceDoc,
  Discipline, DisciplineLog, ContextList, DailyBlock,
} from './db';
import { enqueue } from './sync-queue';
import { v4 as uuid } from 'uuid';

// Helper to get current local datetime string matching SQLite format
function nowLocal(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ---- Store Config Type ----

export interface StoreConfig<T> {
  table: string;
  fetchUrl: string | ((params?: Record<string, string>) => string);
  parseResponse: (json: unknown) => T[];
  queryLocal: (params?: Record<string, string>) => Promise<T[]>;
  mutate: {
    create: (data: Record<string, unknown>) => Promise<T>;
    update: (data: Record<string, unknown> & { id: string }) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
}

// ---- Next Actions ----

export const nextActionsStore: StoreConfig<NextAction> = {
  table: 'next_actions',

  fetchUrl: (params) => {
    const sp = new URLSearchParams(params);
    return `/api/actions?${sp.toString()}`;
  },

  parseResponse: (json) => json as NextAction[],

  queryLocal: async (params) => {
    const status = params?.status || 'active';
    const results = await offlineDb.next_actions
      .where('status').equals(status)
      .toArray();

    const filtered = params?.context
      ? results.filter(a => a.context === params.context)
      : results;

    return filtered.sort((a, b) =>
      (a.sort_order - b.sort_order) ||
      (new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
    );
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: NextAction = {
        id,
        content: data.content as string,
        context: data.context as string,
        project_id: (data.project_id as string) ?? null,
        project_title: null,
        waiting_on_person: (data.waiting_on_person as string) ?? null,
        waiting_since: (data.waiting_since as string) ?? null,
        agenda_person: (data.agenda_person as string) ?? null,
        added_at: nowLocal(),
        completed_at: null,
        status: 'active',
        sort_order: 0,
      };
      await offlineDb.next_actions.put(item);
      await enqueue('POST', '/api/actions', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.next_actions.get(id);
      const baseUpdatedAt = existing?.updated_at;
      if (updates.status === 'completed') {
        updates.completed_at = nowLocal();
      }
      updates.updated_at = nowLocal();
      await offlineDb.next_actions.update(id, updates);
      await enqueue('PATCH', '/api/actions', { ...data, updated_at: updates.updated_at, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.next_actions.delete(id);
      await enqueue('DELETE', `/api/actions?id=${id}`, null);
    },
  },
};

// ---- Inbox ----

export const inboxStore: StoreConfig<InboxItem> = {
  table: 'inbox_items',

  fetchUrl: '/api/inbox',

  parseResponse: (json) => json as InboxItem[],

  queryLocal: async () => {
    return offlineDb.inbox_items
      .where('status').equals('pending')
      .reverse()
      .sortBy('captured_at');
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: InboxItem = {
        id,
        content: data.content as string,
        source: (data.source as string) || 'manual',
        url: (data.url as string) ?? null,
        captured_at: nowLocal(),
        processed_at: null,
        status: 'pending',
      };
      await offlineDb.inbox_items.put(item);
      await enqueue('POST', '/api/inbox', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      if (updates.status === 'processed') {
        updates.processed_at = nowLocal();
      }
      await offlineDb.inbox_items.update(id, updates);
      await enqueue('PATCH', '/api/inbox', data);
    },

    remove: async (id) => {
      await offlineDb.inbox_items.delete(id);
      await enqueue('DELETE', `/api/inbox?id=${id}`, null);
    },
  },
};

// ---- List Items ----

export const listItemsStore: StoreConfig<ListItem> = {
  table: 'list_items',

  fetchUrl: (params) => {
    if (params?.type) return `/api/lists?type=${params.type}`;
    return '/api/lists';
  },

  parseResponse: (json) => {
    // API returns items array when type param given, counts array otherwise
    if (Array.isArray(json) && json.length > 0 && 'title' in json[0]) {
      return json as ListItem[];
    }
    return [];
  },

  queryLocal: async (params) => {
    if (!params?.type) return [];
    return offlineDb.list_items
      .where('list_type').equals(params.type)
      .sortBy('sort_order');
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: ListItem = {
        id,
        list_type: data.list_type as string,
        title: data.title as string,
        tier: (data.tier as string) ?? null,
        status: (data.status as string) ?? null,
        url: (data.url as string) ?? null,
        notes: (data.notes as string) ?? null,
        sort_order: 0,
        created_at: nowLocal(),
      };
      await offlineDb.list_items.put(item);
      await enqueue('POST', '/api/lists', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      await offlineDb.list_items.update(id, updates);
      await enqueue('PATCH', '/api/lists', data);
    },

    remove: async (id) => {
      await offlineDb.list_items.delete(id);
      await enqueue('DELETE', `/api/lists?id=${id}`, null);
    },
  },
};

// ---- Projects ----

export const projectsStore: StoreConfig<Project> = {
  table: 'projects',

  fetchUrl: (params) => {
    const status = params?.status || 'active';
    return `/api/projects?status=${status}`;
  },

  parseResponse: (json) => json as Project[],

  queryLocal: async (params) => {
    const status = params?.status || 'active';
    const results = await offlineDb.projects
      .where('status').equals(status)
      .toArray();
    return results.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const item: Project = {
        id,
        title: data.title as string,
        category: data.category as string,
        purpose: (data.purpose as string) ?? null,
        key_milestones: (data.key_milestones as string) ?? null,
        planning_steps: (data.planning_steps as string) ?? null,
        notes: (data.notes as string) ?? null,
        status: (data.status as string) || 'active',
        created_at: now,
        updated_at: now,
        completed_at: null,
        active_action_count: 0,
      };
      await offlineDb.projects.put(item);
      await enqueue('POST', '/api/projects', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.projects.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      if (updates.status === 'completed' || updates.status === 'archived') {
        updates.completed_at = updates.updated_at;
      }
      await offlineDb.projects.update(id, updates);
      await enqueue('PATCH', '/api/projects', { ...data, updated_at: updates.updated_at, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.projects.delete(id);
      await enqueue('DELETE', `/api/projects?id=${id}`, null);
    },
  },
};

// ---- Daily Notes ----

export const dailyNotesStore: StoreConfig<DailyNote> = {
  table: 'daily_notes',

  fetchUrl: (params) => {
    if (params?.date) return `/api/daily-notes?date=${params.date}`;
    return '/api/daily-notes';
  },

  parseResponse: (json) => {
    // API returns single object for date query, array for list
    if (Array.isArray(json)) return json as DailyNote[];
    return [json as DailyNote];
  },

  queryLocal: async (params) => {
    if (params?.date) {
      const note = await offlineDb.daily_notes
        .where('date').equals(params.date)
        .first();
      return note ? [note] : [];
    }
    const results = await offlineDb.daily_notes.toArray();
    return results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: DailyNote = {
        id,
        date: data.date as string,
        reflection_showed_up: null,
        reflection_fell_short: null,
        reflection_noticed: null,
        reflection_grateful: null,
        top3_first: null,
        top3_second: null,
        top3_third: null,
        notes: null,
        tomorrow: null,
        created_at: nowLocal(),
      };
      await offlineDb.daily_notes.put(item);
      await enqueue('POST', '/api/daily-notes', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.daily_notes.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      await offlineDb.daily_notes.update(id, updates);
      await enqueue('PATCH', '/api/daily-notes', { ...data, updated_at: updates.updated_at, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.daily_notes.delete(id);
    },
  },
};

// ---- Routine Blocks ----

export const routineBlocksStore: StoreConfig<RoutineBlock> = {
  table: 'routine_blocks',

  fetchUrl: (params) => {
    if (params?.type) return `/api/routine?type=${params.type}`;
    return '/api/routine';
  },

  parseResponse: (json) => {
    // API returns { blocks, ... } object or plain array
    if (Array.isArray(json)) return json as RoutineBlock[];
    const obj = json as Record<string, unknown>;
    if (obj.blocks) return obj.blocks as RoutineBlock[];
    return [];
  },

  queryLocal: async (params) => {
    if (params?.type) {
      return offlineDb.routine_blocks
        .where('routine_type').equals(params.type)
        .sortBy('sort_order');
    }
    // Default: figure out today's routine type
    // Will be replaced by week patterns in Phase 3
    const now = new Date();
    const day = now.getDay();
    let routineType: string;
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';
    else routineType = 'non_girls_week'; // temporary default until week patterns
    return offlineDb.routine_blocks
      .where('routine_type').equals(routineType)
      .sortBy('sort_order');
  },

  mutate: {
    create: async (data) => {
      const item = data as unknown as RoutineBlock;
      await offlineDb.routine_blocks.put(item);
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      await offlineDb.routine_blocks.update(id, updates);
      await enqueue('PATCH', '/api/routine', data);
    },

    remove: async (id) => {
      await offlineDb.routine_blocks.delete(id);
    },
  },
};

// ---- Reference Docs ----

export const referenceDocsStore: StoreConfig<ReferenceDoc> = {
  table: 'reference_docs',

  fetchUrl: (params) => {
    if (params?.category) return `/api/reference?category=${encodeURIComponent(params.category)}`;
    return '/api/reference';
  },

  parseResponse: (json) => json as ReferenceDoc[],

  queryLocal: async (params) => {
    if (params?.category) {
      return offlineDb.reference_docs
        .where('category').equals(params.category)
        .reverse()
        .sortBy('created_at');
    }
    const results = await offlineDb.reference_docs.toArray();
    return results.sort((a, b) =>
      a.category.localeCompare(b.category) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const title = data.title as string;
      const category = data.category as string;
      const slug = `${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const item: ReferenceDoc = {
        id,
        title,
        slug,
        category,
        subcategory: (data.subcategory as string) ?? null,
        content: (data.content as string) || '',
        created_at: now,
        updated_at: now,
      };
      await offlineDb.reference_docs.put(item);
      await enqueue('POST', '/api/reference', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.reference_docs.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      await offlineDb.reference_docs.update(id, updates);
      await enqueue('PATCH', '/api/reference', { ...data, updated_at: updates.updated_at, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.reference_docs.delete(id);
      await enqueue('DELETE', `/api/reference?id=${id}`, null);
    },
  },
};

// ---- Disciplines ----

export const disciplinesStore: StoreConfig<Discipline> = {
  table: 'disciplines',

  fetchUrl: '/api/disciplines',

  parseResponse: (json) => json as Discipline[],

  queryLocal: async (params) => {
    let results = await offlineDb.disciplines.toArray();
    if (!params?.include_inactive) {
      results = results.filter(d => d.is_active === 1);
    }
    if (params?.type) {
      results = results.filter(d => d.type === params.type);
    }
    return results.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const item: Discipline = {
        id,
        name: data.name as string,
        type: (data.type as 'discipline' | 'value') || 'discipline',
        description: (data.description as string) ?? null,
        frequency: (data.frequency as string) || 'daily',
        time_of_day: (data.time_of_day as 'morning' | 'shutdown') || 'morning',
        is_active: 1,
        sort_order: (data.sort_order as number) || 0,
        created_at: now,
        updated_at: now,
      };
      await offlineDb.disciplines.put(item);
      await enqueue('POST', '/api/disciplines', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      updates.updated_at = nowLocal();
      await offlineDb.disciplines.update(id, updates);
      await enqueue('PATCH', '/api/disciplines', { ...data, updated_at: updates.updated_at });
    },

    remove: async (id) => {
      await offlineDb.disciplines.delete(id);
      await enqueue('DELETE', `/api/disciplines?id=${id}`, null);
    },
  },
};

// ---- Discipline Logs ----

export const disciplineLogsStore: StoreConfig<DisciplineLog> = {
  table: 'discipline_logs',

  fetchUrl: (params) => {
    const sp = new URLSearchParams(params);
    return `/api/disciplines/logs?${sp.toString()}`;
  },

  parseResponse: (json) => json as DisciplineLog[],

  queryLocal: async (params) => {
    let results = await offlineDb.discipline_logs.toArray();
    if (params?.date) {
      results = results.filter(l => l.date === params.date);
    }
    if (params?.discipline_id) {
      results = results.filter(l => l.discipline_id === params.discipline_id);
    }
    return results.sort((a, b) => b.date.localeCompare(a.date));
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: DisciplineLog = {
        id,
        discipline_id: data.discipline_id as string,
        date: data.date as string,
        completed: (data.completed as number) || 0,
        notes: (data.notes as string) ?? null,
        created_at: nowLocal(),
      };
      await offlineDb.discipline_logs.put(item);
      await enqueue('POST', '/api/disciplines/logs', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      await offlineDb.discipline_logs.update(id, updates);
      await enqueue('PATCH', '/api/disciplines/logs', data);
    },

    remove: async (id) => {
      await offlineDb.discipline_logs.delete(id);
      await enqueue('DELETE', `/api/disciplines/logs?id=${id}`, null);
    },
  },
};

// ---- Context Lists ----

export const contextListsStore: StoreConfig<ContextList> = {
  table: 'context_lists',

  fetchUrl: '/api/context-lists',

  parseResponse: (json) => json as ContextList[],

  queryLocal: async (params) => {
    let results = await offlineDb.context_lists.toArray();
    if (!params?.include_inactive) {
      results = results.filter(c => c.is_active === 1);
    }
    return results.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const item: ContextList = {
        id,
        name: data.name as string,
        key: data.key as string,
        color: (data.color as string) ?? null,
        icon: (data.icon as string) ?? null,
        sort_order: (data.sort_order as number) || 0,
        is_active: 1,
        created_at: now,
        updated_at: now,
      };
      await offlineDb.context_lists.put(item);
      await enqueue('POST', '/api/context-lists', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      updates.updated_at = nowLocal();
      await offlineDb.context_lists.update(id, updates);
      await enqueue('PATCH', '/api/context-lists', { ...data, updated_at: updates.updated_at });
    },

    remove: async (id) => {
      await offlineDb.context_lists.delete(id);
      await enqueue('DELETE', `/api/context-lists?id=${id}`, null);
    },
  },
};

// ---- Daily Blocks ----

export const dailyBlocksStore: StoreConfig<DailyBlock> = {
  table: 'daily_blocks',

  fetchUrl: (params) => {
    if (params?.date) return `/api/daily-blocks?date=${params.date}`;
    return '/api/daily-blocks';
  },

  parseResponse: (json) => {
    const obj = json as Record<string, unknown>;
    if (obj.blocks) return obj.blocks as DailyBlock[];
    if (Array.isArray(json)) return json as DailyBlock[];
    return [];
  },

  queryLocal: async (params) => {
    if (params?.date) {
      return offlineDb.daily_blocks
        .where('date').equals(params.date)
        .sortBy('start_time');
    }
    return offlineDb.daily_blocks.toArray();
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const item: DailyBlock = {
        id,
        date: data.date as string,
        start_time: data.start_time as string,
        end_time: data.end_time as string,
        label: data.label as string,
        description: (data.description as string) ?? null,
        is_non_negotiable: (data.is_non_negotiable as number) || 0,
        source_block_id: null,
        created_at: now,
        updated_at: now,
      };
      await offlineDb.daily_blocks.put(item);
      await enqueue('POST', '/api/daily-blocks', { id, ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      updates.updated_at = nowLocal();
      await offlineDb.daily_blocks.update(id, updates);
      await enqueue('PATCH', '/api/daily-blocks', { ...data, updated_at: updates.updated_at });
    },

    remove: async (id) => {
      await offlineDb.daily_blocks.delete(id);
      await enqueue('DELETE', `/api/daily-blocks?id=${id}`, null);
    },
  },
};
