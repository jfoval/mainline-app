'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Phone, Mail, Building2, User, ArrowRight, Trophy, XCircle, Search, X, Download } from 'lucide-react';
import { useOfflineStore, pipelineDealsStore, pipelineContactsStore, pipelineWarmLeadsStore } from '@/lib/offline';
import type { PipelineDeal as Deal, PipelineContact as Contact, PipelineWarmLead as WarmLead } from '@/lib/offline';
import { exportPipelineCSV } from '@/lib/csv-export';

const STAGES = [
  { value: 'discovery', label: 'Discovery', color: 'bg-blue-100 text-blue-700' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-purple-100 text-purple-700' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'verbal_yes', label: 'Verbal Yes', color: 'bg-green-100 text-green-700' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-red-100 text-red-700' },
];

const CONTACT_TYPES = [
  { value: 'active_client', label: 'Active Client' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'referral', label: 'Referral Source' },
  { value: 'strategic', label: 'Strategic' },
];

type Tab = 'deals' | 'warm_leads' | 'contacts' | 'closed';

function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some(f => f?.toLowerCase().includes(q));
}

export default function PipelinePage() {
  const { data: deals, create: createDeal, update: updateDeal, remove: removeDeal, refresh: refreshDeals } = useOfflineStore(pipelineDealsStore);
  const { data: warmLeads, create: createWarmLead, remove: removeWarmLead } = useOfflineStore(pipelineWarmLeadsStore);
  const { data: contacts, create: createContact, remove: removeContact } = useOfflineStore(pipelineContactsStore);
  const [tab, setTab] = useState<Tab>('deals');
  const [showAdd, setShowAdd] = useState(false);
  const [closedDeals, setClosedDeals] = useState<Deal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExport, setShowExport] = useState(false);

  const fetchClosedDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline?closed=true');
      const data = await res.json();
      setClosedDeals(data.deals || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === 'closed') fetchClosedDeals();
  }, [tab, fetchClosedDeals]);

  // Filtered data
  const filteredDeals = useMemo(() =>
    deals.filter(d => matchesSearch(searchQuery, d.company, d.contact_name, d.what_they_need, d.next_action)),
    [deals, searchQuery]
  );

  const filteredWarmLeads = useMemo(() =>
    warmLeads.filter(l => matchesSearch(searchQuery, l.name, l.company, l.interest, l.source, l.notes)),
    [warmLeads, searchQuery]
  );

  const filteredContacts = useMemo(() =>
    contacts.filter(c => matchesSearch(searchQuery, c.name, c.company, c.role, c.email, c.how_you_know, c.notes)),
    [contacts, searchQuery]
  );

  const filteredClosedDeals = useMemo(() =>
    closedDeals.filter(d => matchesSearch(searchQuery, d.company, d.contact_name, d.what_they_need, d.win_notes, d.loss_reason)),
    [closedDeals, searchQuery]
  );

  const isFiltering = searchQuery.length > 0;

  async function handleStageChange(dealId: string, newStage: string) {
    const today = new Date().toISOString().split('T')[0];
    if (newStage === 'closed_lost') {
      const reason = window.prompt('Why was this deal lost?');
      if (reason === null) return;
      await updateDeal({ id: dealId, stage: newStage, loss_reason: reason, closed_date: today });
    } else if (newStage === 'closed_won') {
      const notes = window.prompt('Any notes on this win?');
      if (notes === null) return;
      await updateDeal({ id: dealId, stage: newStage, win_notes: notes, closed_date: today });
    } else {
      await updateDeal({ id: dealId, stage: newStage });
    }
    if (tab === 'closed') fetchClosedDeals();
  }

  function handleExport(type: 'deals' | 'contacts' | 'warm_leads' | 'everything') {
    exportPipelineCSV(type, {
      deals: isFiltering ? filteredDeals : deals,
      contacts: isFiltering ? filteredContacts : contacts,
      warmLeads: isFiltering ? filteredWarmLeads : warmLeads,
    });
    setShowExport(false);
  }

  function tabLabel(key: Tab): string {
    const counts: Record<Tab, [number, number]> = {
      deals: [filteredDeals.length, deals.length],
      warm_leads: [filteredWarmLeads.length, warmLeads.length],
      contacts: [filteredContacts.length, contacts.length],
      closed: [filteredClosedDeals.length, closedDeals.length],
    };
    const labels: Record<Tab, string> = { deals: 'Deals', warm_leads: 'Warm Leads', contacts: 'Contacts', closed: 'Closed' };
    const [filtered, total] = counts[key];
    if (key === 'closed' && !isFiltering) return labels[key];
    return isFiltering ? `${labels[key]} (${filtered}/${total})` : `${labels[key]} (${total})`;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted mt-1">
            {deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length} active deals
            {' · '}{warmLeads.length} warm leads
            {' · '}{contacts.length} contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-card transition-colors"
            >
              <Download size={16} />
              Export
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-card rounded-xl border border-border shadow-lg p-1">
                  {isFiltering && (
                    <p className="px-3 py-1.5 text-xs text-muted">Exporting filtered results</p>
                  )}
                  <button onClick={() => handleExport('contacts')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-primary/10 transition-colors">
                    Contacts CSV
                  </button>
                  <button onClick={() => handleExport('deals')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-primary/10 transition-colors">
                    Deals CSV
                  </button>
                  <button onClick={() => handleExport('warm_leads')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-primary/10 transition-colors">
                    Warm Leads CSV
                  </button>
                  <div className="border-t border-border my-1" />
                  <button onClick={() => handleExport('everything')} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors">
                    Everything CSV
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-card rounded-xl p-1 border border-border">
        {(['deals', 'warm_leads', 'contacts', 'closed'] as Tab[]).map(key => (
          <button
            key={key}
            onClick={() => { setTab(key); setShowAdd(false); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
            }`}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search pipeline..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Add Forms */}
      {showAdd && tab === 'deals' && <AddDealForm onCreate={createDeal} onDone={() => setShowAdd(false)} onCancel={() => setShowAdd(false)} />}
      {showAdd && tab === 'warm_leads' && <AddWarmLeadForm onCreate={createWarmLead} onDone={() => setShowAdd(false)} onCancel={() => setShowAdd(false)} />}
      {showAdd && tab === 'contacts' && <AddContactForm onCreate={createContact} onDone={() => setShowAdd(false)} onCancel={() => setShowAdd(false)} />}

      {/* Content */}
      {tab === 'deals' && <DealsView deals={filteredDeals} onUpdate={updateDeal} onDelete={removeDeal} onStageChange={handleStageChange} />}
      {tab === 'warm_leads' && <WarmLeadsView leads={filteredWarmLeads} onCreateDeal={createDeal} onDelete={removeWarmLead} />}
      {tab === 'contacts' && <ContactsView contacts={filteredContacts} onDelete={removeContact} />}
      {tab === 'closed' && <ClosedDealsView deals={filteredClosedDeals} />}
    </div>
  );
}

// ─── Deals View ──────────────────────────────────────────
function DealsView({ deals, onUpdate, onDelete, onStageChange }: { deals: Deal[]; onUpdate: (data: Record<string, unknown> & { id: string }) => Promise<void>; onDelete: (id: string) => Promise<void>; onStageChange: (id: string, stage: string) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
    const stageDeals = deals.filter(d => d.stage === s.value);
    if (stageDeals.length > 0) acc[s.value] = stageDeals;
    return acc;
  }, {});

  async function updateDeal(id: string, updates: Record<string, string>) {
    await onUpdate({ id, ...updates });
  }

  async function deleteDeal(id: string) {
    await onDelete(id);
  }

  if (deals.length === 0) {
    return <div className="text-center py-12 text-muted">No deals yet. Add your first deal to start tracking.</div>;
  }

  return (
    <div className="space-y-6">
      {STAGES.map(stage => {
        const stageDeals = grouped[stage.value];
        if (!stageDeals) return null;
        return (
          <StageGroup key={stage.value} stage={stage} deals={stageDeals}>
            {stageDeals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                isEditing={editingId === deal.id}
                onEdit={() => setEditingId(editingId === deal.id ? null : deal.id)}
                onUpdate={(updates) => { updateDeal(deal.id, updates); setEditingId(null); }}
                onDelete={() => deleteDeal(deal.id)}
                onMoveStage={(newStage) => onStageChange(deal.id, newStage)}
              />
            ))}
          </StageGroup>
        );
      })}
    </div>
  );
}

function StageGroup({ stage, deals, children }: { stage: typeof STAGES[0]; deals: Deal[]; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const totalValue = deals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 mb-2">
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${stage.color}`}>{stage.label}</span>
        <span className="text-sm text-muted">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
        {totalValue > 0 && <span className="text-sm text-muted">· ${totalValue.toLocaleString()}</span>}
      </button>
      {isOpen && <div className="space-y-2 ml-1">{children}</div>}
    </div>
  );
}

function DealCard({ deal, isEditing, onEdit, onUpdate, onDelete, onMoveStage }: {
  deal: Deal;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Record<string, string>) => void;
  onDelete: () => void;
  onMoveStage: (stage: string) => void;
}) {
  const [nextAction, setNextAction] = useState(deal.next_action || '');
  const currentIdx = STAGES.findIndex(s => s.value === deal.stage);
  const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1 cursor-pointer" onClick={onEdit}>
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-muted" />
            <p className="font-medium text-sm">{deal.company}</p>
            {deal.value && <span className="text-xs text-green-600 font-medium">${parseFloat(deal.value).toLocaleString()}</span>}
          </div>
          {deal.contact_name && <p className="text-xs text-muted mt-1">{deal.contact_name}</p>}
          {deal.what_they_need && <p className="text-xs text-muted mt-1">{deal.what_they_need}</p>}
          {deal.next_action && <p className="text-xs mt-2"><span className="font-medium">Next:</span> {deal.next_action}</p>}
          {deal.last_contact && <p className="text-xs text-muted mt-1">Last contact: {deal.last_contact}</p>}
        </div>
        <div className="flex items-center gap-1">
          {nextStage && !['closed_won', 'closed_lost'].includes(deal.stage) && (
            <button
              onClick={() => onMoveStage(nextStage.value)}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
              title={`Move to ${nextStage.label}`}
            >
              <ArrowRight size={14} />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <input
            value={nextAction}
            onChange={e => setNextAction(e.target.value)}
            placeholder="Next action..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex gap-2 flex-wrap">
            {STAGES.filter(s => s.value !== deal.stage).map(s => (
              <button
                key={s.value}
                onClick={() => onMoveStage(s.value)}
                className={`px-2 py-1 rounded text-xs ${s.color} hover:opacity-80`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onUpdate({ next_action: nextAction })}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-primary-hover"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Closed Deals View ──────────────────────────────────────
function ClosedDealsView({ deals }: { deals: Deal[] }) {
  const wonDeals = deals.filter(d => d.stage === 'closed_won');
  const lostDeals = deals.filter(d => d.stage === 'closed_lost');

  if (deals.length === 0) {
    return <div className="text-center py-12 text-muted">No closed deals yet.</div>;
  }

  return (
    <div className="space-y-8">
      {wonDeals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Won ({wonDeals.length})</h3>
            <span className="text-sm text-muted">
              · ${wonDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            {wonDeals.map(deal => (
              <div key={deal.id} className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-emerald-600" />
                  <p className="font-medium text-sm">{deal.company}</p>
                  {deal.value && <span className="text-xs text-emerald-700 font-medium">${parseFloat(deal.value).toLocaleString()}</span>}
                </div>
                {deal.win_notes && <p className="text-xs text-emerald-800 mt-1">{deal.win_notes}</p>}
                {deal.closed_date && <p className="text-xs text-muted mt-1">Closed: {deal.closed_date}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {lostDeals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Lost ({lostDeals.length})</h3>
            <span className="text-sm text-muted">
              · ${lostDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            {lostDeals.map(deal => (
              <div key={deal.id} className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-red-500" />
                  <p className="font-medium text-sm">{deal.company}</p>
                  {deal.value && <span className="text-xs text-red-600 font-medium">${parseFloat(deal.value).toLocaleString()}</span>}
                </div>
                {deal.loss_reason && <p className="text-xs text-red-700 mt-1">Reason: {deal.loss_reason}</p>}
                {deal.closed_date && <p className="text-xs text-muted mt-1">Closed: {deal.closed_date}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Warm Leads View ──────────────────────────────────────
function WarmLeadsView({ leads, onCreateDeal, onDelete }: { leads: WarmLead[]; onCreateDeal: (data: Record<string, unknown>) => Promise<unknown>; onDelete: (id: string) => Promise<void> }) {
  async function convertToDeal(lead: WarmLead) {
    await onCreateDeal({
      company: lead.company || lead.name,
      contact_name: lead.name,
      what_they_need: lead.interest,
      stage: 'discovery',
    });
    await onDelete(lead.id);
  }

  async function deleteLead(id: string) {
    await onDelete(id);
  }

  if (leads.length === 0) {
    return <div className="text-center py-12 text-muted">No warm leads. Add people who&apos;ve shown interest.</div>;
  }

  return (
    <div className="space-y-2">
      {leads.map(lead => (
        <div key={lead.id} className="p-4 rounded-xl bg-card border border-border group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium text-sm">{lead.name}</p>
              {lead.company && <p className="text-xs text-muted mt-0.5">{lead.company}</p>}
              {lead.interest && <p className="text-xs mt-1">{lead.interest}</p>}
              {lead.source && <p className="text-xs text-muted mt-1">Source: {lead.source}</p>}
              {lead.notes && <p className="text-xs text-muted mt-1">{lead.notes}</p>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => convertToDeal(lead)}
                className="px-2 py-1 rounded-lg text-xs bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                title="Convert to deal"
              >
                → Deal
              </button>
              <button onClick={() => deleteLead(lead.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contacts View ──────────────────────────────────────
function ContactsView({ contacts, onDelete }: { contacts: Contact[]; onDelete: (id: string) => Promise<void> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = CONTACT_TYPES.reduce<Record<string, Contact[]>>((acc, ct) => {
    const typeContacts = contacts.filter(c => c.contact_type === ct.value);
    if (typeContacts.length > 0) acc[ct.value] = typeContacts;
    return acc;
  }, {});

  async function deleteContact(id: string) {
    await onDelete(id);
  }

  if (contacts.length === 0) {
    return <div className="text-center py-12 text-muted">No contacts yet. Build your network.</div>;
  }

  return (
    <div className="space-y-6">
      {CONTACT_TYPES.map(ct => {
        const typeContacts = grouped[ct.value];
        if (!typeContacts) return null;
        return (
          <div key={ct.value}>
            <p className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">{ct.label} ({typeContacts.length})</p>
            <div className="space-y-2">
              {typeContacts.map(contact => (
                <div key={contact.id} className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}>
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-muted" />
                        <p className="font-medium text-sm">{contact.name}</p>
                      </div>
                      {contact.company && <p className="text-xs text-muted mt-0.5">{contact.company}{contact.role ? ` · ${contact.role}` : ''}</p>}
                      {contact.how_you_know && <p className="text-xs text-muted mt-1">{contact.how_you_know}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors">
                          <Mail size={14} />
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors">
                          <Phone size={14} />
                        </a>
                      )}
                      <button onClick={() => deleteContact(contact.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {expandedId === contact.id && (
                    <div className="mt-3 pt-3 border-t border-border text-xs space-y-1">
                      {contact.email && <p><span className="text-muted">Email:</span> {contact.email}</p>}
                      {contact.phone && <p><span className="text-muted">Phone:</span> {contact.phone}</p>}
                      {contact.engagement_type && <p><span className="text-muted">Engagement:</span> {contact.engagement_type}</p>}
                      {contact.last_contact && <p><span className="text-muted">Last contact:</span> {contact.last_contact}</p>}
                      {contact.notes && <p><span className="text-muted">Notes:</span> {contact.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Forms ──────────────────────────────────────
function AddDealForm({ onCreate, onDone, onCancel }: { onCreate: (data: Record<string, unknown>) => Promise<unknown>; onDone: () => void; onCancel: () => void }) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [whatTheyNeed, setWhatTheyNeed] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('discovery');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    await onCreate({
      company: company.trim(),
      contact_name: contactName.trim(),
      what_they_need: whatTheyNeed.trim(),
      value: value.trim(),
      stage,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" autoFocus
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <div className="flex gap-3">
        <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="Value ($)"
          className="w-32 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <input value={whatTheyNeed} onChange={e => setWhatTheyNeed(e.target.value)} placeholder="What they need"
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <select value={stage} onChange={e => setStage(e.target.value)}
        className="px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
        {STAGES.filter(s => !['closed_won', 'closed_lost'].includes(s.value)).map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm">Add Deal</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">Cancel</button>
      </div>
    </form>
  );
}

function AddWarmLeadForm({ onCreate, onDone, onCancel }: { onCreate: (data: Record<string, unknown>) => Promise<unknown>; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [interest, setInterest] = useState('');
  const [source, setSource] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({
      name: name.trim(),
      company: company.trim(),
      interest: interest.trim(),
      source: source.trim(),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
      <div className="flex gap-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <input value={interest} onChange={e => setInterest(e.target.value)} placeholder="What are they interested in?"
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <input value={source} onChange={e => setSource(e.target.value)} placeholder="How'd you meet? (LinkedIn, referral, etc.)"
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm">Add Lead</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">Cancel</button>
      </div>
    </form>
  );
}

function AddContactForm({ onCreate, onDone, onCancel }: { onCreate: (data: Record<string, unknown>) => Promise<unknown>; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [howYouKnow, setHowYouKnow] = useState('');
  const [contactType, setContactType] = useState('strategic');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({
      name: name.trim(),
      company: company.trim(),
      role: role.trim(),
      email: email.trim(),
      phone: phone.trim(),
      how_you_know: howYouKnow.trim(),
      contact_type: contactType,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 bg-card rounded-xl border border-border space-y-3">
      <div className="flex gap-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" autoFocus
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <select value={contactType} onChange={e => setContactType(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
          {CONTACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <div className="flex gap-3">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone"
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <input value={howYouKnow} onChange={e => setHowYouKnow(e.target.value)} placeholder="How do you know them?"
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm">Add Contact</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-muted hover:text-foreground text-sm">Cancel</button>
      </div>
    </form>
  );
}
