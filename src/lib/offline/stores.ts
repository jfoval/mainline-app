import { offlineDb } from './db';
import type {
  InboxItem, NextAction, ListItem,
  PipelineDeal, PipelineContact, PipelineWarmLead,
  Project, DailyNote, RoutineBlock, ReferenceDoc,
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

// ---- Pipeline Deals ----

export const pipelineDealsStore: StoreConfig<PipelineDeal> = {
  table: 'pipeline_deals',

  fetchUrl: '/api/pipeline/deals',

  parseResponse: (json) => json as PipelineDeal[],

  queryLocal: async () => {
    const stageOrder: Record<string, number> = {
      discovery: 1, proposal_sent: 2, negotiating: 3,
      verbal_yes: 4, closed_won: 5, closed_lost: 6,
    };
    const results = await offlineDb.pipeline_deals.toArray();
    return results.sort((a, b) =>
      (stageOrder[a.stage] || 99) - (stageOrder[b.stage] || 99) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const now = nowLocal();
      const item: PipelineDeal = {
        id,
        company: data.company as string,
        contact_name: (data.contact_name as string) ?? null,
        what_they_need: (data.what_they_need as string) ?? null,
        stage: (data.stage as string) || 'discovery',
        next_action: (data.next_action as string) ?? null,
        last_contact: (data.last_contact as string) ?? null,
        value: (data.value as string) ?? null,
        loss_reason: null,
        win_notes: null,
        closed_date: null,
        created_at: now,
        updated_at: now,
      };
      await offlineDb.pipeline_deals.put(item);
      await enqueue('POST', '/api/pipeline', { id, entity_type: 'deal', ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.pipeline_deals.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      await offlineDb.pipeline_deals.update(id, updates);
      await enqueue('PATCH', '/api/pipeline', { id, entity_type: 'deal', ...updates, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.pipeline_deals.delete(id);
      await enqueue('DELETE', `/api/pipeline?id=${id}&type=deal`, null);
    },
  },
};

// ---- Pipeline Contacts ----

export const pipelineContactsStore: StoreConfig<PipelineContact> = {
  table: 'pipeline_contacts',

  fetchUrl: '/api/pipeline/contacts',

  parseResponse: (json) => json as PipelineContact[],

  queryLocal: async () => {
    const results = await offlineDb.pipeline_contacts.toArray();
    return results.sort((a, b) =>
      a.contact_type.localeCompare(b.contact_type) || a.name.localeCompare(b.name)
    );
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: PipelineContact = {
        id,
        name: data.name as string,
        company: (data.company as string) ?? null,
        role: (data.role as string) ?? null,
        email: (data.email as string) ?? null,
        phone: (data.phone as string) ?? null,
        how_you_know: (data.how_you_know as string) ?? null,
        contact_type: (data.contact_type as string) || 'strategic',
        engagement_type: (data.engagement_type as string) ?? null,
        start_date: (data.start_date as string) ?? null,
        date_range: (data.date_range as string) ?? null,
        last_contact: (data.last_contact as string) ?? null,
        notes: (data.notes as string) ?? null,
        created_at: nowLocal(),
      };
      await offlineDb.pipeline_contacts.put(item);
      await enqueue('POST', '/api/pipeline', { id, entity_type: 'contact', ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.pipeline_contacts.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      await offlineDb.pipeline_contacts.update(id, updates);
      await enqueue('PATCH', '/api/pipeline', { id, entity_type: 'contact', ...updates, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.pipeline_contacts.delete(id);
      await enqueue('DELETE', `/api/pipeline?id=${id}&type=contact`, null);
    },
  },
};

// ---- Pipeline Warm Leads ----

export const pipelineWarmLeadsStore: StoreConfig<PipelineWarmLead> = {
  table: 'pipeline_warm_leads',

  fetchUrl: '/api/pipeline/warm-leads',

  parseResponse: (json) => json as PipelineWarmLead[],

  queryLocal: async () => {
    return offlineDb.pipeline_warm_leads
      .reverse()
      .sortBy('added_at');
  },

  mutate: {
    create: async (data) => {
      const id = uuid();
      const item: PipelineWarmLead = {
        id,
        name: data.name as string,
        company: (data.company as string) ?? null,
        interest: (data.interest as string) ?? null,
        source: (data.source as string) ?? null,
        added_at: nowLocal(),
        notes: (data.notes as string) ?? null,
      };
      await offlineDb.pipeline_warm_leads.put(item);
      await enqueue('POST', '/api/pipeline', { id, entity_type: 'warm_lead', ...data });
      return item;
    },

    update: async (data) => {
      const { id, ...updates } = data;
      const existing = await offlineDb.pipeline_warm_leads.get(id);
      const baseUpdatedAt = existing?.updated_at;
      updates.updated_at = nowLocal();
      await offlineDb.pipeline_warm_leads.update(id, updates);
      await enqueue('PATCH', '/api/pipeline', { id, entity_type: 'warm_lead', ...updates, _base_updated_at: baseUpdatedAt });
    },

    remove: async (id) => {
      await offlineDb.pipeline_warm_leads.delete(id);
      await enqueue('DELETE', `/api/pipeline?id=${id}&type=warm_lead`, null);
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
        top3_revenue: null,
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
    const now = new Date();
    const day = now.getDay();
    let routineType: string;
    if (day === 0) routineType = 'sunday';
    else if (day === 6) routineType = 'saturday';
    else {
      // Auto-calculate girls week: reference Monday March 16, 2026 = non-girls week, alternating
      const ref = new Date(2026, 2, 16).getTime();
      const d = new Date(now);
      const dayOff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      d.setDate(d.getDate() + dayOff);
      d.setHours(0, 0, 0, 0);
      const weeksDiff = Math.round((d.getTime() - ref) / (7 * 24 * 60 * 60 * 1000));
      routineType = weeksDiff % 2 !== 0 ? 'girls_week' : 'non_girls_week';
    }
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
