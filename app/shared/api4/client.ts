import type { AssessmentRecord, CandidateId, Comparison, Demo, Envelope, Stage } from '../api4-types';

export const candidateIds: CandidateId[] = ['amy-chen', 'ann-li', 'david-liu', 'jamie-parker'];
const writePaths = ['/task/send', '/submission', '/analysis', '/review', '/assessment', '/shortlist'];
export class Api4Error extends Error {
  constructor(public code: string, message: string, public requestId = '', public uncertain = false, public status = 0) { super(message); }
}
export type Pending = { path: string; body: Record<string, unknown>; key: string };
export function baseBinding(data: Demo) {
  if (data.job.id !== 'junior-data-analyst') throw new Api4Error('JOB_MISMATCH', 'This contract supports the current Junior Data Analyst role only.');
  return { schemaVersion: data.schemaVersion, sessionId: data.sessionId, candidateId: data.candidate.id, jobId: data.job.id as 'junior-data-analyst', datasetVersion: data.datasetVersion };
}
export function taskBinding(data: Demo) {
  if (!data.task.targetRequirementId) throw new Api4Error('TASK_NOT_SENT', 'Refresh and wait for HR to send a targeted task.');
  return { ...baseBinding(data), taskId: data.task.taskId, targetRequirementId: data.task.targetRequirementId };
}
export function submissionBinding(data: Demo) {
  if (!data.submission) throw new Api4Error('NO_SUBMISSION', 'Select a current submitted work sample.');
  return { ...taskBinding(data), submissionId: data.submission.submissionId, contentFingerprint: data.submission.contentFingerprint };
}
export function stageContext(data: Demo, stage: Stage): { evidenceSnapshotId: string; fingerprint: string; submissionId: string | null; contentFingerprint: string | null; sources: Array<{ sourceId: string; location: string; text: string }>; assessment: AssessmentRecord | null } | null {
  if (stage === 'application_review') return { evidenceSnapshotId: data.application.evidenceSnapshotId, fingerprint: data.application.fingerprint, submissionId: null, contentFingerprint: null, sources: data.application.sources, assessment: data.assessment.application_review };
  const version = data.versions.find(v => v.submission.submissionVersion === (stage === 'task_v1' ? 1 : 2));
  if (!version) return null;
  return { evidenceSnapshotId: version.evidenceSnapshotId, fingerprint: version.submission.contentFingerprint, submissionId: version.submission.submissionId, contentFingerprint: version.submission.contentFingerprint, sources: version.submission.sources, assessment: data.assessment[stage] };
}

