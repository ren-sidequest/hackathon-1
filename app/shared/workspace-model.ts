import type { Finding, Resource } from './api-types';

/** Keep original row numbers through filtering/sorting so a card can cite the source. */
export function resourceRows(resource: Resource, query: string, column: number, descending = false) {
  const needle = query.trim().toLocaleLowerCase();
  const rows = resource.rows.map((cells, index) => ({ cells, row: index + 1 }))
    .filter(({ cells }) => !needle || cells.some(cell => cell.toLocaleLowerCase().includes(needle)));
  if (column < 0) return rows;
  const numeric = resource.rows.length > 0 && resource.rows.every(cells => {
    const value = (cells[column] ?? '').trim();
    return value !== '' && Number.isFinite(Number(value));
  });
  return rows.sort((a, b) => {
    const left = a.cells[column] ?? '', right = b.cells[column] ?? '';
    const order = numeric ? Number(left) - Number(right) : left.localeCompare(right, undefined, { numeric: true });
    return (descending ? -order : order) || a.row - b.row;
  });
}

export function resourceFinding(resource: Resource, row?: { cells: string[]; row: number }): Finding {
  const evidence = row ? `Source row ${row.row} (excluding header)\n${resource.columns.map((column, i) => `${column}: ${row.cells[i] ?? ''}`).join('\n')}` : '';
  return { id: crypto.randomUUID(), section: 'Key Findings', title: '', source: resource.id,
    detail: evidence.slice(0, 4000), confidence: 'Medium' };
}

export type PublicVersion = { summary: string; findings: Finding[] };
export function compareWork(before: PublicVersion, after: PublicVersion) {
  const previous = new Map(before.findings.map(f => [f.id, f]));
  const current = new Map(after.findings.map(f => [f.id, f]));
  const fields = ['section', 'title', 'detail', 'source', 'confidence'] as const;
  return {
    summaryChanged: before.summary !== after.summary,
    added: after.findings.filter(f => !previous.has(f.id)),
    removed: before.findings.filter(f => !current.has(f.id)),
    edited: after.findings.filter(f => previous.has(f.id) && fields.some(key => previous.get(f.id)![key] !== f[key]))
      .map(after => ({ before: previous.get(after.id)!, after })),
    unchanged: after.findings.filter(f => previous.has(f.id) && fields.every(key => previous.get(f.id)![key] === f[key])).length,
  };
}

export function workflowSteps(status: string, started = false, version = 1) {
  const active = status === 'closed' ? 4 : status === 'awaiting_revision' ? 3 : status === 'submitted' ? 2 : status === 'sent' && started ? 1 : 0;
  return ['Task sent', 'Investigation', `V${version} submitted`, 'Human review / revision', 'Closed'].map((label, i) => ({
    label, state: i < active ? 'done' : i === active ? 'current' : 'next',
  }));
}
