interface ColumnConfig {
  key: string;
  header: string;
}

export const DEAL_COLUMNS: ColumnConfig[] = [
  { key: 'company', header: 'Company' },
  { key: 'contact_name', header: 'Contact Name' },
  { key: 'what_they_need', header: 'What They Need' },
  { key: 'stage', header: 'Stage' },
  { key: 'value', header: 'Value' },
  { key: 'next_action', header: 'Next Action' },
  { key: 'last_contact', header: 'Last Contact' },
  { key: 'loss_reason', header: 'Loss Reason' },
  { key: 'win_notes', header: 'Win Notes' },
  { key: 'closed_date', header: 'Closed Date' },
  { key: 'created_at', header: 'Created At' },
  { key: 'updated_at', header: 'Updated At' },
];

export const CONTACT_COLUMNS: ColumnConfig[] = [
  { key: 'name', header: 'Name' },
  { key: 'company', header: 'Company' },
  { key: 'role', header: 'Role' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'how_you_know', header: 'How You Know' },
  { key: 'contact_type', header: 'Type' },
  { key: 'engagement_type', header: 'Engagement Type' },
  { key: 'start_date', header: 'Start Date' },
  { key: 'date_range', header: 'Date Range' },
  { key: 'last_contact', header: 'Last Contact' },
  { key: 'notes', header: 'Notes' },
  { key: 'created_at', header: 'Created At' },
];

export const WARM_LEAD_COLUMNS: ColumnConfig[] = [
  { key: 'name', header: 'Name' },
  { key: 'company', header: 'Company' },
  { key: 'interest', header: 'Interest' },
  { key: 'source', header: 'Source' },
  { key: 'notes', header: 'Notes' },
  { key: 'added_at', header: 'Added At' },
];

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateCSV(data: any[], columns: ColumnConfig[]): string {
  const header = columns.map(c => escapeCSVValue(c.header)).join(',');
  const rows = data.map((row: Record<string, unknown>) =>
    columns.map(c => escapeCSVValue(row[c.key])).join(',')
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportPipelineCSV(
  type: 'deals' | 'contacts' | 'warm_leads' | 'everything',
  data: { deals: any[]; contacts: any[]; warmLeads: any[] }
): void {
  const date = today();

  if (type === 'deals') {
    downloadCSV(generateCSV(data.deals, DEAL_COLUMNS), `pipeline-deals-${date}.csv`);
  } else if (type === 'contacts') {
    downloadCSV(generateCSV(data.contacts, CONTACT_COLUMNS), `pipeline-contacts-${date}.csv`);
  } else if (type === 'warm_leads') {
    downloadCSV(generateCSV(data.warmLeads, WARM_LEAD_COLUMNS), `pipeline-warm-leads-${date}.csv`);
  } else {
    // Everything: combined CSV with Type column
    const allColumns: ColumnConfig[] = [
      { key: '_type', header: 'Type' },
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'contact_name', header: 'Contact Name' },
      { key: 'role', header: 'Role' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'how_you_know', header: 'How You Know' },
      { key: 'contact_type', header: 'Contact Type' },
      { key: 'what_they_need', header: 'What They Need' },
      { key: 'stage', header: 'Stage' },
      { key: 'value', header: 'Value' },
      { key: 'next_action', header: 'Next Action' },
      { key: 'interest', header: 'Interest' },
      { key: 'source', header: 'Source' },
      { key: 'engagement_type', header: 'Engagement Type' },
      { key: 'last_contact', header: 'Last Contact' },
      { key: 'notes', header: 'Notes' },
      { key: 'created_at', header: 'Created At' },
    ];

    const allRows: Record<string, unknown>[] = [
      ...data.deals.map(d => ({ ...d, _type: 'Deal', name: d.company })),
      ...data.contacts.map(c => ({ ...c, _type: 'Contact' })),
      ...data.warmLeads.map(w => ({ ...w, _type: 'Warm Lead' })),
    ];

    downloadCSV(generateCSV(allRows, allColumns), `pipeline-all-${date}.csv`);
  }
}