/** One receipt per role + backend origin. Only public DTOs are persisted, never drafts or tokens. */
export class Api4Client {
  pending: Pending | null = null;
  private running = false;
  constructor(public base: string, private storageKey: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {
    try {
      const p = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (p && writePaths.includes(p.path) && /^[a-zA-Z0-9_-]{8,100}$/.test(p.key) && p.body?.schemaVersion === '4.0' && typeof p.body.sessionId === 'string' && candidateIds.includes(p.body.candidateId) && new TextEncoder().encode(JSON.stringify(p.body)).length <= 128 * 1024) this.pending = p;
    } catch { /* Optional receipt persistence; memory works when storage is blocked. */ }
  }
  private save(value: Pending | null) {
    this.pending = value;
    try { if (value) sessionStorage.setItem(this.storageKey, JSON.stringify(value)); else sessionStorage.removeItem(this.storageKey); } catch { /* Keep the receipt in this tab. */ }
  }
  reconcile(data: Demo) {
    const p = this.pending;
    if (!p) return;
    if (p.body.schemaVersion !== data.schemaVersion || p.body.sessionId !== data.sessionId || p.body.datasetVersion !== data.datasetVersion) { this.save(null); return; }
    if (p.path !== '/analysis' || p.body.candidateId !== data.candidate.id) return;
    // A human review may settle V1 while V2 becomes current. Inspect the owned
    // immutable version rather than requiring its analysis to remain top-level.
    const version = data.versions.find(v => v.submission.candidateId === p.body.candidateId
      && v.submission.submissionId === p.body.submissionId
      && v.submission.contentFingerprint === p.body.contentFingerprint);
    const analysis = version?.analysis;
    if (analysis && (analysis.status === 'succeeded' || analysis.status === 'failed')
      && analysis.submissionId === p.body.submissionId
      && analysis.contentFingerprint === p.body.contentFingerprint) this.save(null);
  }
  private async request(path: string, init?: RequestInit): Promise<{ data: Demo | Comparison; meta: { replayed: boolean } }> {
    let response: Response;
    try { response = await this.fetcher(`${this.base}/api/demo${path}`, { ...init, headers: { ...init?.headers, 'X-EvidenceBridge-Schema-Version': '4.0' }, cache: 'no-store', signal: AbortSignal.timeout(init ? 70000 : 12000) }); }
    catch { throw new Api4Error('CONNECTION_UNCERTAIN', 'The shared service did not respond. Your input is kept. Retry an uncertain write with its original receipt.', '', Boolean(init)); }
    if (response.status === 401) throw new Api4Error('WRITE_AUTH_REQUIRED', 'The service restricted this action. Ask the host to check demo access, then retry the saved request. Your input is kept.', '', false, 401);
    let result;
    try { result = await response.json(); } catch { throw new Api4Error('INVALID_RESPONSE', 'The service returned an unreadable response. Check the API address.', '', Boolean(init), response.status); }
    if (!response.ok) {
      const error = result?.error;
      if (typeof error?.code === 'string' && typeof error?.message === 'string') throw new Api4Error(error.code, error.message, typeof error.requestId === 'string' ? error.requestId : '', Boolean(init) && response.status >= 500 && error.code === 'INTERNAL_ERROR', response.status);
      throw new Api4Error('INVALID_RESPONSE', 'Unexpected service response. Keep the original receipt for retry.', '', Boolean(init), response.status);
    }
    const d = result?.data;
    if (d?.schemaVersion !== '4.0' || typeof d.sessionId !== 'string' || !Number.isInteger(d.revision) || !d.rubric || typeof result?.meta?.replayed !== 'boolean') throw new Api4Error('SCHEMA_MISMATCH', 'This mode needs EvidenceBridge API4. Choose the matching backend; there is no automatic mock fallback.', '', Boolean(init));
    if (path === '/comparison') {
      if (!Array.isArray(d.candidates) || d.candidates.length !== 4 || new Set(d.candidates.map((row: { candidate?: { id?: string } }) => row.candidate?.id)).size !== 4 || d.candidates.some((row: { candidate?: { id?: CandidateId } }) => !row.candidate?.id || !candidateIds.includes(row.candidate.id))) throw new Api4Error('SCHEMA_MISMATCH', 'The comparison response has an invalid candidate set.');
    } else if (!candidateIds.includes(d.candidate?.id) || !Array.isArray(d.versions) || !d.workflow || !d.assessment || !d.shortlist || !Array.isArray(d.dataset?.resources)) throw new Api4Error('SCHEMA_MISMATCH', 'The selected case does not match API4.', '', Boolean(init));
    return result;
  }
  async read(candidate: CandidateId): Promise<Demo> {
    const { data } = await this.request(`?candidateId=${encodeURIComponent(candidate)}`);
    if (!('candidate' in data) || data.candidate.id !== candidate) throw new Api4Error('IDENTITY_MISMATCH', 'The response belongs to a different candidate. It was not displayed.');
    return data;
  }
  async comparison(): Promise<Comparison> { return (await this.request('/comparison')).data as Comparison; }
  async write(path: string, body: Record<string, unknown>): Promise<Envelope> {
    if (this.pending || this.running) throw new Api4Error('PENDING_ACTION', 'Resolve the original receipt before starting a new write.');
    if (!writePaths.includes(path) || body.schemaVersion !== '4.0' || !candidateIds.includes(body.candidateId as CandidateId)) throw new Api4Error('INVALID_REQUEST', 'Use an explicit API4 candidate binding.');
    if (new TextEncoder().encode(JSON.stringify(body)).length > 128 * 1024) throw new Api4Error('PAYLOAD_TOO_LARGE', 'The request exceeds 128 KiB. Shorten the public text.');
    this.save({ path, body: structuredClone(body), key: crypto.randomUUID() });
    return this.retry();
  }
  async retry(): Promise<Envelope> {
    if (this.running) throw new Api4Error('PENDING_ACTION', 'The original action is still running.');
    const p = this.pending;
    if (!p) throw new Api4Error('NO_PENDING_ACTION', 'No original action is awaiting retry.');
    this.running = true;
    try {
      const result = await this.request(p.path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': p.key }, body: JSON.stringify(p.body) }) as Envelope;
      if (result.data.candidate.id !== p.body.candidateId || result.data.sessionId !== p.body.sessionId) throw new Api4Error('IDENTITY_MISMATCH', 'The write receipt did not match the original person and session.', '', true);
      if (p.path !== '/analysis' || result.data.analysis.status !== 'running') this.save(null);
      return result;
    } catch (error) {
      if (error instanceof Api4Error && !error.uncertain && error.status !== 401 && error.code !== 'WRITE_AUTH_REQUIRED') this.save(null);
      throw error;
    } finally { this.running = false; }
  }
}
