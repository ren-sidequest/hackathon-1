import type { AssessmentItem, Comparison, Demo, RequirementId, SourceRef, Stage, Version } from '../api3-types';

export const stageNames: Record<Stage, string> = { application_review: 'Application materials', task_v1: 'Task V1', task_v2: 'Task V2' };
export const requirementNames: Record<RequirementId, string> = { sql: 'SQL', 'data-analysis': 'Data Analysis', 'business-problem-solving': 'Business Problem Solving' };
export const requirements: RequirementId[] = ['sql', 'data-analysis', 'business-problem-solving'];
export function annotationLabel(mode: 'preset_human' | 'human' | 'human_reviewed' | null | undefined): string {
  return mode === 'preset_human' ? 'AI-authored preset · human calibration pending' : mode === 'human' || mode === 'human_reviewed' ? 'Human assessment' : 'Not assessed';
}
export const percent = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(1)}%`;
export type Source = { sourceId: string; location: string; text: string };
export type SourceContext = { evidenceSnapshotId: string; fingerprint: string; sources: Source[] };
export type DraftItem = Omit<AssessmentItem, 'mark'> & { mark: AssessmentItem['mark'] | null };
export function resolveSourceRef(candidateId: string, context: SourceContext, ref: SourceRef): Source | null {
  if (ref.candidateId !== candidateId || ref.evidenceSnapshotId !== context.evidenceSnapshotId || ref.fingerprint !== context.fingerprint) return null;
  const source = context.sources.find(s => s.sourceId === ref.sourceId && s.location === ref.location);
  return source && Number.isInteger(ref.start) && Number.isInteger(ref.end) && ref.start >= 0 && ref.end > ref.start && ref.end <= source.text.length && source.text.slice(ref.start, ref.end) === ref.quote ? source : null;
}
export function assessmentProblem(candidateId: string, context: SourceContext, items: DraftItem[]): string | null {
  for (const item of items) {
    if (item.mark === null) return `${item.criterionId}: select a mark or NE. All criteria in this group are saved together.`;
    for (const field of ['rationale', 'support', 'gaps', 'uncertainty', 'nextStep'] as const) {
      if (!item[field].trim() || item[field].length > 2000) return `${item.criterionId}: ${field} requires 1–2000 characters.`;
    }
    if (!item.checkedSourceIds.length || item.checkedSourceIds.some(id => !context.sources.some(s => s.sourceId === id))) return `${item.criterionId}: select the original sources you checked.`;
    if (item.sourceRefs.some(ref => !item.checkedSourceIds.includes(ref.sourceId))) return `${item.criterionId}: mark every quoted source as checked.`;
    if (item.mark !== 'NE' && !item.sourceRefs.length) return `${item.criterionId}: every numerical mark, including 0, needs an exact source quotation.`;
    if (item.sourceRefs.length > 10 || item.sourceRefs.some(ref => !ref.quote.trim() || ref.quote.length > 2000 || !resolveSourceRef(candidateId, context, ref))) return `${item.criterionId}: a quotation does not match this candidate and material snapshot.`;
  }
  return null;
}
export type CompareRow = Comparison['candidates'][number];
export type CompareSort = 'default' | 'overall' | RequirementId;
export function compareValue(row: CompareRow, sort: CompareSort): number | null {
  if (!row.assessment || sort === 'default') return null;
  return sort === 'overall' ? row.assessment.score.overallPercentage : row.assessment.score.skills.find(s => s.requirementId === sort)?.percentage ?? null;
}
export function sortComparison(rows: CompareRow[], sort: CompareSort): CompareRow[] {
  if (sort === 'default') return rows;
  // Stable sort preserves display order on ties; unknowns receive no rank or fabricated zero.
  return [...rows].sort((a, b) => { const left = compareValue(a, sort), right = compareValue(b, sort); return left === null ? right === null ? 0 : 1 : right === null ? -1 : right - left; });
}
export function analysisSource(version: Version, citation: { sourceId: string; location: string; start: number; end: number; quote: string }): Source | null {
  const result = version.analysis.result, submission = version.submission;
  if (!result || version.analysis.submissionId !== submission.submissionId || version.analysis.contentFingerprint !== submission.contentFingerprint || result.submissionId !== submission.submissionId || result.contentFingerprint !== submission.contentFingerprint) return null;
  const source = submission.sources.find(s => s.sourceId === citation.sourceId && s.location === citation.location);
  return source && Number.isInteger(citation.start) && Number.isInteger(citation.end) && citation.start >= 0 && citation.end > citation.start && citation.end <= source.text.length && source.text.slice(citation.start, citation.end) === citation.quote ? source : null;
}
export function latestStage(data: Demo): Stage { return data.currentSubmissionVersion === 2 ? 'task_v2' : data.currentSubmissionVersion === 1 ? 'task_v1' : 'application_review'; }
