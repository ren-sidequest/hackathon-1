import { describe, expect, it } from 'vitest';
import { compareWork, resourceFinding, resourceRows, workflowSteps } from '../../shared/workspace-model';
import type { Finding, Resource } from '../../shared/api-types';

const resource: Resource = { id:'table.csv', name:'table.csv', datasetVersion:'test', provenance:'synthetic', mimeType:'text/csv', description:'Test rows', columns:['channel','sessions'], rows:[['Paid Search','20'],['Organic','100'],['Paid Search','3']], content:'', sizeBytes:0 };
const finding: Finding = { id:'a', section:'Key Findings', title:'Pattern', detail:'Limited evidence', source:'table.csv', confidence:'Low' };
describe('evidence workspace', () => {
  it('sorts numeric data numerically while preserving source rows through filtering', () => {
    expect(resourceRows(resource, 'paid', 1).map(r=>r.row)).toEqual([3,1]);
    expect(resourceRows(resource, '', 1, true).map(r=>r.row)).toEqual([2,1,3]);
    expect(resourceRows(resource, 'no match', -1)).toEqual([]);
    expect(resource.rows[0][1]).toBe('20');
  });
  it('never turns missing numeric values into zero', () => {
    const mixed = {...resource, rows:[['A',''],['B','-2'],['C','10']]};
    expect(resourceRows(mixed, '', 1).map(r=>r.cells[1])).toEqual(['','-2','10']);
  });
  it('cites the original row, leaves interpretation to the candidate, and bounds public text', () => {
    const card=resourceFinding(resource, resourceRows(resource,'paid',1)[0]);
    expect(card.source).toBe(resource.id);expect(card.title).toBe('');
    expect(card.detail).toContain('Source row 3');expect(card.detail).toContain('sessions: 3');
    expect(resourceFinding(resource).detail).toBe('');
    expect(resourceFinding({...resource,columns:['long']},{row:1,cells:['x'.repeat(9000)]}).detail.length).toBeLessThanOrEqual(4000);
  });
  it('compares by card identity and every public field without counting reorder as an edit', () => {
    const same={...finding,id:'same'};
    const before={summary:'v1',findings:[finding,same,{...finding,id:'removed'}]};
    const after={summary:'v2',findings:[same,{...finding,source:'other.csv'},{...finding,id:'new'}]};
    const diff=compareWork(before,after);
    expect(diff.summaryChanged).toBe(true);expect(diff.added.map(f=>f.id)).toEqual(['new']);
    expect(diff.removed.map(f=>f.id)).toEqual(['removed']);expect(diff.edited[0].before.source).toBe('table.csv');expect(diff.unchanged).toBe(1);
    expect(compareWork(before,{...before,findings:[...before.findings].reverse()}).edited).toEqual([]);
  });
  it('does not mark revision or optional analysis as completion', () => {
    expect(workflowSteps('awaiting_revision',true,1).find(s=>s.state==='current')?.label).toBe('Human review / revision');
    expect(workflowSteps('submitted',false,2).find(s=>s.state==='current')?.label).toBe('V2 submitted');
    expect(workflowSteps('closed',true,1).find(s=>s.state==='current')?.label).toBe('Closed');
  });
});
