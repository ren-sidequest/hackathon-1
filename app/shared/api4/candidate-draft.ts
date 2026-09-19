import type { Demo, Finding, ProcessEvent, Submission, SubmitRequest } from '../api4-types';
import { taskBinding } from './client';

export const sections = ['Key Findings', 'Hypotheses', 'Additional Evidence Needed', 'Recommended Next Steps'] as const;
export type CandidateDraft = { started: boolean; summary: string; findings: Finding[]; events: ProcessEvent[]; notes: string; savedAt: string | null };
export const emptyDraft = (): CandidateDraft => ({ started: false, summary: '', findings: [], events: [], notes: '', savedAt: null });
export const draftKey = (data: Demo, version: number) => `evidencebridge.api4.draft.${data.sessionId}.${data.fixtureVersion}.${data.jdVersion}.${data.rubricVersion}.${data.datasetVersion}.${data.candidate.id}.${data.task.taskId}.v${version}`;
export const event = (title: string, detail?: string): ProcessEvent => ({ id: crypto.randomUUID(), at: new Date().toISOString(), title, ...(detail === undefined ? {} : { detail }) });
// Reserve one of the 100 event slots for the actual submission action.
export const appendDraftEvent = (draft: CandidateDraft, entry: ProcessEvent): CandidateDraft => draft.events.length >= 99 ? draft : { ...draft, events: [...draft.events, entry] };
export function publicWork(draft: CandidateDraft) {
  return {
    summary: draft.summary,
    findings: draft.findings.map(({ id, section, title, detail, source, confidence }) => ({ id, section, title, detail, source, confidence })),
    processEvidence: draft.events.map(({ id, at, title, detail }) => ({ id, at, title, ...(detail === undefined ? {} : { detail }) })),
  };
}
export function submissionPayload(data: Demo, draft: CandidateDraft): SubmitRequest {
  const version = data.workflow.nextSubmissionVersion;
  if (!data.workflow.canSubmit || data.workflow.isTerminal || version === null) throw new Error('Submission is closed. Refresh the shared case.');
  const previous = version === 2 ? data.versions.find(v => v.submission.submissionVersion === 1)?.submission : null;
  if (version === 2 && (!data.workflow.canResubmit || !previous)) throw new Error('V2 needs the V1 snapshot and its More review.');
  return { ...taskBinding(data), submissionVersion: version, previousSubmissionId: previous?.submissionId ?? null, previousContentFingerprint: previous?.contentFingerprint ?? null, ...publicWork(draft) };
}
export function submissionIssues(data: Demo, draft: CandidateDraft): string[] {
  const issues: string[] = [];
  if (!draft.summary.trim() || draft.summary.length > 8000) issues.push('Add an executive summary of 1–8,000 characters.');
  if (draft.findings.length > 40) issues.push('Keep at most 40 investigation cards.');
  const ids = new Set<string>();
  for (const f of draft.findings) {
    if (ids.has(f.id) || !/^[A-Za-z0-9_-]{1,80}$/.test(f.id)) issues.push('Each card needs a unique valid ID.');
    ids.add(f.id);
    if (!f.title.trim() || f.title.length > 300 || f.detail.length > 4000) issues.push('Card titles must be 1–300 characters; reasoning at most 4,000.');
    if (!sections.includes(f.section) || !['High', 'Medium', 'Low'].includes(f.confidence)) issues.push('Check card section and confidence.');
    if (f.source.length > 80 || (f.source && !data.dataset.resources.some(r => r.id === f.source))) issues.push('Choose a source from the current dataset, or no source.');
  }
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (draft.events.length > 100 || new Set(draft.events.map(e => e.id)).size !== draft.events.length || draft.events.some(e => !/^[A-Za-z0-9_-]{1,80}$/.test(e.id) || !iso.test(e.at) || !Number.isFinite(Date.parse(e.at)) || !e.title.trim() || e.title.length > 200 || (e.detail?.length ?? 0) > 1000)) issues.push('Process events exceed the API limits.');
  try {
    if (new TextEncoder().encode(JSON.stringify(submissionPayload(data, draft))).length > 128 * 1024) issues.push('The public work exceeds 128 KiB. Shorten the summary or cards before submitting.');
  } catch (error) { issues.push(error instanceof Error ? error.message : 'Refresh the task before submitting.'); }
  return [...new Set(issues)];
}
export function copyPublicSnapshot(submission: Submission): CandidateDraft {
  return { ...emptyDraft(), started: true, summary: submission.summary, findings: submission.findings.map(({ id, section, title, detail, source, confidence }) => ({ id, section, title, detail, source, confidence })), events: [event('Started V2 draft', 'Public V1 fields explicitly copied; prior snapshot and private notes stay separate.')] };
}
export function readDraft(key: string, storage?: Pick<Storage, 'getItem'>): CandidateDraft {
  try {
    const d = JSON.parse((storage ?? localStorage).getItem(key) ?? 'null');
    if (d && typeof d.started === 'boolean' && typeof d.summary === 'string' && typeof d.notes === 'string' && (d.savedAt === null || typeof d.savedAt === 'string') && Array.isArray(d.findings) && d.findings.every((f: Finding) => f && typeof f.id === 'string' && sections.includes(f.section) && [f.title, f.detail, f.source].every(x => typeof x === 'string') && ['High', 'Medium', 'Low'].includes(f.confidence)) && Array.isArray(d.events) && d.events.every((e: ProcessEvent) => e && typeof e.id === 'string' && typeof e.at === 'string' && typeof e.title === 'string' && (e.detail === undefined || typeof e.detail === 'string'))) {
      const publicFields = publicWork(d);
      return { started: d.started, notes: d.notes, savedAt: d.savedAt, summary: publicFields.summary, findings: publicFields.findings, events: publicFields.processEvidence };
    }
  } catch { /* Damaged or unavailable browser storage never replaces server data. */ }
  return emptyDraft();
}
