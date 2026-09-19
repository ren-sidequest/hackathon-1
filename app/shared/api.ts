import type { Demo, Envelope, Finding, ProcessEvent, Submission, Version, Citation } from './api-types';

export const sections = ['Key Findings', 'Hypotheses', 'Additional Evidence Needed', 'Recommended Next Steps'] as const;
export type Draft = { started: boolean; summary: string; findings: Finding[]; events: ProcessEvent[]; notes: string; savedAt: string | null };
export const emptyDraft = (): Draft => ({ started: false, summary: '', findings: [], events: [], notes: '', savedAt: null });
export const draftKey = (data: Demo, version: number) => `evidencebridge.api2.draft.${data.sessionId}.${data.task.taskId}.v${version}`;
export const binding = (data: Demo) => ({ schemaVersion: data.schemaVersion, sessionId: data.sessionId, taskId: data.task.taskId, datasetVersion: data.datasetVersion });
export const submissionBinding = (data: Demo) => {
  if (!data.submission) throw new Error('No current submission. Refresh the shared case.');
  return { ...binding(data), submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint };
};
export const event = (title: string, detail?: string): ProcessEvent => ({ id: crypto.randomUUID(), at: new Date().toISOString(), title, ...(detail === undefined ? {} : { detail }) });
export function publicWork(draft: Draft) {
  return { summary: draft.summary,
    findings: draft.findings.map(({ id, section, title, detail, source, confidence }) => ({ id, section, title, detail, source, confidence })),
    processEvidence: draft.events.map(({ id, at, title, detail }) => ({ id, at, title, ...(detail === undefined ? {} : { detail }) })),
  };
}
export function submissionPayload(data: Demo, draft: Draft) {
  const version = data.workflow.nextSubmissionVersion;
  if (!data.workflow.canSubmit || version === null) throw new Error('Submission is closed. Refresh the shared case.');
  const previous = version === 2 ? data.versions[0]?.submission : null;
  if (version === 2 && (!data.workflow.canResubmit || !previous)) throw new Error('V2 requires the V1 review and its snapshot.');
  return { ...binding(data), candidateId: data.candidate.id, submissionVersion: version,
    previousSubmissionId: previous?.submissionId ?? null, previousContentFingerprint: previous?.contentFingerprint ?? null, ...publicWork(draft) };
}
export function submissionIssues(data: Demo, draft: Draft): string[] {
  const issues: string[] = [];
  if (!draft.summary.trim() || draft.summary.length > 8000) issues.push('Add an executive summary of 1–8,000 characters.');
  if (draft.findings.length > 40) issues.push('Keep at most 40 investigation cards.');
  const ids = new Set<string>();
  for (const finding of draft.findings) {
    if (ids.has(finding.id) || !/^[A-Za-z0-9_-]{1,80}$/.test(finding.id)) issues.push('Each card needs a unique valid ID.');
    ids.add(finding.id);
    if (!finding.title.trim() || finding.title.length > 300 || finding.detail.length > 4000) issues.push('Card titles must be 1–300 characters; reasoning at most 4,000.');
    if (!sections.includes(finding.section) || !['High','Medium','Low'].includes(finding.confidence)) issues.push('Check card section and confidence.');
    if (finding.source && !data.dataset.resources.some(r => r.id === finding.source)) issues.push('Choose a source from the current dataset, or no source.');
  }
  if (draft.events.length > 100 || new Set(draft.events.map(e => e.id)).size !== draft.events.length || draft.events.some(e => !/^[A-Za-z0-9_-]{1,80}$/.test(e.id) || !Number.isFinite(Date.parse(e.at)) || !e.title.trim() || e.title.length > 200 || (e.detail?.length ?? 0) > 1000)) issues.push('Process events exceed the API limits.');
  if (data.workflow.canSubmit && new TextEncoder().encode(JSON.stringify(submissionPayload(data, draft))).length > 128 * 1024) issues.push('The public work exceeds 128 KiB. Shorten the summary or cards before submitting.');
  return [...new Set(issues)];
}
export function resolveCitation(version: Version, citation: Citation) {
  const { submission, analysis } = version;
  if (analysis.submissionId !== submission.submissionId || analysis.contentFingerprint !== submission.contentFingerprint || analysis.result?.submissionId !== submission.submissionId || analysis.result.contentFingerprint !== submission.contentFingerprint) return null;
  const source = submission.sources.find(s => s.sourceId === citation.sourceId && s.location === citation.location);
  if (!source || !Number.isInteger(citation.start) || !Number.isInteger(citation.end) || citation.start < 0 || citation.end > source.text.length || citation.end <= citation.start || source.text.slice(citation.start, citation.end) !== citation.quote) return null;
  return source;
}
export function readDraft(key: string): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (d && typeof d.started === 'boolean' && typeof d.summary === 'string' && typeof d.notes === 'string' && Array.isArray(d.findings) && d.findings.every((f: Finding) => f && typeof f.id === 'string' && sections.includes(f.section) && [f.title, f.detail, f.source].every(x => typeof x === 'string') && ['High','Medium','Low'].includes(f.confidence)) && Array.isArray(d.events) && d.events.every((e: ProcessEvent) => e && typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(Date.parse(e.at)) && (e.detail === undefined || typeof e.detail === 'string'))) return d;
  } catch { /* Invalid local drafts never replace server snapshots. */ }
  return emptyDraft();
}
export function copySnapshot(submission: Submission): Draft {
  return { ...emptyDraft(), started: true, summary: submission.summary, findings: submission.findings.map(f => ({ ...f })), events: [event('Started V2 draft', 'Public V1 work explicitly copied; V1 remains immutable.')] };
}
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const decisionLabel = (decision: string) => ({ confirm: 'Evidence confirmed', needs_more_evidence: 'Needs more evidence', evidence_still_insufficient: 'Evidence still insufficient' }[decision] ?? decision);
export function workMarkdown(work: Pick<Submission, 'summary' | 'findings' | 'processEvidence'>) {
  return `## Executive summary\n\n${work.summary}\n\n${sections.map(section => `## ${section}\n\n${work.findings.filter(f => f.section === section).map(f => `### ${f.title}\n\n${f.detail}\n\nSource: ${f.source || 'Not supplied'} · Self-reported confidence: ${f.confidence}`).join('\n\n')}`).join('\n\n')}\n\n## Client-reported process\n\n${work.processEvidence.map(e => `${e.at} — ${e.title}${e.detail ? `: ${e.detail}` : ''}`).join('\n')}`;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public requestId = '', public uncertain = false) { super(message); }
}
export type Pending = { path: string; body: Record<string, unknown>; key: string };
export class ApiClient {
  pending: Pending | null = null;
  constructor(public base: string, private storageKey: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {
    try { const p = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); if (p && ['/task/send','/submission','/analysis','/review'].includes(p.path) && typeof p.key === 'string' && p.body?.schemaVersion === '2.0') this.pending = p; } catch { /* Session persistence is optional. */ }
  }
  private save(pending: Pending | null) {
    this.pending = pending;
    try { if (pending) sessionStorage.setItem(this.storageKey, JSON.stringify(pending)); else sessionStorage.removeItem(this.storageKey); } catch { /* Keep an in-memory receipt during this visit. */ }
  }
  discardStale(data: Demo) { if (this.pending && (this.pending.body.sessionId !== data.sessionId || this.pending.body.taskId !== data.task.taskId)) this.save(null); }
  async request(path: string, init?: RequestInit): Promise<Envelope> {
    let response: Response;
    try { response = await this.fetcher(`${this.base}/api/demo${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(init ? 70000 : 12000) }); }
    catch { throw new ApiError('CONNECTION_UNCERTAIN', 'Cannot reach the shared service. Check its address and allowed origins. Your draft is kept; retry an uncertain action with its original receipt.', '', Boolean(init)); }
    let result;
    try { result = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', 'The service did not return JSON. Refresh and check the API address.', '', Boolean(init)); }
    if (!response.ok) {
      if (result.error?.code) throw new ApiError(result.error.code, result.error.message, result.error.requestId);
      throw new ApiError('INVALID_RESPONSE', 'Unexpected service response. Retry with the original receipt.', '', Boolean(init));
    }
    if (result.data?.schemaVersion !== '2.0' || !Array.isArray(result.data.versions) || !result.data.workflow || !result.data.dataset?.resources) throw new ApiError('SCHEMA_MISMATCH', 'This frontend requires EvidenceBridge API 2.0. Check the backend version.', '', Boolean(init));
    return result;
  }
  read() { return this.request(''); }
  async write(path: string, body: Record<string, unknown>) {
    if (this.pending) throw new ApiError('PENDING_ACTION', 'Resolve the previous uncertain action using Retry original action before starting another.');
    this.save({ path, body: structuredClone(body), key: crypto.randomUUID() });
    return this.retry();
  }
  async retry() {
    const p = this.pending;
    if (!p) throw new ApiError('NO_PENDING_ACTION', 'No action is waiting for retry.');
    try {
      const response = await this.request(p.path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': p.key }, body: JSON.stringify(p.body) });
      // 202 is an unresolved receipt. Keep its key while GET shows progress.
      if (p.path !== '/analysis' || response.data.analysis.status !== 'running') this.save(null);
      return response;
    } catch (error) { if (error instanceof ApiError && !error.uncertain) this.save(null); throw error; }
  }
  settleAnalysis(data: Demo) { if (this.pending?.path === '/analysis' && (data.analysis.status !== 'running' || data.submission?.submissionId !== this.pending.body.submissionId)) this.save(null); }
}
