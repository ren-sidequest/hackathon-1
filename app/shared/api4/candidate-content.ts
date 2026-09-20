import type { Demo } from '../api4-types';

const titles: Record<string, string> = {
  'cv-public.txt': 'Personal CV', 'channel_analysis.md': 'Channel conversion report',
  'channel_analysis.sql': 'Channel analysis SQL', 'churn_method_note.md': 'Churn analysis method',
  'cohort_extract.sql': 'Cohort extraction SQL', 'project_readme.md': 'Application project overview',
  'task_queries.sql': 'Task query SQL', 'campaign_brief.md': 'Campaign brief', 'social_reporting.md': 'Social performance report',
  'website_traffic.csv': 'Website traffic', 'channel_comparison.csv': 'Channel comparison',
  'orders.csv': 'Orders', 'current_paid_search_devices.csv': 'Current paid-search devices',
  'product_catalog.csv': 'Product catalogue', 'business_context.md': 'Business context',
};
/** Display-only aliases: identifiers, bytes and citation locations remain unchanged. */
export const sourceTitle = (id: string) => titles[id] ?? id.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
export const taskResources = (data: Demo) => data.task.targetRequirementId
  ? data.dataset.resources.filter(r => data.taskTemplates[data.task.targetRequirementId!].resourceIds.includes(r.id)) : [];

export type TextBlock = { type: 'heading' | 'paragraph' | 'table'; text: string; headers?: string[]; rows?: string[][] };
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
/** Restricted text renderer, never executes HTML or follows document instructions. */
export function documentBlocks(text: string): TextBlock[] {
  const lines = text.split(/\r?\n/), result: TextBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('|') && /^\|?[\s:|-]+\|?$/.test(lines[i + 1]?.trim() ?? '') && lines[i + 1]?.includes('---')) {
      const headers = cells(line), rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      i--; result.push({ type: 'table', text: '', headers, rows });
    } else if (/^#{1,6}\s/.test(line)) result.push({ type: 'heading', text: line.replace(/^#+\s*/, '') });
    else result.push({ type: 'paragraph', text: line.replace(/^>\s?/, '') });
  }
  return result;
}

/** Derived only from a compatible source table, never from the company task metrics. */
export function sourcePeriodMetrics(text: string) {
  const table = documentBlocks(text).find(b => b.type === 'table' && b.headers?.join('|') === 'Period|Channel|Sessions|Completed orders');
  if (!table?.rows?.length) return [];
  const sums = { Previous: [0, 0], Current: [0, 0] };
  const seen = new Set<string>();
  for (const row of table.rows) {
    if (row.length !== 4 || (row[0] !== 'Previous' && row[0] !== 'Current') || !row[1] || seen.has(row.slice(0, 2).join('|'))) return [];
    seen.add(row.slice(0, 2).join('|'));
    if (!row.slice(2).every(c => /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(c))) return [];
    const values = row.slice(2).map(c => Number(c.replace(/,/g, '')));
    if (values.some(n => !Number.isSafeInteger(n)) || values[1] > values[0]) return [];
    sums[row[0]][0] += values[0]; sums[row[0]][1] += values[1];
  }
  const [p, c] = [sums.Previous, sums.Current];
  if (!p[0] || !c[0]) return [];
  const n = (value: number) => value.toLocaleString('en-US');
  return [
    { label: 'Sessions', before: n(p[0]), after: n(c[0]) },
    { label: 'Completed orders', before: n(p[1]), after: n(c[1]) },
    { label: 'Overall conversion', before: `${(100 * p[1] / p[0]).toFixed(1)}%`, after: `${(100 * c[1] / c[0]).toFixed(1)}%` },
  ];
}
