// Frontend view models only. These are NOT the next backend DTO or API contract.
import type { Finding, ProcessEvent } from '../api-types';

export type Skill = 'SQL' | 'DA' | 'BPS';
export type Mark = 0 | 1 | 2 | 3 | 4 | 'NE';
export type Stage = 'application_review' | 'task_v1' | 'task_v2';
export type Criterion = { id: string; skill: Skill; title: string; looksFor: string; anchors: Record<0 | 2 | 4, string> };
export type Source = { id: string; candidateId: string; snapshotId: string; name: string; text: string; kind: 'application' | 'work_sample' };
export type Quote = { candidateId: string; snapshotId: string; sourceId: string; start: number; end: number; text: string };
export type AssessmentEntry = { criterionId: string; mark: Mark | null; reason: string; scope: string; gap: string; citation: Quote | null };
export type Assessment = { id: string; revision: number; rubricVersion: string; candidateId: string; snapshotId: string; stage: Stage; mode: 'illustrative_fixture'; entries: AssessmentEntry[]; results: { skills: Record<Skill, number | null>; overall: number | null; coverage: number; reviewedPoints: number } };
export type Profile = { id: string; name: string; initials: string; subtitle: string; strength: string; question: string; suggestedSkill: Skill; snapshotId: string; sources: Source[]; assessment: Assessment };
export type WorkDraft = { started: boolean; summary: string; findings: Finding[]; events: ProcessEvent[]; notes: string; savedAt: string | null };
export type Review = { decision: 'confirm' | 'needs_more_evidence' | 'evidence_still_insufficient'; comment: string; at: string };
export type WorkVersion = { id: string; version: 1 | 2; candidateId: string; taskId: string; snapshotId: string; summary: string; findings: Finding[]; processEvidence: ProcessEvent[]; submittedAt: string; review: Review | null };
export type Task = { id: string; skill: Skill; instructions: string; reason: string; status: 'sent' | 'submitted' | 'awaiting_revision' | 'closed'; versions: WorkVersion[] };
export type AssessmentDraft = { candidateId: string; stage: Stage; snapshotId: string; rubricVersion: string; entries: AssessmentEntry[]; savedAt: string };
export type Basis = { snapshotId: string; assessmentRevision: number | null; rubricVersion: string; stage: Stage };
export type Retention = { retained: boolean; reason: string; basis: Basis; at: string };
export type PreviewState = { format: 'revision5-ui-v1'; sessionId: string; revision: number; tasks: Record<string, Task | null>; shortlist: Record<string, Retention | null>; assessmentDrafts: Record<string, AssessmentDraft>; workDrafts: Record<string, WorkDraft> };
export const skillName: Record<Skill, string> = { SQL: 'SQL', DA: 'Data Analysis', BPS: 'Business Problem Solving' };
export const stageName: Record<Stage, string> = { application_review: 'Application materials', task_v1: 'Task V1', task_v2: 'Task V2' };
export const skills: Skill[] = ['SQL', 'DA', 'BPS'];
export const rubricVersion = 'ui-rubric-preview-5';
export const formatPercent = (value: number | null) => value === null ? 'Needs evidence' : `${value.toFixed(1)}%`;
export const stageForVersion = (v: number): Stage => v === 1 ? 'task_v1' : 'task_v2';
export const draftKey = (state: PreviewState, id: string, task: Task, version: number) => `${state.sessionId}.${id}.${task.id}.v${version}`;
export const assessmentKey = (id: string, stage: Stage) => `${id}.${stage}`;
export const nextVersion = (task: Task | null): 1 | 2 | null => task?.status === 'sent' ? 1 : task?.status === 'awaiting_revision' ? 2 : null;
export function quoteSource(profile: Profile, quote: Quote, sources = profile.sources) {
  if (quote.candidateId !== profile.id || !Number.isInteger(quote.start) || !Number.isInteger(quote.end) || quote.start < 0 || quote.end <= quote.start) return null;
  const source = sources.find(s => s.id === quote.sourceId && s.candidateId === quote.candidateId && s.snapshotId === quote.snapshotId);
  return source && quote.end <= source.text.length && source.text.slice(quote.start, quote.end) === quote.text ? source : null;
}
export function sortedProfiles(profiles: Profile[], by: 'default' | 'overall' | Skill) {
  if (by === 'default') return [...profiles];
  const value = (p: Profile) => by === 'overall' ? p.assessment.results.overall : p.assessment.results.skills[by];
  return [...profiles].sort((a, b) => {
    const x = value(a), y = value(b);
    return x === null ? y === null ? 0 : 1 : y === null ? -1 : y - x;
  });
}
export function currentBasis(profile: Profile, task: Task | null): Basis {
  const last = task?.versions.at(-1);
  return { snapshotId: last?.snapshotId ?? profile.snapshotId, assessmentRevision: last ? null : profile.assessment.revision, rubricVersion, stage: last ? stageForVersion(last.version) : 'application_review' };
}
export function needsReconfirmation(record: Retention | null, basis: Basis) {
  return Boolean(record?.retained && (record.basis.snapshotId !== basis.snapshotId || record.basis.assessmentRevision !== basis.assessmentRevision || record.basis.rubricVersion !== basis.rubricVersion));
}
export function submissionSource(work: WorkVersion): Source {
  return { id: `${work.id}-source`, candidateId: work.candidateId, snapshotId: work.snapshotId, name: `V${work.version} public work`, kind: 'work_sample', text: [work.summary, ...work.findings.map(f => `${f.section}\n${f.title}\n${f.detail}\nSource: ${f.source || 'Not supplied'}`)].join('\n\n') };
}
