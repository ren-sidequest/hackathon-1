import type { CandidateId } from '../api4-types';
import { sortComparison, type CompareRow, type CompareSort } from './hr-model';

export type CandidateFilter = 'all' | 'retained' | 'needs_evidence';
// Editorial CV-scope labels for the four supplied fictional profiles, not computed judgments.
export const profileLabels: Record<CandidateId, string> = {
  'amy-chen':'Queries & calculations', 'ann-li':'Customer data analysis',
  'david-liu':'Software projects', 'jamie-parker':'Marketing metrics',
};
export function comparisonPage(rows: CompareRow[], query: string, filter: CandidateFilter, sort: CompareSort, requestedPage: number, size: number, displayName: (name:string)=>string = name=>name) {
  const needle=query.trim().toLocaleLowerCase();
  const filtered=sortComparison(rows,sort).filter(row=>
    (!needle || `${row.candidate.name} ${displayName(row.candidate.name)} ${row.candidate.id}`.toLocaleLowerCase().includes(needle)) &&
    (filter==='all' || (filter==='retained' ? row.shortlist.status!=='not_retained' : row.assessment?.score.status==='needs_evidence')));
  const pageSize=Math.max(1,Math.floor(size)||20), pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const page=Math.min(Math.max(0,Math.floor(requestedPage)||0),pages-1), start=page*pageSize;
  return {rows:filtered.slice(start,start+pageSize),total:filtered.length,page,pages,start:filtered.length?start+1:0,end:Math.min(start+pageSize,filtered.length)};
}
