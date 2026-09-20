import type { Comparison, Demo, Stage } from '../api4-types';
import { stageContext } from './client';
import { resolveSourceRef } from './hr-model';

export type RetentionFilter = 'retained' | 'needs_reconfirmation' | 'all';
export function retainedRows(rows: Comparison['candidates'], filter: RetentionFilter) {
  return rows.filter(row => filter === 'all' || row.shortlist.status === filter);
}
export function decisionIsCurrent(data: Demo) {
  const basis = data.shortlist.basis;
  if (!basis || data.shortlist.status !== 'retained') return false;
  const current = stageContext(data, basis.stage);
  return !!current && basis.evidenceSnapshotId === current.evidenceSnapshotId && basis.fingerprint === current.fingerprint
    && basis.assessmentRevision === (current.assessment?.assessmentRevision ?? null) && basis.rubricVersion === data.rubricVersion;
}
export function decisionEvidence(data: Demo, stage: Stage) {
  const context = stageContext(data, stage), assessment = context?.assessment;
  // Never silently substitute another person's/stage's assessment or quotation.
  const valid = !!assessment && !!context && assessment.candidateId === data.candidate.id && assessment.stage === stage
    && assessment.evidenceSnapshotId === context.evidenceSnapshotId && assessment.fingerprint === context.fingerprint
    && assessment.rubricVersion === data.rubricVersion;
  const items = valid ? assessment.items : [];
  const sourceItems = items.filter(item => item.sourceRefs.some(ref => !!resolveSourceRef(data.candidate.id, context!, ref)));
  // Two different skill groups, strongest observed marks first. These are excerpts, not an overall recommendation.
  const groups = new Set<string>();
  const supports = [...sourceItems].filter(i => typeof i.mark === 'number' && i.mark >= 3).sort((a,b) => Number(b.mark)-Number(a.mark) || a.criterionId.localeCompare(b.criterionId)).filter(item => {
    const group = item.criterionId[0]; if(groups.has(group)) return false; groups.add(group); return true;
  }).slice(0,2).sort((a,b)=>data.rubric.criteria.findIndex(c=>c.id===a.criterionId)-data.rubric.criteria.findIndex(c=>c.id===b.criterionId));
  // Preserve backend priority. Equal-priority gaps remain visible, rather than declaring the first one 'the main gap'.
  const gaps = valid ? data.gapSuggestions.filter(g => g.stage === stage && g.assessmentRevision === assessment.assessmentRevision
    && g.evidenceSnapshotId === context!.evidenceSnapshotId && g.fingerprint === context!.fingerprint).sort((a,b) => a.priority-b.priority) : [];
  const concerns = gaps.length ? gaps.map(g => items.find(i => i.criterionId === g.criterionId)).filter(i => !!i)
    : items.filter(i => i.mark === 'NE' || (typeof i.mark === 'number' && i.mark < 3));
  return {context, assessment:valid ? assessment : null, supports, concerns};
}
